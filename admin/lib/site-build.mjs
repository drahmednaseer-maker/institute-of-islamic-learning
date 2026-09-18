/* Rebuilding the public website after an edit in the backend.

   It runs in a child process because the parent has already imported the old
   figures, and an ES module cannot be un-imported. It builds into a staging
   folder and swaps that in, so visitors never meet a half-built site. */
import { rmSync, existsSync, renameSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STAGE = 'dist.next', OLD = 'dist.old';

export const rebuildSite = () => new Promise((resolve) => {
  const child = spawn(process.execPath, [join(ROOT, 'build.mjs')], {
    cwd: ROOT, env: { ...process.env, OUT_DIR: STAGE },
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  child.on('error', (e) => resolve({ ok: false, log: e.message }));
  child.on('close', (code) => {
    if (code !== 0) { rmSync(join(ROOT, STAGE), { recursive: true, force: true }); return resolve({ ok: false, log: out.trim() }); }
    try {
      rmSync(join(ROOT, OLD), { recursive: true, force: true });
      if (existsSync(join(ROOT, 'dist'))) renameSync(join(ROOT, 'dist'), join(ROOT, OLD));
      renameSync(join(ROOT, STAGE), join(ROOT, 'dist'));
      rmSync(join(ROOT, OLD), { recursive: true, force: true });
      return resolve({ ok: true, log: out.trim() });
    } catch (e) { return resolve({ ok: false, log: `${out.trim()}\n${e.message}` }); }
  });
});
