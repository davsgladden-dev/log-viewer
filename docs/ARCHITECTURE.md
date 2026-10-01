# Architecture

## Overview

Log Viewer is a single-page Angular application that runs entirely in the browser. It takes pasted or dropped log text, parses each line, and renders a filterable, searchable, virtual-scrolling view with a detail pane. There is no backend in the MVP.

## Key decisions

| Decision | Rationale |
|---|---|
| Angular only, no backend | MVP is single-user, local, and handles small logs. Keeps log data on the user's machine. |
| Parsing on the main thread | Logs are small for the MVP. The parser is a pure function, so it can move to a Web Worker later without changing callers. |
| Virtual scrolling (Angular CDK) | Handles thousands of rows smoothly. Requires fixed-height rows, so the full message lives in the detail pane. |
| Plain SCSS, no UI library | Fewer dependencies and easier approval. |
| Signals for state | A single `LogStore` holds log data and filter state; the UI derives from it. |
| Separate `LayoutState` | UI sizes (column widths, pane height) are kept apart from log data. |
| Dark theme | Default for a log viewer; easy to revisit. |

## Data flow

```
Paste box / file drop
        │  raw text
        ▼
  LogStore.load(text, sourceName)
        │
        ▼
  parseLog(text) ──► LogEntry[]           (JSON lines → structured; other lines → RAW)
        │
        ▼
  LogStore signals
    entries ─► visible (level filter + optional "only matches")
             ─► matchPositions (search hits within visible)
             ─► activeMatch / selected
        │
        ▼
  Components
    app-toolbar     level chips, search, navigation
    app-log-list    header + virtual-scroll rows, keyboard navigation
    app-log-detail  selected entry: formatted / raw views
```

## Components

| Path | Responsibility |
|---|---|
| `app.ts` / `app.html` | Shell: top bar, switches between input and viewer |
| `features/input/log-input` | Paste box, file picker, drag-and-drop |
| `features/toolbar/toolbar` | Level chips with counts, search input, match navigation, "Only matches" |
| `features/log-list/log-list` | Column header with resize handles, virtual-scroll rows, keyboard selection, scroll-to-match, keeps selection visible |
| `features/log-detail/log-detail` | Formatted and Raw JSON tabs, copy actions, resizable pane |

## State

### `core/state/log-store.ts` (`LogStore`)

| Signal | Purpose |
|---|---|
| `entries` | All parsed entries |
| `sourceName` | Name of the pasted source or file |
| `enabledLevels` | Which levels are shown |
| `searchText` / `query` | Raw and normalized search text |
| `matchesOnly` | Hide non-matching rows |
| `selectedId` | Selected entry (drives the detail pane) |
| `currentMatch` / `activeMatch` | Position within the search matches |
| `navTick` | Bumped on next/previous so the list re-scrolls |

Derived: `levelCounts`, `visible`, `matchPositions`, `selected`.

Actions: `load`, `clear`, `toggleLevel`, `setSearch`, `nextMatch`, `prevMatch`, `moveSelection`.

### `core/state/layout-state.ts` (`LayoutState`)

| Signal | Purpose |
|---|---|
| `columnWidths` | Width of Line, Time, Level, and Caller columns |
| `detailHeight` | Height of the detail pane |

## Parser (`core/parser/log-parser.ts`)

- Splits input on line endings and skips blank lines.
- A line starting with `{` that parses as a JSON object becomes a `json` entry. Known fields are mapped to typed properties (`ts`, `level`, `msg`, `caller`, `stack_trace`); any other fields go into `extra`.
- Anything else becomes a `text` entry with level `RAW`.
- Levels are normalized to uppercase. `WARNING` maps to `WARN`. Unknown levels map to `OTHER`.
- Each entry has a precomputed lowercase `searchText` that covers all fields, so search stays fast.

## Rendering details

- **Virtual scrolling:** rows are a fixed 28px, so only visible rows are in the DOM.
- **Column widths:** stored in `LayoutState` and applied as CSS variables (`--w-ln`, `--w-ts`, `--w-lvl`, `--w-caller`) on the table, so the header and rows always match.
- **Highlighting:** `shared/highlight.ts` splits text into matching and non-matching segments. Used by rows and the detail pane.
- **Resize observer:** the CDK viewport doesn't detect container size changes, so a `ResizeObserver` calls `checkViewportSize()` and keeps the selected row in view.

## Keyboard handling

A document-level `keydown` listener in `LogList`:
- Ignored if a row isn't selected, or focus is in a text input (search box, textarea).
- Arrow, Page, Home, End keys move the selection through `LogStore.moveSelection`.
- Escape clears the selection.

## Extending the app

- **Parsing changes:** edit `core/parser/log-parser.ts`. Keep it a pure function so tests and a future Web Worker stay simple.
- **New filters:** add a signal to `LogStore`, include it in `visible`, and add a control to `toolbar`.
- **New columns:** add a key to `ColumnKey` and `DEFAULT_COLUMN_WIDTHS`, add a header entry in `log-list.ts`, and add the matching cell in `log-list.html` and `log-list.scss`.
- **Backend (Phase 2):** add a Spring Boot service for `kubectl` or the Kubernetes API, and have the frontend call it to fetch text, which then flows through the same `LogStore.load` path.

## Known constraints

- Entire log is held in memory.
- Parsing and search run on the main thread.
- Only JSON Lines input is parsed structurally; other lines are raw text.
- Layout and selection are not persisted across reloads.
