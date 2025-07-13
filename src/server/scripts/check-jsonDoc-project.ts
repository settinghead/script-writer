#!/usr/bin/env node

import { ProjectRepository } from '../transform-jsonDoc-framework/ProjectRepository';
import { JsonDocRepository } from '../transform-jsonDoc-framework/JsonDocRepository';
import { db } from '../database/connection';

async function checkJsonDoc() {
    const projectRepo = new ProjectRepository(db);
    const jsonDocRepo = new JsonDocRepository(db);

    const jsonDocId = '88fd2ddf-22e7-4c61-882c-dd334d867fad';

    try {
        // Check if jsonDoc exists
        console.log(`🔍 Checking jsonDoc ${jsonDocId}...`);
        const jsonDocs = await jsonDocRepo.getJsonDocsByIds([jsonDocId]);
        const jsonDoc = jsonDocs[0];

        if (!jsonDoc) {
            console.log('❌ JsonDoc not found');
            return;
        }

        console.log('✅ JsonDoc found:', {
            id: jsonDoc.id,
            project_id: jsonDoc.project_id,
            schema_version: jsonDoc.schema_version,
            schema_type: jsonDoc.schema_type,
            data: jsonDoc.data
        });

        // Check if this project exists
        console.log(`🔍 Checking project ${jsonDoc.project_id}...`);
        const project = await projectRepo.getProject(jsonDoc.project_id);

        if (!project) {
            console.log('❌ Project not found');
            return;
        }

        console.log('✅ Project found:', {
            id: project.id,
            name: project.name,
            description: project.description
        });

        // Check if test-user-1 has access to this project
        console.log(`🔍 Checking if test-user-1 has access to project...`);
        const hasAccess = await jsonDocRepo.userHasJsonDocAccess('test-user-1', jsonDocId);
        console.log(`Access result: ${hasAccess}`);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

checkJsonDoc().catch(console.error); 