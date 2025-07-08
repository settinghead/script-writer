import React from 'react';
import { BaseActionProps } from './index';

const ChroniclesGenerationAction: React.FC<BaseActionProps> = ({ projectId, onSuccess, onError }) => {
    return (
        <div>
            <p>Chronicles Generation Action Placeholder - Project: {projectId}</p>
        </div>
    );
};

export default ChroniclesGenerationAction; 