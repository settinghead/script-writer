import React from 'react';
import { SectionWrapper, JsonDocDisplayWrapper, EditableOutlineForm } from './shared';

interface OutlineSettingsDisplayProps {
    outlineSettings?: any; // The jsonDoc to display
    isEditable?: boolean; // Whether the jsonDoc is editable
    mode?: 'editable' | 'readonly'; // Display mode
}

export const OutlineSettingsDisplay: React.FC<OutlineSettingsDisplayProps> = ({
    outlineSettings: propsOutlineSettings,
    isEditable: propsIsEditable,
    mode: propsMode
}) => {
    // If we have props from actionComputation, use them directly
    if (propsOutlineSettings) {
        const isEditable = propsIsEditable ?? false;
        const effectiveJsonDoc = propsOutlineSettings;

        return (
            <SectionWrapper
                schemaType={"outline_settings"}
                title="剧本框架"
                sectionId="outline-settings"
                jsonDocId={effectiveJsonDoc?.id}
            >
                <div style={{ marginTop: '24px', position: 'relative' }}>
                    <JsonDocDisplayWrapper
                        jsonDoc={effectiveJsonDoc}
                        isEditable={isEditable}
                        title="剧本框架"
                        icon="📖"
                        editableComponent={EditableOutlineForm}
                        schemaType="outline_settings"
                        enableClickToEdit={true}
                    />
                </div>
            </SectionWrapper>
        );
    }

    // Fallback: No props provided - show loading or empty state
    return (
        <SectionWrapper
            schemaType={"outline_settings"}
            title="剧本框架"
            sectionId="outline-settings"
            jsonDocId={undefined}
        >
            <div style={{ marginTop: '24px', position: 'relative' }}>
                <JsonDocDisplayWrapper
                    jsonDoc={undefined}
                    isEditable={false}
                    title="剧本框架"
                    icon="📖"
                    editableComponent={EditableOutlineForm}
                    schemaType="outline_settings"
                    enableClickToEdit={false}
                />
            </div>
        </SectionWrapper>
    );
}; 