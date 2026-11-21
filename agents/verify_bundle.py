#!/usr/bin/env python3
"""Mirror entry point delegating directly to ../.agents/verify_bundle.py."""

from pathlib import Path
import runpy

_CANONICAL = Path(__file__).resolve().parent.parent / ".agents" / "verify_bundle.py"

if __name__ == "__main__":
    runpy.run_path(str(_CANONICAL), run_name="__main__")
else:
    globals().update(runpy.run_path(str(_CANONICAL)))
