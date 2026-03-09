import json
from cryptography.fernet import Fernet
from backend.config import get_settings


def get_fernet() -> Fernet:
    key = get_settings().credential_encryption_key
    return Fernet(key.encode())


def encrypt_credentials(credentials: dict) -> str:
    f = get_fernet()
    return f.encrypt(json.dumps(credentials).encode()).decode()


def decrypt_credentials(encrypted: str) -> dict:
    f = get_fernet()
    return json.loads(f.decrypt(encrypted.encode()).decode())
