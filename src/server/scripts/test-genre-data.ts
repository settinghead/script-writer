import { genreOptions, GenreSelection } from '../../client/data/genreOptions';

console.log('🎭 Testing Complete Genre Selection Data Structure');
console.log('===============================================\n');

// Count total items at each level
function countGenreItems(genres: GenreSelection[], level: number = 0): void {
    const indent = '  '.repeat(level);
    let totalAtLevel = 0;

    genres.forEach(genre => {
        totalAtLevel++;
        console.log(`${indent}${level + 1}. ${genre.label}`);

        if (genre.selections && genre.selections.length > 0) {
            console.log(`${indent}   └─ ${genre.selections.length} sub-items`);
            countGenreItems(genre.selections, level + 1);
        }
    });

    if (level === 0) {
        console.log(`\n📊 Level ${level + 1} Summary: ${totalAtLevel} main categories`);
    }
}

// Test the structure
console.log('📋 Genre Hierarchy:');
countGenreItems(genreOptions);

console.log('\n🔍 Testing 4-level depth:');
// Test that we can access 4 levels deep
const level1 = genreOptions[0]; // 人物设定
console.log(`Level 1: ${level1.label}`);

if (level1.selections && level1.selections.length > 0) {
    const level2 = level1.selections[0]; // 女性角色
    console.log(`Level 2: ${level2.label}`);

    if (level2.selections && level2.selections.length > 0) {
        const level3 = level2.selections[0]; // 女性成长
        console.log(`Level 3: ${level3.label}`);

        if (level3.selections && level3.selections.length > 0) {
            const level4 = level3.selections[0]; // 女性觉醒
            console.log(`Level 4: ${level4.label}`);
            console.log('✅ Successfully accessed 4 levels deep!');
        } else {
            console.log('❌ Level 4 not found');
        }
    } else {
        console.log('❌ Level 3 not found');
    }
} else {
    console.log('❌ Level 2 not found');
}

console.log('\n🧮 Total Categories Count:');
function countTotal(genres: GenreSelection[]): number {
    let total = 0;
    genres.forEach(genre => {
        total++;
        if (genre.selections) {
            total += countTotal(genre.selections);
        }
    });
    return total;
}

const totalCount = countTotal(genreOptions);
console.log(`Total genre items across all levels: ${totalCount}`);

console.log('\n✅ Genre data structure test completed successfully!'); 