export interface ClaudeInstance {
  pid: number;
  tty: string;
  cwd: string;
  startTime: Date;
  status: InstanceStatus;
  lastStatusChange: Date;
  metrics: ActivityMetrics;
}

export interface ActivityMetrics {
  cpuTime: number;
  readBytes: number;
  writeBytes: number;
  activeConnections: number;
  timestamp: Date;
  cpuPercent?: number;
  memoryRss?: number;
}

export enum InstanceStatus {
  Active = 'active',
  Idle = 'idle',
}

export interface ProjectGroup {
  path: string;
  displayPath: string;
  instances: ClaudeInstance[];
  color: string;
}
