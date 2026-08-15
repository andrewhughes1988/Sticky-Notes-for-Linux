import React from 'react';
import { Check, Type, X } from 'lucide-react';

export interface FontOption {
  id: string;
  name: string;
  category: 'Modern Sans' | 'Handwritten' | 'Monospace' | 'System';
  fontFamily: string;
  sample: string;
}

export const MANAGER_FONTS: FontOption[] = [
  {
    id: 'system',
    name: 'System Default',
    category: 'System',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", Roboto, sans-serif',
    sample: 'Clean standard interface font',
  },
  {
    id: 'plus-jakarta',
    name: 'Plus Jakarta Sans',
    category: 'Modern Sans',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    sample: 'Geometric punchy sans',
  },
  {
    id: 'inter',
    name: 'Inter',
    category: 'Modern Sans',
    fontFamily: "'Inter', sans-serif",
    sample: 'Ultra-crisp modern legibility',
  },
  {
    id: 'outfit',
    name: 'Outfit',
    category: 'Modern Sans',
    fontFamily: "'Outfit', sans-serif",
    sample: 'Contemporary balanced curves',
  },
  {
    id: 'nunito',
    name: 'Nunito',
    category: 'Modern Sans',
    fontFamily: "'Nunito', sans-serif",
    sample: 'Soft & approachable rounded sans',
  },
  {
    id: 'caveat',
    name: 'Caveat',
    category: 'Handwritten',
    fontFamily: "'Caveat', cursive, sans-serif",
    sample: 'Natural flowing handwriting',
  },
  {
    id: 'kalam',
    name: 'Kalam',
    category: 'Handwritten',
    fontFamily: "'Kalam', cursive, sans-serif",
    sample: 'Neat ballpoint note style',
  },
  {
    id: 'patrick-hand',
    name: 'Patrick Hand',
    category: 'Handwritten',
    fontFamily: "'Patrick Hand', cursive, sans-serif",
    sample: 'Friendly schoolhouse lettering',
  },
  {
    id: 'architects-daughter',
    name: 'Architects Daughter',
    category: 'Handwritten',
    fontFamily: "'Architects Daughter', cursive, sans-serif",
    sample: 'Architectural drafting style',
  },
  {
    id: 'jetbrains-mono',
    name: 'JetBrains Mono',
    category: 'Monospace',
    fontFamily: "'JetBrains Mono', monospace",
    sample: 'Technical monospace code look',
  },
];

interface FontPickerProps {
  currentFontId: string;
  onSelectFont: (font: FontOption) => void;
  onClose: () => void;
}

export const FontPicker: React.FC<FontPickerProps> = ({
  currentFontId,
  onSelectFont,
  onClose,
}) => {
  const categories: Array<'System' | 'Modern Sans' | 'Handwritten' | 'Monospace'> = [
    'System',
    'Modern Sans',
    'Handwritten',
    'Monospace',
  ];

  return (
    <>
      {/* Click-outside Backdrop */}
      <div
        className="font-picker-backdrop"
        onClick={onClose}
      />

      <div className="font-picker-popover app-no-drag">
        <div className="font-picker-header">
          <div className="font-picker-title">
            <Type size={15} />
            <span>Manager Typography</span>
          </div>
          <button
            type="button"
            className="font-picker-close-btn"
            title="Close font picker"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>

        <div className="font-picker-list">
          {categories.map((category) => {
            const fontsInCat = MANAGER_FONTS.filter((f) => f.category === category);
            if (fontsInCat.length === 0) return null;

            return (
              <div key={category} className="font-category-group">
                <div className="font-category-label">{category}</div>
                {fontsInCat.map((font) => {
                  const isSelected = font.id === currentFontId;
                  return (
                    <button
                      key={font.id}
                      type="button"
                      className={`font-option-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        onSelectFont(font);
                        onClose();
                      }}
                    >
                      <div className="font-option-info">
                        <span
                          className="font-option-name"
                          style={{ fontFamily: font.fontFamily }}
                        >
                          {font.name}
                        </span>
                        <span
                          className="font-option-sample"
                          style={{ fontFamily: font.fontFamily }}
                        >
                          {font.sample}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="font-option-check">
                          <Check size={16} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
