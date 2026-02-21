#!/bin/bash
cd /Users/muftau/Documents/programming/trading-ai
source python/venv/bin/activate
source .env 2>/dev/null
export $(grep -E "^[A-Z_]+=" .env | cut -d= -f1) 2>/dev/null
exec python -m uvicorn python.server.main:app --port 8000
