import React from 'react';
import { BaseActionProps } from './index';

const BrainstormIdeaSelection: React.FC<BaseActionProps> = ({ projectId, onSuccess, onError }) => {
    return (
        <div>
            <p>Brainstorm Idea Selection Placeholder - Project: {projectId}</p>
        </div>
    );
};

export default BrainstormIdeaSelection; 