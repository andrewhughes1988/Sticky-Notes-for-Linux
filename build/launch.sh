#!/bin/sh
set -eu

binary="$(dirname "$(readlink -f "$0")")/sticky-notes-linux.bin"
platform_set=false
for arg in "$@"; do
  case "$arg" in
    --ozone-platform|--ozone-platform=*) platform_set=true ;;
  esac
done

if [ "$platform_set" = false ]; then
  if [ -n "${DISPLAY:-}" ]; then
    set -- --ozone-platform=x11 "$@"
  elif [ -n "${WAYLAND_DISPLAY:-}" ]; then
    set -- --ozone-platform=wayland "$@"
  fi
fi

exec "$binary" --class=com.netsysprep.stickynotes "$@"
