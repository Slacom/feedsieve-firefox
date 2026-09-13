import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const commands = [
  ['lint'],
  ['keyword-packs:check'],
  ['typecheck'],
  ['test'],
  ['build:extension'],
  ['pack:firefox'],
  ['--filter', '@feedsieve/community-api', 'test'],
];

function run(args) {
  if (process.platform === 'win32') {
    execFileSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', pnpm, ...args], {
      cwd: root,
      stdio: 'inherit',
    });
    return;
  }
  execFileSync(pnpm, args, { cwd: root, stdio: 'inherit' });
}

for (const args of commands) {
  console.log(`==> pnpm ${args.join(' ')}`);
  run(args);
}

console.log('==> all checks passed');
