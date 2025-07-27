#!/usr/bin/env node

import { ProjectRepository } from '../transform-jsondoc-framework/ProjectRepository';
import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';
import { db } from '../database/connection';

async function checkJsondoc() {
    const projectRepo = new ProjectRepository(db);
    const jsondocRepo = new TransformJsondocRepository(db);

    const jsondocId = '88fd2ddf-22e7-4c61-882c-dd334d867fad';

    try {
        // Check if jsondoc exists
        console.log(`🔍 Checking jsondoc ${jsondocId}...`);
        const jsondocs = await jsondocRepo.getJsondocsByIds([jsondocId]);
        const jsondoc = jsondocs[0];

        if (!jsondoc) {
            console.log('❌ Jsondoc not found');
            return;
        }

        console.log('✅ Jsondoc found:', {
            id: jsondoc.id,
            project_id: jsondoc.project_id,
            schema_version: jsondoc.schema_version,
            schema_type: jsondoc.schema_type,
            data: jsondoc.data
        });

        // Check if this project exists
        console.log(`🔍 Checking project ${jsondoc.project_id}...`);
        const project = await projectRepo.getProject(jsondoc.project_id);

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
        const hasAccess = await jsondocRepo.userHasJsondocAccess('test-user-1', jsondocId);
        console.log(`Access result: ${hasAccess}`);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

checkJsondoc().catch(console.error); 