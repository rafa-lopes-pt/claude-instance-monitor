import { Monitor } from './monitor';
import { StateDetector } from './state-detector';
import { TuiRenderer } from './ui/renderer';
import { groupByDirectory } from './utils';
import { initSticky, toggleSticky, StickyState } from './sticky';
import { initNotify, toggleNotify, checkTransitionsAndNotify, NotifyState } from './notifications';

async function main() {
  const monitor = new Monitor();
  const detector = new StateDetector();
  const renderer = new TuiRenderer();

  // Initialize sticky window support (delay slightly to let the screen render first)
  let stickyState: StickyState;
  setTimeout(() => {
    stickyState = initSticky(false);
    renderer.updateStickyStatus(stickyState);
  }, 500);

  let notifyState: NotifyState = initNotify(false);
  renderer.updateNotifyStatus(notifyState);

  let instances = await monitor.update();
  const instanceMap = new Map<number, typeof instances[0]>();

  async function refresh() {
    const newInstances = await monitor.update();

    // Clean up old PIDs that no longer exist
    const activePids = new Set(newInstances.map((i) => i.pid));
    for (const pid of instanceMap.keys()) {
      if (!activePids.has(pid)) {
        instanceMap.delete(pid);
      }
    }

    for (const instance of newInstances) {
      const metrics = await detector.collectMetrics(instance.pid);
      if (metrics) {
        const newStatus = detector.detectStatus(instance, metrics);
        const oldInstance = instanceMap.get(instance.pid);

        // Only update lastStatusChange if status actually changed
        if (oldInstance && oldInstance.status !== newStatus) {
          instance.lastStatusChange = new Date();
        } else if (oldInstance) {
          // Preserve the previous lastStatusChange if status didn't change
          instance.lastStatusChange = oldInstance.lastStatusChange;
        }

        instance.status = newStatus;
        instance.metrics = metrics;
      }
    }

    // Check transitions before updating instanceMap so we can compare old vs new
    checkTransitionsAndNotify(notifyState, instanceMap, newInstances);

    for (const instance of newInstances) {
      instanceMap.set(instance.pid, instance);
    }

    const groups = groupByDirectory(newInstances);
    renderer.render(groups);

    return { groups, instances: newInstances };
  }

  let result = await refresh();
  let groups = result.groups;
  instances = result.instances;

  const refreshInterval = setInterval(async () => {
    result = await refresh();
    groups = result.groups;
    instances = result.instances;
  }, 1000);

  const listWidget = renderer.getListWidget();
  const screen = renderer.getScreen();

  listWidget.key(['r'], async () => {
    result = await refresh();
    groups = result.groups;
    instances = result.instances;
  });

  listWidget.key(['s'], () => {
    stickyState = toggleSticky(stickyState);
    renderer.updateStickyStatus(stickyState);
  });

  listWidget.key(['n'], () => {
    notifyState = toggleNotify(notifyState);
    renderer.updateNotifyStatus(notifyState);
  });

  listWidget.key(['q', 'C-c'], () => {
    clearInterval(refreshInterval);
    process.exit(0);
  });

  listWidget.focus();
  screen.render();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
