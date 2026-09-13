/* global process, console */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditZipArchive } from './firefox-package-audit.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensionOutput = path.join(root, 'apps', 'extension', '.output');

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const command = [pnpm, '--filter', '@feedsieve/extension', 'zip:firefox'];
const executable = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : pnpm;
const args = process.platform === 'win32' ? ['/d', '/s', '/c', ...command] : command.slice(1);
execFileSync(executable, args, {
  cwd: root,
  stdio: 'inherit',
});

const manifestPath = path.join(extensionOutput, 'firefox-mv3', 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

function fail(message) {
  throw new Error(`Firefox package audit failed: ${message}`);
}

if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
if (JSON.stringify(manifest.permissions ?? []) !== JSON.stringify(['storage']))
  fail('Chrome-only permissions leaked into Firefox build');
if (manifest.side_panel) fail('side_panel must not be present');
if (manifest.sidebar_action?.default_panel !== 'popup.html')
  fail('sidebar_action.default_panel must be popup.html');
if (manifest.sidebar_action?.open_at_install !== false)
  fail('sidebar_action.open_at_install must be false');
if (manifest.browser_specific_settings?.gecko?.id !== '@feedsieve-firefox')
  fail('Firefox extension ID is missing');
if (!manifest.browser_specific_settings?.gecko?.data_collection_permissions)
  fail('Firefox data collection permissions are missing');
if (
  JSON.stringify(manifest.host_permissions ?? []) !==
  JSON.stringify(['https://x.com/*', 'https://api.feedsieve.win/*'])
)
  fail('host permissions are not the production Firefox allowlist');
if (
  !Array.isArray(manifest.background?.scripts) ||
  !manifest.background.scripts.includes('background.js')
)
  fail('Firefox background scripts are missing');

const zipName = `feedsieve-${manifest.version}-firefox.zip`;
const zipPath = path.join(extensionOutput, zipName);
const sourcesZipName = `feedsieve-${manifest.version}-sources.zip`;
const sourcesZipPath = path.join(extensionOutput, sourcesZipName);
if (!existsSync(zipPath)) fail(`Firefox ZIP is missing: ${zipName}`);
if (!existsSync(sourcesZipPath)) fail(`sources ZIP is missing: ${sourcesZipName}`);

try {
  const runtimeEntries = auditZipArchive(zipPath, manifest);
  const sourceEntries = auditZipArchive(sourcesZipPath);
  console.log(`Firefox archive audited: ${zipName} (${runtimeEntries.length} files)`);
  console.log(`Firefox sources archive audited: ${sourcesZipName} (${sourceEntries.length} files)`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const checksum = createHash('sha256').update(readFileSync(zipPath)).digest('hex');
const checksumPath = `${zipPath}.sha256`;
writeFileSync(checksumPath, `${checksum}  ${zipName}\n`);

console.log(`Firefox package audited: ${zipName}`);
console.log(`SHA-256: ${checksum}`);
