import { BaseEditor } from 'slate';
import { ReactEditor } from 'slate-react';
import { HistoryEditor } from 'slate-history';

export type CustomEditor = BaseEditor & ReactEditor & HistoryEditor;

export type ParagraphElement = {
    type: 'paragraph';
    children: CustomText[];
};

export type SceneHeadingElement = {
    type: 'scene-heading';
    children: CustomText[];
};

export type CharacterElement = {
    type: 'character';
    children: CustomText[];
};

export type DialogueElement = {
    type: 'dialogue';
    children: CustomText[];
};

export type CustomElement =
    | ParagraphElement
    | SceneHeadingElement
    | CharacterElement
    | DialogueElement;

export type FormattedText = {
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
};

export type CustomText = FormattedText;

declare module 'slate' {
    interface CustomTypes {
        Editor: CustomEditor;
        Element: CustomElement;
        Text: CustomText;
    }
} 