import { execSync } from 'child_process';

export enum DisplayServer {
  X11 = 'x11',
  Wayland = 'wayland',
  Unknown = 'unknown',
}

export interface StickyResult {
  enabled: boolean;
  error: string | null;
}

export interface StickyState {
  displayServer: DisplayServer;
  windowId: string | null;
  enabled: boolean;
  error: string | null;
}

export function detectDisplayServer(): DisplayServer {
  const sessionType = process.env.XDG_SESSION_TYPE?.toLowerCase();
  if (sessionType === 'wayland') return DisplayServer.Wayland;
  if (sessionType === 'x11') return DisplayServer.X11;

  if (process.env.WAYLAND_DISPLAY) return DisplayServer.Wayland;
  if (process.env.DISPLAY) return DisplayServer.X11;

  return DisplayServer.Unknown;
}

export function checkWmctrlInstalled(): boolean {
  try {
    execSync('which wmctrl', { timeout: 1000, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function findWindowId(): string | null {
  // Strategy 1: $WINDOWID env var (fastest, works in most terminals)
  const envWindowId = process.env.WINDOWID;
  if (envWindowId) {
    return envWindowId;
  }

  // Strategy 2: wmctrl -lp matching terminal's PID (process.ppid)
  try {
    const ppid = process.ppid;
    const output = execSync('wmctrl -lp', { timeout: 1000, stdio: 'pipe' }).toString();
    for (const line of output.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3 && parseInt(parts[2], 10) === ppid) {
        return parts[0];
      }
    }
  } catch {
    // wmctrl not available or failed
  }

  // Strategy 3: wmctrl -l matching window title
  try {
    const output = execSync('wmctrl -l', { timeout: 1000, stdio: 'pipe' }).toString();
    for (const line of output.split('\n')) {
      if (line.includes('Claude Instance Monitor')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 1) {
          return parts[0];
        }
      }
    }
  } catch {
    // wmctrl not available or failed
  }

  return null;
}

export function setSticky(windowId: string, enable: boolean): StickyResult {
  const action = enable ? 'add' : 'remove';
  try {
    execSync(`wmctrl -i -r ${windowId} -b ${action},sticky`, {
      timeout: 1000,
      stdio: 'pipe',
    });
    return { enabled: enable, error: null };
  } catch {
    return { enabled: false, error: 'wmctrl command failed' };
  }
}

export function getWaylandInstructions(): string {
  return [
    'Wayland detected -- sticky mode requires manual config:',
    '',
    'GNOME: Install "Window Is Ready - Remover" extension or use',
    '  gsettings to pin window via overview',
    'KDE Plasma: Right-click title bar > More Actions > On All Desktops',
    'Sway: Add "sticky enable" to your sway config for this window',
    'Hyprland: Add "pin" window rule or use hyprctl dispatch pin',
  ].join('\n');
}

export function initSticky(autoEnable: boolean): StickyState {
  const displayServer = detectDisplayServer();

  if (displayServer === DisplayServer.Wayland) {
    return {
      displayServer,
      windowId: null,
      enabled: false,
      error: 'Wayland: manual config needed',
    };
  }

  if (displayServer === DisplayServer.Unknown) {
    return {
      displayServer,
      windowId: null,
      enabled: false,
      error: 'No display server detected',
    };
  }

  // X11 path
  if (!checkWmctrlInstalled()) {
    return {
      displayServer,
      windowId: null,
      enabled: false,
      error: 'wmctrl not installed',
    };
  }

  const windowId = findWindowId();
  if (!windowId) {
    return {
      displayServer,
      windowId: null,
      enabled: false,
      error: 'Window ID not found',
    };
  }

  if (autoEnable) {
    const result = setSticky(windowId, true);
    return {
      displayServer,
      windowId,
      enabled: result.enabled,
      error: result.error,
    };
  }

  return {
    displayServer,
    windowId,
    enabled: false,
    error: null,
  };
}

export function toggleSticky(state: StickyState): StickyState {
  if (state.displayServer === DisplayServer.Wayland) {
    return state; // Can't toggle on Wayland
  }

  if (!state.windowId) {
    // Try to find window ID again (might not have been available at startup)
    const windowId = findWindowId();
    if (!windowId) {
      return { ...state, error: 'Window ID not found' };
    }
    state = { ...state, windowId };
  }

  const result = setSticky(state.windowId!, !state.enabled);
  return {
    ...state,
    enabled: result.enabled,
    error: result.error,
  };
}
