import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { KubeStore } from '../../../core/state/kube-store';

@Component({
  selector: 'app-kube-log-refresh',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.isKubeSource()) {
      <label class="lbl">
        Tail
        <input type="number" min="0" step="100" [value]="store.tailLines()"
               (change)="onTail($event)" (keydown.enter)="onTail($event); refresh()"
               title="Number of lines from the end. 0 = all lines." />
      </label>
      <button type="button" [disabled]="store.logsLoading()" (click)="refresh()">
        {{ store.logsLoading() ? 'Loading…' : 'Refresh' }}
      </button>
      @if (store.logsError(); as err) {
        <span class="err" [title]="err">{{ err }}</span>
      }
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; }
    .lbl { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted, #8b9098); }
    input { width: 84px; height: 26px; padding: 0 6px; background: var(--panel-bg, #1e1f22);
            color: var(--text-color, #d4d4d4); border: 1px solid var(--border-color, #3a3d41); border-radius: 4px; }
    button { height: 26px; padding: 0 10px; background: transparent; color: var(--text-color, #d4d4d4);
             border: 1px solid var(--border-color, #3a3d41); border-radius: 4px; cursor: pointer; }
    button:disabled { opacity: .5; cursor: default; }
    .err { color: #f26d6d; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `,
})
export class KubeLogRefresh {
  protected readonly store = inject(KubeStore);

  protected onTail(event: Event): void {
    this.store.setTailLines(Number((event.target as HTMLInputElement).value));
  }

  protected refresh(): void {
    void this.store.refreshLogs();
  }
}
