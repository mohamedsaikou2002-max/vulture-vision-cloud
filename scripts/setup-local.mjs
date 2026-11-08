import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const target = resolve(root, '.env.local');
const template = resolve(root, '.env.example');
if (!existsSync(template)) {
  console.error('Run this command from the Vulture Vision repository root.');
  process.exit(1);
}
const version = process.versions.node.split('.').map(Number);
if (version[0] < 22 || (version[0] === 22 && version[1] < 12)) {
  console.error('Vulture Vision requires Node.js 22.12 or newer. Install Node 22 LTS, then rerun.');
  process.exit(1);
}
if (!existsSync(target)) {
  copyFileSync(template, target, 0x80);
  console.log('Created .env.local from .env.example. This local file is ignored by Git.');
} else {
  console.log('.env.local already exists; no values were overwritten.');
}
const content = readFileSync(target, 'utf8');
if (/your-project-ref|your-supabase-publishable-key/.test(content)) {
  console.log('NEXT: Open .env.local in VS Code and replace the Supabase URL and PUBLIC publishable key.');
}
console.log('Never put Stripe secrets, Supabase service-role keys, or AI API keys in VITE_ variables.');
console.log('Then run: npm ci; npm run doctor:local; npm run dev');
