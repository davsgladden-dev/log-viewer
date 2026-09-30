import { AfterViewInit, Component, DestroyRef, computed, effect, inject, untracked, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { LogStore } from '../../core/state/log-store';
import { ColumnKey, LayoutState } from '../../core/state/layout-state';
import { LogEntry } from '../../core/models/log-entry.model';
import { highlight } from '../../shared/highlight';

const ROW_HEIGHT = 28;

@Component({
  selector: 'app-log-list',
  imports: [CdkVirtualScrollViewport, CdkFixedSizeVirtualScroll, CdkVirtualForOf, DatePipe],
  templateUrl: './log-list.html',
  styleUrl: './log-list.scss',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class LogList implements AfterViewInit {
  protected readonly store = inject(LogStore);
  protected readonly layout = inject(LayoutState);
  private readonly destroyRef = inject(DestroyRef);
  private readonly viewport = viewChild(CdkVirtualScrollViewport);

  protected readonly rowHeight = ROW_HEIGHT;
  protected readonly trackById = (_: number, entry: LogEntry) => entry.id;

  protected readonly columns: { key: ColumnKey; label: string }[] = [
    { key: 'ln', label: 'Line' },
    { key: 'ts', label: 'Time' },
    { key: 'lvl', label: 'Level' },
    { key: 'caller', label: 'Caller' },
  ];

  /** Column widths exposed as CSS variables so header and rows stay in sync. */
  protected readonly cssVars = computed(() => {
    const w = this.layout.columnWidths();
    return {
      '--w-ln': `${w.ln}px`,
      '--w-ts': `${w.ts}px`,
      '--w-lvl': `${w.lvl}px`,
      '--w-caller': `${w.caller}px`,
    };
  });

  private resizing: { key: ColumnKey; startX: number; startWidth: number } | null = null;

  constructor() {
    // Scroll to the active search match (on typing, or on next/previous).
    effect(() => {
      this.store.navTick();
      const positions = this.store.matchPositions();
      const active = this.store.activeMatch();
      const vp = this.viewport();
      if (vp && active >= 0) {
        const target = Math.max(0, positions[active] - 3);
        // Deferred so the viewport has the updated list before scrolling.
        setTimeout(() => vp.scrollToIndex(target));
      }
    });

    // Keep the selected row visible when the selection changes (arrow keys, clicks).
    effect(() => {
      const id = this.store.selectedId();
      untracked(() => this.ensureVisible(id));
    });
  }

  ngAfterViewInit(): void {
    // The CDK viewport doesn't notice container size changes (detail pane opening/resizing).
    const vp = this.viewport();
    if (!vp) return;
    const observer = new ResizeObserver(() => {
      vp.checkViewportSize();
      this.ensureVisible(this.store.selectedId());
    });
    observer.observe(vp.elementRef.nativeElement);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  // ---- Keyboard navigation ----
  onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (this.store.selectedId() === null || isTextEntry(event.target)) return;

    switch (event.key) {
      case 'ArrowDown': this.store.moveSelection(1); break;
      case 'ArrowUp': this.store.moveSelection(-1); break;
      case 'PageDown': this.store.moveSelection(this.pageSize()); break;
      case 'PageUp': this.store.moveSelection(-this.pageSize()); break;
      case 'Home': this.store.moveSelection(-Infinity); break;
      case 'End': this.store.moveSelection(Infinity); break;
      case 'Escape': this.store.selectedId.set(null); break;
      default: return;
    }
    event.preventDefault();
  }

  private pageSize(): number {
    const vp = this.viewport();
    return vp ? Math.max(1, Math.floor(vp.getViewportSize() / ROW_HEIGHT) - 1) : 10;
  }

  /** Scroll only as far as needed to bring the selected row into view. */
  private ensureVisible(id: number | null): void {
    const vp = this.viewport();
    if (!vp || id === null) return;

    const index = this.store.visible().findIndex((e) => e.id === id);
    if (index < 0) return;

    const top = vp.measureScrollOffset('top');
    const height = vp.getViewportSize();
    const rowTop = index * ROW_HEIGHT;
    const rowBottom = rowTop + ROW_HEIGHT;

    if (rowTop < top) vp.scrollToOffset(rowTop);
    else if (rowBottom > top + height) vp.scrollToOffset(rowBottom - height);
  }

  // ---- Column resizing ----
  protected startResize(event: PointerEvent, key: ColumnKey): void {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.resizing = { key, startX: event.clientX, startWidth: this.layout.columnWidths()[key] };
  }

  protected onResize(event: PointerEvent): void {
    const r = this.resizing;
    if (!r) return;
    this.layout.setColumnWidth(r.key, r.startWidth + (event.clientX - r.startX));
  }

  protected endResize(): void {
    this.resizing = null;
  }

  // ---- Display helpers ----
  protected seg(text: string) {
    return highlight(text, this.store.query());
  }

  /** e.g. "CoreController.getCVOStatusList:599" */
  protected callerLabel(entry: LogEntry): string {
    const c = entry.caller;
    if (!c) return '';
    const simpleClass = c.class?.split('.').pop() ?? '';
    const name = [simpleClass, c.method].filter(Boolean).join('.');
    return c.line !== undefined ? `${name}:${c.line}` : name;
  }
}

/** True when the key event came from somewhere the user is typing (arrows should not hijack it). */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return !['checkbox', 'button'].includes(target.type);
  return false;
}
