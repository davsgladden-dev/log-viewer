# Backlog / Tech Debt

## Phase 2 – Features
- [ ] Pull logs directly via kubectl / Kubernetes API (requires Spring Boot backend)
- [ ] Backend for large files (indexing, server-side search/filter)
- [ ] Load multiple files/pods and merge by timestamp
- [ ] Saved sessions / persistence / recent files
- [ ] Shareable views between teammates
- [ ] Parse kubectl prefixes (`--timestamps`, `--prefix`, label-selector output)

## Nice-to-have viewing features (not requested for MVP)
- [ ] Regex search
- [ ] Filter by time range, logger/class, pod/container
- [ ] Timeline / histogram of log volume
- [ ] Jump to next/previous ERROR
- [ ] Bookmark/pin lines
- [ ] Trace/correlation ID tracking (if such fields appear)
- [ ] Group repeated messages
- [ ] Export filtered results
- [ ] Diff two log sets
- [ ] Light/dark theme toggle, font size, line wrap options
- [ ] Attach non-JSON continuation lines (e.g., raw stack traces) to the preceding JSON entry

## Technical debt
- [ ] Unit tests (parser first, then store)
- [ ] Move parsing into a Web Worker if larger files cause UI freezes
- [ ] CI/CD and Docker packaging
- [ ] Confirm the schema of Python app logs (currently assumed identical)
- [ ] Confirm the full set of level values (currently TRACE/DEBUG/INFO/WARN/ERROR/FATAL, others map to OTHER)
