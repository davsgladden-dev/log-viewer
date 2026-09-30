import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LogStore } from '../../core/state/log-store';
import { highlight } from '../../shared/highlight';
import { LayoutState } from '../../core/state/layout-state';

type Tab = 'formatted' | 'raw';
interface StackLine {
  text: string;
  kind: 'header' | 'frame' | 'cause';
}

@Component({
  selector: 'app-log-detail',
  imports: [DatePipe],
  templateUrl: './log-detail.html',
  styleUrl: './log-detail.scss',
  host: { '[style.height.px]': 'layout.detailHeight()' },
})
export class LogDetail {
  protected readonly store = inject(LogStore);
  readonly layout = inject(LayoutState); // public: used by the host binding
  private dragStart: { y: number; height: number } | null = null;
  protected readonly entry = this.store.selected;

  protected readonly tab = signal<Tab>('formatted');
  protected readonly prettyRaw = signal(true);

  protected readonly message = computed(() => prettyMessage(this.entry()?.message ?? ''));

  protected readonly callerText = computed(() => {
    const c = this.entry()?.caller;
    if (!c) return '';
    const where = c.file ? ` (${c.file}${c.line !== undefined ? ':' + c.line : ''})` : '';
    return `${c.class ?? ''}${c.method ? '#' + c.method : ''}${where}`;
  });

  protected readonly stackLines = computed(() => parseStack(this.entry()?.stackTrace));

  protected readonly extraFields = computed(() =>
    Object.entries(this.entry()?.extra ?? {}).map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
    })),
  );

  protected readonly rawText = computed(() => {
    const e = this.entry();
    if (!e) return '';
    if (e.kind === 'json' && this.prettyRaw()) {
      try {
        return JSON.stringify(JSON.parse(e.raw.trim()), null, 2);
      } catch {
        /* fall back to the raw line */
      }
    }
    return e.raw;
  });

  protected seg(text: string) {
    return highlight(text, this.store.query());
  }

  protected close(): void {
    this.store.selectedId.set(null);
  }

  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable; ignore */
    }
  }

  protected startDrag(event: PointerEvent): void {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.dragStart = { y: event.clientY, height: this.layout.detailHeight() };
  }

  protected onDrag(event: PointerEvent): void {
    const d = this.dragStart;
    if (!d) return;
    // Dragging up makes the pane taller.
    this.layout.setDetailHeight(d.height + (d.y - event.clientY));
  }

  protected endDrag(): void {
    this.dragStart = null;
  }
}



/** If the message itself is JSON, indent it; otherwise return it unchanged. */
function prettyMessage(message: string): string {
  const t = message.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      return JSON.stringify(JSON.parse(t), null, 2);
    } catch {
      /* not JSON */
    }
  }
  return message;
}

function parseStack(trace?: string): StackLine[] {
  if (!trace) return [];
  return trace
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l, i): StackLine => {
      const text = l.trim();
      if (/^(Caused by:|Suppressed:)/.test(text)) return { text, kind: 'cause' };
      if (i > 0 && (text.startsWith('at ') || text.startsWith('...'))) return { text, kind: 'frame' };
      return { text, kind: 'header' };
    });
}
