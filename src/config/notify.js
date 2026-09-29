// ═══════════════════════════════════════════════════════════════
// Notification bridge
// antd v5 + React 19: static notification.error() called from a plain
// module (like the axios interceptor) does NOT pick up the app's React
// context and often fails to render. Instead we hold a reference to the
// real notification API instance created via App.useApp() inside a
// component, and route all non-component notifications through it.
// A queue buffers any notifications fired before the app has mounted.
// ═══════════════════════════════════════════════════════════════

let apiRef = null;
const queue = [];

export const setNotificationApi = (instance) => {
  apiRef = instance;
  // Flush anything queued before the app mounted.
  while (queue.length) {
    const args = queue.shift();
    try { apiRef.error(args); } catch { /* ignore */ }
  }
};

export const notifyError = (config) => {
  if (apiRef) {
    apiRef.error(config);
  } else {
    queue.push(config);
  }
};

export const notifySuccess = (config) => {
  if (apiRef) apiRef.success(config);
};
