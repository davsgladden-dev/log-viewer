import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { KubeStore } from '../../../core/state/kube-store';

@Component({
  selector: 'app-kube-secrets',
  imports: [DatePipe],
  templateUrl: './kube-secrets.html',
  styleUrl: './kube-secrets.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KubeSecrets {
  protected readonly store = inject(KubeStore);
  protected readonly copiedKey = signal<string | null>(null);

  protected async copy(key: string): Promise<void> {
    const value = this.store.revealed()[key]?.value;
    if (value == null) return;
    await navigator.clipboard.writeText(value);
    this.copiedKey.set(key);
    setTimeout(() => this.copiedKey.update(k => (k === key ? null : k)), 1500);
  }
}
