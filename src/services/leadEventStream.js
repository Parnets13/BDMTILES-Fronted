import { API_ABSOLUTE_BASE_URL, refreshAccessToken } from '../config/api.js';

const parseEventBlock = (block) => {
  let event = 'message';
  const data = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) data.push(line.slice(5).trim());
  }
  if (!data.length) return null;
  try { return { event, data: JSON.parse(data.join('\n')) }; }
  catch { return null; }
};

export const subscribeToLeadEvents = ({ onEvent, onStateChange }) => {
  const controller = new AbortController();

  const connect = async (retryAuth = true) => {
    try {
      const token = localStorage.getItem('bdmtiles_token');
      const branchId = localStorage.getItem('bdmtiles_active_branch');
      // Deliberately the ABSOLUTE base, not the same-origin one: this response is a
      // long-lived stream, and an edge proxy (the Netlify /api/* redirect) may buffer
      // it, which would silently downgrade live lead updates to the fallback poll.
      // It authenticates with the bearer header below, so cross-site is fine.
      const response = await fetch(`${API_ABSOLUTE_BASE_URL}/leads/events`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(branchId ? { 'X-Branch-Id': branchId } : {}),
        },
        signal: controller.signal,
      });
      if (response.status === 401 && retryAuth) {
        await refreshAccessToken();
        return connect(false);
      }
      if (!response.ok || !response.body) throw new Error(`Lead event stream unavailable (${response.status})`);
      onStateChange?.('connected');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!controller.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        let boundary = buffer.indexOf('\n\n');
        while (boundary >= 0) {
          const parsed = parseEventBlock(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          if (parsed) onEvent?.(parsed);
          boundary = buffer.indexOf('\n\n');
        }
      }
      if (!controller.signal.aborted) onStateChange?.('disconnected');
    } catch (error) {
      if (!controller.signal.aborted) onStateChange?.('disconnected', error);
    }
  };

  connect();
  return () => controller.abort();
};

export default subscribeToLeadEvents;
