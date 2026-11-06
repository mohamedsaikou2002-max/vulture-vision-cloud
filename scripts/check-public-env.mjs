import { loadEnv } from 'vite';
import { publicEnvironmentErrors } from './public-env.mjs';
const errors = publicEnvironmentErrors(loadEnv('production', process.cwd(), 'VITE_'));
if (errors.length) {
  console.error('Frontend deployment configuration is incomplete:\n' + errors.map(error => '- ' + error).join('\n'));
  process.exitCode = 1;
} else console.log('Public frontend configuration validated. No secret values were printed.');
