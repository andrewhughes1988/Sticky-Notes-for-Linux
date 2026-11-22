/**
 * Main-process HTML5 allowlist sanitizer using parse5.
 * Provides defense-in-depth before persisting renderer-supplied HTML to SQLite.
 */

import { type DefaultTreeAdapterTypes, html, parseFragment } from 'parse5';

const HTML_NS = html.NS.HTML;

const ALLOWED_TAGS = new Set([
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'strike',
  'del',
  'p',
  'div',
  'br',
  'span',
  'ul',
  'ol',
  'li',
  'a',
  'input',
  'label',
]);

const VOID_TAGS = new Set(['br', 'input']);
const DROP_WITH_CONTENT_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'template',
  'noscript',
  'textarea',
  'title',
  'xmp',
  'noembed',
  'noframes',
  'plaintext',
  'head',
]);

const ALLOWED_CLASSES = new Set([
  'checklist-item',
  'checked',
  'checklist-checkbox',
  'checklist-text',
  'task-list',
  'task-item',
]);

const ALLOWED_DATA_TYPES = new Set(['taskList', 'taskItem']);
const ALLOWED_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);

export function parseSafeExternalUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 4096) return null;
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function toAttrMap(rawAttrs: Array<{ name: string; value: string }>): Map<string, string> {
  const attrs = new Map<string, string>();
  for (const attr of rawAttrs) {
    const name = attr.name.toLowerCase();
    if (!attrs.has(name)) {
      attrs.set(name, attr.value);
    }
  }
  return attrs;
}

function filterClasses(rawClass: string): string {
  const kept = rawClass.split(/\s+/).filter((token) => ALLOWED_CLASSES.has(token));
  return [...new Set(kept)].join(' ');
}

function buildSanitizedOpenTag(tag: string, attrs: Map<string, string>): string | null {
  const outAttrs: string[] = [];

  if (tag === 'input') {
    const inputType = (attrs.get('type') || '').toLowerCase();
    if (inputType !== 'checkbox') return null;
    outAttrs.push('type="checkbox"');
    const classes = filterClasses(attrs.get('class') || '');
    if (classes) outAttrs.push(`class="${escapeAttr(classes)}"`);
    if (attrs.has('checked')) outAttrs.push('checked="checked"');
    if ((attrs.get('contenteditable') || '').toLowerCase() === 'false') {
      outAttrs.push('contenteditable="false"');
    }
    return `<input ${outAttrs.join(' ')}>`;
  }

  const classes = filterClasses(attrs.get('class') || '');
  if (classes) outAttrs.push(`class="${escapeAttr(classes)}"`);

  if (tag === 'a') {
    const safeHref = parseSafeExternalUrl(attrs.get('href') || '');
    if (safeHref) {
      outAttrs.push(`href="${escapeAttr(safeHref)}"`);
      outAttrs.push('rel="noopener noreferrer"');
    }
  }

  if (tag === 'ul' || tag === 'li') {
    const dataType = attrs.get('data-type');
    if (dataType && ALLOWED_DATA_TYPES.has(dataType)) {
      outAttrs.push(`data-type="${escapeAttr(dataType)}"`);
    }
  }

  if (tag === 'li' || tag === 'div') {
    const dataChecked = (attrs.get('data-checked') || '').toLowerCase();
    if (dataChecked === 'true' || dataChecked === 'false') {
      outAttrs.push(`data-checked="${dataChecked}"`);
    }
  }

  if (tag === 'label' && (attrs.get('contenteditable') || '').toLowerCase() === 'false') {
    outAttrs.push('contenteditable="false"');
  }

  return outAttrs.length > 0 ? `<${tag} ${outAttrs.join(' ')}>` : `<${tag}>`;
}

type StackFrame =
  { kind: 'node'; node: DefaultTreeAdapterTypes.ChildNode } | { kind: 'close'; tag: string };

export function sanitizeNoteHtmlMain(rawHtml: string): string {
  if (!rawHtml) return '';

  const fragment = parseFragment(rawHtml);
  const stack: StackFrame[] = [];
  for (let i = fragment.childNodes.length - 1; i >= 0; i--) {
    stack.push({ kind: 'node', node: fragment.childNodes[i] });
  }

  const out: string[] = [];

  while (stack.length > 0) {
    const frame = stack.pop()!;
    if (frame.kind === 'close') {
      out.push(`</${frame.tag}>`);
      continue;
    }

    const { node } = frame;
    if (node.nodeName === '#text') {
      out.push(escapeText((node as DefaultTreeAdapterTypes.TextNode).value));
      continue;
    }
    if (node.nodeName === '#comment' || node.nodeName === '#documentType') {
      continue;
    }

    const element = node as DefaultTreeAdapterTypes.Element;
    const tagName = element.tagName.toLowerCase();

    if (element.namespaceURI !== HTML_NS || DROP_WITH_CONTENT_TAGS.has(tagName)) {
      continue;
    }

    const isAllowed = ALLOWED_TAGS.has(tagName);
    const isVoid = VOID_TAGS.has(tagName);

    if (isAllowed) {
      const openTag = buildSanitizedOpenTag(tagName, toAttrMap(element.attrs));
      if (openTag) {
        out.push(openTag);
        if (!isVoid) {
          stack.push({ kind: 'close', tag: tagName });
        }
      } else if (isVoid) {
        continue;
      }
    }

    if (!isVoid) {
      for (let i = element.childNodes.length - 1; i >= 0; i--) {
        stack.push({ kind: 'node', node: element.childNodes[i] });
      }
    }
  }

  return out.join('');
}
