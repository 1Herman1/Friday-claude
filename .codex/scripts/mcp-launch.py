#!/usr/bin/env python3
"""Launch repo MCP servers from any subdirectory without shell path assumptions."""
import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
name = sys.argv[1]
folders = {'icon-library': 'tools/icon-mcp-server', 'nullume': 'tools/nullume'}
folder = root / folders[name]
os.chdir(folder)
if name == 'nullume' and (folder / 'dist/mcp/index.js').exists():
    command = ['node', 'dist/mcp/index.js']
else:
    entry = 'src/index.ts' if name == 'icon-library' else 'src/mcp/index.ts'
    command = ['node', '--import', 'tsx', entry]
os.execvp(command[0], command)
