let source = null;
const listeners = {};
let retryTimer = null;

function connect() {
  if (source) return;
  clearTimeout(retryTimer);

  source = new EventSource('/api/sse/events');

  source.onerror = () => {
    source.close();
    source = null;
    retryTimer = setTimeout(connect, 3000);
  };

  Object.entries(listeners).forEach(([event, handlers]) => {
    handlers.forEach(h => source.addEventListener(event, h));
  });
}

function disconnect() {
  clearTimeout(retryTimer);
  if (source) {
    source.close();
    source = null;
  }
}

function on(event, handler) {
  if (!listeners[event]) listeners[event] = [];
  if (!listeners[event].includes(handler)) {
    listeners[event].push(handler);
    if (source) source.addEventListener(event, handler);
  }
  return () => off(event, handler);
}

function off(event, handler) {
  if (listeners[event]) {
    listeners[event] = listeners[event].filter(h => h !== handler);
  }
  if (source) source.removeEventListener(event, handler);
}

export const sseService = { connect, disconnect, on, off };
