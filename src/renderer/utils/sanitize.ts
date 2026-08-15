import DOMPurify from 'dompurify';

export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del',
      'p', 'div', 'br', 'span',
      'ul', 'ol', 'li',
      'a', 'input', 'label'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'type', 'checked', 'data-checked'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });
}
