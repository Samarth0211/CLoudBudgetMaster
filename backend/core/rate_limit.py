"""
Shared slowapi limiter. Behind nginx every request appears to come from
127.0.0.1, so we key on the first X-Forwarded-For hop (the real client) and fall
back to the socket address when there's no proxy header.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address


def _client_ip(request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=_client_ip, default_limits=[])
