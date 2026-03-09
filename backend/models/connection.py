from pydantic import BaseModel
from typing import Optional


class AWSCredentials(BaseModel):
    access_key_id: str
    secret_access_key: str
    region: str = "us-east-1"


class GCPCredentials(BaseModel):
    service_account_json: dict
    project_id: str


class AzureCredentials(BaseModel):
    tenant_id: str
    client_id: str
    client_secret: str
    subscription_id: str


class SnowflakeCredentials(BaseModel):
    account: str
    user: str
    password: str
    warehouse: str = "COMPUTE_WH"


class CreateConnectionRequest(BaseModel):
    provider: str  # aws, gcp, azure, snowflake
    display_name: str
    credentials: dict


class ConnectionResponse(BaseModel):
    id: str
    provider: str
    display_name: str
    status: str
    last_scanned_at: Optional[str] = None
    error_message: Optional[str] = None
    created_at: str


class ConnectionListResponse(BaseModel):
    connections: list[ConnectionResponse]
    count: int


class ConnectionStatusResponse(BaseModel):
    id: str
    provider: str
    display_name: str
    status: str
    last_scanned_at: Optional[str] = None
    error_message: Optional[str] = None
    resource_count: int = 0
    total_monthly_cost_usd: float = 0.0
    waste_monthly_cost_usd: float = 0.0
