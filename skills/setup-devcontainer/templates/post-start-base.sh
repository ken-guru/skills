#!/bin/bash
set -euo pipefail
# Runs on every container start (not just create/rebuild). Empty by design —
# each CLI skill appends its own skill-sync block here, under its own
# marker, when the user opts into automatic skill sync for that tool.
