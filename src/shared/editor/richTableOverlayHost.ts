export const getRichTableOverlayHost = (host?: HTMLElement | null) => {
  if (host) return host;
  if (typeof document === 'undefined') return null;
  return document.body;
};
