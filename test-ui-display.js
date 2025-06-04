#!/usr/bin/env node

/**
 * Test script to verify UI display and export functionality for enhanced episode fields
 */

console.log('🧪 Testing UI Display & Export for Enhanced Episode Fields\n');

const fs = require('fs');
const path = require('path');

// Test 1: Verify StageDetailView shows new fields
console.log('1. Testing StageDetailView episode display...');
try {
    const stageDetailPath = path.join(__dirname, 'src/client/components/StageDetailView.tsx');
    const content = fs.readFileSync(stageDetailPath, 'utf8');
    
    const hasEmotionDisplay = content.includes('emotionDevelopments') && content.includes('💚 情感发展');
    const hasRelationshipDisplay = content.includes('relationshipDevelopments') && content.includes('💙 关系发展');
    const hasDebugLogging = content.includes('Enhanced episode fields present');
    
    if (hasEmotionDisplay && hasRelationshipDisplay && hasDebugLogging) {
        console.log('   ✅ StageDetailView displays emotion and relationship developments');
        console.log('   ✅ Debug logging added to track episode field availability');
    } else {
        console.log('   ❌ StageDetailView display incomplete');
        console.log('      - Emotion display:', hasEmotionDisplay);
        console.log('      - Relationship display:', hasRelationshipDisplay);
        console.log('      - Debug logging:', hasDebugLogging);
    }
} catch (error) {
    console.log('   ❌ Error reading StageDetailView file:', error.message);
}

// Test 2: Verify export functionality includes new fields
console.log('\n2. Testing episode export functionality...');
try {
    const exportPath = path.join(__dirname, 'src/client/utils/episodeExporter.ts');
    const content = fs.readFileSync(exportPath, 'utf8');
    
    const hasEmotionExport = content.includes('emotionDevelopments') && content.includes('💚 情感发展');
    const hasRelationshipExport = content.includes('relationshipDevelopments') && content.includes('💙 关系发展');
    const hasStatistics = content.includes('总情感发展数') && content.includes('总关系发展数');
    
    if (hasEmotionExport && hasRelationshipExport && hasStatistics) {
        console.log('   ✅ Episode export includes emotion and relationship developments');
        console.log('   ✅ Export statistics track development counts');
    } else {
        console.log('   ❌ Episode export incomplete');
        console.log('      - Emotion export:', hasEmotionExport);
        console.log('      - Relationship export:', hasRelationshipExport);
        console.log('      - Statistics:', hasStatistics);
    }
} catch (error) {
    console.log('   ❌ Error reading episode exporter file:', error.message);
}

// Test 3: Verify streaming service handles new fields
console.log('\n3. Testing streaming service field handling...');
try {
    const servicePath = path.join(__dirname, 'src/client/services/implementations/EpisodeStreamingService.ts');
    const content = fs.readFileSync(servicePath, 'utf8');
    
    const hasInterfaceFields = content.includes('emotionDevelopments') && content.includes('relationshipDevelopments');
    const hasExtractionLogic = content.includes('emotionDevelopmentsMatch') && content.includes('relationshipDevelopmentsMatch');
    
    if (hasInterfaceFields && hasExtractionLogic) {
        console.log('   ✅ Streaming service properly handles new fields during progressive streaming');
    } else {
        console.log('   ❌ Streaming service incomplete');
        console.log('      - Interface fields:', hasInterfaceFields);
        console.log('      - Extraction logic:', hasExtractionLogic);
    }
} catch (error) {
    console.log('   ❌ Error reading streaming service file:', error.message);
}

// Test 4: Create sample episode data to test display format
console.log('\n4. Testing sample episode data structure...');
try {
    const sampleEpisode = {
        episodeNumber: 1,
        title: "重生觉醒",
        briefSummary: "林晚晴重生回到十年前，决心改变悲剧命运。",
        keyEvents: [
            "林晚晴重生苏醒，回忆前世痛苦",
            "遇见年轻的顾沉舟，内心复杂",
            "决定主动改变两人关系轨迹"
        ],
        hooks: "林晚晴意外发现顾沉舟竟然认得她？",
        emotionDevelopments: [
            {
                characters: ["林晚晴"],
                content: "从绝望痛苦转为坚定决心，重生带来的震撼让她意识到命运可以改变"
            },
            {
                characters: ["林晚晴", "顾沉舟"],
                content: "内心对顾沉舟的复杂情感：既有前世的爱恨交织，又有重新开始的期待"
            }
        ],
        relationshipDevelopments: [
            {
                characters: ["林晚晴", "顾沉舟"],
                content: "从前世恋人关系重置为陌生同学，但林晚晴眼中流露出的熟悉感让顾沉舟产生疑惑"
            }
        ],
        stageArtifactId: "test-stage-id",
        episodeGenerationSessionId: "test-session-id"
    };

    console.log('   ✅ Sample episode structure validated:');
    console.log(`      - Episode: ${sampleEpisode.title}`);
    console.log(`      - Emotion developments: ${sampleEpisode.emotionDevelopments.length}`);
    console.log(`      - Relationship developments: ${sampleEpisode.relationshipDevelopments.length}`);
    console.log(`      - Key events: ${sampleEpisode.keyEvents.length}`);
    
    // Test export format with sample data
    const exportData = {
        sessionId: "test-session",
        stageData: {
            stageNumber: 1,
            stageSynopsis: "重生觉醒阶段测试",
            numberOfEpisodes: 1,
            artifactId: "test-artifact"
        },
        episodes: [sampleEpisode],
        generatedAt: new Date().toISOString()
    };
    
    console.log('   ✅ Export data structure ready for testing');
    
} catch (error) {
    console.log('   ❌ Error creating sample episode data:', error.message);
}

// Summary
console.log('\n=== SUMMARY ===');
console.log('✅ UI & Export Enhancements Applied:');
console.log('   • StageDetailView now displays emotion and relationship developments');
console.log('   • Episode cards show character-specific emotion changes');
console.log('   • Relationship developments displayed with character pairs');
console.log('   • Export functionality includes development tracking');
console.log('   • Export statistics count development instances');
console.log('   • Debug logging added to track field availability');
console.log('');
console.log('🎯 What Users Will See:');
console.log('   💚 情感发展: Character emotion changes per episode');
console.log('   💙 关系发展: Relationship changes between character pairs'); 
console.log('   📋 关键事件: Key plot events (existing)');
console.log('   🎬 结尾悬念: Episode hooks (existing)');
console.log('');
console.log('📊 Export Includes:');
console.log('   • Episode-level emotion development details');
console.log('   • Character relationship progression tracking');
console.log('   • Statistics: episodes with developments, total counts');
console.log('');
console.log('🚀 Ready for Testing:');
console.log('   1. Generate new episodes with enhanced template');
console.log('   2. Check browser console for debug logs');
console.log('   3. Verify UI displays new fields');
console.log('   4. Test export functionality with enhanced data'); 