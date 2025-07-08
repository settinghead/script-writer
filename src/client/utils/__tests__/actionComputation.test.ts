import { describe, it, expect } from 'vitest';
import {
    isLeafNode,
    canBecomeEditable
} from '../actionComputation';

describe('actionComputation', () => {
    describe('isLeafNode', () => {
        it('should return true for artifact with no descendants', () => {
            const transformInputs = [
                { artifact_id: 'other-artifact', transform_id: 'transform-1' }
            ];
            expect(isLeafNode('test-artifact', transformInputs)).toBe(true);
        });

        it('should return false for artifact with descendants', () => {
            const transformInputs = [
                { artifact_id: 'test-artifact', transform_id: 'transform-1' }
            ];
            expect(isLeafNode('test-artifact', transformInputs)).toBe(false);
        });

        it('should return true for empty transform inputs', () => {
            expect(isLeafNode('test-artifact', [])).toBe(true);
        });
    });

    describe('canBecomeEditable', () => {
        it('should return true for AI-generated leaf node', () => {
            const artifact = { id: 'test', origin_type: 'ai_generated' };
            const transformInputs: any[] = [];
            expect(canBecomeEditable(artifact, transformInputs)).toBe(true);
        });

        it('should return false for user input artifact', () => {
            const artifact = { id: 'test', origin_type: 'user_input' };
            const transformInputs: any[] = [];
            expect(canBecomeEditable(artifact, transformInputs)).toBe(false);
        });

        it('should return false for artifact with descendants', () => {
            const artifact = { id: 'test', origin_type: 'ai_generated' };
            const transformInputs = [{ artifact_id: 'test', transform_id: 'transform-1' }];
            expect(canBecomeEditable(artifact, transformInputs)).toBe(false);
        });
    });


}); 