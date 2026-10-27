#!/usr/bin/env node
// PreToolUse hook (matcher: Bash|PowerShell). Gates `git push` on a build of the repo
// being pushed. Exit 2 blocks the push and shows the failure to Claude.
// Multi-repo aware: resolves the target repo from `git -C <dir>`, a leading `cd <dir>`,
// or the hook's cwd. .NET repos → dotnet build; Angular repos → ng build (development).

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

let raw = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) raw += chunk;

let payload = {};
try { payload = JSON.parse(raw); } catch { process.exit(0); }
const cmd = payload?.tool_input?.command ?? '';

// Only real `git push` subcommands count — not the words "git push" inside a quoted string.
// Quoted spans become numbered placeholders so `git -C "dir with spaces" push` still resolves.
const quoted = [];
const masked = cmd.replace(/"[^"]*"|'[^']*'/g, m => `\u0000${quoted.push(m.slice(1, -1)) - 1}\u0000`);
const unmask = s => s.replace(/\u0000(\d+)\u0000/g, (_, i) => quoted[Number(i)]);
const segments = masked.split(/&&|\|\||[;|\n]/).map(s => s.trim());
const pushSeg = segments.find(s => /^git\s+(?:-C\s+\S+\s+)?push\b/.test(s));
if (!pushSeg || /--dry-run\b/.test(pushSeg)) process.exit(0);

const baseDir = payload.cwd || process.cwd();
let target = baseDir;
const gitC = pushSeg.match(/^git\s+-C\s+(\S+)/);
const cdSeg = segments.slice(0, segments.indexOf(pushSeg)).reverse()
  .find(s => /^(?:cd|Set-Location)\s+\S/i.test(s));
if (gitC) target = path.resolve(baseDir, unmask(gitC[1]));
else if (cdSeg) target = path.resolve(baseDir, unmask(cdSeg.replace(/^(?:cd|Set-Location)\s+/i, '')));

const top = spawnSync('git', ['-C', target, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
if (top.status !== 0) process.exit(0); // not a repo — let git report the error itself
const root = top.stdout.trim();

function findSln(dir) {
  const sln = readdirSync(dir).find(f => f.endsWith('.sln') || f.endsWith('.slnx'));
  return sln ? path.join(dir, sln) : null;
}

let check;
const sln = findSln(root);
if (sln) {
  // dotnet is a real .exe: no shell, so a path with spaces stays one argument.
  check = { label: 'dotnet build', exe: 'dotnet', args: ['build', sln, '--nologo', '-v', 'q'], shell: false };
} else if (existsSync(path.join(root, 'angular.json'))) {
  // npx is a .cmd shim on Windows and needs a shell; its args contain no spaces.
  check = { label: 'ng build (development)', exe: 'npx', args: ['ng', 'build', '--configuration', 'development'],
    shell: process.platform === 'win32' };
} else {
  process.exit(0);
}

process.stderr.write(`→ pre-push gate (${path.basename(root)}): ${check.label}\n`);
const r = spawnSync(check.exe, check.args, {
  cwd: root,
  encoding: 'utf8',
  shell: check.shell,
});

if (r.status !== 0) {
  const tail = ((r.stdout || '') + (r.stderr || '')).split('\n').slice(-30).join('\n');
  process.stderr.write(`❌ ${check.label} failed in ${path.basename(root)} — push blocked.\n${tail}\n` +
    'Fix the build and push again. Do NOT bypass with --no-verify.\n');
  process.exit(2);
}

process.stderr.write(`✓ ${check.label} passed\n`);
process.exit(0);
