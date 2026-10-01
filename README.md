# Log Viewer

A lightweight, browser-based viewer for Kubernetes application logs in JSON-lines format. Paste or drop a log file and review it with color-coded levels, search, filtering, and a detail pane, without relying on a terminal or Kibana.

Everything runs locally in the browser. Log data is never uploaded or stored.

## Features

- **Paste or drop** a log file, or use **Choose file**
- **Color-coded levels** (TRACE, DEBUG, INFO, WARN, ERROR, FATAL) with non-JSON lines shown separately
- **Level filter chips** with counts; click to toggle
- **Search** across all fields, with highlighting, match count, and next/previous navigation
- **Only matches** mode to hide non-matching rows
- **Detail pane** with the full message, formatted stack trace, caller, extra fields, and a Raw JSON tab with pretty-print
- **Keyboard navigation** through entries
- **Resizable columns** and resizable detail pane
- **Copy** the raw log line or stack trace

## Requirements

| Tool | Version used |
|---|---|
| Node.js | 24.x |
| npm | 11.x |
| Angular CLI | 22.x |
| Browser | Google Chrome (latest) |

## Getting started

```bash
# from the project folder
npm install
ng serve
```

Open http://localhost:4200 in Chrome.

## Using the viewer

1. **Load logs:** paste text into the box and click **Load pasted text**, or drop a file onto the box, or click **Choose file**.
2. **Filter:** click a level chip (e.g., ERROR) to show or hide that level.
3. **Search:** type in the search box. Matches are highlighted and the list scrolls to the first one.
  - **Enter** = next match
  - **Shift+Enter** = previous match
  - Tick **Only matches** to hide rows that don't match.
4. **Inspect a line:** click a row to open the detail pane at the bottom.
  - **Formatted** tab: message, caller, stack trace, and other fields
  - **Raw JSON** tab: the full original line, optionally pretty-printed
5. **Clear:** click **Clear** to return to the input screen.

### Keyboard shortcuts

| Key | Action |
|---|---|
| ↑ / ↓ | Select previous / next entry (after a row is selected) |
| PageUp / PageDown | Move the selection by one page |
| Home / End | Jump to the first / last visible entry |
| Esc | Close the detail pane |
| Enter / Shift+Enter | Next / previous search match (while in the search box) |

Arrow keys are ignored while you're typing in the search box.

### Layout

- **Columns:** drag the handles in the header row to resize. Double-click a handle to reset it.
- **Detail pane:** drag the bar along its top edge to make it taller or shorter.

## Supported log format

Each line is expected to be a JSON object (JSON Lines / NDJSON), for example:

```json
{"caller":{"class":"com.example.CoreController","method":"getStatus","file":"CoreController.java","line":599},"ts":1787328226740,"level":"DEBUG","msg":"CoreController.getStatus()"}
```

| Field | Type | Used for |
|---|---|---|
| `ts` | epoch milliseconds | Time column |
| `level` | string | Level color and filter |
| `msg` | string | Message |
| `caller` | object (`class`, `method`, `file`, `line`) | Caller column and detail |
| `stack_trace` | string | Stack trace section |
| any other field | any | "Other fields" section |

Lines that aren't valid JSON (startup banners, kubectl output, etc.) are shown as **NON-JSON** entries. They're still searchable. Blank lines are skipped.

## Project structure

```
src/app/
├── core/
│   ├── models/        log entry types and level definitions
│   ├── parser/        line-by-line JSON parser
│   └── state/         LogStore (logs, filters, selection), LayoutState (UI sizes)
├── features/
│   ├── input/         paste box and file drop zone
│   ├── toolbar/       level chips and search
│   ├── log-list/      virtual-scrolling table with header and column resizing
│   └── log-detail/    detail pane
└── shared/            highlight helper
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for design details and [docs/BACKLOG.md](docs/BACKLOG.md) for planned work.

## Building a static copy

To share a build with teammates or run it without `ng serve`:

```bash
ng build
```

The output is written to `dist/log-viewer/browser/` (check the path printed by the build). That folder is plain static files and can be opened with any static file server, for example:

```bash
npx http-server dist/log-viewer/browser -p 8080
```

Then open http://localhost:8080.

## Running tests

```bash
ng test
```

Unit tests are not yet written for the MVP. See the backlog.

## Troubleshooting

| Problem | Fix |
|---|---|
| Log lines look like plain text (NON-JSON) | The line isn't a single valid JSON object. Check for a prefix such as a kubectl timestamp or a pod name. |
| Times show blank | The line has no numeric `ts` field. |
| Columns or detail pane reset after a reload | Layout is kept only for the current page session; this is expected for the MVP. |
| Large logs feel slow | Parsing runs on the main thread. See the backlog item for moving it to a Web Worker. |

## Limitations (MVP)

- Single file or paste at a time; no merging
- No saved sessions or persistence across page reloads
- Parsing expects JSON Lines; kubectl-prefixed lines are treated as NON-JSON
- Designed for small to medium logs (tens of thousands of lines)
- Chrome is the supported browser

## Privacy

Logs are processed entirely in the browser. Nothing is sent to a server or stored. Do not paste logs containing secrets into shared machines, and avoid saving logs that contain PII in unapproved locations.
