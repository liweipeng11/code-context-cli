export interface CodeChunk {
  id: string;
  filePath: string;
  language: string;
  type: string;
  name?: string;
  startLine: number;
  endLine: number;
  content: string;
  keywords: string[];
  links: string[];
  score?: number;
}

export interface IndexedFile {
  filePath: string;
  hash: string;
  size: number;
  chunks: number;
}

export interface CodeIndex {
  version: string;
  createdAt: string;
  rootDir: string;
  files: IndexedFile[];
  chunks: CodeChunk[];
}
