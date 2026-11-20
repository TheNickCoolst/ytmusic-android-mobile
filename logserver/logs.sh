#!/bin/sh
# Show app logs from Railway. Usage: ./logs.sh [day YYYY-MM-DD] [level] [device]
# Needs READ_TOKEN in ~/.ytmusic-logs.env
. ~/.ytmusic-logs.env
Q="limit=500"
[ -n "$1" ] && Q="$Q&day=$1"
[ -n "$2" ] && Q="$Q&level=$2"
[ -n "$3" ] && Q="$Q&device=$3"
curl -s "https://logs-production-0aaa9aa2.up.railway.app/logs?$Q" -H "Authorization: Bearer $READ_TOKEN" |
  python3 -c 'import sys,json
for e in json.load(sys.stdin): print(e["t"][11:19], e["platform"], e["device"][:6], e["level"].upper(), e["msg"])'
