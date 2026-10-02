import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { KubeStore } from '../../../core/state/kube-store';
import { KubePods } from '../kube-pods/kube-pods';
import { KubeSecrets } from '../kube-secrets/kube-secrets';

@Component({
  selector: 'app-kube-panel',
  imports: [KubePods, KubeSecrets],
  templateUrl: './kube-panel.html',
  styleUrl: './kube-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KubePanel implements OnInit {
  protected readonly store = inject(KubeStore);

  ngOnInit(): void {
    void this.store.init();
  }

  protected onConfigChange(event: Event): void {
    const file = (event.target as HTMLSelectElement).value;
    if (file) void this.store.selectConfig(file);
  }

  protected onContextChange(event: Event): void {
    const context = (event.target as HTMLSelectElement).value;
    void this.store.selectConfig(this.store.selectedFile(), context);
  }

  protected onNamespaceChange(event: Event): void {
    void this.store.setNamespace((event.target as HTMLInputElement).value);
  }
}
