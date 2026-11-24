import assert from 'node:assert/strict';
import { test } from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { ErrorBoundary } from '../src/renderer/components/ErrorBoundary';

test('a render failure shows recovery and reports only its error category', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousActEnvironment = (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT;
  const oldConsoleError = console.error;
  const reported: string[] = [];
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(dom.window, 'stickyNotesAPI', {
    value: { logRendererError: async (category: string) => { reported.push(category); } },
  });
  console.error = () => {};
  const root = createRoot(dom.window.document.getElementById('root')!);
  const Broken = () => { throw new TypeError('private note text'); };
  try {
    await act(async () => { root.render(React.createElement(ErrorBoundary, null, React.createElement(Broken))); });
    assert.match(dom.window.document.body.textContent ?? '', /Something went wrong/);
    assert.deepEqual(reported, ['TypeError']);
  } finally {
    await act(async () => root.unmount());
    console.error = oldConsoleError;
    Object.assign(globalThis, { window: previousWindow, document: previousDocument, IS_REACT_ACT_ENVIRONMENT: previousActEnvironment });
    dom.window.close();
  }
});
