export const KNOWN_LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as const;

/** OTHER = JSON line with a missing or unrecognized level. RAW = non-JSON line (banners, etc.). */
export type LogLevel = (typeof KNOWN_LEVELS)[number] | 'OTHER' | 'RAW';

export const ALL_LEVELS: LogLevel[] = [...KNOWN_LEVELS, 'OTHER', 'RAW'];

export interface LogCaller {
  class?: string;
  method?: string;
  file?: string;
  line?: number;
}

export interface LogEntry {
  /** Index in the parsed list (stable identifier). */
  id: number;
  /** 1-based line number in the original input. */
  lineNumber: number;
  kind: 'json' | 'text';
  raw: string;
  /** Epoch milliseconds, when available. */
  timestamp?: number;
  level: LogLevel;
  message: string;
  caller?: LogCaller;
  stackTrace?: string;
  /** Any JSON fields we don't explicitly know about. */
  extra: Record<string, unknown>;
  /** Lowercased text of all fields, precomputed for fast searching. */
  searchText: string;
}
