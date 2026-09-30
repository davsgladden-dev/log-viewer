import { Injectable, computed, signal } from '@angular/core';
import { ALL_LEVELS, LogEntry, LogLevel } from '../models/log-entry.model';
import { parseLog } from '../parser/log-parser';

@Injectable({ providedIn: 'root' })
export class LogStore {
  // ---- State ----
  readonly entries = signal<LogEntry[]>([]);
  readonly sourceName = signal<string | null>(null);
  readonly enabledLevels = signal<ReadonlySet<LogLevel>>(new Set(ALL_LEVELS));
  readonly searchText = signal('');
  readonly matchesOnly = signal(false);
  readonly selectedId = signal<number | null>(null);
  readonly currentMatch = signal(0); // index into matchPositions
  readonly navTick = signal(0); // bumps on every next/prev so the list re-scrolls

  // ---- Derived ----
  readonly query = computed(() => this.searchText().trim().toLowerCase());

  readonly levelCounts = computed(() => {
    const counts = new Map<LogLevel, number>();
    for (const e of this.entries()) counts.set(e.level, (counts.get(e.level) ?? 0) + 1);
    return counts;
  });

  /** Entries after level filter (and the "only matches" option). This is what the list renders. */
  readonly visible = computed(() => {
    const on = this.enabledLevels();
    const q = this.query();
    const onlyMatches = this.matchesOnly() && q !== '';
    return this.entries().filter((e) => on.has(e.level) && (!onlyMatches || e.searchText.includes(q)));
  });

  /** Positions (indexes in `visible`) of entries that match the search. */
  readonly matchPositions = computed(() => {
    const q = this.query();
    if (!q) return [] as number[];
    const out: number[] = [];
    this.visible().forEach((e, i) => {
      if (e.searchText.includes(q)) out.push(i);
    });
    return out;
  });

  /** Current match index, clamped to the available matches (-1 when there are none). */
  readonly activeMatch = computed(() => {
    const n = this.matchPositions().length;
    return n ? Math.min(this.currentMatch(), n - 1) : -1;
  });

  readonly selected = computed(() => {
    const id = this.selectedId();
    return id === null ? null : (this.entries().find((e) => e.id === id) ?? null);
  });

  // ---- Actions ----
  load(text: string, sourceName: string | null = null): void {
    this.entries.set(parseLog(text));
    this.sourceName.set(sourceName);
    this.selectedId.set(null);
    this.currentMatch.set(0);
    this.searchText.set('');
    this.matchesOnly.set(false);
    this.enabledLevels.set(new Set(ALL_LEVELS));
  }

  clear(): void {
    this.load('');
  }

  toggleLevel(level: LogLevel): void {
    const next = new Set(this.enabledLevels());
    if (next.has(level)) next.delete(level);
    else next.add(level);
    this.enabledLevels.set(next);
  }

  setSearch(text: string): void {
    this.searchText.set(text);
    this.currentMatch.set(0);
  }

  nextMatch(): void {
    this.stepMatch(1);
  }

  prevMatch(): void {
    this.stepMatch(-1);
  }

  /**
   * Move the selection within the visible list. Only acts if something is already selected.
   * Pass -Infinity / Infinity to jump to the first / last entry.
   */
  moveSelection(delta: number): void {
    const list = this.visible();
    const current = this.selectedId();
    if (!list.length || current === null) return;

    const index = list.findIndex((e) => e.id === current);
    if (index === -1) return; // selected entry is currently filtered out

    const next = Math.min(list.length - 1, Math.max(0, index + delta));
    this.selectedId.set(list[next].id);
  }

  private stepMatch(delta: number): void {
    const positions = this.matchPositions();
    const n = positions.length;
    if (!n) return;
    const next = (this.activeMatch() + delta + n) % n;
    this.currentMatch.set(next);
    this.navTick.update((t) => t + 1);
    const entry = this.visible()[positions[next]];
    if (entry) this.selectedId.set(entry.id);
  }
}
