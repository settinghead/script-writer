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
                schemaType={"剧本设定"}
                title="剧本设定"
                sectionId="剧本设定"
                jsondocId={effectiveJsondoc?.id}
            >
                <div style={{ marginTop: '24px', position: 'relative' }}>
                    <JsondocDisplayWrapper
                        jsondoc={effectiveJsondoc}
                        isEditable={isEditable}
                        title="剧本设定"
                        icon="📖"
                        editableComponent={EditableOutlineForm}
                        schemaType="剧本设定"
                        enableClickToEdit={true}
                    />
                </div>
            </SectionWrapper>
        );
    }

    return (
        <SectionWrapper
            schemaType={"剧本设定"}
            title="剧本设定"
            sectionId="剧本设定"
            jsondocId={undefined}
        >
            <div style={{ marginTop: '24px', position: 'relative' }}>
                <JsondocDisplayWrapper
                    jsondoc={undefined}
                    isEditable={false}
                    title="剧本设定"
                    icon="📖"
                    editableComponent={EditableOutlineForm}
                    schemaType="剧本设定"
                    enableClickToEdit={false}
                />
            </div>
        </SectionWrapper>
    );
}; 