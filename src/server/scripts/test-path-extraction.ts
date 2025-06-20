#!/usr/bin/env node

import { extractDataAtPath, setDataAtPath, validatePath, getPathDescription } from '../../common/utils/pathExtraction';

console.log('🧪 Testing Path Extraction Utilities\n');

// Test data structure similar to brainstorm_idea_collection
const testData = [
    { title: "逆世商凰", body: "现代女性穿越到古代，成为商界女强人的故事" },
    { title: "智穿山河", body: "拥有现代知识的女主在古代开创新事业" },
    { title: "时空恋曲", body: "跨越时空的爱情故事，现代与古代的碰撞" }
];

console.log('📊 Test Data:');
console.log(JSON.stringify(testData, null, 2));
console.log();

// Test 1: Extract data at various paths
console.log('🔍 Test 1: Extract data at paths');
console.log('Root data:', extractDataAtPath(testData, ''));
console.log('First idea:', extractDataAtPath(testData, '[0]'));
console.log('First title:', extractDataAtPath(testData, '[0].title'));
console.log('Second body:', extractDataAtPath(testData, '[1].body'));
console.log('Invalid path:', extractDataAtPath(testData, '[5].title'));
console.log();

// Test 2: Validate paths
console.log('✅ Test 2: Validate paths');
console.log('Valid path [0].title:', validatePath(testData, '[0].title'));
console.log('Valid path [1].body:', validatePath(testData, '[1].body'));
console.log('Invalid path [5].title:', validatePath(testData, '[5].title'));
console.log('Invalid path [0].invalid:', validatePath(testData, '[0].invalid'));
console.log();

// Test 3: Set data at paths
console.log('🔧 Test 3: Set data at paths');
const modified1 = setDataAtPath(testData, '[0].title', '新标题');
console.log('Modified first title:', extractDataAtPath(modified1, '[0].title'));

const modified2 = setDataAtPath(testData, '[1].body', '这是一个新的故事内容');
console.log('Modified second body:', extractDataAtPath(modified2, '[1].body'));
console.log();

// Test 4: Path descriptions
console.log('📝 Test 4: Path descriptions');
console.log('Empty path:', getPathDescription(''));
console.log('[0].title:', getPathDescription('[0].title'));
console.log('[1].body:', getPathDescription('[1].body'));
console.log('[2].title:', getPathDescription('[2].title'));
console.log('custom.field:', getPathDescription('custom.field'));
console.log();

// Test 5: Edge cases
console.log('🚨 Test 5: Edge cases');
try {
    console.log('Null data:', extractDataAtPath(null, '[0].title'));
} catch (error) {
    console.log('Null data error:', error.message);
}

try {
    console.log('Undefined data:', extractDataAtPath(undefined, '[0].title'));
} catch (error) {
    console.log('Undefined data error:', error.message);
}

console.log('Empty array:', extractDataAtPath([], '[0].title'));
console.log('Empty object:', extractDataAtPath({}, 'title'));
console.log();

console.log('✅ Path extraction utilities test completed!'); 