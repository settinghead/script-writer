#!/usr/bin/env node

import { extractDataAtPath, setDataAtPath, validatePath, getPathDescription } from '../../common/utils/pathExtraction';

console.log('🧪 Testing Path Extraction Utilities\n');

// Test data structure like brainstorm_idea_collection
const testData = [
  { title: 'Test Title 1', body: 'Test Body 1' },
  { title: 'Test Title 2', body: 'Test Body 2' },
  { title: 'Test Title 3', body: 'Test Body 3' }
];

console.log('📊 Test data:', JSON.stringify(testData, null, 2));

console.log('\n🔍 Testing extractDataAtPath:');
console.log('Extract [0]:', extractDataAtPath(testData, '[0]'));
console.log('Extract [0].title:', extractDataAtPath(testData, '[0].title'));
console.log('Extract [0].body:', extractDataAtPath(testData, '[0].body'));
console.log('Extract [1].title:', extractDataAtPath(testData, '[1].title'));
console.log('Extract [2].body:', extractDataAtPath(testData, '[2].body'));

console.log('\n📝 Testing getPathDescription:');
console.log('[0].title ->', getPathDescription('[0].title'));
console.log('[1].body ->', getPathDescription('[1].body'));
console.log('[2].title ->', getPathDescription('[2].title'));

console.log('\n✅ Path extraction test completed'); 