from fastapi import APIRouter, HTTPException, Request, UploadFile, File

from backend.core.rate_limit import limiter
from backend.services.bill_audit.parser import parse_billing_csv
from backend.services.bill_audit.analyze import analyze_line_items

router = APIRouter(prefix="/bill-audit", tags=["bill-audit"])

# Hard cap for the public no-signup endpoint. Tighter than the parser's own
# 50MB safety valve (see parser.MAX_BYTES) since this is an unauthenticated,
# ungated upload — read only up to this many bytes off the wire and bail.
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post("/check")
@limiter.limit("20/minute")
async def check_bill(request: Request, file: UploadFile = File(...)):
    """Public, no-signup bill health check. Accepts a CSV upload, runs the
    bill-audit engine in memory, and returns the findings report. Nothing is
    persisted — the file bytes are discarded when the request completes.
    """
    try:
        chunks = []
        total = 0
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > _MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=(
                        f"File is too large. Max supported size is "
                        f"{_MAX_UPLOAD_BYTES // (1024 * 1024)} MB. "
                        "Export a grouped summary (by Service/Usage Type) instead of a raw CUR dump."
                    ),
                )
            chunks.append(chunk)
        raw_bytes = b"".join(chunks)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read the uploaded file.")
    finally:
        try:
            await file.close()
        except Exception:
            pass

    try:
        parse_result = parse_billing_csv(raw_bytes, filename=file.filename)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse the uploaded CSV.")

    if not parse_result.ok:
        raise HTTPException(status_code=400, detail=parse_result.error or "Could not parse the uploaded CSV.")

    try:
        report = analyze_line_items(parse_result.line_items, warnings=parse_result.warnings)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not analyze the uploaded CSV.")

    return report.to_dict()
