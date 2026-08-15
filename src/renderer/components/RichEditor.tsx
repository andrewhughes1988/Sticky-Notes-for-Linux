import React, { useRef, useEffect, useState, useCallback } from 'react';
import { sanitizeHtml } from '../utils/sanitize';

export type FormatKey = 'bold' | 'italic' | 'underline' | 'strike';

export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
}

interface RichEditorProps {
  initialHtml: string;
  placeholder?: string;
  onChange: (html: string, plainText: string) => void;
  onFormatChange?: (formats: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
    list: boolean;
    checklist: boolean;
  }) => void;
  editorRefExpose?: (api: {
    format: (command: string, value?: string) => void;
    insertChecklist: () => void;
    flush: () => void;
  }) => void;
}

export const RichEditor: React.FC<RichEditorProps> = ({
  initialHtml,
  placeholder = 'Take a note...',
  onChange,
  onFormatChange,
  editorRefExpose,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDirtyRef = useRef(false);

  // State for pending styling on a collapsed caret
  const pendingFormatsRef = useRef<FormatState | null>(null);

  // Helper to extract clean plain text without forcing synchronous style/layout reflows
  const extractPlainText = (element: HTMLElement): string => {
    return (element.textContent || '')
      .replace(/\u200B/g, '')
      .replace(/\u00a0/g, ' ')
      .trim();
  };

  // Immediate save flush for pending dirty edits
  const flush = useCallback(() => {
    if (!isDirtyRef.current || !editorRef.current) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    isDirtyRef.current = false;
    const html = editorRef.current.innerHTML;
    const plain = extractPlainText(editorRef.current);
    onChange(html, plain);
  }, [onChange]);

  // Helper to find parent checklist item
  const getParentChecklistItem = (node: Node | null): HTMLElement | null => {
    let curr: Node | null = node;
    while (curr && curr !== editorRef.current) {
      if (curr instanceof HTMLElement && curr.classList.contains('checklist-item')) {
        return curr;
      }
      curr = curr.parentNode;
    }
    return null;
  };

  // Helper to find parent list item (li)
  const getParentListItem = (node: Node | null): HTMLElement | null => {
    let curr: Node | null = node;
    while (curr && curr !== editorRef.current) {
      if (curr instanceof HTMLElement && curr.tagName.toLowerCase() === 'li') {
        return curr;
      }
      curr = curr.parentNode;
    }
    return null;
  };

  // Helper to find top-level block inside the editor
  const getParentBlock = (node: Node | null): HTMLElement | null => {
    let curr: Node | null = node;
    while (curr && curr.parentNode !== editorRef.current && curr !== editorRef.current) {
      if (curr.nodeType === Node.ELEMENT_NODE) {
        return curr as HTMLElement;
      }
      curr = curr.parentNode;
    }
    return curr instanceof HTMLElement ? curr : null;
  };

  // Helper to map commands to format keys
  const getCommandKey = (command: string): FormatKey => {
    const c = command.toLowerCase();
    if (c === 'bold') return 'bold';
    if (c === 'italic') return 'italic';
    if (c === 'underline') return 'underline';
    return 'strike';
  };

  // Helper to extract active formats at a specific DOM node
  const getDomFormatsAtNode = (node: Node | null, root: HTMLElement | null): FormatState => {
    const result: FormatState = { bold: false, italic: false, underline: false, strike: false };
    let curr: Node | null = node;
    while (curr && curr !== root) {
      if (curr.nodeType === Node.ELEMENT_NODE) {
        const el = curr as HTMLElement;
        const tag = el.tagName.toLowerCase();
        const style = el.style;
        const textDec = (style.textDecoration || style.textDecorationLine || '').toLowerCase();
        const weight = (style.fontWeight || '').toLowerCase();

        if (tag === 'b' || tag === 'strong' || weight === 'bold' || parseInt(weight || '0', 10) >= 700) {
          result.bold = true;
        }
        if (tag === 'i' || tag === 'em' || style.fontStyle.toLowerCase() === 'italic') {
          result.italic = true;
        }
        if (tag === 'u' || textDec.includes('underline')) {
          result.underline = true;
        }
        if (tag === 's' || tag === 'strike' || tag === 'del' || textDec.includes('line-through')) {
          result.strike = true;
        }
      }
      curr = curr.parentNode;
    }
    return result;
  };

  // Get all text nodes intersecting a range
  const getTextNodesInRange = (range: Range, root: HTMLElement): Text[] => {
    const textNodes: Text[] = [];
    const container = range.commonAncestorContainer;
    const searchRoot = container.nodeType === Node.TEXT_NODE ? (container.parentNode || root) : container;

    const treeWalker = document.createTreeWalker(
      searchRoot,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          try {
            if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
            const text = (node.textContent || '').replace(/\u200B/g, '');
            if (text.length === 0) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          } catch {
            return NodeFilter.FILTER_REJECT;
          }
        },
      }
    );

    let curr = treeWalker.nextNode();
    while (curr) {
      textNodes.push(curr as Text);
      curr = treeWalker.nextNode();
    }
    return textNodes;
  };

  // Evaluate format state across a selection range ('all' | 'some' | 'none')
  const getRangeFormatState = (range: Range, command: string, root: HTMLElement): 'all' | 'some' | 'none' => {
    const key = getCommandKey(command);
    const textNodes = getTextNodesInRange(range, root);

    if (textNodes.length === 0) {
      const formats = getDomFormatsAtNode(range.startContainer, root);
      return formats[key] ? 'all' : 'none';
    }

    let count = 0;
    for (const node of textNodes) {
      const formats = getDomFormatsAtNode(node, root);
      if (formats[key]) {
        count++;
      }
    }

    if (count === textNodes.length) return 'all';
    if (count > 0) return 'some';
    return 'none';
  };

  const unwrapElement = (el: HTMLElement) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) {
      parent.insertBefore(el.firstChild, el);
    }
    parent.removeChild(el);
  };

  const cleanEmptySpan = (el: HTMLElement) => {
    if (
      el.tagName.toLowerCase() === 'span' &&
      !el.getAttribute('style') &&
      el.classList.length === 0
    ) {
      unwrapElement(el);
    }
  };

  const isolateElementAroundNode = (node: Node, el: HTMLElement) => {
    if (!el.parentNode) return;
    if (node.previousSibling) {
      const leftEl = el.cloneNode(false) as HTMLElement;
      let sibling: ChildNode | null = el.firstChild;
      while (sibling && sibling !== node) {
        const next: ChildNode | null = sibling.nextSibling;
        leftEl.appendChild(sibling);
        sibling = next;
      }
      if (leftEl.hasChildNodes()) {
        el.parentNode.insertBefore(leftEl, el);
      }
    }
    if (node.nextSibling) {
      const rightEl = el.cloneNode(false) as HTMLElement;
      let sibling: ChildNode | null = node.nextSibling;
      while (sibling) {
        const next: ChildNode | null = sibling.nextSibling;
        rightEl.appendChild(sibling);
        sibling = next;
      }
      if (rightEl.hasChildNodes()) {
        el.parentNode.insertBefore(rightEl, el.nextSibling);
      }
    }
  };

  const applyOrRemoveRangeFormat = (range: Range, command: string, root: HTMLElement) => {
    const key = getCommandKey(command);
    const formatState = getRangeFormatState(range, command, root);
    const shouldApply = (formatState === 'none');

    // 1. Split start text node if inside
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      const textNode = range.startContainer as Text;
      if (range.startOffset > 0 && range.startOffset < (textNode.textContent || '').length) {
        const rightText = textNode.splitText(range.startOffset);
        if (range.startContainer === range.endContainer) {
          range.setEnd(rightText, range.endOffset - range.startOffset);
        }
        range.setStart(rightText, 0);
      }
    }

    // 2. Split end text node if inside
    if (range.endContainer.nodeType === Node.TEXT_NODE) {
      const textNode = range.endContainer as Text;
      if (range.endOffset > 0 && range.endOffset < (textNode.textContent || '').length) {
        textNode.splitText(range.endOffset);
      }
    }

    const textNodes = getTextNodesInRange(range, root);

    for (const textNode of textNodes) {
      const currentFormats = getDomFormatsAtNode(textNode, root);

      if (shouldApply) {
        if (!currentFormats[key]) {
          let tagName = 'span';
          if (key === 'bold') tagName = 'strong';
          else if (key === 'italic') tagName = 'em';
          else if (key === 'underline') tagName = 'u';
          else if (key === 'strike') tagName = 's';

          const wrapper = document.createElement(tagName);
          textNode.parentNode?.insertBefore(wrapper, textNode);
          wrapper.appendChild(textNode);
        }
      } else {
        // Remove format from this textNode
        let curr: Node = textNode;
        while (curr && curr.parentNode !== root && curr.parentNode) {
          const parent: Node = curr.parentNode;
          if (parent.nodeType === Node.ELEMENT_NODE) {
            const el = parent as HTMLElement;
            const tag = el.tagName.toLowerCase();

            if (key === 'underline') {
              if (tag === 'u') {
                isolateElementAroundNode(curr, el);
                unwrapElement(el);
                curr = curr.parentNode || parent;
                continue;
              } else if (el.style.textDecoration || el.style.textDecorationLine) {
                const currentDec = el.style.textDecoration || el.style.textDecorationLine || '';
                const newDec = currentDec.replace(/underline/gi, '').trim();
                if (newDec) el.style.textDecoration = newDec;
                else {
                  el.style.textDecoration = '';
                  cleanEmptySpan(el);
                }
              }
            } else if (key === 'strike') {
              if (tag === 's' || tag === 'strike' || tag === 'del') {
                isolateElementAroundNode(curr, el);
                unwrapElement(el);
                curr = curr.parentNode || parent;
                continue;
              } else if (el.style.textDecoration || el.style.textDecorationLine) {
                const currentDec = el.style.textDecoration || el.style.textDecorationLine || '';
                const newDec = currentDec.replace(/line-through/gi, '').trim();
                if (newDec) el.style.textDecoration = newDec;
                else {
                  el.style.textDecoration = '';
                  cleanEmptySpan(el);
                }
              }
            } else if (key === 'bold') {
              if (tag === 'b' || tag === 'strong') {
                isolateElementAroundNode(curr, el);
                unwrapElement(el);
                curr = curr.parentNode || parent;
                continue;
              } else if (el.style.fontWeight) {
                el.style.fontWeight = '';
                cleanEmptySpan(el);
              }
            } else if (key === 'italic') {
              if (tag === 'i' || tag === 'em') {
                isolateElementAroundNode(curr, el);
                unwrapElement(el);
                curr = curr.parentNode || parent;
                continue;
              } else if (el.style.fontStyle) {
                el.style.fontStyle = '';
                cleanEmptySpan(el);
              }
            }
          }
          curr = parent;
        }
      }
    }
  };

  // Update format states on selection change
  const checkFormats = useCallback(() => {
    if (!onFormatChange || !editorRef.current) return;
    try {
      const selection = window.getSelection();
      const inChecklist = Boolean(
        selection && selection.anchorNode && getParentChecklistItem(selection.anchorNode)
      );
      const inBulletList = !inChecklist && Boolean(
        selection && selection.anchorNode && getParentListItem(selection.anchorNode)
      );

      if (pendingFormatsRef.current && selection && selection.isCollapsed) {
        onFormatChange({
          ...pendingFormatsRef.current,
          list: inBulletList,
          checklist: inChecklist,
        });
        return;
      }

      let currentFormats: FormatState = { bold: false, italic: false, underline: false, strike: false };
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (range.collapsed) {
          currentFormats = getDomFormatsAtNode(selection.anchorNode, editorRef.current);
        } else {
          currentFormats = {
            bold: getRangeFormatState(range, 'bold', editorRef.current) === 'all',
            italic: getRangeFormatState(range, 'italic', editorRef.current) === 'all',
            underline: getRangeFormatState(range, 'underline', editorRef.current) === 'all',
            strike: getRangeFormatState(range, 'strikeThrough', editorRef.current) === 'all',
          };
        }
      }

      onFormatChange({
        ...currentFormats,
        list: inBulletList,
        checklist: inChecklist,
      });
    } catch {
      // Ignore
    }
  }, [onFormatChange]);

  const handleContentChange = useCallback(() => {
    if (!editorRef.current || isComposing) return;
    isDirtyRef.current = true;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (!editorRef.current) return;
      isDirtyRef.current = false;
      const html = editorRef.current.innerHTML;
      const plain = extractPlainText(editorRef.current);
      onChange(html, plain);
    }, 300);
  }, [isComposing, onChange]);

  // Execute formatting command with mutual exclusivity between Checklist and Bullet list
  const format = useCallback(
    (command: string, value: string = '') => {
      if (!editorRef.current) return;
      editorRef.current.focus();

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      // 1. Lists
      if (command === 'insertUnorderedList') {
        const checklistItem = getParentChecklistItem(selection.anchorNode);
        if (checklistItem) {
          // Mutually exclusive: convert Checklist item directly to a Bullet List
          const textSpan = (checklistItem.querySelector('.checklist-text') || checklistItem.querySelector('span')) as HTMLElement | null;
          const innerHtml = textSpan ? textSpan.innerHTML : checklistItem.innerText;
          const cleanHtml = innerHtml.trim() === '' || innerHtml === '&nbsp;' ? '<br>' : innerHtml;

          const ul = document.createElement('ul');
          const li = document.createElement('li');
          li.innerHTML = cleanHtml;
          ul.appendChild(li);

          checklistItem.parentNode?.replaceChild(ul, checklistItem);

          const newRange = document.createRange();
          newRange.selectNodeContents(li);
          newRange.collapse(false);
          selection.removeAllRanges();
          selection.addRange(newRange);

          checkFormats();
          handleContentChange();
          return;
        }
        document.execCommand(command, false, value);
        checkFormats();
        handleContentChange();
        return;
      }

      const key = getCommandKey(command);
      const range = selection.getRangeAt(0);

      // 2. Collapsed Caret Formatting: Toggle independently
      if (range.collapsed) {
        const currentFormats = pendingFormatsRef.current || getDomFormatsAtNode(selection.anchorNode, editorRef.current);
        const nextState = !currentFormats[key];
        pendingFormatsRef.current = {
          ...currentFormats,
          [key]: nextState,
        };
        checkFormats();
        return;
      }

      // 3. Highlighted Range Selection: preserve exact character selection across DOM unwrap/normalize
      const getSelectionOffsets = (root: HTMLElement): { start: number; end: number } | null => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;
        const currentRange = sel.getRangeAt(0);

        const preStartRange = document.createRange();
        preStartRange.selectNodeContents(root);
        preStartRange.setEnd(currentRange.startContainer, currentRange.startOffset);
        const start = preStartRange.toString().length;

        const preEndRange = document.createRange();
        preEndRange.selectNodeContents(root);
        preEndRange.setEnd(currentRange.endContainer, currentRange.endOffset);
        const end = preEndRange.toString().length;

        return { start, end };
      };

      const restoreSelectionOffsets = (root: HTMLElement, start: number, end: number) => {
        const sel = window.getSelection();
        if (!sel) return;

        let currentOffset = 0;
        let startNode: Node | null = null;
        let startNodeOffset = 0;
        let endNode: Node | null = null;
        let endNodeOffset = 0;

        const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        let textNode = treeWalker.nextNode();

        while (textNode) {
          const textLen = (textNode.textContent || '').length;

          if (!startNode && currentOffset + textLen >= start) {
            startNode = textNode;
            startNodeOffset = start - currentOffset;
          }

          if (!endNode && currentOffset + textLen >= end) {
            endNode = textNode;
            endNodeOffset = end - currentOffset;
            break;
          }

          currentOffset += textLen;
          textNode = treeWalker.nextNode();
        }

        if (startNode && endNode) {
          const newRange = document.createRange();
          newRange.setStart(startNode, startNodeOffset);
          newRange.setEnd(endNode, endNodeOffset);
          sel.removeAllRanges();
          sel.addRange(newRange);
        }
      };

      const offsets = getSelectionOffsets(editorRef.current);
      applyOrRemoveRangeFormat(range, command, editorRef.current);
      editorRef.current.normalize();

      if (offsets) {
        restoreSelectionOffsets(editorRef.current, offsets.start, offsets.end);
      }

      pendingFormatsRef.current = null;
      checkFormats();
      handleContentChange();
    },
    [checkFormats, handleContentChange]
  );

  // Toggle or insert an interactive checklist item
  const toggleChecklist = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    // 1. If inside a bullet list (li), convert Bullet List to Checklist (mutually exclusive)
    const existingLi = getParentListItem(selection.anchorNode);
    if (existingLi) {
      const parentUl = existingLi.closest('ul, ol');
      const innerHtml = existingLi.innerHTML.trim();
      const cleanHtml = innerHtml === '' || innerHtml === '<br>' ? '&nbsp;' : innerHtml;

      const checklistDiv = document.createElement('div');
      checklistDiv.className = 'checklist-item';
      checklistDiv.innerHTML = `<input type="checkbox" class="checklist-checkbox" contenteditable="false" /><span class="checklist-text">${cleanHtml}</span>`;

      if (parentUl && parentUl.children.length === 1) {
        // Only 1 list item in UL: replace entire UL
        parentUl.parentNode?.replaceChild(checklistDiv, parentUl);
      } else if (parentUl) {
        // Multiple items in UL: insert checklist and remove this LI
        parentUl.parentNode?.insertBefore(checklistDiv, parentUl.nextSibling);
        existingLi.remove();
      }

      const span = checklistDiv.querySelector('.checklist-text');
      if (span) {
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        newRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }

      checkFormats();
      handleContentChange();
      return;
    }

    // 2. If already inside a checklist item: toggle OFF back to normal paragraph
    const existingChecklist = getParentChecklistItem(selection.anchorNode);
    if (existingChecklist) {
      const textSpan = (existingChecklist.querySelector('.checklist-text') || existingChecklist.querySelector('span')) as HTMLElement | null;
      const innerHtml = textSpan ? textSpan.innerHTML : existingChecklist.innerText;
      const normalDiv = document.createElement('div');
      normalDiv.innerHTML = innerHtml.trim() === '' || innerHtml === '&nbsp;' ? '<br>' : innerHtml;

      existingChecklist.parentNode?.replaceChild(normalDiv, existingChecklist);

      const newRange = document.createRange();
      newRange.selectNodeContents(normalDiv);
      newRange.collapse(false);
      selection.removeAllRanges();
      selection.addRange(newRange);

      checkFormats();
      handleContentChange();
      return;
    }

    // 3. Normal line: convert to single Checklist item
    const parentBlock = getParentBlock(selection.anchorNode);
    let contentHtml = '';

    const checklistDiv = document.createElement('div');
    checklistDiv.className = 'checklist-item';

    if (parentBlock && parentBlock !== editorRef.current) {
      contentHtml = parentBlock.innerHTML.replace(/<br\s*[\/]?>/gi, '').trim();
      checklistDiv.innerHTML = `<input type="checkbox" class="checklist-checkbox" contenteditable="false" /><span class="checklist-text">${contentHtml || '&nbsp;'}</span>`;
      parentBlock.parentNode?.replaceChild(checklistDiv, parentBlock);
    } else {
      const selectedHtml = range.extractContents();
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(selectedHtml);
      contentHtml = tempDiv.innerHTML.replace(/<br\s*[\/]?>/gi, '').trim();
      checklistDiv.innerHTML = `<input type="checkbox" class="checklist-checkbox" contenteditable="false" /><span class="checklist-text">${contentHtml || '&nbsp;'}</span>`;
      range.insertNode(checklistDiv);
    }

    const span = checklistDiv.querySelector('.checklist-text');
    if (span) {
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      newRange.collapse(false);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }

    checkFormats();
    handleContentChange();
  }, [checkFormats, handleContentChange]);

  // Expose formatting and flush APIs to parent
  useEffect(() => {
    if (editorRefExpose) {
      editorRefExpose({ format, insertChecklist: toggleChecklist, flush });
    }
  }, [editorRefExpose, format, toggleChecklist, flush]);

  // Flush pending changes before page unloads or component unmounts
  useEffect(() => {
    const handleBeforeUnload = () => {
      flush();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flush();
    };
  }, [flush]);

  // Initial HTML mount
  useEffect(() => {
    if (editorRef.current && initialHtml !== undefined) {
      const sanitized = sanitizeHtml(initialHtml);
      if (editorRef.current.innerHTML !== sanitized) {
        editorRef.current.innerHTML = sanitized;
      }
    }
  }, []);

  // Keyboard listener for shortcuts and checklist enter/backspace handling
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // 1. Formatting shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        format('bold');
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        format('italic');
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        format('underline');
      } else if (e.key === 't' || e.key === 'T' || (e.shiftKey && (e.key === 'x' || e.key === 'X'))) {
        e.preventDefault();
        format('strikeThrough');
      } else if (e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        format('insertUnorderedList');
      }
      return;
    }

    // 2. Handle Enter key inside a checklist item
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const checklistItem = getParentChecklistItem(selection.anchorNode);
        if (checklistItem) {
          e.preventDefault();
          const textSpan = (checklistItem.querySelector('.checklist-text') || checklistItem.querySelector('span')) as HTMLElement | null;
          const text = textSpan ? (textSpan.innerText || textSpan.textContent || '').trim() : '';

          if (!text || text === '') {
            // Empty checklist item -> Exit checklist and convert to regular paragraph
            const normalDiv = document.createElement('div');
            normalDiv.innerHTML = '<br>';
            checklistItem.parentNode?.replaceChild(normalDiv, checklistItem);

            const newRange = document.createRange();
            newRange.setStart(normalDiv, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          } else {
            // Create a new checklist item row directly below
            const newChecklist = document.createElement('div');
            newChecklist.className = 'checklist-item';
            newChecklist.innerHTML = `<input type="checkbox" class="checklist-checkbox" contenteditable="false" /><span class="checklist-text">&nbsp;</span>`;

            if (checklistItem.nextSibling) {
              checklistItem.parentNode?.insertBefore(newChecklist, checklistItem.nextSibling);
            } else {
              checklistItem.parentNode?.appendChild(newChecklist);
            }

            const newSpan = newChecklist.querySelector('.checklist-text');
            if (newSpan) {
              const newRange = document.createRange();
              newRange.selectNodeContents(newSpan);
              newRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(newRange);
            }
          }
          handleContentChange();
          checkFormats();
          return;
        }
      }
    }

    // 3. Handle Backspace at start of checklist item
    if (e.key === 'Backspace') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && selection.isCollapsed) {
        const checklistItem = getParentChecklistItem(selection.anchorNode);
        if (checklistItem) {
          const textSpan = (checklistItem.querySelector('.checklist-text') || checklistItem.querySelector('span')) as HTMLElement | null;
          const range = selection.getRangeAt(0);
          if (range.startOffset === 0 && (selection.anchorNode === textSpan || selection.anchorNode === textSpan?.firstChild)) {
            e.preventDefault();
            const innerHtml = textSpan ? textSpan.innerHTML : '<br>';
            const normalDiv = document.createElement('div');
            normalDiv.innerHTML = innerHtml.trim() === '' || innerHtml === '&nbsp;' ? '<br>' : innerHtml;
            checklistItem.parentNode?.replaceChild(normalDiv, checklistItem);

            const newRange = document.createRange();
            newRange.selectNodeContents(normalDiv);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            handleContentChange();
            checkFormats();
            return;
          }
        }
      }
    }
  };

  // Delegate click for checklist checkboxes
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target && target.classList.contains('checklist-checkbox')) {
      const checkbox = target as HTMLInputElement;
      const parent = checkbox.closest('.checklist-item');
      if (parent) {
        if (checkbox.checked) {
          parent.classList.add('checked');
          checkbox.setAttribute('checked', 'checked');
        } else {
          parent.classList.remove('checked');
          checkbox.removeAttribute('checked');
        }
        handleContentChange();
      }
    }
  };

  // Intercept paste to sanitize HTML and prevent malformed layout/large base64 injection
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const clipboardData = e.clipboardData;
    const rawHtml = clipboardData.getData('text/html');
    const plainText = clipboardData.getData('text/plain');

    if (rawHtml) {
      const clean = sanitizeHtml(rawHtml);
      document.execCommand('insertHTML', false, clean);
    } else if (plainText) {
      document.execCommand('insertText', false, plainText);
    }
    handleContentChange();
    checkFormats();
  };

  // Helper to split any ancestor tags that contain formatting not present in target formats
  const splitUnwantedAncestors = (
    range: Range,
    formats: FormatState,
    root: HTMLElement
  ): { parentNode: Node; insertBefore: Node | null } => {
    let container = range.startContainer;
    let offset = range.startOffset;

    // 1. If inside a Text node, split it if caret is in the middle
    let leftNode: Node = container;
    let rightNode: Node | null = null;
    if (container.nodeType === Node.TEXT_NODE) {
      const textNode = container as Text;
      const text = textNode.textContent || '';
      if (offset < text.length) {
        rightNode = textNode.splitText(offset);
      }
    }

    const hasUnwantedFormat = (el: HTMLElement): boolean => {
      const tag = el.tagName.toLowerCase();
      const style = el.style;
      const textDec = (style.textDecoration || style.textDecorationLine || '').toLowerCase();
      const weight = (style.fontWeight || '').toLowerCase();
      const isBold = tag === 'b' || tag === 'strong' || weight === 'bold' || parseInt(weight || '0', 10) >= 700;
      const isItalic = tag === 'i' || tag === 'em' || style.fontStyle.toLowerCase() === 'italic';
      const isUnderline = tag === 'u' || textDec.includes('underline');
      const isStrike = tag === 's' || tag === 'strike' || tag === 'del' || textDec.includes('line-through');

      if (isBold && !formats.bold) return true;
      if (isItalic && !formats.italic) return true;
      if (isUnderline && !formats.underline) return true;
      if (isStrike && !formats.strike) return true;
      return false;
    };

    let currLeft: Node = leftNode;
    let currRight: Node | null = rightNode;

    while (currLeft && currLeft !== root) {
      const parent: Node | null = currLeft.parentNode;
      if (!parent || parent === root) break;

      if (parent.nodeType === Node.ELEMENT_NODE && hasUnwantedFormat(parent as HTMLElement)) {
        const parentEl = parent as HTMLElement;
        const rightParent = parentEl.cloneNode(false) as HTMLElement;

        let sibling: Node | null = currRight ? currRight : currLeft.nextSibling;

        while (sibling) {
          const next = sibling.nextSibling;
          rightParent.appendChild(sibling);
          sibling = next;
        }

        if (parentEl.parentNode) {
          parentEl.parentNode.insertBefore(rightParent, parentEl.nextSibling);
        }

        if (rightParent.textContent === '' && !rightParent.querySelector('input, img, br')) {
          currRight = rightParent.nextSibling;
          rightParent.remove();
        } else {
          currRight = rightParent;
        }

        currLeft = parent;
      } else {
        // Parent is a wanted ancestor or neutral container - insertion point is right here
        return {
          parentNode: parent,
          insertBefore: currRight || (currLeft ? currLeft.nextSibling : null),
        };
      }
    }

    return {
      parentNode: root,
      insertBefore: currRight || (currLeft && currLeft !== root ? currLeft.nextSibling : null),
    };
  };

  // Attach native beforeinput listener to intercept typing when pendingFormats are active
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const onNativeBeforeInput = (e: InputEvent) => {
      if (e.inputType === 'insertText' && e.data && pendingFormatsRef.current && editorRef.current) {
        e.preventDefault();
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        range.deleteContents();

        const formats = pendingFormatsRef.current;
        const text = e.data;

        // 1. Split away any ancestor tags that contain styles the user untoggled
        const ref = splitUnwantedAncestors(range, formats, editorRef.current);

        // 2. Build the styled wrapper or plain text node according to formats
        const textNode = document.createTextNode(text);
        let insertNode: Node = textNode;

        let rootEl: HTMLElement | null = null;
        let leafEl: HTMLElement | null = null;

        const wrapInTag = (tagName: string) => {
          const wrapper = document.createElement(tagName);
          if (!rootEl) rootEl = wrapper;
          if (leafEl) leafEl.appendChild(wrapper);
          leafEl = wrapper;
        };

        if (formats.bold) wrapInTag('strong');
        if (formats.italic) wrapInTag('em');
        if (formats.underline) wrapInTag('u');
        if (formats.strike) wrapInTag('s');

        if (rootEl && leafEl) {
          (leafEl as HTMLElement).appendChild(textNode);
          insertNode = rootEl;
        }

        // 3. Insert into the split container at the exact caret location
        const targetParent = (ref.parentNode || editorRef.current) as HTMLElement;
        targetParent.insertBefore(insertNode, ref.insertBefore);

        // 4. Place caret immediately after the inserted text
        const newRange = document.createRange();
        newRange.setStart(textNode, text.length);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        pendingFormatsRef.current = null;
        handleContentChange();
        checkFormats();
      }
    };

    el.addEventListener('beforeinput', onNativeBeforeInput);
    return () => {
      el.removeEventListener('beforeinput', onNativeBeforeInput);
    };
  }, [checkFormats, handleContentChange]);

  const handleSelectionReset = (e: React.SyntheticEvent) => {
    if ('key' in e) {
      const key = (e as React.KeyboardEvent).key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(key)) {
        pendingFormatsRef.current = null;
      }
    } else {
      pendingFormatsRef.current = null;
    }
    checkFormats();
  };

  return (
    <div className="note-editor-wrapper app-no-drag">
      <div
        ref={editorRef}
        className="note-editor-content"
        contentEditable={true}
        suppressContentEditableWarning={true}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        data-placeholder={placeholder}
        onBlur={flush}
        onPaste={handlePaste}
        onInput={handleContentChange}
        onKeyUp={handleSelectionReset}
        onMouseUp={handleSelectionReset}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => {
          setIsComposing(false);
          handleContentChange();
        }}
      />
    </div>
  );
};
