#!/bin/sh
# Name: Dashboard probe
# Author: kindle-dash
#
# Read-only: writes what this Kindle offers for frontlight, wake-up alarms,
# suspend and Wi-Fi into /mnt/us/kindle-dash-probe.txt, to tune weather-dashboard.sh.

OUT="/mnt/us/kindle-dash-probe.txt"

section() {
  printf '\n=== %s ===\n' "$1"
}

{
  section "system"
  date
  uname -a
  cat /etc/prettyversion.txt 2>&1
  id

  section "tools"
  for t in curl setsid nohup rtcwake lipc-set-prop lipc-get-prop lipc-probe initctl; do
    printf '%s: %s\n' "$t" "$(command -v "$t" || echo missing)"
  done
  /mnt/us/libkh/bin/fbink --version 2>&1 | head -n 2

  section "backlight"
  for d in /sys/class/backlight/*; do
    [ -d "$d" ] || continue
    echo "$d brightness=$(cat "$d/brightness" 2>&1) actual=$(cat "$d/actual_brightness" 2>&1) max=$(cat "$d/max_brightness" 2>&1)"
    ls -l "$d/brightness" 2>&1
  done

  section "powerd"
  lipc-probe -v com.lab126.powerd 2>&1
  lipc-get-prop com.lab126.powerd status 2>&1

  section "rtc"
  ls -l /dev/rtc* 2>&1
  for r in /sys/class/rtc/rtc*; do
    [ -d "$r" ] || continue
    echo "$r name=$(cat "$r/name" 2>&1) wakealarm=$(cat "$r/wakealarm" 2>&1) wakeup=$(cat "$r/device/power/wakeup" 2>&1)"
    ls -l "$r/wakealarm" 2>&1
  done

  section "rtc alarm arming test (no suspend; alarms are cleared again)"
  for r in /sys/class/rtc/rtc*; do
    [ -w "$r/wakealarm" ] || continue
    echo 0 >"$r/wakealarm" 2>&1
    echo +120 >"$r/wakealarm" 2>&1
    echo "$r write rc=$? since_epoch=$(cat "$r/since_epoch" 2>&1) wakealarm now=$(cat "$r/wakealarm" 2>&1)"
    echo 0 >"$r/wakealarm" 2>&1
  done
  cat /proc/driver/rtc 2>&1

  section "suspend"
  echo "state: $(cat /sys/power/state 2>&1)"
  echo "mem_sleep: $(cat /sys/power/mem_sleep 2>&1)"
  echo "wakeup_count: $(cat /sys/power/wakeup_count 2>&1)"
  cat /sys/power/wake_lock 2>&1
  ls /sys/power 2>&1
  ls /usr/bin /usr/sbin /sbin /bin 2>/dev/null | grep -i -E 'rtc|wake|susp|power' 2>&1

  section "storage"
  mount 2>&1 | grep -E 'mnt|fuse'
  echo "dirty_expire=$(cat /proc/sys/vm/dirty_expire_centisecs 2>&1) dirty_writeback=$(cat /proc/sys/vm/dirty_writeback_centisecs 2>&1)"

  section "kernel log (power, rtc)"
  dmesg 2>&1 | grep -i -E 'rtc|suspend|resume|wake|PM:' | tail -n 60

  section "wifi"
  lipc-get-prop com.lab126.wifid cmState 2>&1
  lipc-probe -v com.lab126.wifid 2>&1
  lipc-probe -v com.lab126.cmd 2>&1

  section "services"
  initctl list 2>&1
} >"$OUT" 2>&1

# Make sure the report is on disk before anything else happens.
sync
sleep 2
sync

echo "Probe finished: kindle-dash-probe.txt written."
