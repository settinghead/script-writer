# Remove Unused Imports Script

A TypeScript script that analyzes your codebase and removes unused imports automatically.

## Usage

### Dry Run (Preview Only)
```bash
npm run remove-unused-imports
```
or
```bash
./run-ts src/server/scripts/remove-unused-imports.ts
```

This will analyze all TypeScript files and show you what unused imports were found, but won't make any changes.

### Fix Mode (Actually Remove Imports)
```bash
npm run remove-unused-imports:fix
```
or
```bash
./run-ts src/server/scripts/remove-unused-imports.ts --fix
```

This will actually remove the unused imports from your files.

### Custom Directory
```bash
./run-ts src/server/scripts/remove-unused-imports.ts /path/to/directory --fix
```

## What It Does

The script uses TypeScript's compiler API to:

1. **Parse your tsconfig.json** to understand your project structure
2. **Analyze each TypeScript file** to identify:
   - Default imports (`import Foo from 'foo'`)
   - Named imports (`import { bar, baz } from 'foo'`)
   - Namespace imports (`import * as foo from 'foo'`)
3. **Track usage** of each imported identifier throughout the file
4. **Remove unused imports** while preserving:
   - Used imports on the same line
   - Proper formatting and syntax
   - Import statements that are partially used

## Features

- ✅ **Safe removal**: Only removes truly unused imports
- ✅ **Smart cleanup**: Handles mixed used/unused imports on the same line
- ✅ **Dry run mode**: Preview changes before applying them
- ✅ **TypeScript aware**: Uses TS compiler API for accurate analysis
- ✅ **Batch processing**: Processes all files in your project at once
- ✅ **Clean output**: Shows exactly what will be removed and from which files

## Example Output

```
🔍 Analyzing TypeScript files for unused imports...

Found 148 unused imports:

📄 src/client/components/LoginPage.tsx:
  - Line 6: Stack

📄 src/client/components/ProjectList.tsx:
  - Line 3: Tooltip
  - Line 17: EditOutlined
  - Line 17: ProjectOutlined

🔍 Dry run completed. Use --fix to actually remove unused imports.
```

## Safety Notes

- Always run in dry-run mode first to review changes
- The script respects your tsconfig.json settings
- Only processes TypeScript files (`.ts`, `.tsx`)
- Skips declaration files (`.d.ts`) and node_modules
- Creates backups by showing you exactly what will be changed

## Limitations

- May not detect dynamic imports or runtime usage
- Cannot detect usage in template strings or comments
- Conservative approach: when in doubt, it keeps the import 