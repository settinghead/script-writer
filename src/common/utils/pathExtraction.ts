/**
 * Path extraction utilities for artifact derivation
 * Handles JSON paths like "ideas[0].title" or "[1].body"
 */

export function extractDataAtPath(data: any, path: string): any {
  if (!path) return data;

  // Handle array indices: [0].title -> 0.title, ideas[0].title -> ideas.0.title
  const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');

  return normalizedPath.split('.').filter(key => key !== '').reduce((obj, key) => {
    return obj?.[key];
  }, data);
}

export function setDataAtPath(data: any, path: string, value: any): any {
  if (!path) return value;

  const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
  const keys = normalizedPath.split('.').filter(key => key !== '');
  const result = JSON.parse(JSON.stringify(data)); // Deep clone

  let current = result;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current)) {
      // Create array if key is numeric, object otherwise
      current[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
  return result;
}

export function validatePath(data: any, path: string): boolean {
  try {
    const value = extractDataAtPath(data, path);
    return value !== undefined;
  } catch {
    return false;
  }
}

export function getPathDescription(path: string): string {
  if (!path) return '根节点';

  // Convert paths like "[0].title" to "想法 1 标题"
  const match = path.match(/\[(\d+)\]\.?(.+)?/);
  if (match) {
    const index = parseInt(match[1]) + 1;
    const field = match[2];
    if (field === 'title') return `想法 ${index} 标题`;
    if (field === 'body') return `想法 ${index} 内容`;
    return `想法 ${index} ${field || ''}`.trim();
  }

  return path;
} 