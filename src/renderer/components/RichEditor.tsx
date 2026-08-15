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

  // Update format states on selection change
  const checkFormats = useCallback(() => {
    if (!onFormatChange) return;
    try {
      onFormatChange({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
        list: document.queryCommandState('insertUnorderedList'),
      });
    } catch {
      // Ignore
    }
  }, [onFormatChange]);

  // Execute formatting command
  const format = useCallback(
    (command: string, value: string = '') => {
      if (!editorRef.current) return;
      editorRef.current.focus();
      document.execCommand(command, false, value);
      checkFormats();
      handleContentChange();
    },
    [checkFormats]
  );

  // Insert an interactive checklist item
  const insertChecklist = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const checklistDiv = document.createElement('div');
    checklistDiv.className = 'checklist-item';
    checklistDiv.innerHTML = `<input type="checkbox" class="checklist-checkbox" /><span>&nbsp;</span>`;

    range.deleteContents();
    range.insertNode(checklistDiv);

    // Place cursor in span
    const span = checklistDiv.querySelector('span');
    if (span) {
      const newRange = document.createRange();
      newRange.setStart(span, 0);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }

    handleContentChange();
  }, []);

  // Expose formatting APIs to parent
  useEffect(() => {
    if (editorRefExpose) {
      editorRefExpose({ format, insertChecklist });
    }
  }, [editorRefExpose, format, insertChecklist]);

  // Initial HTML mount
  useEffect(() => {
    if (editorRef.current && initialHtml !== undefined) {
      const sanitized = sanitizeHtml(initialHtml);
      if (editorRef.current.innerHTML !== sanitized) {
        editorRef.current.innerHTML = sanitized;
      }
    }
  }, []);

  const handleContentChange = () => {
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
  };

  // Keyboard shortcut listener
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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
