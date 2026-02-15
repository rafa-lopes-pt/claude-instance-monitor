import { execSync } from 'child_process';
import { ClaudeInstance, InstanceStatus } from './models';
import { abbreviatePath } from './utils';

export interface NotifyState {
  enabled: boolean;
  available: boolean;
  error: string | null;
}

export function initNotify(autoEnable: boolean): NotifyState {
  const available = checkNotifySendInstalled();
  if (!available) {
    return { enabled: false, available: false, error: 'notify-send not installed' };
  }
  return { enabled: autoEnable, available: true, error: null };
}

export function toggleNotify(state: NotifyState): NotifyState {
  if (!state.available) return state;
  return { ...state, enabled: !state.enabled };
}

const IDLE_NOTIFY_DELAY_MS = 5000;
const NOTIFY_THROTTLE_MS = 30000;

// Track when each PID first went idle (always updated, regardless of enabled state)
const idleSince = new Map<number, number>();
const lastNotifiedByPid = new Map<number, number>();

export function trackIdleState(newInstances: ClaudeInstance[]): void {
  const now = Date.now();
  const activePids = new Set<number>();

  for (const instance of newInstances) {
    activePids.add(instance.pid);
    if (instance.status === InstanceStatus.Idle) {
      if (!idleSince.has(instance.pid)) {
        idleSince.set(instance.pid, now);
      }
    } else {
      idleSince.delete(instance.pid);
    }
  }

  for (const pid of idleSince.keys()) {
    if (!activePids.has(pid)) {
      idleSince.delete(pid);
      lastNotifiedByPid.delete(pid);
    }
  }
}

export function checkAndNotify(
  state: NotifyState,
  newInstances: ClaudeInstance[],
): void {
  if (!state.enabled) return;

  const now = Date.now();

  for (const instance of newInstances) {
    if (instance.status !== InstanceStatus.Idle) continue;

    const idleStart = idleSince.get(instance.pid);
    if (!idleStart || now - idleStart < IDLE_NOTIFY_DELAY_MS) continue;

    const lastSent = lastNotifiedByPid.get(instance.pid) ?? 0;
    if (now - lastSent < NOTIFY_THROTTLE_MS) continue;

    lastNotifiedByPid.set(instance.pid, now);
    sendNotification(instance);
  }
}

function checkNotifySendInstalled(): boolean {
  try {
    execSync('which notify-send', { timeout: 1000, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function sendNotification(instance: ClaudeInstance): void {
  const project = abbreviatePath(instance.cwd);
  const summary = 'Claude Instance Idle';
  const body = `PID ${instance.pid} in ${project} is waiting`;
  try {
    execSync(
      `notify-send -a "Claude Monitor" -u normal ${escapeShellArg(summary)} ${escapeShellArg(body)}`,
      { timeout: 2000, stdio: 'pipe' },
    );
  } catch {
    // Notification failed silently -- not worth crashing over
  }
}

function escapeShellArg(arg: string): string {
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}
