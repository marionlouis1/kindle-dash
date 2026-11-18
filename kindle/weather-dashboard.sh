#!/bin/sh
# Name: Weather dashboard
# Author: kindle-dash
#
# Kindle side of kindle-dash, packaged as a scriptlet: copy this file into the
# Kindle's documents folder and it shows up in the library; tap it to turn the
# dashboard on, tap it again to turn it off.
#
# While it is on, the dashboard replaces the Kindle's sleep screen: press the
# power button and the weather appears instead of the screensaver. The Kindle
# then really sleeps (e-ink keeps the image, the light is off) and its power
# manager wakes it briefly for each refresh. Press the power button again to
# get the normal Kindle back.
#
# Direct suspend (echo mem > /sys/power/state) does not wake up again on the
# Paperwhite 11, so sleeping and waking are left to powerd: we only draw over
# its screensaver and tell it when to wake next (rtcWakeup).
#
#   (no argument)  toggle on/off
#   once           fetch and draw a single time

URL="https://marionlouis1.github.io/kindle-dash/dash.png"
INTERVAL=1800 # seconds between refreshes (30 minutes)

FBINK="/mnt/us/libkh/bin/fbink"
IMG="/tmp/kindle-dash.png"
PID="/tmp/kindle-dash.pid"
BUSY="/tmp/kindle-dash.busy"
DUE="/tmp/kindle-dash.due"
ASLEEP="/tmp/kindle-dash.asleep"
VERSION="/tmp/kindle-dash.version"
WOKE="/tmp/kindle-dash.woke"
LOG="/mnt/us/kindle-dash.log"

# Optional overrides (same variable names as above), handy for testing with a
# short INTERVAL without editing this file. Delete the file to go back to defaults.
CONF="/mnt/us/kindle-dash.conf"
# shellcheck disable=SC1090
[ -f "$CONF" ] && . "$CONF"

log() {
  echo "$(date '+%F %T') $*" >>"$LOG"
}

# Keep the log from growing forever on the user partition.
trim_log() {
  [ -f "$LOG" ] && [ "$(wc -l <"$LOG")" -gt 600 ] || return 0
  tail -n 300 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"
}

# Only ever draw over the sleep screen, never over the Kindle's UI. Pass
# "quiet" to redraw without the black flash (invisible if nothing changed).
paint() {
  [ -f "$ASLEEP" ] && [ -s "$IMG" ] || return 0
  if [ "$1" = quiet ]; then
    "$FBINK" -q -g file="$IMG" >/dev/null 2>&1
  else
    "$FBINK" -q -c -f -g file="$IMG" >/dev/null 2>&1
  fi
}

wifi_state() {
  lipc-get-prop com.lab126.wifid cmState 2>/dev/null
}

# Wait up to $1 seconds for Wi-Fi; succeeds as soon as it is connected.
connected_within() {
  n=0
  while [ "$n" -lt "$1" ]; do
    [ "$(wifi_state)" = "CONNECTED" ] && return 0
    n=$((n + 1))
    sleep 1
  done
  return 1
}

power_state() {
  lipc-get-prop com.lab126.powerd state 2>/dev/null
}

has_ip() {
  ifconfig wlan0 2>/dev/null | grep -q 'inet addr'
}

wpa_state() {
  wpa_cli -i wlan0 status 2>/dev/null | sed -n 's/^wpa_state=//p'
}

# Wait up to $2 seconds for the command $1 to succeed.
within() {
  n=0
  while [ "$n" -lt "$2" ]; do
    "$1" && return 0
    n=$((n + 1))
    sleep 1
  done
  return 1
}

associated() {
  [ "$(wpa_state)" = COMPLETED ]
}

# When the Kindle wakes itself (not by the power button) it stays on its sleep
# screen with Wi-Fi down, and neither the Wi-Fi services nor wpa_supplicant
# reconnect when asked. powerd's sendPendingResume does it: the services get
# their "resuming" notice and Wi-Fi comes back in a few seconds, while the
# Kindle stays on the sleep screen (no UI, no light).
quiet_wifi() {
  within has_ip 2 && return 0
  lipc-set-prop com.lab126.powerd sendPendingResume 1 2>/dev/null
  if within associated 12 && within has_ip 8; then
    return 0
  fi
  log "quiet wifi failed: wpa $(wpa_state), wifid $(wifi_state), powerd $(power_state)"
  return 1
}

# The fallback, should the quiet way fail: wake the Kindle fully, as a press of the
# power button would, so its own services reconnect; refresh() puts it back to
# sleep afterwards. The Kindle's UI shows for a few seconds.
wake_wifi() {
  connected_within 2 && return 0
  log "wifi $(wifi_state) at wake, powerd $(power_state)"
  lipc-set-prop com.lab126.powerd wakeUp 1 2>/dev/null
  sleep 2
  if [ "$(power_state)" != active ]; then
    log "wakeUp left powerd $(power_state); pressing the power button instead"
    lipc-set-prop com.lab126.powerd powerButton 1 2>/dev/null
    sleep 2
  fi
  [ "$(power_state)" = active ] && touch "$WOKE"
  if connected_within 30; then
    log "wifi up (powerd $(power_state))"
    return 0
  fi
  log "wifi still $(wifi_state) (powerd $(power_state))"
  return 1
}

# Fetch a fresh image and schedule the next refresh. The timestamp in the URL
# skips the CDN's 10-minute cache so every refresh really is current.
fetch() {
  tries=0
  while [ "$tries" -lt "${1:-3}" ]; do
    tries=$((tries + 1))
    if curl -fsSL --max-time 20 -o "$IMG.new" "$URL?t=$(date +%s)" && [ -s "$IMG.new" ]; then
      mv "$IMG.new" "$IMG"
      echo $(($(date +%s) + INTERVAL)) >"$DUE"
      trim_log
      log "fetched (attempt $tries, battery $(lipc-get-prop com.lab126.powerd battLevel 2>/dev/null)%)"
      return 0
    fi
    rm -f "$IMG.new"
    sleep 3
  done
  # No network: try again later rather than waking every minute and draining
  # the battery (at most 10 minutes, or the normal interval if that is shorter).
  retry=$INTERVAL
  [ "$retry" -gt 600 ] && retry=600
  echo $(($(date +%s) + retry)) >"$DUE"
  log "fetch failed after $tries attempts; next try in ${retry}s"
  return 1
}

# Seconds until the next refresh is due (never less than a minute).
seconds_left() {
  left=$(($(cat "$DUE" 2>/dev/null || echo 0) - $(date +%s)))
  [ "$left" -lt 60 ] && left=60
  echo "$left"
}

# Runs in the background so the event loop stays free to arm the wake-up alarm.
refresh() {
  [ -f "$BUSY" ] && return 0
  touch "$BUSY"
  if quiet_wifi && fetch 1; then
    paint
    log "refreshed without waking"
  else
    wake_wifi
    fetch && paint
  fi
  # If we had to wake the Kindle for Wi-Fi, send it back to sleep; the
  # goingToScreenSaver handler then draws the new image over the screensaver.
  if [ -f "$WOKE" ]; then
    rm -f "$WOKE"
    if [ "$(power_state)" = active ]; then
      lipc-set-prop com.lab126.powerd powerButton 1 2>/dev/null
      log "sent back to sleep"
    fi
  fi
  rm -f "$BUSY"
}

events() {
  lipc-wait-event -m com.lab126.powerd goingToScreenSaver,outOfScreenSaver,readyToSuspend,wakeupFromSuspend,resuming |
    while read -r event args; do
      # readyToSuspend repeats every few seconds while the Kindle counts down.
      [ "$event" = readyToSuspend ] || log "event $event $args"
      case "$event" in
        goingToScreenSaver)
          touch "$ASLEEP"
          # The stock screensaver takes a few seconds to draw; cover it after.
          (sleep 5 && paint && log "painted over screensaver") &
          [ "$(seconds_left)" -le 60 ] && refresh &
          ;;
        outOfScreenSaver)
          rm -f "$ASLEEP"
          ;;
        readyToSuspend)
          left=$(seconds_left)
          lipc-set-prop -i com.lab126.powerd rtcWakeup "$left" ||
            log "could not set the wake-up alarm"
          # Last chance before the Kindle sleeps: make sure our image is on top.
          paint quiet
          ;;
        wakeupFromSuspend | resuming)
          # Woken by our alarm (refresh is due) or by the power button (not due).
          [ "$(seconds_left)" -le 60 ] && refresh &
          ;;
      esac
    done
}

running() {
  [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null
}

case "${1:-toggle}" in
  toggle)
    if running; then
      # The daemon leads its own process group; take lipc-wait-event down with it.
      kill -- "-$(cat "$PID")" 2>/dev/null || kill "$(cat "$PID")"
      rm -f "$PID" "$BUSY" "$DUE" "$ASLEEP" "$WOKE"
      # A daemon left over from an older copy of this file (it survives a USB
      # connection) is replaced rather than switched off, so that one tap after
      # an update always means "on".
      if [ "$(cat "$VERSION" 2>/dev/null)" = "$(md5sum <"$0")" ]; then
        log "stopped"
        echo "Weather dashboard is OFF."
        exit 0
      fi
      log "replacing daemon from an older version"
    fi
    trim_log
    md5sum <"$0" >"$VERSION"
    setsid sh "$0" daemon >/dev/null 2>&1 &
    echo "Weather dashboard is ON."
    echo "Press the power button to show it."
    ;;
  daemon)
    echo $$ >"$PID"
    rm -f "$BUSY" "$ASLEEP" "$WOKE"
    log "started (interval ${INTERVAL}s)"
    fetch
    events
    ;;
  once)
    touch "$ASLEEP"
    fetch && paint
    rm -f "$ASLEEP"
    ;;
  *)
    echo "usage: $0 [once]" >&2
    exit 1
    ;;
esac
