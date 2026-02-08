# Claude Instance Monitor -- Project Guide

## What This Is

TUI dashboard that monitors Claude Code instances across terminals. Detects active vs idle state via `/proc` metrics. Linux only.

## Read First

See [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for architecture, design decisions, thresholds, and file layout. That file is the source of truth for how things work.

## Development

```bash
npm install
npm run dev           # ts-node
npm run build         # tsc -> dist/
npm start             # runs compiled JS
```

## Code Conventions

- TypeScript strict mode
- No emojis or unicode symbols anywhere -- text labels and ASCII tree chars only
- Status colors: green (Active), yellow (Idle)
- All `/proc` reads wrapped in try/catch returning null on failure
- External commands (wmctrl, notify-send) use execSync with 1-second timeout
- Footer shows toggle states for all features: `[Feature: ON/OFF]`

## Module Responsibilities

- **monitor.ts**: Finds Claude processes. Reads /proc/[pid]/comm, cwd, fd/0, stat.
- **state-detector.ts**: Collects rchar/wchar/CPU metrics, determines Active vs Idle.
- **ui/renderer.ts**: blessed TUI. Owns screen, header, list, footer widgets. Exposes update methods for sticky/notify status.
- **sticky.ts**: Self-contained. Detects display server, finds window ID, toggles sticky via wmctrl.
- **notifications.ts**: Self-contained. Sends notify-send when instance transitions Active -> Idle.
- **index.ts**: Glue. CLI args, event loop, keybindings, wires modules together.
- **models.ts**: Data types only. ClaudeInstance, ActivityMetrics, InstanceStatus, ProjectGroup.
- **utils.ts**: Pure functions. Status labels/colors, path formatting, grouping, duration.

## Adding Features

New toggleable features (like sticky/notify) follow this pattern:
1. Create `src/feature.ts` with state interface, init/toggle functions
2. Add `updateFeatureStatus(state)` to renderer.ts (it stores state and calls `refreshFooter()`)
3. Add CLI flag and keybinding in index.ts
4. Footer rendering is centralized in `renderer.refreshFooter()`

## Future Considerations

- **Rust port**: Codebase maps cleanly to Rust modules. blessed -> ratatui, try/catch -> Result.
- **Daemon+client split**: Monitor/StateDetector could run as a daemon on a Unix socket, with index.ts becoming a thin client. Current module separation supports this.
- **Finer status granularity**: Would require reading terminal output or Claude's internal state, not just /proc metrics.
