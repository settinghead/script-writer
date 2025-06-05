import { FieldUpdate, FieldDefinition, PathMatch } from './types';

export class StreamingFieldDetector {
  private discoveredPaths: Set<string> = new Set();
  private pathData: Map<string, any> = new Map();
  
  processChunk(partialJson: any): FieldUpdate[] {
    const updates: FieldUpdate[] = [];
    const paths = this.extractJsonPaths(partialJson);
    
    for (const [path, value] of paths) {
      const currentValue = this.pathData.get(path);
      
      if (!this.discoveredPaths.has(path)) {
        // New field discovered!
        this.discoveredPaths.add(path);
        updates.push({ type: 'new-field', path, value });
      } else if (!this.deepEqual(currentValue, value)) {
        // Existing field updated
        updates.push({ type: 'update-field', path, value });
      }
      this.pathData.set(path, value);
    }
    
    return updates;
  }
  
  /**
   * Extract all JSON paths from an object
   */
  private extractJsonPaths(obj: any, prefix = ''): Array<[string, any]> {
    const paths: Array<[string, any]> = [];
    
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const itemPath = `${prefix}[${index}]`;
        paths.push([itemPath, item]);
        if (typeof item === 'object' && item !== null) {
          paths.push(...this.extractJsonPaths(item, itemPath));
        }
      });
    } else if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        paths.push([path, value]);
        if (typeof value === 'object' && value !== null) {
          paths.push(...this.extractJsonPaths(value, path));
        }
      });
    }
    
    return paths;
  }
  
  /**
   * Deep equality check for values
   */
  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;
    
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => this.deepEqual(item, b[index]));
    }
    
    if (typeof a === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      return keysA.every(key => this.deepEqual(a[key], b[key]));
    }
    
    return false;
  }
  
  /**
   * Clear all discovered paths (useful for new sessions)
   */
  reset(): void {
    this.discoveredPaths.clear();
    this.pathData.clear();
  }
  
  /**
   * Get all discovered paths
   */
  getDiscoveredPaths(): string[] {
    return Array.from(this.discoveredPaths);
  }
  
  /**
   * Get current value for a path
   */
  getValue(path: string): any {
    return this.pathData.get(path);
  }
}

/**
 * Path matching utilities
 */
export class PathMatcher {
  /**
   * Find field definition that matches a given data path
   */
  static findMatchingDefinition(dataPath: string, registry: FieldDefinition[]): PathMatch | null {
    for (const definition of registry) {
      const match = this.matchPath(dataPath, definition.path);
      if (match) {
        return {
          definition,
          actualPath: dataPath,
          wildcardValues: match
        };
      }
    }
    return null;
  }
  
  /**
   * Check if a data path matches a registry path pattern
   * Returns wildcard values if it matches, null otherwise
   */
  static matchPath(dataPath: string, registryPath: string): { [key: string]: string | number } | null {
    // Convert registry path to regex and extract wildcards
    const wildcards: { [key: string]: string | number } = {};
    
    // Handle simple exact matches first
    if (registryPath === dataPath) {
      return wildcards;
    }
    
    // Convert registry path to regex pattern
    let regexPattern = registryPath
      .replace(/\./g, '\\.')  // Escape dots
      .replace(/\[/g, '\\[')  // Escape opening brackets
      .replace(/\]/g, '\\]'); // Escape closing brackets
    
    // Replace wildcards with capture groups
    let wildcardIndex = 0;
    regexPattern = regexPattern.replace(/\\\[\*\\\]/g, () => {
      const key = `array_${wildcardIndex++}`;
      return `\\[(\\d+)\\]`;
    });
    
    // 🔍 DEBUG: Log path matching attempts for synopsis_stages
    if (dataPath.includes('synopsis_stages') || registryPath.includes('synopsis_stages')) {
      console.log(`🔍 [PathMatcher] Attempting to match dataPath: "${dataPath}" with registryPath: "${registryPath}"`);
      console.log(`🔍 [PathMatcher] Generated regex pattern: "${regexPattern}"`);
    }
    
    const regex = new RegExp(`^${regexPattern}$`);
    const match = dataPath.match(regex);
    
    if (match) {
      // Extract wildcard values
      for (let i = 1; i < match.length; i++) {
        const key = `array_${i - 1}`;
        wildcards[key] = parseInt(match[i], 10);
      }
      
      if (dataPath.includes('synopsis_stages') || registryPath.includes('synopsis_stages')) {
        console.log(`🔍 [PathMatcher] ✅ MATCH found! Wildcards:`, wildcards);
      }
      
      return wildcards;
    }
    
    if (dataPath.includes('synopsis_stages') || registryPath.includes('synopsis_stages')) {
      console.log(`🔍 [PathMatcher] ❌ No match found`);
    }
    
    return null;
  }
  
  /**
   * Generate a unique field ID from path and wildcards
   */
  static generateFieldId(path: string, definition: FieldDefinition, value?: any): string {
    if (definition.extractKey && value) {
      try {
        const customKey = definition.extractKey(value);
        return `${definition.path}-${customKey}`;
      } catch (e) {
        console.warn('Failed to extract custom key, falling back to path');
      }
    }
    
    // Use path with array indices as unique ID
    return path.replace(/\[/g, '_').replace(/\]/g, '_').replace(/\./g, '_');
  }
} 