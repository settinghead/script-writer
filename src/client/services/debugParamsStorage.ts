interface DebugParams {
    selectedTool: string;
    selectedJsondocs: string[];
    additionalParams: string;
    lastUpdated: number;
}

interface AgentContextParams {
    userInput: string;
    intent?: string;
    lastUpdated: number;
}

interface ProjectDebugParams {
    projectId: string;
    params: DebugParams;
}

interface ProjectAgentContextParams {
    projectId: string;
    params: AgentContextParams;
}

class DebugParamsStorage {
    private dbName = 'script-writer-debug-params';
    private dbVersion = 2; // Increment version for new store
    private storeName = 'debug-params';
    private agentContextStoreName = 'agent-context-params';
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                reject(new Error('Failed to open IndexedDB'));
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Create debug params object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'projectId' });
                    store.createIndex('lastUpdated', 'params.lastUpdated', { unique: false });
                }

                // Create agent context params object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.agentContextStoreName)) {
                    const agentStore = db.createObjectStore(this.agentContextStoreName, { keyPath: 'projectId' });
                    agentStore.createIndex('lastUpdated', 'params.lastUpdated', { unique: false });
                }
            };
        });
    }

    async saveParams(projectId: string, params: Omit<DebugParams, 'lastUpdated'>): Promise<void> {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const data: ProjectDebugParams = {
                projectId,
                params: {
                    ...params,
                    lastUpdated: Date.now()
                }
            };

            const request = store.put(data);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(new Error('Failed to save debug params'));
            };
        });
    }

    async loadParams(projectId: string): Promise<DebugParams | null> {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(projectId);

            request.onsuccess = () => {
                const result = request.result as ProjectDebugParams | undefined;
                resolve(result ? result.params : null);
            };

            request.onerror = () => {
                reject(new Error('Failed to load debug params'));
            };
        });
    }

    async clearParams(projectId: string): Promise<void> {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(projectId);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(new Error('Failed to clear debug params'));
            };
        });
    }

    async getAllProjectParams(): Promise<ProjectDebugParams[]> {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result as ProjectDebugParams[]);
            };

            request.onerror = () => {
                reject(new Error('Failed to load all debug params'));
            };
        });
    }

    // Clean up old entries (older than 30 days)
    async cleanupOldParams(): Promise<void> {
        if (!this.db) {
            await this.init();
        }

        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('lastUpdated');
            const range = IDBKeyRange.upperBound(thirtyDaysAgo);
            const request = index.openCursor(range);

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };

            request.onerror = () => {
                reject(new Error('Failed to cleanup old debug params'));
            };
        });
    }

    // Agent Context Methods
    async saveAgentContextParams(projectId: string, params: Omit<AgentContextParams, 'lastUpdated'>): Promise<void> {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([this.agentContextStoreName], 'readwrite');
            const store = transaction.objectStore(this.agentContextStoreName);

            const data: ProjectAgentContextParams = {
                projectId,
                params: {
                    ...params,
                    lastUpdated: Date.now()
                }
            };

            const request = store.put(data);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(new Error('Failed to save agent context params'));
            };
        });
    }

    async loadAgentContextParams(projectId: string): Promise<AgentContextParams | null> {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([this.agentContextStoreName], 'readonly');
            const store = transaction.objectStore(this.agentContextStoreName);
            const request = store.get(projectId);

            request.onsuccess = () => {
                const result = request.result as ProjectAgentContextParams;
                resolve(result?.params || null);
            };

            request.onerror = () => {
                reject(new Error('Failed to load agent context params'));
            };
        });
    }

    async clearAgentContextParams(projectId: string): Promise<void> {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([this.agentContextStoreName], 'readwrite');
            const store = transaction.objectStore(this.agentContextStoreName);
            const request = store.delete(projectId);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(new Error('Failed to clear agent context params'));
            };
        });
    }
}

// Export singleton instance
export const debugParamsStorage = new DebugParamsStorage();

// Export types for use in components
export type { DebugParams, ProjectDebugParams, AgentContextParams }; 