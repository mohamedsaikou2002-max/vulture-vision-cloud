/** Preserve useful server errors (especially operator access), without exposing provider responses. */
export async function functionError(error: { message?: string; context?: Response }, fallback: string): Promise<string> {
  const response = error.context;
  if (response?.status === 403) return 'This feature requires operator access. Ask your workspace administrator to enable your account.';
  if (response?.status === 401) return 'Your session has expired. Sign in again.';
  if (response && typeof response.clone === 'function') {
    try { const body = await response.clone().json(); if (typeof body?.error === 'string') return body.error; } catch { /* Use the safe fallback. */ }
  }
  return fallback;
}
