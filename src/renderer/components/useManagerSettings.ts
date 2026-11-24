import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { AppTheme, EncryptionStatus } from '../../shared/types';

export function useManagerSettings(
  setActionError: Dispatch<SetStateAction<string | null>>,
  setActionStatus: Dispatch<SetStateAction<string | null>>
) {
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [themePref, setThemePref] = useState<AppTheme>('system');
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
  const [isUpdatingAutostart, setIsUpdatingAutostart] = useState(false);
  const [autostartError, setAutostartError] = useState<string | null>(null);
  const [encryption, setEncryption] = useState<EncryptionStatus | null>(null);
  const [isUpdatingEncryption, setIsUpdatingEncryption] = useState(false);
  const [backupCount, setBackupCount] = useState(0);
  const [settingsRetry, setSettingsRetry] = useState(0);
  const isDarkMode = themePref === 'dark' || (themePref === 'system' && systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  }, []);

  const toggleTheme = useCallback(async () => {
    const next: AppTheme = isDarkMode ? 'light' : 'dark';
    setThemePref(next);
    try {
      await window.stickyNotesAPI.setConfig('theme', next);
    } catch {
      setActionError('Could not save theme preference.');
    }
  }, [isDarkMode, setActionError]);

  // Load settings from SQLite + migrate legacy localStorage('manager_theme') once
  useEffect(() => {
    let active = true;
    let receivedAutostart = false;
    let receivedTheme = false;

    const unsubscribe = window.stickyNotesAPI.onSettingsChanged((key, value) => {
      if (key === 'autostart' && typeof value === 'boolean') {
        receivedAutostart = true;
        setAutostart(value);
        setAutostartError(null);
      } else if (key === 'theme' && (value === 'system' || value === 'light' || value === 'dark')) {
        receivedTheme = true;
        setThemePref(value);
      }
    });

    window.stickyNotesAPI.getConfig().then(
      (config) => {
        if (!active) return;
        if (!receivedAutostart) {
          setAutostart(config.autostart);
          setAutostartError(null);
        }
        if (!receivedTheme) {
          let resolvedTheme: AppTheme = config.theme;
          try {
            const legacy = localStorage.getItem('manager_theme');
            if ((legacy === 'dark' || legacy === 'light') && config.theme === 'system') {
              resolvedTheme = legacy;
              void window.stickyNotesAPI.setConfig('theme', legacy).catch(() => {});
            }
            if (legacy !== null) localStorage.removeItem('manager_theme');
          } catch {
            // Ignore storage access errors
          }
          setThemePref(resolvedTheme);
        }
      },
      () => {
        if (active && !receivedAutostart) {
          setAutostartError('Could not load settings.');
        }
      }
    );

    window.stickyNotesAPI
      .getMigrationBackupCount()
      .then((count) => {
        if (active) setBackupCount(count);
      })
      .catch(() => {});

    window.stickyNotesAPI
      .getEncryptionStatus()
      .then((status) => {
        if (active) setEncryption(status);
      })
      .catch(() => {});

    return () => {
      active = false;
      unsubscribe();
    };
  }, [settingsRetry]);

  const handleAutostartChange = useCallback(async (enabled: boolean) => {
    setIsUpdatingAutostart(true);
    setAutostartError(null);
    try {
      await window.stickyNotesAPI.setConfig('autostart', enabled);
      setAutostart(enabled);
    } catch {
      setAutostartError('Could not change the startup setting. Try again.');
    } finally {
      setIsUpdatingAutostart(false);
    }
  }, []);

  const handleEncryptionChange = useCallback(
    async (enabled: boolean) => {
      setIsUpdatingEncryption(true);
      setActionError(null);
      setActionStatus(null);
      try {
        const updated = await window.stickyNotesAPI.setEncryptionEnabled(enabled);
        setEncryption(updated);
        setActionStatus(
          updated.enabled ? 'Notes are now encrypted at rest.' : 'Note encryption disabled.'
        );
      } catch {
        setActionError('Could not update encryption setting. Verify your OS keyring is unlocked.');
      } finally {
        setIsUpdatingEncryption(false);
      }
    },
    [setActionError, setActionStatus]
  );

  const handlePurgeBackups = useCallback(async () => {
    setActionError(null);
    setActionStatus(null);
    try {
      const removed = await window.stickyNotesAPI.purgeMigrationBackups();
      setBackupCount(0);
      setActionStatus(`Removed ${removed} pre-upgrade backup file${removed === 1 ? '' : 's'}.`);
    } catch {
      setActionError('Could not remove pre-upgrade backups.');
    }
  }, [setActionError, setActionStatus]);

  const handleRetrySettings = useCallback(() => {
    setSettingsRetry((value) => value + 1);
  }, []);

  return {
    isDarkMode,
    autostart,
    isUpdatingAutostart,
    autostartError,
    encryption,
    isUpdatingEncryption,
    backupCount,
    toggleTheme,
    handleAutostartChange,
    handleEncryptionChange,
    handlePurgeBackups,
    handleRetrySettings,
  };
}
