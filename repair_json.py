#!/usr/bin/env python3
"""
JSON Repair Utility

Uses the json_repair Python library to fix malformed JSON from LLM outputs.
Can read from a file or stdin and outputs repaired JSON to stdout.

Usage:
    python repair_json.py <filename>
    cat file.json | python repair_json.py
"""

import sys
import json_repair
import argparse

def main():
    parser = argparse.ArgumentParser(description='Repair malformed JSON using json_repair library')
    parser.add_argument('filename', nargs='?', help='JSON file to repair (if omitted, reads from stdin)')
    parser.add_argument('--ensure-ascii', action='store_true', help='Ensure ASCII output (default: preserve non-ASCII)')
    parser.add_argument('--indent', type=int, default=2, help='JSON indentation spaces (default: 2)')
    
    args = parser.parse_args()
    
    try:
        # Read input
        if args.filename:
            with open(args.filename, 'r', encoding='utf-8') as f:
                input_text = f.read()
        else:
            input_text = sys.stdin.read()
        
        # Repair the JSON
        # Use ensure_ascii=False to preserve Chinese characters
        if args.ensure_ascii:
            repaired_json = json_repair.repair_json(input_text, ensure_ascii=True)
        else:
            repaired_json = json_repair.repair_json(input_text, ensure_ascii=False)
        
        # Re-format with proper indentation if needed
        if args.indent > 0:
            import json
            parsed = json.loads(repaired_json)
            repaired_json = json.dumps(parsed, ensure_ascii=not args.ensure_ascii, indent=args.indent)
        
        # Output to stdout
        print(repaired_json)
        
    except FileNotFoundError:
        print(f"Error: File '{args.filename}' not found", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error repairing JSON: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main() 