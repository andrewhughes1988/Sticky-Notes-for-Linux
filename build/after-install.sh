#!/bin/bash
# Post-install script for Debian/Ubuntu/Parrot packaging

for s in 16x16 24x24 32x32 48x48 64x64 128x128 256x256 512x512 1024x1024; do
  if [ -f "/usr/share/icons/hicolor/$s/apps/sticky-notes-linux.png" ]; then
    cp -f "/usr/share/icons/hicolor/$s/apps/sticky-notes-linux.png" "/usr/share/icons/hicolor/$s/apps/com.netsysprep.stickynotes.png"
  fi
done

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t /usr/share/icons/hicolor >/dev/null 2>&1 || true
fi

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database -q /usr/share/applications >/dev/null 2>&1 || true
fi
