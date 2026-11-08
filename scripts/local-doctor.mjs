import { existsSync, readFileSync } from 'node:fs';
import { loadEnv } from 'vite';
import { publicEnvironmentErrors } from './public-env.mjs';

const offline = process.argv.includes('--offline');
const issues = [];
const warnings = [];
const version = process.versions.node.split('.').map(Number);
if (version[0] < 22 || (version[0] === 22 && version[1] < 12)) issues.push('Node.js 22.12 or newer is required.');
if (!existsSync('.env.local') && !process.env.VITE_SUPABASE_URL) issues.push('Missing .env.local. Run npm run setup:local.');
const env = loadEnv('development', process.cwd(), 'VITE_');
issues.push(...publicEnvironmentErrors(env));
let linkedProject;
if (existsSync('supabase/config.toml')) {
  linkedProject = readFileSync('supabase/config.toml', 'utf8').match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
}
const url = env.VITE_SUPABASE_URL || '';
const project = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(url)?.[1];
if (project && linkedProject && project !== linkedProject) {
  warnings.push('Frontend project reference differs from supabase/config.toml; verify intended backend before deploying functions or migrations.');
}
if (!offline && issues.length === 0) {
  try {
    const r = await fetch(url.replace(/\/$/, '') + '/auth/v1/health', { signal: AbortSignal.timeout(8000) });
    if (!r.ok) issues.push('Supabase Auth health check returned HTTP ' + r.status + '.');
    else console.log('PASS: Supabase Auth endpoint responded successfully.');
  } catch {
    issues.push('Supabase Auth endpoint unreachable from this computer. Confirm project is active, URL, VPN and network.');
  }
}
for (const warning of warnings) console.log('WARNING: ' + warning);
for (const issue of issues) console.error('BLOCKED: ' + issue);
if (issues.length) {
  console.error('Correct the configuration and rerun npm run doctor:local.');
  process.exitCode = 1;
} else {
  console.log('PASS: Local runtime and browser configuration validated.' + (offline ? ' Network test skipped.' : ''));
  console.log('NEXT: npm run dev. For live feature checks: npm run check:backend -- --ai');
}
