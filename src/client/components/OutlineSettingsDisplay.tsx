import React from 'react';
import { SectionWrapper, JsondocDisplayWrapper, EditableOutlineForm } from './shared';

interface OutlineSettingsDisplayProps {
    outlineSettings?: any; // The jsondoc to display
    isEditable?: boolean; // Whether the jsondoc is editable
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
        const effectiveJsondoc = propsOutlineSettings;


        return (
            <SectionWrapper
                schemaType={"outline_settings"}
                title="剧本框架"
                sectionId="outline-settings"
                jsondocId={effectiveJsondoc?.id}
            >
                <div style={{ marginTop: '24px', position: 'relative' }}>
                    <JsondocDisplayWrapper
                        jsondoc={effectiveJsondoc}
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

    return (
        <SectionWrapper
            schemaType={"outline_settings"}
            title="剧本框架"
            sectionId="outline-settings"
            jsondocId={undefined}
        >
            <div style={{ marginTop: '24px', position: 'relative' }}>
                <JsondocDisplayWrapper
                    jsondoc={undefined}
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