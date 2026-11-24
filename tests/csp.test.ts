import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { NOTE_COLORS, NoteColor } from '../src/shared/types';

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

test('renderer components contain no inline style props or runtime style injection and Tiptap disables injectCSS', () => {
  const forbiddenPatterns: Array<{ label: string; regex: RegExp }> = [
    { label: 'inline JSX style prop (style={)', regex: /\bstyle=\{/ },
    { label: 'inline HTML style attribute (style=")', regex: /\bstyle="/ },
    { label: 'direct DOM style mutation (.style.)', regex: /\.style\./ },
    { label: "setAttribute('style', ...)", regex: /setAttribute\(\s*['"]style['"]/ },
    { label: "createElement('style')", regex: /createElement\(\s*['"]style['"]\s*\)/ },
  ];

  const rendererDir = path.join(ROOT, 'src', 'renderer');
  for (const filePath of getAllFiles(rendererDir)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const rel = path.relative(ROOT, filePath);
    for (const { label, regex } of forbiddenPatterns) {
      assert.ok(!regex.test(content), `Unexpected ${label} found in ${rel}`);
    }
  }

  const richEditor = readText('src/renderer/components/RichEditor.tsx');
  assert.match(richEditor, /injectCSS:\s*false/);
});

test('NOTE_COLORS in types.ts matches CSS themes and color swatches in index.css', () => {
  const css = readText('src/renderer/styles/index.css');

  for (const colorKey of Object.keys(NOTE_COLORS) as NoteColor[]) {
    const theme = NOTE_COLORS[colorKey];
    const themeBlockRegex = new RegExp(
      `:where\\(\\.note-container,\\s*\\.note-card\\)\\[data-color=["']${colorKey}["']\\]\\s*\\{([^}]*)\\}`,
      'i'
    );
    const themeMatch = css.match(themeBlockRegex);
    assert.ok(themeMatch, `Missing CSS theme block for data-color="${colorKey}"`);
    const block = themeMatch[1];

    assert.match(
      block,
      new RegExp(`--theme-body:\\s*${theme.body};`, 'i'),
      `Mismatch for --theme-body in ${colorKey}`
    );
    assert.match(
      block,
      new RegExp(`--theme-header:\\s*${theme.header};`, 'i'),
      `Mismatch for --theme-header in ${colorKey}`
    );

    const swatchRegex = new RegExp(
      `\\.color-swatch\\[data-color=["']${colorKey}["']\\]\\s*\\{\\s*background-color:\\s*${theme.dotColor};\\s*\\}`,
      'i'
    );
    assert.match(css, swatchRegex, `Missing or mismatched .color-swatch for ${colorKey}`);
  }
});
