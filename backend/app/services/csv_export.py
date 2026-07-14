"""Shared CSV-streaming helper. Always reads the full underlying query — no
dashboard-pagination cap — so an export can never silently truncate a large
campaign (a real incident on the reference platform this app is modeled on:
its dashboard export button used to only export the currently-loaded page)."""
from __future__ import annotations

import csv
import io
from collections.abc import Iterable

from fastapi.responses import StreamingResponse

# Cells starting with any of these are interpreted as formulas by Excel/Sheets.
_FORMULA_LEADS = ("=", "+", "-", "@", "\t", "\r")


def sanitize_cell(value):
    """Neutralize CSV/formula injection (CWE-1236): prefix a `'` to any string
    cell that starts with a formula trigger so a creator-controlled value like
    `=1+1` (or `=HYPERLINK(...)`) can't execute when an admin opens the export."""
    if isinstance(value, str) and value and value[0] in _FORMULA_LEADS:
        return "'" + value
    return value


def csv_response(filename: str, header: list[str], rows: Iterable[list]) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    for row in rows:
        writer.writerow([sanitize_cell(c) for c in row])
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
