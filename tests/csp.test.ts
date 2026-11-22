import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT = path.resolve(__dirname, '..');

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function getAllFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

test('production index.html CSP disallows unsafe-inline in style-src', () => {
  const html = readText('index.html');
  assert.match(html, /style-src\s+'self';/);
  assert.ok(!/style-src[^;]*'unsafe-inline'/.test(html));
});

test('renderer components contain no inline style props and Tiptap disables injectCSS', () => {
  const rendererDir = path.join(ROOT, 'src', 'renderer');
  for (const filePath of getAllFiles(rendererDir)) {
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(
      !/\bstyle=\{/.test(content),
      `Unexpected inline style prop found in ${path.relative(ROOT, filePath)}`
    );
  }

  const richEditor = readText('src/renderer/components/RichEditor.tsx');
  assert.match(richEditor, /injectCSS:\s*false/);
});
