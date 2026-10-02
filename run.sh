#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

PYTHON="/media/mahdi/Data/data-lake/venv/bin/python"

if [ ! -x "$PYTHON" ]; then
    echo "Python executable not found:"
    echo "$PYTHON"
    exit 1
fi

exec "$PYTHON" -m uvicorn app.server:app --host 127.0.0.1 --port 8787
