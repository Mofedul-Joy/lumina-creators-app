"""Shared CSV-streaming helper. Always reads the full underlying query — no
dashboard-pagination cap — so an export can never silently truncate a large
campaign (a real incident on the reference platform this app is modeled on:
its dashboard export button used to only export the currently-loaded page)."""
from __future__ import annotations

import csv
import io
from collections.abc import Iterable

from fastapi.responses import StreamingResponse


def csv_response(filename: str, header: list[str], rows: Iterable[list]) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    for row in rows:
        writer.writerow(row)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
