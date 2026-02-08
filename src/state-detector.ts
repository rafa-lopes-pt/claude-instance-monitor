import * as fs from 'fs/promises';
import { ActivityMetrics, ClaudeInstance, InstanceStatus } from './models';

export class StateDetector {
  private prevMetrics: Map<number, ActivityMetrics> = new Map();
  private lastActivityTime: Map<number, Date> = new Map();

  async collectMetrics(pid: number): Promise<ActivityMetrics | null> {
    try {
      const cpuTime = await this.readCpuTime(pid);
      const ioCounters = await this.readIoCounters(pid);
      const activeConnections = await this.countNetworkConnections(pid);

      if (cpuTime === null || ioCounters === null) {
        return null;
      }

      return {
        cpuTime,
        readBytes: ioCounters.read,
        writeBytes: ioCounters.write,
        activeConnections,
        timestamp: new Date(),
      };
    } catch {
      return null;
    }
  }

  private async readCpuTime(pid: number): Promise<number | null> {
    try {
      const statPath = `/proc/${pid}/stat`;
      const stat = await fs.readFile(statPath, 'utf-8');

      const fields = stat.split(/\s+/);

      const utime = parseInt(fields[13], 10);
      const stime = parseInt(fields[14], 10);

      if (isNaN(utime) || isNaN(stime)) {
        return null;
      }

      return utime + stime;
    } catch {
      return null;
    }
  }

  private async readIoCounters(pid: number): Promise<{ read: number; write: number } | null> {
    try {
      const ioPath = `/proc/${pid}/io`;
      const ioData = await fs.readFile(ioPath, 'utf-8');

      let readBytes = 0;
      let writeBytes = 0;

      // Use rchar/wchar (total I/O including sockets and pipes) instead of
      // read_bytes/write_bytes (physical disk only). Disk I/O is dominated by
      // page cache writeback noise, while rchar/wchar accurately reflect
      // API traffic and tool execution (~57 B/s idle vs ~700 KB/s active).
      for (const line of ioData.split('\n')) {
        if (line.startsWith('rchar: ')) {
          readBytes = parseInt(line.substring(7), 10);
        } else if (line.startsWith('wchar: ')) {
          writeBytes = parseInt(line.substring(7), 10);
        }
      }

      return { read: readBytes, write: writeBytes };
    } catch {
      return null;
    }
  }

  private async countNetworkConnections(pid: number): Promise<number> {
    try {
      const fdDir = `/proc/${pid}/fd`;
      const entries = await fs.readdir(fdDir);

      let count = 0;

      for (const entry of entries) {
        try {
          const link = await fs.readlink(`${fdDir}/${entry}`);
          if (link.startsWith('socket:')) {
            count++;
          }
        } catch {
          continue;
        }
      }

      return count;
    } catch {
      return 0;
    }
  }

  detectStatus(instance: ClaudeInstance, currentMetrics: ActivityMetrics): InstanceStatus {
    const prevMetrics = this.prevMetrics.get(instance.pid);

    let status: InstanceStatus;
    if (prevMetrics) {
      status = this.analyzeMetrics(instance.pid, prevMetrics, currentMetrics);
    } else {
      status = InstanceStatus.Idle;
    }

    this.prevMetrics.set(instance.pid, currentMetrics);

    return status;
  }

  private analyzeMetrics(pid: number, prev: ActivityMetrics, curr: ActivityMetrics): InstanceStatus {
    const elapsed = curr.timestamp.getTime() - prev.timestamp.getTime();

    if (elapsed === 0) {
      return InstanceStatus.Idle;
    }

    const cpuDelta = Math.max(0, curr.cpuTime - prev.cpuTime);
    const readDelta = Math.max(0, curr.readBytes - prev.readBytes);
    const writeDelta = Math.max(0, curr.writeBytes - prev.writeBytes);

    // Thresholds calibrated from real measurements:
    // Idle Claude: ~57 B/s rchar, ~114 B/s wchar, ~2 CPU ticks/s
    // Active Claude: ~700 KB/s rchar, ~42 KB/s wchar, ~96 CPU ticks/s
    const CPU_THRESHOLD = 10;
    const IO_THRESHOLD = 4096;
    const ACTIVITY_DEBOUNCE_MS = 3000;

    const hasActivity =
      cpuDelta > CPU_THRESHOLD ||
      readDelta > IO_THRESHOLD ||
      writeDelta > IO_THRESHOLD;

    if (hasActivity) {
      this.lastActivityTime.set(pid, new Date());
      return InstanceStatus.Active;
    }

    // Debounce: keep Active for a few seconds after last burst
    const lastActivity = this.lastActivityTime.get(pid);
    if (lastActivity) {
      const timeSinceActivity = Date.now() - lastActivity.getTime();
      if (timeSinceActivity < ACTIVITY_DEBOUNCE_MS) {
        return InstanceStatus.Active;
      }
    }

    return InstanceStatus.Idle;
  }
}
