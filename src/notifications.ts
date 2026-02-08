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

export function checkTransitionsAndNotify(
  state: NotifyState,
  oldInstances: Map<number, ClaudeInstance>,
  newInstances: ClaudeInstance[],
): void {
  if (!state.enabled) return;

  for (const instance of newInstances) {
    const old = oldInstances.get(instance.pid);
    if (old && old.status === InstanceStatus.Active && instance.status === InstanceStatus.Idle) {
      sendNotification(instance);
    }
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
