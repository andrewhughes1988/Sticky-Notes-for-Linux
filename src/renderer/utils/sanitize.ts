import DOMPurify from 'dompurify';

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

let hookRegistered = false;

function ensureDomPurifyHooks(): void {
  if (hookRegistered) return;
  hookRegistered = true;

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    // Restrict class names strictly to known checklist/task-list classes (prevents UI class spoofing)
    if (el.hasAttribute('class')) {
      const kept = (el.getAttribute('class') || '')
        .split(/\s+/)
        .filter((cls) => ALLOWED_CLASSES.has(cls));
      if (kept.length > 0) {
        el.setAttribute('class', [...new Set(kept)].join(' '));
      } else {
        el.removeAttribute('class');
      }
    }

    // Only allow checkbox <input> elements; strip all other input types (file, password, image, etc.)
    if (tag === 'input') {
      if ((el.getAttribute('type') || '').toLowerCase() !== 'checkbox') {
        el.remove();
        return;
      }
      el.setAttribute('type', 'checkbox');
    }

    // Allow contenteditable="false" only on checkboxes and their wrapper labels
    if (el.hasAttribute('contenteditable')) {
      if (
        (tag === 'input' || tag === 'label') &&
        (el.getAttribute('contenteditable') || '').toLowerCase() === 'false'
      ) {
        el.setAttribute('contenteditable', 'false');
      } else {
        el.removeAttribute('contenteditable');
      }
    }

    // Strictly validate data-type and data-checked for Tiptap TaskList / TaskItem
    if (el.hasAttribute('data-type')) {
      const dataType = el.getAttribute('data-type') || '';
      if ((tag !== 'ul' && tag !== 'li') || !ALLOWED_DATA_TYPES.has(dataType)) {
        el.removeAttribute('data-type');
      }
    }

    if (el.hasAttribute('data-checked')) {
      const val = (el.getAttribute('data-checked') || '').toLowerCase();
      if ((tag !== 'li' && tag !== 'div') || (val !== 'true' && val !== 'false')) {
        el.removeAttribute('data-checked');
      } else {
        el.setAttribute('data-checked', val);
      }
    }

    // Enforce safe external link protocols and rel="noopener noreferrer"
    if (tag === 'a') {
      const rawHref = (el.getAttribute('href') || '').trim();
      let safeHref: string | null = null;
      if (rawHref && rawHref.length <= 4096) {
        try {
          const parsed = new URL(rawHref);
          if (ALLOWED_PROTOCOLS.has(parsed.protocol)) {
            safeHref = parsed.href;
          }
        } catch {
          safeHref = null;
        }
      }
      if (safeHref) {
        el.setAttribute('href', safeHref);
        el.setAttribute('rel', 'noopener noreferrer');
        el.removeAttribute('target');
      } else {
        el.removeAttribute('href');
        el.removeAttribute('rel');
        el.removeAttribute('target');
      }
    }
  });
}

export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  ensureDomPurifyHooks();
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
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
    ],
    ALLOWED_ATTR: [
      'href',
      'rel',
      'class',
      'type',
      'checked',
      'data-type',
      'data-checked',
      'contenteditable',
    ],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Converts legacy `<div class="checklist-item">` rows (v1.0–v1.1) into Tiptap's
 * `<ul data-type="taskList"><li data-type="taskItem" data-checked="...">` format
 * while leaving all other HTML untouched.
 */
export function upgradeLegacyChecklistHtml(rawHtml: string): string {
  const sanitized = sanitizeHtml(rawHtml);
  if (!sanitized || !sanitized.includes('checklist-item')) return sanitized;

  if (typeof DOMParser === 'undefined') return sanitized;
  const doc = new DOMParser().parseFromString(sanitized, 'text/html');
  const body = doc.body;
  const children = Array.from(body.childNodes);
  let activeTaskList: HTMLUListElement | null = null;

  for (const child of children) {
    const isLegacyChecklist =
      child.nodeType === 1 && (child as Element).classList.contains('checklist-item');
    if (isLegacyChecklist) {
      const el = child as HTMLElement;
      const checkbox = el.querySelector<HTMLInputElement>('input[type="checkbox"]');
      const checked = el.classList.contains('checked') || Boolean(checkbox?.hasAttribute('checked'));
      const textSpan = el.querySelector('.checklist-text') || el.querySelector('span');

      if (!activeTaskList) {
        activeTaskList = doc.createElement('ul');
        activeTaskList.setAttribute('data-type', 'taskList');
        body.insertBefore(activeTaskList, el);
      }

      const li = doc.createElement('li');
      li.setAttribute('data-type', 'taskItem');
      li.setAttribute('data-checked', checked ? 'true' : 'false');

      const p = doc.createElement('p');
      if (textSpan) {
        const cleaned = textSpan.innerHTML.replace(/^(&nbsp;|\u00a0)+$/, '').trim();
        p.innerHTML = cleaned;
      } else {
        p.textContent = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
      }
      li.appendChild(p);
      activeTaskList.appendChild(li);
      el.remove();
    } else {
      activeTaskList = null;
    }
  }

  return body.innerHTML;
}
