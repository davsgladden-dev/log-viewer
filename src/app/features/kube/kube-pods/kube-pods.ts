import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { KubeStore, TAIL_PRESETS } from '../../../core/state/kube-store';

@Component({
  selector: 'app-kube-pods',
  templateUrl: './kube-pods.html',
  styleUrl: './kube-pods.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KubePods {
  protected readonly store = inject(KubeStore);
  protected readonly presets = TAIL_PRESETS;

  protected onFilter(event: Event): void {
    this.store.podFilter.set((event.target as HTMLInputElement).value);
  }

  protected onTail(event: Event): void {
    this.store.setTailLines(Number((event.target as HTMLInputElement).value));
  }

  protected onContainer(event: Event): void {
    this.store.container.set((event.target as HTMLSelectElement).value);
  }

  protected onPrevious(event: Event): void {
    this.store.previous.set((event.target as HTMLInputElement).checked);
  }

  /** Double-click on a row: select and load in one go. */
  protected loadLogsFor(podName: string): void {
    this.store.selectPod(podName);
    void this.store.fetchLogs();
  }

  protected statusClass(status: string): string {
    if (status === 'Running' || status === 'Completed' || status === 'Succeeded') return 'st st--ok';
    if (status === 'Pending' || status === 'ContainerCreating' || status === 'Terminating'
        || status === 'PodInitializing' || status.startsWith('Init:')) return 'st st--warn';
    return 'st st--bad';
  }
}
