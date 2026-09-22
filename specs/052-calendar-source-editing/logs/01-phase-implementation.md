# 01 — Implementation

## Result

✅ Complete.

- Reused the existing authenticated calendar-source update mutation for birthday titles.
- Allowed uploaded ICS source titles and colors to be updated without selecting a
  replacement file.
- Kept the edited source in dialog state so successful renames update immediately.
- Invalidated calendar event queries after source metadata changes.
- Replaced dense source rows with responsive cards and explicit text-labelled actions.
