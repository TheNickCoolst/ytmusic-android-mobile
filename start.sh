#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "================================================="
echo "  🎵 YT Music Mobile (Android & Ad-Free Background) 🎵"
echo "================================================="

# Check Python environment
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 ist nicht installiert."
    exit 1
fi

# Build frontend if dist doesn't exist
if [ ! -d "frontend/dist" ]; then
    echo "📦 Baue Frontend..."
    cd frontend
    bun run build || npm run build
    cd ..
fi

echo "🚀 Starte Server auf http://0.0.0.0:8000 ..."
echo "📱 Öffne diese URL im Android-Browser (Chrome / Brave / Firefox)"
echo "💡 Tippe auf 'Zum Startbildschirm hinzufügen' für native App-Erfahrung!"
echo "-------------------------------------------------"

exec python3 -m uvicorn backend.server:app --host 0.0.0.0 --port 8000
