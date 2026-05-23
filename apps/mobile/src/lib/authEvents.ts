type UnauthorizedListener = () => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();

export function emitUnauthorized() {
  unauthorizedListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Listener failures should not break auth fanout
    }
  });
}

export function subscribeUnauthorized(listener: UnauthorizedListener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}
