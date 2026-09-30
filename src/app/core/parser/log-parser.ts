import { KNOWN_LEVELS, LogCaller, LogEntry, LogLevel } from '../models/log-entry.model';

/** Parse pasted/loaded text into entries. Blank lines are skipped. */
export function parseLog(text: string): LogEntry[] {
  const entries: LogEntry[] = [];
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim() === '') continue;
    entries.push(parseLine(raw, i + 1, entries.length));
  }
  return entries;
}

function parseLine(raw: string, lineNumber: number, id: number): LogEntry {
  const trimmed = raw.trim();

  if (trimmed.startsWith('{')) {
    try {
      const obj: unknown = JSON.parse(trimmed);
      if (isPlainObject(obj)) {
        return fromJson(obj, raw, lineNumber, id);
      }
    } catch {
      // Not valid JSON, so fall through and treat it as plain text.
    }
  }

  return {
    id,
    lineNumber,
    kind: 'text',
    raw,
    level: 'RAW',
    message: raw,
    extra: {},
    searchText: raw.toLowerCase(),
  };
}

function fromJson(obj: Record<string, unknown>, raw: string, lineNumber: number, id: number): LogEntry {
  const { caller, ts, level, msg, stack_trace, ...extra } = obj;

  const entry: LogEntry = {
    id,
    lineNumber,
    kind: 'json',
    raw,
    timestamp: toEpochMs(ts),
    level: normalizeLevel(level),
    message: msg === undefined || msg === null ? '' : typeof msg === 'string' ? msg : JSON.stringify(msg),
    caller: toCaller(caller),
    stackTrace: typeof stack_trace === 'string' ? stack_trace : undefined,
    extra,
    searchText: '',
  };

  entry.searchText = [
    entry.level,
    entry.message,
    entry.caller?.class,
    entry.caller?.method,
    entry.caller?.file,
    entry.stackTrace,
    Object.keys(extra).length ? JSON.stringify(extra) : undefined,
  ]
    .filter((s): s is string => !!s)
    .join('\n')
    .toLowerCase();

  return entry;
}

function normalizeLevel(value: unknown): LogLevel {
  if (typeof value !== 'string') return 'OTHER';
  const upper = value.trim().toUpperCase();
  if (upper === 'WARNING') return 'WARN';
  return (KNOWN_LEVELS as readonly string[]).includes(upper) ? (upper as LogLevel) : 'OTHER';
}

function toEpochMs(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function toCaller(value: unknown): LogCaller | undefined {
  if (!isPlainObject(value)) return undefined;
  return {
    class: typeof value['class'] === 'string' ? value['class'] : undefined,
    method: typeof value['method'] === 'string' ? value['method'] : undefined,
    file: typeof value['file'] === 'string' ? value['file'] : undefined,
    line: typeof value['line'] === 'number' ? value['line'] : undefined,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
