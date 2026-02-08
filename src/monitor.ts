import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { ClaudeInstance, InstanceStatus } from './models';

export class Monitor {
  private knownPids: Set<number> = new Set();
  private lastFullScan: Date = new Date(0);

  async scanProcesses(): Promise<ClaudeInstance[]> {
    const instances: ClaudeInstance[] = [];

    try {
      const entries = await fs.readdir('/proc');

      for (const entry of entries) {
        const pid = parseInt(entry, 10);
        if (isNaN(pid)) continue;

        const instance = await this.checkProcess(pid);
        if (instance) {
          instances.push(instance);
          this.knownPids.add(pid);
        }
      }
    } catch (error) {
      // /proc read failed
    }

    return instances;
  }

  private async checkProcess(pid: number): Promise<ClaudeInstance | null> {
    try {
      const commPath = `/proc/${pid}/comm`;
      const comm = await fs.readFile(commPath, 'utf-8');

      if (!comm.trim().includes('claude')) {
        return null;
      }

      const tty = await this.getTty(pid);
      const cwd = await this.getCwd(pid);
      const startTime = await this.getStartTime(pid);

      if (!tty || !cwd) {
        return null;
      }

      return {
        pid,
        tty,
        cwd,
        startTime,
        status: InstanceStatus.Idle,
        lastStatusChange: new Date(),
        metrics: {
          cpuTime: 0,
          readBytes: 0,
          writeBytes: 0,
          activeConnections: 0,
          timestamp: new Date(),
        },
      };
    } catch {
      return null;
    }
  }

  private async getTty(pid: number): Promise<string | null> {
    try {
      const fd0Path = `/proc/${pid}/fd/0`;
      const ttyPath = await fs.readlink(fd0Path);
      return ttyPath;
    } catch {
      return null;
    }
  }

  private async getCwd(pid: number): Promise<string | null> {
    try {
      const cwdPath = `/proc/${pid}/cwd`;
      const cwd = await fs.readlink(cwdPath);

      try {
        return await fs.realpath(cwd);
      } catch {
        return cwd;
      }
    } catch {
      return null;
    }
  }

  private async getStartTime(pid: number): Promise<Date> {
    try {
      const statPath = `/proc/${pid}/stat`;
      const stat = await fs.readFile(statPath, 'utf-8');

      const fields = stat.split(/\s+/);
      const starttimeTicks = parseInt(fields[21], 10);

      const uptimeStat = await fs.readFile('/proc/uptime', 'utf-8');
      const uptimeSeconds = parseFloat(uptimeStat.split(' ')[0]);

      const clockTicks = 100;
      const processAgeSeconds = starttimeTicks / clockTicks;
      const startTime = new Date(Date.now() - (uptimeSeconds - processAgeSeconds) * 1000);

      return startTime;
    } catch {
      return new Date();
    }
  }


  async update(): Promise<ClaudeInstance[]> {
    // Quick check: remove PIDs that no longer exist
    const stillExists = new Set<number>();
    for (const pid of this.knownPids) {
      if (fsSync.existsSync(`/proc/${pid}`)) {
        stillExists.add(pid);
      }
    }
    this.knownPids = stillExists;

    // Full scan every 10 seconds to find new processes
    const timeSinceLastScan = Date.now() - this.lastFullScan.getTime();
    if (timeSinceLastScan > 10000) {
      this.lastFullScan = new Date();
      return this.scanProcesses();
    }

    // Otherwise just update known PIDs
    const instances: ClaudeInstance[] = [];
    for (const pid of this.knownPids) {
      const instance = await this.checkProcess(pid);
      if (instance) {
        instances.push(instance);
      }
    }

    return instances;
  }

}
