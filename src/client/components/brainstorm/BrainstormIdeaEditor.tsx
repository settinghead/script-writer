import React, { HTMLAttributes } from 'react';
import { Typography } from 'antd';
import { StarFilled } from '@ant-design/icons';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { getJsondocAtPath } from '../../../common/transform-jsondoc-framework/lineageResolution';
import { StyledCard, StatusBadge, Inline, Stack } from '../shared/StyledComponents';
import { AppColors } from '@/common/theme/colors';
import { DesignTokens } from '@/common/theme/designSystem';
import './BrainstormIdeaCard.css';

const { Text } = Typography;

export const BrainstormIdeaEditor: React.FC<{
    jsondocId: string;
    jsondocPath: string;
    originalCollectionId: string;
    index: number;
    isSelected: boolean;
    isChosen: boolean;
    hasEditableDescendants: boolean;
    ideaOutlines: any[];
    onIdeaClick: (collectionId: string, index: number) => void;
} & HTMLAttributes<HTMLDivElement>> = ({
    jsondocId,
    jsondocPath,
    originalCollectionId,
    index,
    isSelected,
    isChosen,
    hasEditableDescendants,
    onIdeaClick,
    ...props
}) => {
        const projectData = useProjectData();

        // Get the jsondoc data to display
        const jsondoc = projectData.getJsondocById(jsondocId);

        let ideaData: any = null;

        if (jsondoc) {
            try {
                const parsedData = JSON.parse(jsondoc.data);
                ideaData = jsondocPath === '$' ? parsedData : getJsondocAtPath(jsondoc, jsondocPath);
            } catch (error) {
                console.warn(`[BrainstormIdeaEditor] Failed to parse jsondoc data for ${jsondocId}:`, error);
            }
        }

        // Don't render anything if we don't have data
        if (!ideaData) {
            return null;
        }

        const title = ideaData.title || `创意 ${index + 1}`;
        const body = ideaData.body || '';

        // Check if this is a derived jsondoc (has been edited)
        const hasBeenEdited = jsondoc?.origin_type === 'user_input' || jsondoc?.isEditable || false;

        // Determine if this idea is clickable
        const isClickable = !isChosen && !hasEditableDescendants;

        // Determine card variant and styling based on state
        const getCardStyling = () => {
            if (isChosen) {
                return {
                    backgroundColor: AppColors.human.primary + '20',
                    border: `2px solid ${AppColors.status.success}`,
                    boxShadow: `${DesignTokens.shadows.md}, ${DesignTokens.shadows.glow.human}`,
                    opacity: 1,
                };
            }
            if (isSelected) {
                return {
                    backgroundColor: AppColors.ai.primary + '20',
                    border: `2px solid ${AppColors.ai.primary}`,
                    boxShadow: `${DesignTokens.shadows.md}, ${DesignTokens.shadows.glow.ai}`,
                    opacity: 1,
                };
            }
            return {
                backgroundColor: AppColors.background.card,
                border: `1px solid ${AppColors.border.primary}`,
                boxShadow: DesignTokens.shadows.sm,
                opacity: hasEditableDescendants ? 0.6 : 0.8,
            };
        };

        const getStatusInfo = () => {
            if (isChosen) {
                return { status: 'human' as const, text: '✏️ 正在编辑', icon: <StarFilled /> };
            }
            if (hasEditableDescendants) {
                return { status: 'processing' as const, text: '📝 已有编辑版本' };
            }
            if (hasBeenEdited) {
                return { status: 'success' as const, text: '📝 已编辑版本' };
            }
            return { status: 'ai' as const, text: 'AI生成' };
        };

        const statusInfo = getStatusInfo();
        const cardStyling = getCardStyling();

        return (
            <StyledCard
                key={`${jsondocId}-${index}`}
                onClick={() => isClickable && onIdeaClick(originalCollectionId, index)}
                {...props}
                style={{
                    ...cardStyling,
                    cursor: isClickable ? 'pointer' : 'default',
                    transition: DesignTokens.transitions.medium,
                    position: 'relative',
                    ...props.style
                }}
                className={`
                idea-card 
                ${isClickable ? 'clickable hover-lift' : ''} 
                ${isSelected ? 'selected' : ''} 
                ${isChosen ? 'chosen' : ''} 
                animate-fade-in
                ${props.className || ''}
            `}
            >
                <Stack gap="sm">
                    {/* Status indicator */}
                    <StatusBadge
                        status={statusInfo.status}
                        text={statusInfo.text}
                        icon={statusInfo.icon}
                    />

                    {/* Idea content */}
                    <Stack gap="xs">
                        <Text style={{
                            fontSize: isClickable ? DesignTokens.typography.fontSize.sm : DesignTokens.typography.fontSize.xs,
                            color: isClickable ? AppColors.text.primary : AppColors.text.secondary,
                            fontWeight: DesignTokens.typography.fontWeight.semibold,
                            opacity: isChosen ? 0.8 : 1,
                            lineHeight: DesignTokens.typography.lineHeight.tight,
                        }}>
                            {title}
                        </Text>

                        <Text style={{
                            fontSize: isClickable ? DesignTokens.typography.fontSize.sm : DesignTokens.typography.fontSize.xs,
                            color: isClickable ? AppColors.text.secondary : AppColors.text.muted,
                            lineHeight: DesignTokens.typography.lineHeight.normal,
                            opacity: isChosen ? 0.7 : 1,
                        }}>
                            {body.length > 150 ? `${body.substring(0, 150)}...` : body}
                        </Text>
                    </Stack>

                    {/* Status Footer */}
                    {!isChosen && !hasEditableDescendants && (
                        <div className="flex-center py-xs" style={{
                            borderTop: `1px solid ${AppColors.border.primary}`,
                            marginTop: DesignTokens.spacing.xs,
                        }}>
                            <Text style={{
                                fontSize: DesignTokens.typography.fontSize.xs,
                                color: AppColors.text.muted,
                                fontStyle: 'italic',
                            }}>
                                点击选择
                            </Text>
                        </div>
                    )}

                    {isChosen && (
                        <div className="flex-center py-xs" style={{
                            borderTop: `1px solid ${AppColors.status.success}`,
                            marginTop: DesignTokens.spacing.xs,
                        }}>
                            <Text style={{
                                fontSize: DesignTokens.typography.fontSize.xs,
                                color: AppColors.status.success,
                                fontWeight: DesignTokens.typography.fontWeight.semibold,
                            }}>
                                已选中进行编辑
                            </Text>
                        </div>
                    )}

                    {hasEditableDescendants && !isChosen && (
                        <div className="flex-center py-xs" style={{
                            borderTop: `1px solid ${AppColors.status.processing}`,
                            marginTop: DesignTokens.spacing.xs,
                        }}>
                            <Text style={{
                                fontSize: DesignTokens.typography.fontSize.xs,
                                color: AppColors.status.processing,
                                fontWeight: DesignTokens.typography.fontWeight.semibold,
                            }}>
                                已选其他创意，仅供参考
                            </Text>
                        </div>
                    )}
                </Stack>
            </StyledCard>
        );
    };
