import React, { useRef, useEffect, useState, useCallback } from 'react';
import { sanitizeHtml } from '../utils/sanitize';

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

  // Update format states on selection change
  const checkFormats = useCallback(() => {
    if (!onFormatChange) return;
    try {
      const selection = window.getSelection();
      const inChecklist = Boolean(
        selection && selection.anchorNode && getParentChecklistItem(selection.anchorNode)
      );
      const inBulletList = !inChecklist && Boolean(
        selection && selection.anchorNode && getParentListItem(selection.anchorNode)
      );

      onFormatChange({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
        list: inBulletList,
        checklist: inChecklist,
      });
    } catch {
      // Ignore
    }
  }, [onFormatChange]);

  const handleContentChange = useCallback(() => {
    if (!editorRef.current || isComposing) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (!editorRef.current) return;
      const html = editorRef.current.innerHTML;
      const plain = editorRef.current.innerText || '';
      onChange(html, plain);
    }, 300);
  }, [isComposing, onChange]);

  // Execute formatting command with mutual exclusivity between Checklist and Bullet list
  const format = useCallback(
    (command: string, value: string = '') => {
      if (!editorRef.current) return;
      editorRef.current.focus();

      const selection = window.getSelection();

      if (command === 'insertUnorderedList' && selection && selection.rangeCount > 0) {
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
      }

      document.execCommand(command, false, value);
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

  // Expose formatting APIs to parent
  useEffect(() => {
    if (editorRefExpose) {
      editorRefExpose({ format, insertChecklist: toggleChecklist });
    }
  }, [editorRefExpose, format, toggleChecklist]);

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

  return (
    <div className="note-editor-wrapper app-no-drag">
      <div
        ref={editorRef}
        className="note-editor-content"
        contentEditable={true}
        suppressContentEditableWarning={true}
        data-placeholder={placeholder}
        onInput={handleContentChange}
        onKeyUp={checkFormats}
        onMouseUp={checkFormats}
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
