"""WSGI entry point for hosting the contacts application."""
import sys
from pathlib import Path

backend_dir = str(Path(__file__).resolve().parent / 'backend')
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import create_app

application = create_app()
