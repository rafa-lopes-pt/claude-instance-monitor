# Implementation Summary

## Architecture

TypeScript + Node.js TUI using blessed. Linux only (reads `/proc` filesystem).

```
src/
  index.ts           -- Entry point, event loop, keybindings, CLI flag parsing
  models.ts          -- ClaudeInstance, ActivityMetrics, InstanceStatus (Active/Idle), ProjectGroup
  monitor.ts         -- Process detection via /proc scan (comm name matching "claude")
  state-detector.ts  -- Status detection from rchar/wchar and CPU ticks
  sticky.ts          -- X11 sticky window support via wmctrl
  notifications.ts   -- Desktop notifications via notify-send on Active->Idle transitions
  utils.ts           -- Formatting (status labels/colors, path abbreviation, duration, grouping)
  ui/
    renderer.ts      -- blessed TUI: header, scrollable list, footer with feature status
```

## Key Design Decisions

**Status detection uses rchar/wchar, not read_bytes/write_bytes.**
Physical disk I/O (`read_bytes`/`write_bytes` in `/proc/[pid]/io`) is dominated by page cache noise -- both idle and active Claude instances show ~4096 bytes/sec of disk writes. The `rchar`/`wchar` counters capture total I/O including sockets and pipes, giving a clear signal: ~57 B/s idle vs ~700 KB/s active.

**Two status states instead of five.**
Originally planned for Thinking/Working/Responding/WaitingInput/Idle. In practice, distinguishing between these substates reliably from /proc metrics alone isn't feasible. Active (doing work) vs Idle (waiting) covers the real use case: knowing which instance needs attention.

**Sticky window via wmctrl, not custom X11 bindings.**
Using `wmctrl -i -r <id> -b add,sticky` avoids linking against X11 libraries. Window ID found via `$WINDOWID` env var (fast path), falling back to PID matching or title matching.

**Notifications use notify-send, not a Node.js library.**
Avoids adding a dependency. `notify-send` (libnotify) is available on virtually all Linux desktops.

**3-second activity debounce.**
After detecting activity, the instance stays "Active" for 3 seconds even if metrics drop. Prevents flickering during brief pauses in API streaming.

## Thresholds

| Signal | Threshold | Source |
|--------|-----------|--------|
| CPU delta | 10 ticks | `/proc/[pid]/stat` fields 14+15 |
| I/O delta | 4096 bytes | `rchar`/`wchar` from `/proc/[pid]/io` |
| Activity debounce | 3 seconds | Time since last activity burst |

## Update Cycle

- Full `/proc` scan every 10 seconds to discover new processes
- Quick existence check every 1 second for known PIDs
- Metrics collected and status updated every 1 second
- UI re-renders on each refresh cycle

## Dependencies

- **Runtime**: blessed (TUI framework)
- **Dev**: typescript, ts-node, @types/node, @types/blessed
- **System**: wmctrl (optional), notify-send (optional)
