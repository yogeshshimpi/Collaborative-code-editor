import {
  Globe,
  Atom,
  FileCode2,
  Terminal,
  Coffee,
  Cpu,
  FolderPlus
} from 'lucide-react';

export const PROJECT_TYPES = [
  {
    id: 'html',
    name: 'HTML / CSS / JavaScript',
    shortName: 'HTML / CSS',
    badgeText: 'HTML / CSS / JS',
    description: 'Full frontend web stack with real-time browser Live Preview.',
    starterSummary: 'index.html, styles.css, main.js',
    starterFiles: ['index.html', 'styles.css', 'main.js'],
    tag: 'Live Preview',
    color: '#38bdf8',
    borderColor: 'rgba(56, 189, 248, 0.35)',
    bgTint: 'rgba(56, 189, 248, 0.12)',
    Icon: Globe
  },
  {
    id: 'react',
    name: 'React + Vite',
    shortName: 'React',
    badgeText: 'React + Vite',
    description: 'Modern component-based UI application with React Router and Vite.',
    starterSummary: 'package.json, index.html, src/App.jsx, src/main.jsx, src/index.css',
    starterFiles: ['package.json', 'index.html', 'src/main.jsx', 'src/App.jsx', 'src/index.css'],
    tag: 'Frontend',
    color: '#06b6d4',
    borderColor: 'rgba(6, 182, 212, 0.35)',
    bgTint: 'rgba(6, 182, 212, 0.12)',
    Icon: Atom
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    shortName: 'JavaScript',
    badgeText: 'JavaScript',
    description: 'Pure JavaScript script with interactive console and output view.',
    starterSummary: 'main.js',
    starterFiles: ['main.js'],
    tag: 'Console',
    color: '#eab308',
    borderColor: 'rgba(234, 179, 8, 0.35)',
    bgTint: 'rgba(234, 179, 8, 0.12)',
    Icon: FileCode2
  },
  {
    id: 'python',
    name: 'Python',
    shortName: 'Python',
    badgeText: 'Python',
    description: 'Clean Python workspace for algorithms, scripts, and automation.',
    starterSummary: 'main.py',
    starterFiles: ['main.py'],
    tag: 'Safe Runner',
    color: '#3b82f6',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    bgTint: 'rgba(59, 130, 246, 0.12)',
    Icon: Terminal
  },
  {
    id: 'java',
    name: 'Java',
    shortName: 'Java',
    badgeText: 'Java',
    description: 'Object-oriented Java application with standard Main class.',
    starterSummary: 'Main.java',
    starterFiles: ['Main.java'],
    tag: 'Workspace',
    color: '#f97316',
    borderColor: 'rgba(249, 115, 22, 0.35)',
    bgTint: 'rgba(249, 115, 22, 0.12)',
    Icon: Coffee
  },
  {
    id: 'cpp',
    name: 'C++',
    shortName: 'C++',
    badgeText: 'C++',
    description: 'High-performance C++ program with standard library integration.',
    starterSummary: 'main.cpp',
    starterFiles: ['main.cpp'],
    tag: 'Workspace',
    color: '#a855f7',
    borderColor: 'rgba(168, 85, 247, 0.35)',
    bgTint: 'rgba(168, 85, 247, 0.12)',
    Icon: Cpu
  },
  {
    id: 'blank',
    name: 'Blank Project',
    shortName: 'Blank',
    badgeText: 'Blank Project',
    description: 'Start with an empty file workspace to build your own structure.',
    starterSummary: 'Empty file tree',
    starterFiles: [],
    tag: 'Empty',
    color: '#94a3b8',
    borderColor: 'rgba(148, 163, 184, 0.35)',
    bgTint: 'rgba(148, 163, 184, 0.12)',
    Icon: FolderPlus
  }
];

export const DEFAULT_PROJECT_TYPE = 'html';

export const PROJECT_TYPE_MAP = PROJECT_TYPES.reduce((acc, curr) => {
  acc[curr.id] = curr;
  return acc;
}, {});

/**
 * Retrieve config for a project type, with optional file inference fallback
 * to support legacy projects without explicit type metadata.
 */
export function getProjectTypeConfig(type, files = null) {
  if (type && PROJECT_TYPE_MAP[type.toLowerCase()]) {
    return PROJECT_TYPE_MAP[type.toLowerCase()];
  }

  // File-based inference for legacy or untyped projects
  if (files) {
    const fileKeys = Array.isArray(files)
      ? files
      : typeof files === 'object'
      ? Object.keys(files)
      : [];

    if (fileKeys.length === 0) {
      return PROJECT_TYPE_MAP.blank;
    }
    if (fileKeys.some((k) => k.endsWith('.py'))) {
      return PROJECT_TYPE_MAP.python;
    }
    if (fileKeys.some((k) => k.endsWith('.java'))) {
      return PROJECT_TYPE_MAP.java;
    }
    if (fileKeys.some((k) => k.endsWith('.cpp') || k.endsWith('.cc') || k.endsWith('.cxx'))) {
      return PROJECT_TYPE_MAP.cpp;
    }
    if (fileKeys.some((k) => k.includes('App.jsx') || k.includes('package.json'))) {
      return PROJECT_TYPE_MAP.react;
    }
  }

  return PROJECT_TYPE_MAP[DEFAULT_PROJECT_TYPE];
}
