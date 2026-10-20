/** Never silently point a deployed application at the viewer's own computer. */
export function backendOrigin(configured: string | undefined, development: boolean, localPort: number, secure: boolean) {
  const value = configured?.trim() || (development ? `localhost:${localPort}` : '');
  if (!value) return null;
  try {
    const url = new URL(value.includes('://') ? value : `${secure ? 'https' : 'http'}://${value}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    if (secure && url.protocol !== 'https:') return null;
    return url.origin;
  } catch { return null; }
}
