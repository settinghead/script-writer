import 'dotenv/config';
import { executeIdeationTransform } from '../transforms/ideation.js';
import type { IdeationInput } from '../../common/transform_schemas.js';

async function testIdeation() {
  console.log('🚀 Starting ideation transform test...');

  const testInput: IdeationInput = {
    platform: '抖音',
    genre: '甜宠',
    main_story_points: '职场精英, 双强CP',
    plot_keywords: '谈判专家, 微表情专家, 悬疑破案',
    style_modifiers: '高智商男女主, 救赎式甜宠恋爱',
    other_requirements: '需要有反转情节',
  };

  console.log('\n📝 Test Input:');
  console.log(JSON.stringify(testInput, null, 2));

  try {
    const startTime = Date.now();
    const ideas = await executeIdeationTransform(testInput);
    const duration = (Date.now() - startTime) / 1000;

    console.log(`\n✅ Ideation transform completed successfully in ${duration.toFixed(2)}s!`);
    console.log(`\n💡 Generated Ideas (${ideas.length}):`);
    console.log(JSON.stringify(ideas, null, 2));

  } catch (error) {
    console.error('\n❌ Ideation transform failed:');
    if (error instanceof Error) {
        console.error('Error message:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    } else {
        console.error('An unknown error occurred:', error);
    }
  }
}

testIdeation(); 