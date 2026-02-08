import * as crypto from 'crypto';
import * as os from 'os';
import { InstanceStatus, ClaudeInstance, ProjectGroup } from './models';

export function getStatusLabel(status: InstanceStatus): string {
  switch (status) {
    case InstanceStatus.Active:
      return 'ACTV';
    case InstanceStatus.Idle:
      return 'IDLE';
  }
}

export function getStatusText(status: InstanceStatus): string {
  switch (status) {
    case InstanceStatus.Active:
      return 'Active';
    case InstanceStatus.Idle:
      return 'Idle';
  }
}

export function getStatusColor(status: InstanceStatus): string {
  switch (status) {
    case InstanceStatus.Active:
      return 'green';
    case InstanceStatus.Idle:
      return 'yellow';
  }
}

export function groupByDirectory(instances: ClaudeInstance[]): ProjectGroup[] {
  const groups = new Map<string, ClaudeInstance[]>();

  for (const instance of instances) {
    if (!groups.has(instance.cwd)) {
      groups.set(instance.cwd, []);
    }
    groups.get(instance.cwd)!.push(instance);
  }

  return Array.from(groups.entries())
    .map(([dirPath, instances]) => ({
      path: dirPath,
      displayPath: abbreviatePath(dirPath),
      color: pathToColor(dirPath),
      instances: instances.sort((a, b) => a.pid - b.pid),
    }))
    .sort((a, b) => a.displayPath.localeCompare(b.displayPath));
}

export function abbreviatePath(fullPath: string): string {
  const home = os.homedir();
  if (fullPath.startsWith(home)) {
    return `~${fullPath.substring(home.length)}`;
  }
  return fullPath;
}

export function pathToColor(dirPath: string): string {
  const hash = crypto.createHash('md5').update(dirPath).digest('hex');
  const hashNum = parseInt(hash.substring(0, 8), 16);

  const colors = ['blue', 'magenta', 'cyan', 'light-blue', 'light-magenta', 'light-cyan'];

  return colors[hashNum % colors.length];
}

export function extractTtyName(ttyPath: string): string {
  if (ttyPath.startsWith('/dev/')) {
    return ttyPath.substring(5);
  }
  return ttyPath;
}

export function formatDuration(since: Date): string {
  const elapsed = Date.now() - since.getTime();
  const secs = Math.floor(elapsed / 1000);

  if (secs < 60) {
    return `${secs}s`;
  } else if (secs < 3600) {
    return `${Math.floor(secs / 60)}m`;
  } else {
    return `${Math.floor(secs / 3600)}h`;
  }
}
