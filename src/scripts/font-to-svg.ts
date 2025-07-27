#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as opentype from 'opentype.js';

interface FontToSvgOptions {
    fontPath: string;
    text: string;
    fontSize?: number;
    outputPath?: string;
    help?: boolean;
}

function showHelp() {
    console.log(`
Font to SVG Converter

Usage: ./run-ts src/scripts/font-to-svg.ts [options] <font-path> <text>

Arguments:
  font-path     Path to the font file (TTF, OTF, or WOFF - WOFF2 not supported)
  text          Text to convert to SVG

Options:
  -s, --size <number>     Font size in pixels (default: 48)
  -o, --output <path>     Output SVG file path (default: auto-generated)
  -h, --help              Show this help message

Examples:
  ./run-ts src/scripts/font-to-svg.ts fonts/my-font.ttf "Hello World"
  ./run-ts src/scripts/font-to-svg.ts -s 64 -o logo.svg fonts/custom.ttf "Company Name"
  ./run-ts src/scripts/font-to-svg.ts fonts/chinese.ttf "觅光助创"
  ./run-ts src/scripts/font-to-svg.ts -s 32 fonts/regular.otf "Test Text"

Supported Formats:
  ✅ TTF (TrueType Font)
  ✅ OTF (OpenType Font) 
  ⚠️  WOFF (Web Open Font Format) - may have compatibility issues
  ❌ WOFF2 (not supported by opentype.js)

Output:
  Creates an SVG file with scalable vector text using the specified font.
  The SVG uses 'currentColor' for fill, making it easy to style with CSS.
`);
}

function parseArgs(): FontToSvgOptions {
    const args = process.argv.slice(2);
    const options: FontToSvgOptions = {
        fontPath: '',
        text: '',
        fontSize: 48
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '-h' || arg === '--help') {
            options.help = true;
            return options;
        }

        if (arg === '-s' || arg === '--size') {
            const size = parseInt(args[++i]);
            if (isNaN(size) || size <= 0) {
                throw new Error('Font size must be a positive number');
            }
            options.fontSize = size;
            continue;
        }

        if (arg === '-o' || arg === '--output') {
            options.outputPath = args[++i];
            if (!options.outputPath) {
                throw new Error('Output path is required after -o/--output');
            }
            continue;
        }

        // Positional arguments
        if (!options.fontPath) {
            options.fontPath = arg;
        } else if (!options.text) {
            options.text = arg;
        } else {
            throw new Error(`Unexpected argument: ${arg}`);
        }
    }

    if (!options.fontPath || !options.text) {
        throw new Error('Both font path and text are required');
    }

    return options;
}

function generateOutputPath(fontPath: string, text: string): string {
    const fontName = path.basename(fontPath, path.extname(fontPath));
    const safeText = text.replace(/[^\w\u4e00-\u9fff]/g, '-').substring(0, 20);
    const timestamp = Date.now();
    return `${fontName}-${safeText}-${timestamp}.svg`;
}

async function fontToSvg(options: FontToSvgOptions): Promise<void> {
    try {
        console.log(`Loading font from: ${options.fontPath}`);

        // Check if font file exists
        if (!fs.existsSync(options.fontPath)) {
            throw new Error(`Font file not found: ${options.fontPath}`);
        }

        // Load the font with better error handling
        let font: opentype.Font;
        try {
            font = opentype.loadSync(options.fontPath);
        } catch (loadError: any) {
            if (loadError.message.includes('wOF2')) {
                throw new Error('WOFF2 format is not supported. Please use TTF, OTF, or WOFF format instead.');
            } else if (loadError.message.includes('cmap')) {
                throw new Error('Invalid or corrupted font file. The font may be missing required character mapping tables.');
            } else {
                throw new Error(`Failed to load font: ${loadError.message}`);
            }
        }

        const fontName = font.names.fullName?.en || font.names.fontFamily?.en || 'Unknown Font';
        console.log(`Font loaded successfully: ${fontName}`);

        // Check if font supports the characters in the text
        const missingChars: string[] = [];
        for (const char of options.text) {
            const glyph = font.charToGlyph(char);
            if (!glyph || !glyph.unicode || glyph.index === 0) {
                missingChars.push(char);
            }
        }

        if (missingChars.length > 0) {
            console.warn(`⚠️  Warning: Font may not support these characters: ${missingChars.join(', ')}`);
            console.warn('The SVG may display missing character symbols (□) for unsupported characters.');
        }

        // Create SVG path for the text
        const fontPath = font.getPath(options.text, 0, options.fontSize!, options.fontSize!);
        const pathData = fontPath.toPathData(2);

        // Calculate text dimensions for proper SVG viewBox
        const bbox = fontPath.getBoundingBox();
        const width = Math.ceil(bbox.x2 - bbox.x1);
        const height = Math.ceil(bbox.y2 - bbox.y1);

        console.log(`Text: "${options.text}"`);
        console.log(`Font size: ${options.fontSize}px`);
        console.log(`SVG dimensions: ${width}x${height}px`);
        console.log(`Bounding box: x1=${bbox.x1.toFixed(2)}, y1=${bbox.y1.toFixed(2)}, x2=${bbox.x2.toFixed(2)}, y2=${bbox.y2.toFixed(2)}`);

        // Generate output path if not provided
        const outputPath = options.outputPath || generateOutputPath(options.fontPath, options.text);

        // Create SVG content with proper viewBox and dimensions
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bbox.x1} ${bbox.y1} ${width} ${height}" width="${width}" height="${height}">
  <path d="${pathData}" fill="currentColor"/>
</svg>`;

        // Ensure the output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Write SVG to file
        fs.writeFileSync(outputPath, svg);

        console.log(`✅ SVG generated successfully: ${outputPath}`);
        console.log(`📊 File size: ${fs.statSync(outputPath).size} bytes`);

    } catch (error) {
        console.error('❌ Error generating SVG:', error);
        process.exit(1);
    }
}

async function main() {
    try {
        const options = parseArgs();

        if (options.help) {
            showHelp();
            return;
        }

        await fontToSvg(options);

    } catch (error) {
        console.error('❌ Error:', (error as Error).message);
        console.log('\nUse --help for usage information');
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

// Run if this script is executed directly
if (require.main === module) {
    main();
} 