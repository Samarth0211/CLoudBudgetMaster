"""
Vercel serverless entry point for the FastAPI backend.
Vercel auto-maps api/index.py to /api/* routes.
"""
import sys
import os

# Ensure the project root is on the Python path so `from backend.xxx` imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app  # noqa: E402
