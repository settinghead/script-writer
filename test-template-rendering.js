const { TemplateService } = require('./dist-server/server/services/templates/TemplateService.js');

const templateService = new TemplateService();

async function testTemplateRendering() {
  try {
    console.log('Testing outline template rendering...');
    
    const outlineTemplate = templateService.getTemplate('outline');
    if (!outlineTemplate) {
      console.error('Outline template not found!');
      return;
    }
    
    console.log('Outline template found, variables:', outlineTemplate.variables);
    
    // Test with minimal context
    const testContext = {
      artifacts: {
        brainstorm_params: {
          platform: 'test',
          genre: 'test',
          requirements: 'test'
        }
      },
      params: {
        totalEpisodes: 10,
        episodeDuration: 3
      }
    };
    
    const rendered = await templateService.renderTemplate(outlineTemplate, testContext);
    console.log('Template rendered successfully! Length:', rendered.length);
    console.log('First 500 chars:', rendered.substring(0, 500));
    
  } catch (error) {
    console.error('Template rendering failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testTemplateRendering(); 