#!/bin/sh
# PROTOTYPE — throwaway local server.
exec python3 -m http.server 4173 --directory "$(dirname "$0")"
