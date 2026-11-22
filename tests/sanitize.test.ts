import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { parseSafeExternalUrl, sanitizeNoteHtmlMain } from '../src/main/htmlSanitizer';

test('parseSafeExternalUrl allows only http, https, and mailto without control characters', () => {
  assert.equal(
    parseSafeExternalUrl('https://example.com/path?a=1'),
    'https://example.com/path?a=1'
  );
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
    sanitizeNoteHtmlMain(
      '<style>body{display:none}</style><svg onload=alert(1)><script>1</script></svg><p>Safe</p>'
    ),
    '<p>Safe</p>'
  );
  assert.equal(
    sanitizeNoteHtmlMain(
      '<input type="file"><input type="password" value="secret"><input type="checkbox" checked class="checklist-checkbox modal-dialog" onclick="alert(1)">'
    ),
    '<input type="checkbox" class="checklist-checkbox" checked="checked">'
  );
  assert.equal(
    sanitizeNoteHtmlMain(
      '<div class="modal-dialog color-menu-popover" contenteditable="false" onmouseover="alert(1)">Text</div>'
    ),
    '<div>Text</div>'
  );
  assert.equal(
    sanitizeNoteHtmlMain(
      '<a href="javascript:alert(1)" target="_blank">Bad</a> <a href="https://example.com">Good</a>'
    ),
    '<a>Bad</a> <a href="https://example.com/" rel="noopener noreferrer">Good</a>'
  );
  assert.equal(
    sanitizeNoteHtmlMain(
      '<ul data-type="taskList" class="task-list"><li data-type="taskItem" data-checked="true" data-evil="1"><p>Done</p></li></ul>'
    ),
    '<ul class="task-list" data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Done</p></li></ul>'
  );
});

test('sanitizeNoteHtmlMain handles > in quoted attributes, unclosed/bogus comments, mXSS, and malformed nesting', () => {
  // Literal '>' inside quoted attribute values
  assert.equal(
    sanitizeNoteHtmlMain('<a title="a > b" href="https://example.com">link</a>'),
    '<a href="https://example.com/" rel="noopener noreferrer">link</a>'
  );
  assert.equal(
    sanitizeNoteHtmlMain('<p data-x="1>2<script>alert(1)</script>">safe</p>'),
    '<p>safe</p>'
  );

  // Unclosed '<!--' comments and bogus comments
  assert.equal(
    sanitizeNoteHtmlMain('<p>Before</p><!-- unclosed comment <script>alert(1)</script>'),
    '<p>Before</p>'
  );
  assert.equal(
    sanitizeNoteHtmlMain('<?xml version="1.0"?><!doctype html><p>Ok</p><!bogus >'),
    '<p>Ok</p>'
  );

  // Entity-encoded XSS / mXSS payloads
  assert.equal(
    sanitizeNoteHtmlMain('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>'),
    '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>'
  );
  assert.equal(sanitizeNoteHtmlMain('<a href="javascript&#58;alert(1)">click</a>'), '<a>click</a>');
  assert.equal(
    sanitizeNoteHtmlMain(
      '<noscript><img src=x onerror=alert(1)></noscript><template><script>alert(1)</script></template><svg onload=alert(1)><foreignObject><p><script>1</script>Hidden</p></foreignObject></svg><math><mtext><script>alert(1)</script></mtext></math><p>Clean</p>'
    ),
    '<p>Clean</p>'
  );

  // Dropped rawtext / legacy containers
  assert.equal(
    sanitizeNoteHtmlMain(
      '<xmp><script>alert(1)</script></xmp><noembed><img src=x onerror=1></noembed><noframes><p>hidden</p></noframes><head><title>x</title></head><p>Visible</p><plaintext><script>alert(1)</script>'
    ),
    '<p>Visible</p>'
  );

  // Foster-parenting mXSS & sanitizer idempotency
  const fosterPayload =
    '<form><math><mtext></form><form><mglyph><style></math><img src onerror=alert(1)>';
  const fosterOut = sanitizeNoteHtmlMain(fosterPayload);
  assert.ok(!fosterOut.includes('<img') && !fosterOut.includes('<style'));
  assert.equal(sanitizeNoteHtmlMain(fosterOut), fosterOut);

  // Deeply nested HTML should not overflow the call stack
  const deepHtml = '<div>'.repeat(10_000) + 'x' + '</div>'.repeat(10_000);
  const deepOut = sanitizeNoteHtmlMain(deepHtml);
  assert.equal(deepOut, deepHtml);
  assert.ok(deepOut.includes('x'));

  // Malformed/interleaved nesting
  assert.equal(sanitizeNoteHtmlMain('<p><b>text</p></b>'), '<p><b>text</b></p>');

  // Valid Tiptap task lists + legacy checklists
  assert.equal(
    sanitizeNoteHtmlMain(
      '<ul data-type="taskList" class="task-list"><li data-type="taskItem" data-checked="FALSE"><label contenteditable="false"><input type="checkbox" checked></label><div><p>Item</p></div></li></ul>'
    ),
    '<ul class="task-list" data-type="taskList"><li data-type="taskItem" data-checked="false"><label contenteditable="false"><input type="checkbox" checked="checked"></label><div><p>Item</p></div></li></ul>'
  );
  assert.equal(
    sanitizeNoteHtmlMain(
      '<div class="checklist-item checked" data-checked="TRUE"><input type="checkbox" class="checklist-checkbox" checked="checked" contenteditable="false"><span class="checklist-text">Buy <b>milk</b></span></div>'
    ),
    '<div class="checklist-item checked" data-checked="true"><input type="checkbox" class="checklist-checkbox" checked="checked" contenteditable="false"><span class="checklist-text">Buy <b>milk</b></span></div>'
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
  Object.defineProperty(globalThis, 'DOMParser', {
    value: dom.window.DOMParser,
    configurable: true,
  });

  try {
    const { sanitizeHtml, upgradeLegacyChecklistHtml } =
      await import('../src/renderer/utils/sanitize');

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
