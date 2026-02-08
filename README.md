# Claude Instance Monitor

TUI dashboard to monitor multiple Claude Code instances across terminals on multiple workspaces. Shows which instances are active vs idle so you know where to look.

>V1.0.0 - Feb 8th 2026

## Setup

1. Clone the repo
2. run ```npm install```
3. either ```npm run dev``` or ```npm start``` (requires build first)
 
**Optional**

Create an alias that cds into this directory and runs the command.

```bash
cd <your-local-path> && npm run dev
```

## Keyboard Controls

| Key | Action |
|-----|--------|
| `r` | Force refresh |
| `s` | Toggle sticky window (X11, requires wmctrl) |
| `n` | Toggle desktop notifications (requires notify-send) |
| `q` or `Ctrl+C` | Quit |

## Status Detection

Two states based on process metrics sampled every second:

| Status | Color | Meaning |
|--------|-------|---------|
| Active | Green | CPU or I/O activity detected |
| Idle | Yellow | No significant activity -- instance is waiting |

Metrics source: `rchar`/`wchar` from `/proc/[pid]/io` (total I/O including sockets and pipes) and CPU ticks from `/proc/[pid]/stat`. Thresholds calibrated from real measurements -- idle Claude shows ~57 B/s rchar vs ~700 KB/s when active.

## Features

- **Process detection**: Scans `/proc` for processes with "claude" in comm name
- **Project grouping**: Instances grouped by working directory with deterministic colors
- **Sticky window**: X11 support via wmctrl to keep the monitor visible on all workspaces
- **Desktop notifications**: Fires via notify-send when an instance transitions from Active to Idle
- **Wayland**: Detected automatically, shows manual instructions for sticky mode


### Roadmap
If more features or ideas arise...might port this to Rust and make something fancier.
Otherwise this is it LOL

## Requirements

- Linux (requires `/proc` filesystem)
- Node.js 18+
- Optional: `wmctrl` for sticky window
- Optional: `notify-send` (libnotify) for desktop notifications

## Troubleshooting

**No instances found**: Make sure Claude is running (`ps aux | grep claude`), then press `r`.

**Terminal corrupted after exit**: Run `reset`.

**Sticky not working**: Install wmctrl (`sudo apt install wmctrl`). Only works on X11, not Wayland.

**Notifications not working**: Install libnotify (`sudo apt install libnotify-bin`).

## License
Feel free to use, modify, distribute, do whatever you want with this :)
