import * as blessed from 'blessed';
import { ProjectGroup } from '../models';
import { StickyState, DisplayServer } from '../sticky';
import { NotifyState } from '../notifications';
import { getStatusText, getStatusColor, formatDuration, extractTtyName, formatCpuPercent, formatMemory } from '../utils';

export class TuiRenderer {
  private screen: blessed.Widgets.Screen;
  private listWidget: blessed.Widgets.ListElement;
  private headerWidget: blessed.Widgets.BoxElement;
  private footerWidget: blessed.Widgets.BoxElement;
  private stickyState: StickyState | null = null;
  private notifyState: NotifyState | null = null;

  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Claude Instance Monitor',
      mouse: true,
      vi: true,
    });

    this.headerWidget = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: ' Claude Instance Monitor',
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        border: {
          fg: 'cyan',
        },
      },
    });

    this.listWidget = blessed.list({
      top: 3,
      left: 0,
      width: '100%',
      height: '100%-6',
      keys: true,
      vi: true,
      mouse: false,
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        selected: {
          bg: 'blue',
          fg: 'white',
        },
        border: {
          fg: 'cyan',
        },
      },
    });

    this.footerWidget = blessed.box({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: ' [r] Refresh  [s] Sticky  [n] Notify  [q] Quit',
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        border: {
          fg: 'cyan',
        },
      },
    });

    this.screen.append(this.headerWidget);
    this.screen.append(this.listWidget);
    this.screen.append(this.footerWidget);

    this.screen.key(['q', 'C-c'], () => {
      process.exit(0);
    });
  }

  render(groups: ProjectGroup[]): void {
    const items: string[] = [];

    for (const group of groups) {
      items.push(
        `{bold}{${group.color}-fg}[PROJ] ${group.displayPath}{/${group.color}-fg}{/bold} (${group.instances.length} instances)`
      );

      for (let i = 0; i < group.instances.length; i++) {
        const instance = group.instances[i];
        const isLast = i === group.instances.length - 1;
        const treeChar = isLast ? '└─' : '├─';

        const statusText = getStatusText(instance.status);
        const statusColor = getStatusColor(instance.status);
        const ttyDisplay = extractTtyName(instance.tty);
        const duration = formatDuration(instance.lastStatusChange);
        const cpu = formatCpuPercent(instance.metrics.cpuPercent);
        const mem = formatMemory(instance.metrics.memoryRss);

        const line =
          `  ${treeChar} PID ${String(instance.pid).padEnd(5)}  | ` +
          `${ttyDisplay.padEnd(8)} | ` +
          `{${statusColor}-fg}${statusText.padEnd(12)}{/${statusColor}-fg} | ` +
          `${duration.padEnd(4)} | ` +
          `CPU: ${cpu.padEnd(6)} | ` +
          `MEM: ${mem}`;

        items.push(line);
      }

      items.push('');
    }

    if (items.length === 0) {
      items.push('{gray-fg}No Claude instances found{/gray-fg}');
    }

    this.listWidget.setItems(items);
    this.screen.render();
  }

  getScreen(): blessed.Widgets.Screen {
    return this.screen;
  }

  getListWidget(): blessed.Widgets.ListElement {
    return this.listWidget;
  }

  updateStickyStatus(state: StickyState): void {
    this.stickyState = state;
    this.refreshFooter();
  }

  updateNotifyStatus(state: NotifyState): void {
    this.notifyState = state;
    this.refreshFooter();
  }

  private refreshFooter(): void {
    const tags: string[] = [];

    if (this.stickyState) {
      tags.push(this.formatStickyTag(this.stickyState));
    }
    if (this.notifyState) {
      tags.push(this.formatNotifyTag(this.notifyState));
    }

    const suffix = tags.length > 0 ? '  ' + tags.join('  ') : '';
    this.footerWidget.setContent(` [r] Refresh  [s] Sticky  [n] Notify  [q] Quit${suffix}`);
    this.screen.render();
  }

  private formatStickyTag(state: StickyState): string {
    if (state.error) {
      if (state.displayServer === DisplayServer.Wayland) {
        return `{yellow-fg}[${state.error}]{/yellow-fg}`;
      }
      return `{red-fg}[Sticky: ${state.error}]{/red-fg}`;
    }
    if (state.enabled) return '{green-fg}[Sticky: ON]{/green-fg}';
    return '{gray-fg}[Sticky: OFF]{/gray-fg}';
  }

  private formatNotifyTag(state: NotifyState): string {
    if (state.error) return `{red-fg}[Notify: ${state.error}]{/red-fg}`;
    if (state.enabled) return '{green-fg}[Notify: ON]{/green-fg}';
    return '{gray-fg}[Notify: OFF]{/gray-fg}';
  }

}
