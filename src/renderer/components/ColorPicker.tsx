import React from 'react';
import { NoteColor, NOTE_COLORS } from '../../shared/types';
import { List, Trash2 } from 'lucide-react';

interface ColorPickerProps {
  currentColor: NoteColor;
  onSelectColor: (color: NoteColor) => void;
  onOpenManager: () => void;
  onDeleteNote: () => void;
  onClose: () => void;
}

const ColorPickerComponent: React.FC<ColorPickerProps> = ({
  currentColor,
  onSelectColor,
  onOpenManager,
  onDeleteNote,
  onClose,
}) => {
  const colors: NoteColor[] = ['yellow', 'green', 'pink', 'purple', 'blue', 'charcoal', 'white'];

  return (
    <>
      {/* Backdrop to close when clicking outside */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 90,
        }}
        onClick={onClose}
      />

      <div className="color-menu-popover app-no-drag">
        {/* Color Palette Row */}
        <div className="color-palette-grid">
          {colors.map((colorKey) => {
            const def = NOTE_COLORS[colorKey];
            const isSelected = colorKey === currentColor;
            return (
              <div
                key={colorKey}
                className={`color-swatch ${isSelected ? 'active' : ''}`}
                style={{ backgroundColor: def.dotColor }}
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

        {/* Notes list link */}
        <button
          className="color-menu-item"
          onClick={() => {
            onOpenManager();
            onClose();
          }}
        >
          <List size={16} />
          <span>Notes list</span>
        </button>

        {/* Delete note */}
        <button
          className="color-menu-item delete-item"
          onClick={() => {
            onDeleteNote();
            onClose();
          }}
        >
          <Trash2 size={16} />
          <span>Delete note</span>
        </button>
      </div>
    </>
  );
};

export const ColorPicker = React.memo(ColorPickerComponent);
