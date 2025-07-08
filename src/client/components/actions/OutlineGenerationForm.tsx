import React from 'react';
import { BaseActionProps } from './index';

const OutlineGenerationForm: React.FC<BaseActionProps> = ({ projectId, onSuccess, onError }) => {
    return (
        <div>
            <p>Outline Generation Form Placeholder - Project: {projectId}</p>
        </div>
    );
};

export default OutlineGenerationForm; 