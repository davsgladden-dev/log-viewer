import { Component, inject } from '@angular/core';
import { LogStore } from './core/state/log-store';
import { LogInput } from './features/input/log-input';
import { LogList } from './features/log-list/log-list';
import { Toolbar } from './features/toolbar/toolbar';
import { LogDetail } from './features/log-detail/log-detail';
import { signal } from '@angular/core';
import { KubePanel } from './features/kube/kube-panel/kube-panel';
import { KubeLogRefresh } from './features/kube/kube-log-refresh/kube-log-refresh';

@Component({
  selector: 'app-root',
  imports: [LogInput, LogList, Toolbar, LogDetail, KubePanel, KubeLogRefresh],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly store = inject(LogStore);
  protected readonly source = signal<'paste' | 'kube'>('paste');
}
