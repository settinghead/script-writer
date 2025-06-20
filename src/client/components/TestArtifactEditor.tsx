import React from 'react';
import { ArtifactEditor } from './shared/ArtifactEditor';

export const TestArtifactEditor: React.FC = () => {
    // Use the artifact ID from our test script
    const testArtifactId = '4e2f468f-4f6e-448d-93f7-646ed4185ec4';

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">🧪 Artifact Editor Test</h1>

                <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">Test Artifact</h2>
                    <p className="text-gray-400 text-sm mb-1">ID: {testArtifactId}</p>
                    <p className="text-gray-400 text-sm mb-4">Type: brainstorm_idea</p>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg">
                    <h3 className="text-lg font-medium mb-4">Editable Artifact:</h3>
                    <ArtifactEditor
                        artifactId={testArtifactId}
                        onTransition={(newArtifactId) => {
                            console.log('Artifact transitioned to:', newArtifactId);
                            alert(`Artifact transformed! New ID: ${newArtifactId}`);
                        }}
                    />
                </div>

                <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-300 mb-2">Instructions:</h4>
                    <ul className="text-sm text-blue-200 space-y-1">
                        <li>• Try editing the title or description above</li>
                        <li>• Blue border = AI-generated content</li>
                        <li>• Green border + glow = User-modified content</li>
                        <li>• Changes auto-save after 500ms</li>
                        <li>• LLM→Human transforms create new artifacts</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}; 