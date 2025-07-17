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
    console.log('[OutlineSettingsDisplay] Component render:', {
        hasPropsOutlineSettings: !!propsOutlineSettings,
        propsIsEditable,
        propsMode,
        outlineSettingsId: propsOutlineSettings?.id,
        outlineSettingsSchemaType: propsOutlineSettings?.schema_type,
        outlineSettingsDataLength: propsOutlineSettings?.data?.length
    });

    // If we have props from actionComputation, use them directly
    if (propsOutlineSettings) {
        const isEditable = propsIsEditable ?? false;
        const effectiveJsondoc = propsOutlineSettings;

        console.log('[OutlineSettingsDisplay] Rendering with props:', {
            effectiveJsondocId: effectiveJsondoc?.id,
            isEditable,
            hasJsondoc: !!effectiveJsondoc
        });

        console.log('[OutlineSettingsDisplay] Jsondoc data structure:', {
            jsondocId: effectiveJsondoc?.id,
            schemaType: effectiveJsondoc?.schema_type,
            dataType: typeof effectiveJsondoc?.data,
            dataString: effectiveJsondoc?.data ? effectiveJsondoc.data.substring(0, 200) + '...' : 'null',
            createdAt: effectiveJsondoc?.created_at,
            projectId: effectiveJsondoc?.project_id
        });

        console.log('[OutlineSettingsDisplay] About to render SectionWrapper with JsondocDisplayWrapper');

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

    // Fallback: No props provided - show loading or empty state
    console.log('[OutlineSettingsDisplay] Rendering fallback mode - no props provided');

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