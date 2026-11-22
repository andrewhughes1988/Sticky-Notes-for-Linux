import React, { useLayoutEffect, useRef } from 'react';
import { NoteColor, NOTE_COLORS } from '../../shared/types';
import { List, Trash2 } from 'lucide-react';

interface ColorPickerProps {
  currentColor: NoteColor;
  onSelectColor: (color: NoteColor) => void;
  onOpenManager: () => void;
  onDeleteNote: () => void;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement>;
}

const colors = Object.keys(NOTE_COLORS) as NoteColor[];

const ColorPickerComponent: React.FC<ColorPickerProps> = ({
  currentColor,
  onSelectColor,
  onOpenManager,
  onDeleteNote,
  onClose,
  triggerRef,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const trigger = triggerRef?.current ?? document.activeElement;
    const popover = popoverRef.current;
    popover?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();

    return () => {
      if (
        trigger instanceof HTMLElement && trigger.isConnected
        && (popover?.contains(document.activeElement) || document.activeElement === document.body)
      ) trigger.focus();
    };
  }, [triggerRef]);

  return (
    <>
      <div className="color-menu-backdrop app-no-drag" aria-hidden="true" onClick={onClose} />

      <div
        ref={popoverRef}
        className="color-menu-popover app-no-drag"
        role="dialog"
        aria-label="Note options"
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (next && next !== triggerRef?.current && !event.currentTarget.contains(next)) onClose();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="color-palette-grid" role="group" aria-label="Note colors">
          {colors.map((colorKey) => {
            const def = NOTE_COLORS[colorKey];
            const isSelected = colorKey === currentColor;
            return (
              <button
                key={colorKey}
                type="button"
                className={`color-swatch ${isSelected ? 'active' : ''}`}
                style={{ backgroundColor: def.dotColor }}
                aria-label={def.name}
                aria-pressed={isSelected}
                title={def.name}
                onClick={() => {
                  onSelectColor(colorKey);
                  onClose();
                }}
              />
            );
          })}
        </div>

        <div className="color-menu-divider" />

        <button type="button" className="color-menu-item" onClick={() => {
          onOpenManager();
          onClose();
        }}>
          <List size={16} />
          <span>Notes list</span>
        </button>

        <button type="button" className="color-menu-item delete-item" onClick={() => {
          onDeleteNote();
          onClose();
        }}>
          <Trash2 size={16} />
          <span>Delete note</span>
        </button>
      </div>
    </>
  );
};

export const ColorPicker = React.memo(ColorPickerComponent);
