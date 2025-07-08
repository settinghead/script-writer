import React from 'react';
import { BaseActionProps } from './index';

const EpisodeGenerationAction: React.FC<BaseActionProps> = ({ projectId, onSuccess, onError }) => {
    return (
        <div>
            <p>Episode Generation Action Placeholder - Project: {projectId}</p>
        </div>
    );
};

export default EpisodeGenerationAction; 