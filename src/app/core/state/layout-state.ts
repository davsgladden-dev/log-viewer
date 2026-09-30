import { Injectable, signal } from '@angular/core';

export type ColumnKey = 'ln' | 'ts' | 'lvl' | 'caller';

export const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  ln: 56,
  ts: 92,
  lvl: 56,
  caller: 260,
};

const MIN_COLUMN = 44;
const MAX_COLUMN = 700;
const MIN_DETAIL = 120;
const RESERVED_FOR_LIST = 160; // keep at least this much vertical space for the header + list

/** UI layout state (column widths, detail pane height). Kept separate from log data. */
@Injectable({ providedIn: 'root' })
export class LayoutState {
  readonly columnWidths = signal<Record<ColumnKey, number>>({ ...DEFAULT_COLUMN_WIDTHS });
  readonly detailHeight = signal(Math.round(window.innerHeight * 0.4));

  setColumnWidth(key: ColumnKey, px: number): void {
    const width = Math.round(Math.min(MAX_COLUMN, Math.max(MIN_COLUMN, px)));
    this.columnWidths.update((w) => ({ ...w, [key]: width }));
  }

  resetColumnWidth(key: ColumnKey): void {
    this.setColumnWidth(key, DEFAULT_COLUMN_WIDTHS[key]);
  }

  setDetailHeight(px: number): void {
    const max = Math.max(MIN_DETAIL, window.innerHeight - RESERVED_FOR_LIST);
    this.detailHeight.set(Math.round(Math.min(max, Math.max(MIN_DETAIL, px))));
  }
}
