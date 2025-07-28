#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

interface UnusedImport {
    file: string;
    line: number;
    importName: string;
    isDefault: boolean;
    isNamespace: boolean;
}

class UnusedImportRemover {
    private program: ts.Program;
    private checker: ts.TypeChecker;
    private unusedImports: UnusedImport[] = [];
    private modifiedFiles = new Set<string>();

    constructor(private rootDir: string = process.cwd()) {
        // Find tsconfig.json
        const configPath = ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.json');
        if (!configPath) {
            throw new Error('Could not find tsconfig.json');
        }

        // Parse tsconfig.json
        const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
        const compilerOptions = ts.parseJsonConfigFileContent(
            configFile.config,
            ts.sys,
            path.dirname(configPath)
        );

        // Create TypeScript program
        this.program = ts.createProgram(compilerOptions.fileNames, compilerOptions.options);
        this.checker = this.program.getTypeChecker();
    }

    public async removeUnusedImports(dryRun = false): Promise<void> {
        console.log('🔍 Analyzing TypeScript files for unused imports...\n');

        const sourceFiles = this.program.getSourceFiles()
            .filter(sf => !sf.isDeclarationFile && !sf.fileName.includes('node_modules'));

        for (const sourceFile of sourceFiles) {
            this.analyzeFile(sourceFile);
        }

        if (this.unusedImports.length === 0) {
            console.log('✅ No unused imports found!');
            return;
        }

        console.log(`Found ${this.unusedImports.length} unused imports:\n`);

        // Group by file
        const importsByFile = new Map<string, UnusedImport[]>();
        for (const unusedImport of this.unusedImports) {
            if (!importsByFile.has(unusedImport.file)) {
                importsByFile.set(unusedImport.file, []);
            }
            importsByFile.get(unusedImport.file)!.push(unusedImport);
        }

        // Process each file
        for (const [filePath, imports] of importsByFile) {
            console.log(`📄 ${path.relative(this.rootDir, filePath)}:`);
            for (const imp of imports) {
                console.log(`  - Line ${imp.line}: ${imp.importName}`);
            }

            if (!dryRun) {
                await this.removeImportsFromFile(filePath, imports);
            }
        }

        if (dryRun) {
            console.log('\n🔍 Dry run completed. Use --fix to actually remove unused imports.');
        } else {
            console.log(`\n✅ Removed unused imports from ${this.modifiedFiles.size} files.`);
        }
    }

    private analyzeFile(sourceFile: ts.SourceFile): void {
        const usedIdentifiers = new Set<string>();
        const importDeclarations: ts.ImportDeclaration[] = [];

        // Collect all import declarations
        ts.forEachChild(sourceFile, (node) => {
            if (ts.isImportDeclaration(node)) {
                importDeclarations.push(node);
            }
        });

        // Collect all used identifiers
        const visit = (node: ts.Node) => {
            if (ts.isIdentifier(node)) {
                usedIdentifiers.add(node.text);
            }
            ts.forEachChild(node, visit);
        };

        // Visit all nodes except import declarations
        ts.forEachChild(sourceFile, (node) => {
            if (!ts.isImportDeclaration(node)) {
                visit(node);
            }
        });

        // Check each import declaration
        for (const importDecl of importDeclarations) {
            if (!importDecl.importClause) continue;

            const line = sourceFile.getLineAndCharacterOfPosition(importDecl.getStart()).line + 1;

            // Check default import
            if (importDecl.importClause.name) {
                const defaultImportName = importDecl.importClause.name.text;
                if (!usedIdentifiers.has(defaultImportName)) {
                    this.unusedImports.push({
                        file: sourceFile.fileName,
                        line,
                        importName: defaultImportName,
                        isDefault: true,
                        isNamespace: false
                    });
                }
            }

            // Check named imports
            if (importDecl.importClause.namedBindings) {
                if (ts.isNamedImports(importDecl.importClause.namedBindings)) {
                    for (const element of importDecl.importClause.namedBindings.elements) {
                        const importName = element.name.text;
                        if (!usedIdentifiers.has(importName)) {
                            this.unusedImports.push({
                                file: sourceFile.fileName,
                                line,
                                importName,
                                isDefault: false,
                                isNamespace: false
                            });
                        }
                    }
                } else if (ts.isNamespaceImport(importDecl.importClause.namedBindings)) {
                    // Namespace import (import * as foo)
                    const namespaceName = importDecl.importClause.namedBindings.name.text;
                    if (!usedIdentifiers.has(namespaceName)) {
                        this.unusedImports.push({
                            file: sourceFile.fileName,
                            line,
                            importName: namespaceName,
                            isDefault: false,
                            isNamespace: true
                        });
                    }
                }
            }
        }
    }

    private async removeImportsFromFile(filePath: string, unusedImports: UnusedImport[]): Promise<void> {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        // Group unused imports by line number
        const importsByLine = new Map<number, UnusedImport[]>();
        for (const imp of unusedImports) {
            if (!importsByLine.has(imp.line)) {
                importsByLine.set(imp.line, []);
            }
            importsByLine.get(imp.line)!.push(imp);
        }

        // Process lines in reverse order to maintain line numbers
        const sortedLines = Array.from(importsByLine.keys()).sort((a, b) => b - a);

        for (const lineNum of sortedLines) {
            const lineIndex = lineNum - 1;
            const originalLine = lines[lineIndex];
            const importsOnLine = importsByLine.get(lineNum)!;

            let modifiedLine = originalLine;

            // Remove unused imports from the line
            for (const unusedImport of importsOnLine) {
                if (unusedImport.isDefault) {
                    // Remove default import
                    modifiedLine = modifiedLine.replace(
                        new RegExp(`\\b${unusedImport.importName}\\s*,?\\s*`, 'g'),
                        ''
                    );
                } else if (unusedImport.isNamespace) {
                    // Remove namespace import
                    modifiedLine = modifiedLine.replace(
                        new RegExp(`\\*\\s+as\\s+${unusedImport.importName}\\s*,?\\s*`, 'g'),
                        ''
                    );
                } else {
                    // Remove named import
                    modifiedLine = modifiedLine.replace(
                        new RegExp(`\\b${unusedImport.importName}\\s*,?\\s*`, 'g'),
                        ''
                    );
                }
            }

            // Clean up the import statement
            modifiedLine = this.cleanImportStatement(modifiedLine);

            // If the entire import statement is now empty, remove the line
            if (this.isEmptyImportStatement(modifiedLine)) {
                lines.splice(lineIndex, 1);
            } else {
                lines[lineIndex] = modifiedLine;
            }
        }

        // Write the modified content back to the file
        const modifiedContent = lines.join('\n');
        if (modifiedContent !== content) {
            fs.writeFileSync(filePath, modifiedContent, 'utf-8');
            this.modifiedFiles.add(filePath);
        }
    }

    private cleanImportStatement(line: string): string {
        // Clean up extra commas and spaces
        return line
            .replace(/,\s*,/g, ',') // Remove double commas
            .replace(/{\s*,/g, '{') // Remove comma after opening brace
            .replace(/,\s*}/g, '}') // Remove comma before closing brace
            .replace(/{\s*}/g, '{}') // Clean empty braces
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }

    private isEmptyImportStatement(line: string): boolean {
        // Check if the import statement is effectively empty
        const cleaned = line.replace(/import\s*{\s*}\s*from\s*['"][^'"]*['"];?/g, '');
        const cleanedDefault = cleaned.replace(/import\s*from\s*['"][^'"]*['"];?/g, '');
        return cleaned.trim() === '' || cleanedDefault.trim() === '';
    }
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = !args.includes('--fix');
    const rootDir = args.find(arg => !arg.startsWith('--')) || process.cwd();

    try {
        const remover = new UnusedImportRemover(rootDir);
        await remover.removeUnusedImports(dryRun);
    } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

if (require.main === module) {
    main().finally(() => {
        process.exit(0);
    });
} 