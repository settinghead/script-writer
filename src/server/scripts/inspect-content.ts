import { db } from '../database/connection';

type ContentType = 'jsondoc' | 'particle';

async function inspectContent(projectId: string, contentType: ContentType, ids: string[]) {
    console.log(`\n=== Inspecting ${contentType}s for project ${projectId} ===\n`);

    if (contentType === 'jsondoc') {
        for (const id of ids) {
            try {
                const jsondoc = await db
                    .selectFrom('jsondocs')
                    .selectAll()
                    .where('id', '=', id)
                    .where('project_id', '=', projectId)
                    .executeTakeFirst();

                if (!jsondoc) {
                    console.log(`❌ Jsondoc ${id} not found in project ${projectId}`);
                    continue;
                }

                console.log(`📄 Jsondoc ID: ${id}`);
                console.log(`   Schema Type: ${jsondoc.schema_type}`);
                console.log(`   Schema Version: ${jsondoc.schema_version}`);
                console.log(`   Origin Type: ${jsondoc.origin_type}`);
                console.log(`   Created: ${jsondoc.created_at}`);
                console.log(`   Updated: ${jsondoc.updated_at}`);
                console.log(`   Streaming Status: ${jsondoc.streaming_status || 'N/A'}`);
                console.log(`   Metadata: ${jsondoc.metadata || 'None'}`);
                console.log(`   Content:`);

                try {
                    const parsedData = JSON.parse(jsondoc.data);
                    console.log(JSON.stringify(parsedData, null, 2));
                } catch (e) {
                    console.log(`   Raw data: ${jsondoc.data}`);
                }

                console.log('\n' + '─'.repeat(80) + '\n');
            } catch (error) {
                console.error(`❌ Error fetching jsondoc ${id}:`, error);
            }
        }
    } else if (contentType === 'particle') {
        for (const id of ids) {
            try {
                const particle = await db
                    .selectFrom('particles')
                    .selectAll()
                    .where('id', '=', id)
                    .where('project_id', '=', projectId)
                    .executeTakeFirst();

                if (!particle) {
                    console.log(`❌ Particle ${id} not found in project ${projectId}`);
                    continue;
                }

                console.log(`🔬 Particle ID: ${id}`);
                console.log(`   Jsondoc ID: ${particle.jsondoc_id}`);
                console.log(`   Path: ${particle.path}`);
                console.log(`   Type: ${particle.type}`);
                console.log(`   Title: ${particle.title}`);
                console.log(`   Active: ${particle.is_active}`);
                console.log(`   Created: ${particle.created_at}`);
                console.log(`   Updated: ${particle.updated_at}`);
                console.log(`   Content Text: ${particle.content_text}`);
                console.log(`   Content (JSON):`);

                try {
                    if (typeof particle.content === 'string') {
                        const parsedContent = JSON.parse(particle.content);
                        console.log(JSON.stringify(parsedContent, null, 2));
                    } else {
                        console.log(JSON.stringify(particle.content, null, 2));
                    }
                } catch (e) {
                    console.log(`   Raw content: ${particle.content}`);
                }

                console.log('\n' + '─'.repeat(80) + '\n');
            } catch (error) {
                console.error(`❌ Error fetching particle ${id}:`, error);
            }
        }
    }

    process.exit(0);
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 3) {
    console.error('Usage: ./run-ts src/server/scripts/inspect-content.ts <project_id> <type> <comma_separated_ids>');
    console.error('  type: jsondoc | particle');
    console.error('  Example: ./run-ts src/server/scripts/inspect-content.ts proj123 jsondoc doc1,doc2,doc3');
    console.error('  Example: ./run-ts src/server/scripts/inspect-content.ts proj123 particle part1,part2');
    process.exit(1);
}

const [projectId, contentType, idsString] = args;

if (contentType !== 'jsondoc' && contentType !== 'particle') {
    console.error('Error: type must be either "jsondoc" or "particle"');
    process.exit(1);
}

const ids = idsString.split(',').map(id => id.trim()).filter(id => id.length > 0);

if (ids.length === 0) {
    console.error('Error: No valid IDs provided');
    process.exit(1);
}

inspectContent(projectId, contentType as ContentType, ids); 