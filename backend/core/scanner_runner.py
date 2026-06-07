from backend.db.client import get_db


async def run_scan(connection_id: str, provider: str, credentials: dict, user_id: str):
    """Dispatch scan to the appropriate provider scanner."""
    db = get_db()

    if provider == "aws":
        from backend.services.aws.scanner import scan_aws
        return await scan_aws(connection_id, credentials, user_id, db)
    elif provider == "gcp":
        from backend.services.gcp.scanner import scan_gcp
        return await scan_gcp(connection_id, credentials, user_id, db)
    elif provider == "azure":
        raise NotImplementedError("Azure scanning coming in Weekend 6")
    elif provider == "snowflake":
        raise NotImplementedError("Snowflake scanning coming in Weekend 5")
    else:
        raise ValueError(f"Unknown provider: {provider}")
