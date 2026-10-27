#!/usr/bin/env node
// Stop hook. Warns at the end of a turn if this repo has uncommitted changes. Informational only.

import { spawnSync } from 'node:child_process';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const r = spawnSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' });

if (r.status === 0 && r.stdout.trim()) {
  const n = r.stdout.trim().split('\n').length;
  process.stdout.write(JSON.stringify({ systemMessage: `Uncommitted changes: ${n} file(s). Run git status to review.` }));
}
process.exit(0);
