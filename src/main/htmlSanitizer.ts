/**
 * Pure TypeScript, zero-DOM main-process HTML allowlist sanitizer.
 * Provides defense-in-depth before persisting renderer-supplied HTML to SQLite.
 */

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

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : '';
    })
    .replace(/&#(\d+);?/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : '';
    })
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

function parseAttributes(rawAttrString: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const attrRegex = /([^\s"'=<>`/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(rawAttrString)) !== null) {
    const name = match[1].toLowerCase();
    const rawValue = match[2] ?? match[3] ?? match[4] ?? '';
    attrs.set(name, decodeHtmlEntities(rawValue));
  }
  return attrs;
}

function filterClasses(rawClass: string): string {
  const kept = rawClass
    .split(/\s+/)
    .filter((token) => ALLOWED_CLASSES.has(token));
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

export function sanitizeNoteHtmlMain(rawHtml: string): string {
  if (!rawHtml) return '';

  // Remove HTML comments first
  const withoutComments = rawHtml.replace(/<!--[\s\S]*?-->/g, '');
  let result = '';
  let index = 0;
  let skippingTag: string | null = null;
  let skippingDepth = 0;
  const openStack: string[] = [];

  while (index < withoutComments.length) {
    const lt = withoutComments.indexOf('<', index);
    if (lt === -1) {
      if (!skippingTag) result += withoutComments.slice(index);
      break;
    }

    if (lt > index && !skippingTag) {
      result += withoutComments.slice(index, lt);
    }

    const gt = withoutComments.indexOf('>', lt + 1);
    if (gt === -1) {
      // Unterminated tag — escape safely as text
      if (!skippingTag) result += '&lt;' + withoutComments.slice(lt + 1);
      break;
    }

    const rawTagBody = withoutComments.slice(lt + 1, gt).trim();
    index = gt + 1;

    if (!rawTagBody) continue;

    const isClosing = rawTagBody.startsWith('/');
    const tagMatch = /^\/?\s*([a-zA-Z][a-zA-Z0-9:-]*)(?:\s+([\s\S]*))?$/.exec(rawTagBody);
    if (!tagMatch) continue;

    const tagName = tagMatch[1].toLowerCase();
    const attrPart = (tagMatch[2] || '').replace(/\/\s*$/, '').trim();

    if (skippingTag) {
      if (tagName === skippingTag) {
        if (isClosing) {
          skippingDepth--;
          if (skippingDepth <= 0) {
            skippingTag = null;
            skippingDepth = 0;
          }
        } else if (!rawTagBody.endsWith('/')) {
          skippingDepth++;
        }
      }
      continue;
    }

    if (!isClosing && DROP_WITH_CONTENT_TAGS.has(tagName)) {
      if (!rawTagBody.endsWith('/')) {
        skippingTag = tagName;
        skippingDepth = 1;
      }
      continue;
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      continue;
    }

    if (isClosing) {
      if (VOID_TAGS.has(tagName)) continue;
      const stackIdx = openStack.lastIndexOf(tagName);
      if (stackIdx !== -1) {
        while (openStack.length > stackIdx) {
          const popped = openStack.pop()!;
          result += `</${popped}>`;
        }
      }
      continue;
    }

    const attrs = parseAttributes(attrPart);
    const sanitizedTag = buildSanitizedOpenTag(tagName, attrs);
    if (!sanitizedTag) continue;

    result += sanitizedTag;
    if (!VOID_TAGS.has(tagName)) {
      openStack.push(tagName);
    }
  }

  while (openStack.length > 0) {
    result += `</${openStack.pop()!}>`;
  }

  return result;
}
