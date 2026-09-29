import { io } from 'socket.io-client';
import { API_ORIGIN } from '../config/api.js';

/**
 * Realtime chat connection for the web admin.
 *
 * Connects to the same socket.io server the two apps use, authenticated with the
 * staff token. The server puts anyone holding `support.chat` in the `support`
 * room, which receives every dealer's messages — that is what the back-office
 * screen is for.
 *
 * This replaced a 20s `setInterval`, which was the slowest of the three surfaces:
 * a dealer could reply and the support desk would not see it for twenty seconds.
 *
 * DEGRADATION
 *   The support screen keeps a slow poll as a fallback, so if the socket cannot
 *   connect — a corporate proxy blocking upgrades, say — the desk still refreshes
 *   on its own rather than sitting stale.
 */

let socket = null;
const listeners = new Set();
// Tracking updates are kept in their own set. A chat screen and the monitoring board
// can be open at once, and neither should have to filter the other's traffic.
const trackingListeners = new Set();

const notify = (message) => {
  listeners.forEach((listener) => {
    try {
      listener(message);
    } catch {
      // One bad listener must not take down delivery for the others.
    }
  });
};

const notifyTracking = (update) => {
  trackingListeners.forEach((listener) => {
    try {
      listener(update);
    } catch {
      // Same reasoning as above.
    }
  });
};

/** Open the connection if it is not already open. Safe to call repeatedly. */
export const startRealtime = () => {
  if (socket) return socket;

  const token = localStorage.getItem('bdmtiles_token');
  if (!token) return null;

  socket = io(API_ORIGIN, {
    auth: { token },
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  });

  socket.on('message:new', notify);
  socket.on('tracking:update', notifyTracking);
  socket.on('connect_error', (error) => {
    // A rejected handshake means the token is no longer valid. AuthContext already
    // handles sign-out on 401, so stop retrying rather than hammering the server.
    if (/unauthorized/i.test(error?.message || '')) {
      socket?.disconnect();
      socket = null;
    }
  });

  return socket;
};

/**
 * Listen for newly created messages.
 * @returns {() => void} unsubscribe
 */
export const subscribeToMessages = (handler) => {
  listeners.add(handler);
  startRealtime();
  return () => { listeners.delete(handler); };
};

/**
 * Listen for field-tracking updates.
 *
 * The server only sends these to holders of `se.attendance.view`, and only for the
 * branches they are assigned to — so an unauthorised screen receives nothing to
 * filter out.
 *
 * @returns {() => void} unsubscribe
 */
export const subscribeToTracking = (handler) => {
  trackingListeners.add(handler);
  startRealtime();
  return () => { trackingListeners.delete(handler); };
};

/** Close the connection and drop every listener. Used on sign-out. */
export const stopRealtime = () => {
  listeners.clear();
  trackingListeners.clear();
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

/** For diagnostics only. */
export const isRealtimeConnected = () => Boolean(socket?.connected);
