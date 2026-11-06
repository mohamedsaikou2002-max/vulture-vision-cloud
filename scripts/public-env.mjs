/** Validate browser-visible configuration without logging any credential value. */
export function publicEnvironmentErrors(env) {
  const problems = [];
  const projectUrl = env.VITE_SUPABASE_URL?.trim();
  try {
    const url = new URL(projectUrl || '');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || /your-project|example\.com/.test(url.hostname)) throw new Error();
    if (env.VITE_SUPABASE_PROJECT_ID && url.hostname.endsWith('.supabase.co') && url.hostname !== `${env.VITE_SUPABASE_PROJECT_ID}.supabase.co`) problems.push('VITE_SUPABASE_PROJECT_ID does not match VITE_SUPABASE_URL.');
  } catch { problems.push('Set VITE_SUPABASE_URL to the production Supabase HTTPS origin.'); }
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || '';
  if (!key || /your-|placeholder/.test(key)) problems.push('Set VITE_SUPABASE_PUBLISHABLE_KEY to the public project key.');
  else if (key.startsWith('sb_secret_')) problems.push('A server secret cannot be used as VITE_SUPABASE_PUBLISHABLE_KEY.');
  else if (!key.startsWith('sb_publishable_')) {
    try {
      const parts = key.split('.');
      if (parts.length !== 3 || JSON.parse(Buffer.from(parts[1], 'base64url').toString()).role !== 'anon') throw new Error();
    } catch { problems.push('VITE_SUPABASE_PUBLISHABLE_KEY must be a publishable key or legacy anon JWT, never service-role credentials.'); }
  }
  for (const name of Object.keys(env)) {
    if (/^VITE_/i.test(name) && /SERVICE_ROLE|SECRET|(?:GEMINI|GOOGLE|STRIPE|LOVABLE).*KEY|DB_PASSWORD|WORKER_TOKEN/i.test(name) && env[name]) problems.push(`${name} is server-only configuration; remove it from the frontend environment.`);
  }
  if (env.VITE_VOICE_HOST) {
    try { const url = new URL(env.VITE_VOICE_HOST); if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error(); }
    catch { problems.push('VITE_VOICE_HOST must be an HTTPS origin, or unset to use browser speech.'); }
  }
  if (env.VITE_BACKGROUND_VIDEO_URL) {
    try { const url = new URL(env.VITE_BACKGROUND_VIDEO_URL, 'https://local.invalid'); if (url.protocol !== 'https:' || url.username || url.password || !/^(?:https:\/\/|\/(?!\/))/.test(env.VITE_BACKGROUND_VIDEO_URL)) throw new Error(); }
    catch { problems.push('VITE_BACKGROUND_VIDEO_URL must be an HTTPS URL or a local absolute asset path.'); }
  }
  return problems;
}
