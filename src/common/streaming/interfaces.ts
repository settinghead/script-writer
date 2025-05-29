export interface JSONStreamable<T> {
    validate(item: any): item is T;
    parsePartial(content: string): T[];
    cleanContent(content: string): string;
} 