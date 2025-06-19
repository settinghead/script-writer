import 'dotenv/config';
import { executeStreamingIdeationTransform } from '../transforms/ideation-stream.js';
import type { IdeationInput } from '../../common/transform_schemas.js';
import { spinner } from '@clack/prompts';
import c from 'ansi-colors';

async function testStreamingIdeation() {
  console.log(c.bold.yellow('🚀 Starting streaming ideation transform test...'));

  const testInput: IdeationInput = {
    platform: '抖音',
    genre: '甜宠',
    main_story_points: '职场精英, 双强CP',
    plot_keywords: '谈判专家, 微表情专家, 悬疑破案',
    style_modifiers: '高智商男女主, 救赎式甜宠恋爱',
    other_requirements: '需要有反转情节',
  };

  console.log(c.bold('\n📝 Test Input:'));
  console.log(JSON.stringify(testInput, null, 2));

  const s = spinner();
  s.start('Generating ideas...');
  
  try {
    const startTime = Date.now();
    const partialObjectStream = await executeStreamingIdeationTransform(testInput);

    let lastOutput: any = null;

    for await (const partialObject of partialObjectStream) {
      lastOutput = partialObject;
      s.message(c.cyan('Streaming ideas...\n') + JSON.stringify(partialObject, null, 2));
    }
    
    const duration = (Date.now() - startTime) / 1000;
    s.stop(`✅ Ideation transform streamed successfully in ${duration.toFixed(2)}s!`);

    console.log(c.bold.green('\n💡 Final Generated Ideas:'));
    console.log(JSON.stringify(lastOutput, null, 2));

  } catch (error) {
    s.stop(c.bold.red('❌ Ideation transform failed.'));
    if (error instanceof Error) {
        console.error(c.red('Error message:'), error.message);
        if (error.stack) {
            console.error(c.red('Stack trace:'), error.stack);
        }
    } else {
        console.error(c.red('An unknown error occurred:'), error);
    }
  }
}

testStreamingIdeation(); 