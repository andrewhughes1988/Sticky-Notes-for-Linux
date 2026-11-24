import React, { useLayoutEffect, useRef } from 'react';
import { Download, FileText, Lock, Moon, Sun, Trash2, Power, ShieldAlert } from 'lucide-react';
import { EncryptionStatus } from '../../shared/types';

interface ManagerMenuProps {
  isDarkMode: boolean;
  isTrashView: boolean;
  autostart: boolean | null;
  isUpdatingAutostart: boolean;
  autostartError: string | null;
  encryption: EncryptionStatus | null;
  isUpdatingEncryption: boolean;
  backupCount: number;
  triggerRef: React.RefObject<HTMLButtonElement>;
  onToggleTheme: () => void;
  onToggleAutostart: (enabled: boolean) => void;
  onRetrySettings: () => void;
  onToggleEncryption: (enabled: boolean) => void;
  onToggleTrashView: () => void;
  onExportJson: () => void;
  onExportMarkdown: () => void;
  onPurgeBackups: () => void;
  onClose: () => void;
}

const ManagerMenuComponent: React.FC<ManagerMenuProps> = ({
  isDarkMode,
  isTrashView,
  autostart,
  isUpdatingAutostart,
  autostartError,
  encryption,
  isUpdatingEncryption,
  backupCount,
  triggerRef,
  onToggleTheme,
  onToggleAutostart,
  onRetrySettings,
  onToggleEncryption,
  onToggleTrashView,
  onExportJson,
  onExportMarkdown,
  onPurgeBackups,
  onClose,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const trigger = triggerRef.current ?? document.activeElement;
    const popover = popoverRef.current;
    popover?.querySelector<HTMLElement>('button:not(:disabled)')?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    popover?.addEventListener('keydown', handleKeyDown);

    return () => {
      popover?.removeEventListener('keydown', handleKeyDown);
      if (
        trigger instanceof HTMLElement &&
        trigger.isConnected &&
        (popover?.contains(document.activeElement) || document.activeElement === document.body)
      ) {
        trigger.focus();
      }
    };
  }, [triggerRef, onClose]);

  return (
    <>
      <div className="color-menu-backdrop app-no-drag" aria-hidden="true" onClick={onClose} />

      <div
        ref={popoverRef}
        className="manager-menu-popover app-no-drag"
        role="dialog"
        aria-label="Settings and actions"
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (next && next !== triggerRef.current && !event.currentTarget.contains(next)) {
            onClose();
          }
        }}
      >
        <div className="manager-menu-section-label">Preferences</div>

        <button
          type="button"
          className="manager-menu-item manager-menu-toggle-item"
          role="switch"
          aria-checked={isDarkMode}
          onClick={onToggleTheme}
        >
          <span className="manager-menu-item-left">
            {isDarkMode ? (
              <Moon size={15} aria-hidden="true" />
            ) : (
              <Sun size={15} aria-hidden="true" />
            )}
            <span>Dark mode</span>
          </span>
          <span className={`menu-switch-pill ${isDarkMode ? 'on' : ''}`} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="manager-menu-item manager-menu-toggle-item"
          role="switch"
          aria-checked={autostart ?? false}
          disabled={autostart === null || isUpdatingAutostart}
          onClick={() => onToggleAutostart(!(autostart ?? false))}
        >
          <span className="manager-menu-item-left">
            <Power size={15} aria-hidden="true" />
            <span>Start at login</span>
          </span>
          <span className={`menu-switch-pill ${autostart ? 'on' : ''}`} aria-hidden="true" />
        </button>

        {autostartError && (
          <div className="manager-menu-inline-error" role="alert">
            <span>{autostartError}</span>
            {autostart === null && (
              <button type="button" className="inline-retry-btn" onClick={onRetrySettings}>
                Retry
              </button>
            )}
          </div>
        )}

        {encryption && (
          <button
            type="button"
            className="manager-menu-item manager-menu-toggle-item"
            role="switch"
            aria-checked={encryption.enabled}
            disabled={(!encryption.available && !encryption.enabled) || isUpdatingEncryption}
            title={
              encryption.available
                ? `Encrypt notes at rest using OS keyring (${encryption.backend})`
                : 'Requires a desktop OS keyring (e.g., KWallet or GNOME Keyring)'
            }
            onClick={() => onToggleEncryption(!encryption.enabled)}
          >
            <span className="manager-menu-item-left">
              <Lock size={15} aria-hidden="true" />
              <span>Encrypt at rest</span>
            </span>
            <span
              className={`menu-switch-pill ${encryption.enabled ? 'on' : ''}`}
              aria-hidden="true"
            />
          </button>
        )}

        <div className="color-menu-divider" />
        <div className="manager-menu-section-label">Data &amp; Recovery</div>

        <button
          type="button"
          className="manager-menu-item"
          onClick={() => {
            onToggleTrashView();
            onClose();
          }}
        >
          <span className="manager-menu-item-left">
            <Trash2 size={15} aria-hidden="true" />
            <span>{isTrashView ? 'Back to notes' : 'Open Trash'}</span>
          </span>
        </button>

        <button
          type="button"
          className="manager-menu-item"
          onClick={() => {
            onExportJson();
            onClose();
          }}
        >
          <span className="manager-menu-item-left">
            <Download size={15} aria-hidden="true" />
            <span>Export as JSON</span>
          </span>
        </button>

        <button
          type="button"
          className="manager-menu-item"
          onClick={() => {
            onExportMarkdown();
            onClose();
          }}
        >
          <span className="manager-menu-item-left">
            <FileText size={15} aria-hidden="true" />
            <span>Export as Markdown</span>
          </span>
        </button>

        {backupCount > 0 && (
          <>
            <div className="color-menu-divider" />
            <button
              type="button"
              className="manager-menu-item"
              onClick={() => {
                onPurgeBackups();
                onClose();
              }}
            >
              <span className="manager-menu-item-left">
                <ShieldAlert size={15} aria-hidden="true" />
                <span>
                  Remove pre-upgrade backup{backupCount === 1 ? '' : 's'} ({backupCount})
                </span>
              </span>
            </button>
          </>
        )}
      </div>
    </>
  );
};

export const ManagerMenu = React.memo(ManagerMenuComponent);
