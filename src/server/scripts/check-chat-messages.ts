import { db } from '../database/connection';

async function checkChatMessages() {
    try {
        console.log('🔍 Checking chat messages in database...');

        const displayMessages = await db
            .selectFrom('chat_messages_display')
            .selectAll()
            .orderBy('created_at', 'desc')
            .limit(10)
            .execute();

        console.log(`📋 Found ${displayMessages.length} display messages:`);
        for (const msg of displayMessages) {
            console.log(`  - ${msg.role}: ${msg.content.substring(0, 80)}...`);
            console.log(`    Project: ${msg.project_id}, Status: ${msg.status}, Type: ${msg.display_type}`);
        }

        const rawMessages = await db
            .selectFrom('chat_messages_raw')
            .selectAll()
            .orderBy('created_at', 'desc')
            .limit(10)
            .execute();

        console.log(`📋 Found ${rawMessages.length} raw messages:`);
        for (const msg of rawMessages) {
            console.log(`  - ${msg.role}: ${msg.content.substring(0, 80)}...`);
            console.log(`    Project: ${msg.project_id}`);
        }

    } catch (error) {
        console.error('❌ Error checking chat messages:', error);
    }
}

checkChatMessages().then(() => process.exit(0)); 