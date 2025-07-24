import * as fs from 'fs';
import * as path from 'path';

function applyUnifiedDiff(originalText: string, diffText: string): string {
    const originalLines = originalText.split('\n');
    let currentLines = [...originalLines];

    const diffLines = diffText.split('\n');
    let i = 0;
    while (i < diffLines.length) {
        const line = diffLines[i];
        if (line.startsWith('@@')) {
            const match = line.match(/@@ -(\d+),(\d+) +(\d+),(\d+) @@/);
            if (match) {
                const oldStart = parseInt(match[1]) - 1;
                const oldCount = parseInt(match[2]);
                const newStart = parseInt(match[3]) - 1;
                const newCount = parseInt(match[4]);

                // Collect the hunk lines
                const hunkLines: string[] = [];
                i++;
                while (i < diffLines.length && !diffLines[i].startsWith('@@')) {
                    hunkLines.push(diffLines[i]);
                    i++;
                }

                // Verify context
                let j = 0;
                let k = oldStart;
                for (const hunkLine of hunkLines) {
                    if (hunkLine.startsWith(' ') || hunkLine.startsWith('-')) {
                        const content = hunkLine.substring(1).trimStart();
                        if (k >= currentLines.length || currentLines[k].trimStart() !== content) {
                            console.log(`Context mismatch at line ${k + 1}: expected '${content}', got '${currentLines[k].trimStart()}'`);
                            return currentLines.join('\n');
                        }
                        k++;
                    }
                }

                // Build new segment
                const newSegment: string[] = [];
                for (const hunkLine of hunkLines) {
                    if (hunkLine.startsWith(' ') || hunkLine.startsWith('+')) {
                        newSegment.push(hunkLine.substring(1));
                    }
                }

                // Apply the change
                currentLines.splice(oldStart, oldCount, ...newSegment);
                console.log(`Applied hunk at ${oldStart}, oldCount: ${oldCount}, new lines: ${newSegment.length}`);
            }
        } else {
            i++;
        }
    }

    return currentLines.join('\n');
}

try {
    const original = fs.readFileSync(path.join('src', '__tests__', 'fixtures', '00001', '0_original-jsondoc.json'), 'utf8');
    const diff = fs.readFileSync(path.join('src', '__tests__', 'fixtures', '00001', '1_raw_llm_diff.txt'), 'utf8');
    const patched = applyUnifiedDiff(original, diff);
    fs.writeFileSync('manual_patched.json', patched);
    console.log('Manual patch applied successfully. Check manual_patched.json');
} catch (error) {
    console.error('Error applying patch:', error);
} 