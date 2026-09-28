"""Utilidades compartilhadas pelos models."""
from datetime import datetime, timezone


def utcnow() -> datetime:
    
    return datetime.now(timezone.utc).replace(tzinfo=None)
