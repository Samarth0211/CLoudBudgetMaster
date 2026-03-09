"""GCP Billing — fetch costs from BigQuery billing export."""
from datetime import datetime, timedelta


async def get_gcp_costs(credentials: dict) -> dict | None:
    """
    Fetch daily costs from GCP BigQuery billing export.

    Requires:
    - credentials["project_id"]: GCP project ID
    - credentials["service_account_json"]: Service account key (dict)
    - BigQuery billing export table configured in the project

    Returns: { "date": "YYYY-MM-DD", "total": float, "breakdown": { service: cost } }
    """
    try:
        from google.cloud import bigquery
        from google.oauth2 import service_account
    except ImportError:
        raise NotImplementedError(
            "GCP scanning requires google-cloud-bigquery package. "
            "Install with: pip install google-cloud-bigquery"
        )

    project_id = credentials.get("project_id")
    sa_json = credentials.get("service_account_json")

    if not project_id or not sa_json:
        raise ValueError("Missing project_id or service_account_json in credentials")

    # Build credentials
    creds = service_account.Credentials.from_service_account_info(
        sa_json,
        scopes=["https://www.googleapis.com/auth/bigquery.readonly"],
    )

    client = bigquery.Client(project=project_id, credentials=creds)

    # Query last day's billing
    yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")

    query = f"""
    SELECT
        service.description AS service_name,
        SUM(cost) AS total_cost
    FROM `{project_id}.billing_export.gcp_billing_export_v1_*`
    WHERE DATE(usage_start_time) = '{yesterday}'
    GROUP BY service_name
    ORDER BY total_cost DESC
    """

    try:
        results = client.query(query).result()
        breakdown = {}
        total = 0.0
        for row in results:
            cost = float(row.total_cost or 0)
            breakdown[row.service_name] = round(cost, 2)
            total += cost

        return {
            "date": yesterday,
            "total": round(total, 2),
            "breakdown": breakdown,
        }
    except Exception as e:
        # BigQuery table might not exist yet
        raise RuntimeError(f"Failed to query BigQuery billing: {e}")
