import React from 'react';
import { useParams } from 'react-router-dom';
import ProjectStreamingDisplay from './ProjectStreamingDisplay';

const ProjectStreamingDisplayWrapper: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    
    if (!projectId) {
        return <div>Project ID is required</div>;
    }
    
    return <ProjectStreamingDisplay projectId={projectId} />;
};

export default ProjectStreamingDisplayWrapper; 