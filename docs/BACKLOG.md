# Backlog

Items are grouped by area. Nothing here is committed to a date. Priority labels are suggestions for the tech department to confirm.

Legend: **[P1]** high value · **[P2]** medium · **[P3]** low / nice-to-have

## Phase 2: Data sources and scale

- [ ] **[P1]** Pull logs directly from `kubectl` or the Kubernetes API (requires a Spring Boot backend)
- [ ] **[P1]** Parse `kubectl` output prefixes (`--timestamps`, `--prefix`, label-selector output)
- [ ] **[P2]** Backend for large files: server-side indexing, search, and filtering
- [ ] **[P2]** Load multiple files or pods at once and merge them by timestamp
- [ ] **[P3]** Support for additional log formats beyond JSON Lines (if other apps need them)

## Phase 2: Sharing and persistence

- [ ] **[P2]** Saved sessions (reopen a previous log view)
- [ ] **[P2]** Shareable view links between teammates
- [ ] **[P3]** Persist layout (column widths, pane height) in localStorage across reloads
- [ ] **[P3]** Recent files list

## Viewing and analysis features

- [ ] **[P1]** Regex search
- [ ] **[P1]** Filter by time range
- [ ] **[P2]** Filter by logger/class, pod, or container
- [ ] **[P2]** Timeline / histogram of log volume (spot error spikes)
- [ ] **[P2]** Jump to next / previous ERROR (or WARN) entry
- [ ] **[P2]** Trace / correlation ID tracking: click an ID to filter on it
- [ ] **[P2]** Attach non-JSON continuation lines (e.g., raw stack traces) to the preceding JSON entry
- [ ] **[P3]** Group repeated or similar messages
- [ ] **[P3]** Bookmark / pin lines
- [ ] **[P3]** Export filtered results (download as file)
- [ ] **[P3]** Diff two log sets
- [ ] **[P3]** Highlight frames from the application's own packages in stack traces
- [ ] **[P3]** Expand abbreviated package names in stack traces (e.g., `c.t.c.e.` to full name)

## UI and usability

- [ ] **[P2]** Column show/hide and reorder
- [ ] **[P2]** Horizontal scroll for the Message column when columns are widened
- [ ] **[P2]** Keyboard shortcut help panel
- [ ] **[P3]** Light/dark theme toggle (dark is the default)
- [ ] **[P3]** Font size control
- [ ] **[P3]** Line wrap option
- [ ] **[P3]** "Reset layout" button
- [ ] **[P3]** Show the "Raw JSON" view with newlines unescaped for readability
- [ ] **[P3]** Reset/clear the detail pane automatically when a new log is loaded (already true; confirm UX)

## Technical debt and quality

- [ ] **[P1]** Unit tests for the parser (`core/parser/log-parser.ts`)
- [ ] **[P1]** Unit tests for `LogStore` (filters, search, navigation, selection)
- [ ] **[P2]** Component tests for the toolbar and log list
- [ ] **[P2]** Move parsing into a Web Worker if large logs freeze the UI
- [ ] **[P2]** Confirm the log schema used by Python applications (currently assumed identical to Java/Spring)
- [ ] **[P2]** Confirm the complete set of log level values (currently TRACE, DEBUG, INFO, WARN, ERROR, FATAL; others map to OTHER)
- [ ] **[P2]** Performance test with a large log file (e.g., 100k+ lines) and tune if needed
- [ ] **[P3]** Accessibility review (keyboard focus, ARIA labels, contrast)
- [ ] **[P3]** CI/CD pipeline (build, test, lint)
- [ ] **[P3]** Docker packaging for internal deployment
- [ ] **[P3]** Browser compatibility testing beyond Chrome (Edge, Firefox)
- [ ] **[P3]** Automated dependency/security scanning

## Documentation

- [ ] **[P3]** Add screenshots or a short demo GIF to the README
- [ ] **[P3]** Document the parser's field mapping for other teams who may want to reuse it

## Out of scope (explicitly not planned)

- Replacing Kibana's full feature set
- Storing or uploading log data to any external service
