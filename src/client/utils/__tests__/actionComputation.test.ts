import { describe, it, expect } from 'vitest';
import {
    isLeafNode,
    canBecomeEditable
} from '../actionComputation';
import { TypedJsonDoc } from '../../../common/types';



describe('actionComputation', () => {
    describe('isLeafNode', () => {
        it('should return true for jsonDoc with no descendants', () => {
            const transformInputs = [
                { jsonDoc_id: 'other-jsonDoc', transform_id: 'transform-1' }
            ];
            expect(isLeafNode('test-jsonDoc', transformInputs)).toBe(true);
        });

        it('should return false for jsonDoc with descendants', () => {
            const transformInputs = [
                { jsonDoc_id: 'test-jsonDoc', transform_id: 'transform-1' }
            ];
            expect(isLeafNode('test-jsonDoc', transformInputs)).toBe(false);
        });

        it('should return true for empty transform inputs', () => {
            expect(isLeafNode('test-jsonDoc', [])).toBe(true);
        });
    });

    describe('canBecomeEditable', () => {
        it('should return true for AI-generated leaf node', () => {
            const jsonDoc = { id: 'test', origin_type: 'ai_generated' } as TypedJsonDoc;
            const transformInputs: any[] = [];
            expect(canBecomeEditable(jsonDoc, transformInputs)).toBe(true);
        });

        it('should return false for user input jsonDoc', () => {
            const jsonDoc = { id: 'test', origin_type: 'user_input' } as TypedJsonDoc;
            const transformInputs: any[] = [];
            expect(canBecomeEditable(jsonDoc, transformInputs)).toBe(false);
        });

        it('should return false for jsonDoc with descendants', () => {
            const jsonDoc = { id: 'test', origin_type: 'ai_generated' } as TypedJsonDoc;
            const transformInputs = [{ jsonDoc_id: 'test', transform_id: 'transform-1' }];
            expect(canBecomeEditable(jsonDoc, transformInputs)).toBe(false);
        });
    });
}); 