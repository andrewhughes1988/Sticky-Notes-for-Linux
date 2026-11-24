import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { setTimeout } from 'node:timers';
async function run(cwd) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-memory-'));
  const app = await electron.launch({
    cwd,
    args: ['--ozone-platform=x11', '.'],
    env: {
      ...process.env,
      XDG_DATA_HOME: path.join(root, 'data'),
      XDG_CONFIG_HOME: path.join(root, 'config'),
      XDG_STATE_HOME: path.join(root, 'state'),
    },
  });
  try {
    let page = await app.firstWindow();
    await page.getByRole('textbox', { name: 'Note text' }).waitFor();
    for (let i = 1; i < 5; i++) {
      const next = app.waitForEvent('window');
      await page.keyboard.press('Control+n');
      page = await next;
      await page.getByRole('textbox', { name: 'Note text' }).waitFor();
    }
    await new Promise((r) => setTimeout(r, 1000));
    const pids = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map((w) => w.webContents.getOSProcessId())
    );
    if (pids.length !== 5) throw Error('Expected five notes');
    const unique = [...new Set(pids)];
    const memory = unique.map((pid) => {
      let data = fs.readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8');
      let val = data.match(/^Pss:\s+(\d+)/m);
      if (!val) throw Error('Missing PSS');
      return +val[1];
    });
    return { renderers: unique.length, pssKiB: memory.reduce((a, b) => a + b, 0) };
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}
const [baseline, pooled] = process.argv.slice(2);
if (!baseline || !pooled)
  throw new Error('Usage: node benchmarks/renderer-memory.mjs BASELINE_DIR POOLED_DIR');
(async () => {
  for (let i = 0; i < 5; i++)
    for (const [label, cwd] of [
      ['baseline', baseline],
      ['pooled', pooled],
    ])
      console.log(JSON.stringify({ iteration: i, label, ...(await run(cwd)) }));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
