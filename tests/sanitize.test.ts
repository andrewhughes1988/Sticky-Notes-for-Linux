import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { parseSafeExternalUrl, sanitizeNoteHtmlMain } from '../src/main/htmlSanitizer';

test('parseSafeExternalUrl allows only http, https, and mailto without control characters', () => {
  assert.equal(parseSafeExternalUrl('https://example.com/path?a=1'), 'https://example.com/path?a=1');
  assert.equal(parseSafeExternalUrl('http://example.com'), 'http://example.com/');
  assert.equal(parseSafeExternalUrl('mailto:user@example.com'), 'mailto:user@example.com');

  assert.equal(parseSafeExternalUrl('javascript:alert(1)'), null);
  assert.equal(parseSafeExternalUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(parseSafeExternalUrl('file:///etc/passwd'), null);
  assert.equal(parseSafeExternalUrl('ftp://example.com/file'), null);
  assert.equal(parseSafeExternalUrl('https://example.com/\nfoo'), null);
  assert.equal(parseSafeExternalUrl(''), null);
});

test('sanitizeNoteHtmlMain strips XSS vectors, spoofed UI classes, and non-checkbox inputs', () => {
  assert.equal(
    sanitizeNoteHtmlMain('<p>Hello</p><script>alert(1)</script><img src=x onerror=alert(1)>'),
    '<p>Hello</p>'
  );
  assert.equal(
    sanitizeNoteHtmlMain('<style>body{display:none}</style><svg onload=alert(1)><script>1</script></svg><p>Safe</p>'),
    '<p>Safe</p>'
  );
  assert.equal(
    sanitizeNoteHtmlMain('<input type="file"><input type="password" value="secret"><input type="checkbox" checked class="checklist-checkbox modal-dialog" onclick="alert(1)">'),
    '<input type="checkbox" class="checklist-checkbox" checked="checked">'
  );
  assert.equal(
    sanitizeNoteHtmlMain('<div class="modal-dialog color-menu-popover" contenteditable="false" onmouseover="alert(1)">Text</div>'),
    '<div>Text</div>'
  );
  assert.equal(
    sanitizeNoteHtmlMain('<a href="javascript:alert(1)" target="_blank">Bad</a> <a href="https://example.com">Good</a>'),
    '<a>Bad</a> <a href="https://example.com/" rel="noopener noreferrer">Good</a>'
  );
  assert.equal(
    sanitizeNoteHtmlMain('<ul data-type="taskList" class="task-list"><li data-type="taskItem" data-checked="true" data-evil="1"><p>Done</p></li></ul>'),
    '<ul class="task-list" data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Done</p></li></ul>'
  );
});

test('renderer sanitizeHtml & upgradeLegacyChecklistHtml enforce strict DOMPurify hooks', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const prevWindow = globalThis.window;
  const prevDocument = globalThis.document;
  const prevDOMParser = globalThis.DOMParser;

  // Bind JSDOM globals for DOMPurify in Node test runtime
  Object.defineProperty(globalThis, 'window', { value: dom.window, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true });
  Object.defineProperty(globalThis, 'DOMParser', { value: dom.window.DOMParser, configurable: true });

  try {
    const { sanitizeHtml, upgradeLegacyChecklistHtml } = await import(
      '../src/renderer/utils/sanitize'
    );

    const malicious =
      '<div class="modal-dialog" contenteditable="false"><input type="file"><input type="password"><a href="javascript:alert(1)">x</a><a href="https://example.com">ok</a><script>evil()</script></div>';
    const cleaned = sanitizeHtml(malicious);
    assert.ok(!cleaned.includes('modal-dialog'));
    assert.ok(!cleaned.includes('contenteditable'));
    assert.ok(!cleaned.includes('type="file"'));
    assert.ok(!cleaned.includes('type="password"'));
    assert.ok(!cleaned.includes('javascript:'));
    assert.ok(!cleaned.includes('<script'));
    assert.ok(cleaned.includes('href="https://example.com/"'));
    assert.ok(cleaned.includes('rel="noopener noreferrer"'));

    // Legacy v1.0-v1.1 checklist divs upgrade cleanly into Tiptap taskList/taskItem markup
    const legacy =
      '<p>Header</p><div class="checklist-item checked"><input type="checkbox" class="checklist-checkbox" checked="checked" contenteditable="false"><span class="checklist-text">Buy <b>milk</b></span></div><div class="checklist-item"><input type="checkbox" class="checklist-checkbox" contenteditable="false"><span class="checklist-text">Walk dog</span></div>';
    const upgraded = upgradeLegacyChecklistHtml(legacy);
    assert.ok(upgraded.includes('<ul data-type="taskList">'));
    assert.ok(upgraded.includes('data-type="taskItem" data-checked="true"'));
    assert.ok(upgraded.includes('data-type="taskItem" data-checked="false"'));
    assert.ok(upgraded.includes('Buy <b>milk</b>'));
    assert.ok(upgraded.includes('Walk dog'));
  } finally {
    Object.defineProperty(globalThis, 'window', { value: prevWindow, configurable: true });
    Object.defineProperty(globalThis, 'document', { value: prevDocument, configurable: true });
    Object.defineProperty(globalThis, 'DOMParser', { value: prevDOMParser, configurable: true });
  }
});
