#!/usr/bin/env node

import { db } from './src/server/database/connection';
import { ProjectService } from './src/server/services/ProjectService';

async function main() {
    try {
        const projectService = new ProjectService(db);
        const projects = await projectService.listUserProjects('test-user-1');
        console.log('Projects for test-user-1:', JSON.stringify(projects, null, 2));

        if (projects.length > 0) {
            console.log('\nFirst project ID:', projects[0].id);
        }
    } catch (error) {
        console.error('Error:', error);
    }

    process.exit(0);
}

main(); 