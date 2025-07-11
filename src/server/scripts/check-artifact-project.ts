#!/usr/bin/env node

import { ProjectRepository } from '../transform-artifact-framework/ProjectRepository';
import { ArtifactRepository } from '../transform-artifact-framework/ArtifactRepository';
import { db } from '../database/connection';

async function checkArtifact() {
    const projectRepo = new ProjectRepository(db);
    const artifactRepo = new ArtifactRepository(db);

    const artifactId = '88fd2ddf-22e7-4c61-882c-dd334d867fad';

    try {
        // Check if artifact exists
        console.log(`🔍 Checking artifact ${artifactId}...`);
        const artifacts = await artifactRepo.getArtifactsByIds([artifactId]);
        const artifact = artifacts[0];

        if (!artifact) {
            console.log('❌ Artifact not found');
            return;
        }

        console.log('✅ Artifact found:', {
            id: artifact.id,
            project_id: artifact.project_id,
            schema_version: artifact.schema_version,
            schema_type: artifact.schema_type,
            data: artifact.data
        });

        // Check if this project exists
        console.log(`🔍 Checking project ${artifact.project_id}...`);
        const project = await projectRepo.getProject(artifact.project_id);

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
        const hasAccess = await artifactRepo.userHasArtifactAccess('test-user-1', artifactId);
        console.log(`Access result: ${hasAccess}`);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

checkArtifact().catch(console.error); 