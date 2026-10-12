/**
 * Normalizes a path string:
 * - Replaces backslashes with slashes
 * - Strips leading/trailing slashes
 * - Collapses consecutive slashes
 */
export function normalizePath(pathStr) {
  if (typeof pathStr !== 'string') return '';
  return pathStr
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/+/g, '/');
}

/**
 * Validates a file or folder name.
 */
export function isValidName(name) {
  if (!name || typeof name !== 'string') return false;
  const clean = name.trim();
  if (!clean || clean === '.' || clean === '..') return false;
  // eslint-disable-next-line no-control-regex
  if (/[\0*?"<>|:]/.test(clean)) return false;
  return true;
}

/**
 * Builds a hierarchical tree from a flat list of files and folders.
 *
 * @param {Array<{name: string, content?: string}>} filesList
 * @param {Array<string>} foldersList
 * @returns {Array<object>} root children sorted folders first, then files
 */
export function buildFileTree(filesList = [], foldersList = []) {
  const root = {
    id: '__root__',
    name: 'root',
    path: '',
    isFolder: true,
    children: []
  };

  const folderMap = new Map();
  folderMap.set('', root);

  // Collect all unique folder paths (both explicit and inferred from files)
  const allFolderPaths = new Set();

  for (const f of foldersList) {
    const clean = normalizePath(f);
    if (clean) allFolderPaths.add(clean);
  }

  for (const file of filesList) {
    const filePath = normalizePath(file.name);
    if (!filePath) continue;
    const segments = filePath.split('/');
    let current = '';
    for (let i = 0; i < segments.length - 1; i++) {
      current = current ? `${current}/${segments[i]}` : segments[i];
      allFolderPaths.add(current);
    }
  }

  // Ensure all ancestor folders exist and are linked in the hierarchy
  const sortedFolders = Array.from(allFolderPaths).sort((a, b) => a.split('/').length - b.split('/').length);

  for (const folderPath of sortedFolders) {
    const segments = folderPath.split('/');
    const folderName = segments[segments.length - 1];
    const parentPath = segments.slice(0, -1).join('/');

    if (!folderMap.has(folderPath)) {
      const folderNode = {
        id: folderPath,
        name: folderName,
        path: folderPath,
        isFolder: true,
        children: []
      };
      folderMap.set(folderPath, folderNode);

      const parentNode = folderMap.get(parentPath) || root;
      if (!parentNode.children.some((c) => c.path === folderPath)) {
        parentNode.children.push(folderNode);
      }
    }
  }

  // Add files into their respective parent folders
  for (const file of filesList) {
    const filePath = normalizePath(file.name);
    if (!filePath) continue;
    const segments = filePath.split('/');
    const fileName = segments[segments.length - 1];
    const parentPath = segments.slice(0, -1).join('/');

    const fileNode = {
      id: filePath,
      name: fileName,
      path: filePath,
      isFolder: false,
      extension: fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : ''
    };

    const parentNode = folderMap.get(parentPath) || root;
    if (!parentNode.children.some((c) => c.path === filePath)) {
      parentNode.children.push(fileNode);
    }
  }

  // Recursively sort nodes: folders first (alphabetical), then files (alphabetical)
  function sortNodes(node) {
    node.children.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
    for (const child of node.children) {
      if (child.isFolder) {
        sortNodes(child);
      }
    }
  }

  sortNodes(root);
  return root.children;
}
