import { describe, it, expect } from 'vitest';
import {
    isLeafNode,
    canBecomeEditable
} from '../actionComputation';
import { TypedJsondoc } from '../../../common/types';



describe('actionComputation', () => {
    describe('isLeafNode', () => {
        it('should return true for jsondoc with no descendants', () => {
            const transformInputs = [
                { jsondoc_id: 'other-jsondoc', transform_id: 'transform-1' }
            ];
            expect(isLeafNode('test-jsondoc', transformInputs)).toBe(true);
        });

        it('should return false for jsondoc with descendants', () => {
            const transformInputs = [
                { jsondoc_id: 'test-jsondoc', transform_id: 'transform-1' }
            ];
            expect(isLeafNode('test-jsondoc', transformInputs)).toBe(false);
        });

        it('should return true for empty transform inputs', () => {
            expect(isLeafNode('test-jsondoc', [])).toBe(true);
        });
    });

    describe('canBecomeEditable', () => {
        it('should return true for AI-generated leaf node', () => {
            const jsondoc = { id: 'test', origin_type: 'ai_generated' } as TypedJsondoc;
            const transformInputs: any[] = [];
            expect(canBecomeEditable(jsondoc, transformInputs)).toBe(true);
        });

        it('should return false for user input jsondoc', () => {
            const jsondoc = { id: 'test', origin_type: 'user_input' } as TypedJsondoc;
            const transformInputs: any[] = [];
            expect(canBecomeEditable(jsondoc, transformInputs)).toBe(false);
        });

        it('should return false for jsondoc with descendants', () => {
            const jsondoc = { id: 'test', origin_type: 'ai_generated' } as TypedJsondoc;
            const transformInputs = [{ jsondoc_id: 'test', transform_id: 'transform-1' }];
            expect(canBecomeEditable(jsondoc, transformInputs)).toBe(false);
        });
    });
}); 