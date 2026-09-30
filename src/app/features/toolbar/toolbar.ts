import { Component, computed, inject } from '@angular/core';
import { LogStore } from '../../core/state/log-store';
import { ALL_LEVELS, LogLevel } from '../../core/models/log-entry.model';

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.html',
  styleUrl: './toolbar.scss',
})
export class Toolbar {
  protected readonly store = inject(LogStore);

  /** Only show chips for levels that actually occur in the loaded log. */
  protected readonly levels = computed(() =>
    ALL_LEVELS.filter((l) => (this.store.levelCounts().get(l) ?? 0) > 0),
  );
  protected readonly matchCount = computed(() => this.store.matchPositions().length);

  private timer: ReturnType<typeof setTimeout> | undefined;

  protected label(level: LogLevel): string {
    return level === 'RAW' ? 'NON-JSON' : level;
  }

  /** Debounced so typing stays smooth on larger logs. */
  protected onSearchInput(value: string): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.store.setSearch(value), 200);
  }
}
