import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Extension } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { Autosave, AutosaveTimer } from '../utils/autosave';
import { sanitizeHtml, upgradeLegacyChecklistHtml } from '../utils/sanitize';
import { ActiveFormatFlags } from './EditorToolbar';

const compositionPending = new Error('Finish composing text before closing this note.');

export interface RichEditorHandle {
  format: (command: string) => void;
  insertChecklist: () => void;
  flush: () => Promise<void>;
}

interface RichEditorProps {
  initialHtml: string;
  placeholder?: string;
  containerRef: React.RefObject<HTMLDivElement>;
  onChange: (html: string, plainText: string) => Promise<void>;
  onFormatChange?: (formats: ActiveFormatFlags) => void;
  editorRefExpose?: (api: RichEditorHandle) => void;
}

const StickyShortcuts = Extension.create({
  name: 'stickyShortcuts',
  addKeyboardShortcuts() {
    return {
      'Mod-t': () => this.editor.commands.toggleStrike(),
      'Mod-Shift-x': () => this.editor.commands.toggleStrike(),
      'Mod-Shift-l': () => this.editor.commands.toggleBulletList(),
      'Mod-y': () => this.editor.commands.redo(),
    };
  },
});

const StickyTaskItem = TaskItem.extend({
  addNodeView() {
    return ({ node: initialNode, getPos, editor }) => {
      let node = initialNode;

      const listItem = document.createElement('li');
      listItem.dataset.type = 'taskItem';
      listItem.dataset.checked = node.attrs.checked ? 'true' : 'false';
      listItem.classList.add('task-item');
      listItem.classList.toggle('checked', Boolean(node.attrs.checked));

      const checkboxWrapper = document.createElement('label');
      checkboxWrapper.contentEditable = 'false';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'checklist-checkbox';
      checkbox.checked = Boolean(node.attrs.checked);
      checkbox.setAttribute('aria-label', 'Toggle checklist item');

      const content = document.createElement('div');
      content.className = 'checklist-text';

      const getSelectedTaskPositions = (): number[] => {
        const { from, to, empty } = editor.state.selection;
        if (empty) return [];
        const positions: number[] = [];
        editor.state.doc.nodesBetween(from, to, (descendant, pos) => {
          if (descendant.type.name === 'taskItem') {
            positions.push(pos);
            return false;
          }
          return true;
        });
        return positions;
      };

      checkbox.addEventListener('mousedown', (event) => {
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (typeof pos !== 'number') return;
        const selected = getSelectedTaskPositions();
        if (selected.length > 1 && selected.includes(pos)) {
          event.preventDefault();
        }
      });

      checkbox.addEventListener('change', () => {
        if (!editor.isEditable) {
          checkbox.checked = Boolean(node.attrs.checked);
          return;
        }
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (typeof pos !== 'number') return;

        const checked = checkbox.checked;
        const selected = getSelectedTaskPositions();
        const targets = selected.length > 1 && selected.includes(pos) ? selected : [pos];

        const { tr } = editor.state;
        for (const targetPos of targets) {
          const targetNode = tr.doc.nodeAt(targetPos);
          if (targetNode && targetNode.type.name === 'taskItem') {
            tr.setNodeMarkup(targetPos, undefined, { ...targetNode.attrs, checked });
          }
        }
        editor.view.dispatch(tr);
      });

      checkboxWrapper.appendChild(checkbox);
      listItem.appendChild(checkboxWrapper);
      listItem.appendChild(content);

      return {
        dom: listItem,
        contentDOM: content,
        update(updatedNode) {
          if (updatedNode.type !== node.type) return false;
          node = updatedNode;
          const isChecked = Boolean(updatedNode.attrs.checked);
          listItem.dataset.checked = isChecked ? 'true' : 'false';
          listItem.classList.toggle('checked', isChecked);
          checkbox.checked = isChecked;
          return true;
        },
      };
    };
  },
});

export const RichEditor: React.FC<RichEditorProps> = ({
  initialHtml,
  placeholder = 'Take a note...',
  containerRef,
  onChange,
  onFormatChange,
  editorRefExpose,
}) => {
  const composing = useRef(false);
  const [saveError, setSaveError] = useState('');
  const [linkError, setLinkError] = useState(false);
  const autosaveTimer = useRef(new AutosaveTimer());
  const autosave = useRef(new Autosave());
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const initialContent = useMemo(() => upgradeLegacyChecklistHtml(initialHtml), [initialHtml]);

  const editor = useEditor({
    injectCSS: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        orderedList: false,
        dropcursor: false,
        gapcursor: false,
        trailingNode: false,
        undoRedo: { depth: 100 },
        link: {
          openOnClick: false,
          autolink: true,
          protocols: ['http', 'https', 'mailto'],
          HTMLAttributes: {
            rel: 'noopener noreferrer',
          },
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'task-list',
        },
      }),
      StickyTaskItem.configure({
        nested: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      StickyShortcuts,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'note-editor-content',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Note text',
        spellcheck: 'false',
        autocorrect: 'off',
        autocapitalize: 'off',
      },
      transformPastedHTML: (html) => sanitizeHtml(html),
      handleClick: (_view, _pos, event) => {
        if (!event.ctrlKey && !event.metaKey) return false;
        const target = event.target as HTMLElement | null;
        const anchor = target?.closest<HTMLAnchorElement>('a[href]');
        if (anchor?.href) {
          event.preventDefault();
          void window.stickyNotesAPI.openExternalLink(anchor.href).then(
            () => setLinkError(false),
            () => setLinkError(true)
          );
          return true;
        }
        return false;
      },
    },
  });

  const syncFormats = useCallback(() => {
    if (!editor || !onFormatChange) return;
    onFormatChange({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      list: editor.isActive('bulletList'),
      checklist: editor.isActive('taskList'),
    });
  }, [editor, onFormatChange]);

  const flush = useCallback(async () => {
    if (composing.current) {
      setSaveError(compositionPending.message);
      throw compositionPending;
    }
    autosaveTimer.current.reset();
    try {
      await autosave.current.flush(async () => {
        if (composing.current) throw compositionPending;
        if (!editor || editor.isDestroyed) throw new Error('Editor is unavailable');
        const html = editor.getHTML();
        const plain = editor
          .getText({ blockSeparator: '\n' })
          .replace(/\u200B/g, '')
          .trim();
        await onChangeRef.current(html, plain);
      });
      setSaveError('');
    } catch (error) {
      if (error !== compositionPending) setSaveError('Changes could not be saved.');
      throw error;
    }
  }, [editor]);

  const autosaveNow = useCallback(() => {
    if (!composing.current) void flush().catch(() => {});
  }, [flush]);

  const scheduleAutosave = useCallback(() => {
    if (composing.current) return;
    autosave.current.edited();
    autosaveTimer.current.schedule(autosaveNow);
  }, [autosaveNow]);

  // Subscribe to Tiptap update / selection / blur events
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      scheduleAutosave();
      syncFormats();
    };
    const handleSelectionUpdate = () => {
      syncFormats();
    };
    const handleBlur = () => {
      autosaveNow();
    };

    editor.on('update', handleUpdate);
    editor.on('selectionUpdate', handleSelectionUpdate);
    editor.on('blur', handleBlur);
    syncFormats();

    return () => {
      editor.off('update', handleUpdate);
      editor.off('selectionUpdate', handleSelectionUpdate);
      editor.off('blur', handleBlur);
    };
  }, [editor, scheduleAutosave, syncFormats, autosaveNow]);

  // Track IME composition directly on ProseMirror's DOM element
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const timer = autosaveTimer.current;
    const onCompositionStart = () => {
      composing.current = true;
      timer.pause();
    };
    const onCompositionEnd = () => {
      composing.current = false;
      scheduleAutosave();
    };
    dom.addEventListener('compositionstart', onCompositionStart);
    dom.addEventListener('compositionend', onCompositionEnd);
    return () => {
      dom.removeEventListener('compositionstart', onCompositionStart);
      dom.removeEventListener('compositionend', onCompositionEnd);
      timer.reset();
    };
  }, [editor, scheduleAutosave]);

  // Register editor flush handshake ONLY while RichEditor is mounted & ready (Decision D2)
  useEffect(() => {
    if (!editor) return;
    const unsubscribe = window.stickyNotesAPI.onFlushRequested(async () => {
      if (containerRef.current) containerRef.current.inert = true;
      await flush();
    });
    const resume = window.stickyNotesAPI.onFlushCancelled(() => {
      if (containerRef.current) containerRef.current.inert = false;
    });
    return () => {
      unsubscribe();
      resume();
    };
  }, [editor, containerRef, flush]);

  const format = useCallback(
    (command: string) => {
      if (!editor) return;
      const chain = editor.chain().focus();
      if (command === 'bold') chain.toggleBold().run();
      else if (command === 'italic') chain.toggleItalic().run();
      else if (command === 'underline') chain.toggleUnderline().run();
      else if (command === 'strikeThrough') chain.toggleStrike().run();
      else if (command === 'insertUnorderedList') chain.toggleBulletList().run();
      else if (command === 'insertChecklist') chain.toggleTaskList().run();
      syncFormats();
    },
    [editor, syncFormats]
  );

  const insertChecklist = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().toggleTaskList().run();
    syncFormats();
  }, [editor, syncFormats]);

  useEffect(() => {
    if (editorRefExpose) {
      editorRefExpose({ format, insertChecklist, flush });
    }
  }, [editorRefExpose, format, insertChecklist, flush]);

  return (
    <div className="note-editor-wrapper app-no-drag">
      <EditorContent editor={editor} className="note-editor-tiptap" />
      {linkError && (
        <div role="alert" className="editor-error-banner app-no-drag">
          <span>Could not open this link.</span>
          <button type="button" className="inline-retry-btn" onClick={() => setLinkError(false)}>
            Dismiss
          </button>
        </div>
      )}
      {saveError && (
        <div role="alert" className="editor-error-banner app-no-drag">
          <span>{saveError}</span>
          <button type="button" className="inline-retry-btn" onClick={autosaveNow}>
            Retry save
          </button>
        </div>
      )}
    </div>
  );
};
