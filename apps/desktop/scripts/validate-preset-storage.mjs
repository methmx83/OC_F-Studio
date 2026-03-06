import fs from 'node:fs/promises';
import path from 'node:path';

const workflowStudioPath = path.resolve(process.cwd(), 'src/renderer/src/features/workflows/WorkflowStudioView.tsx');

const source = await fs.readFile(workflowStudioPath, 'utf-8');

const forbiddenPatterns = [
  /localStorage/i,
  /sessionStorage\s*\.\s*getItem\([^)]*preset/i,
  /sessionStorage\s*\.\s*setItem\([^)]*preset/i,
];

const violations = forbiddenPatterns.filter((pattern) => pattern.test(source));

if (violations.length > 0) {
  console.error('[validate-preset-storage] FAILED: Workflow presets must not use browser storage in renderer.');
  process.exit(1);
}

console.log('[validate-preset-storage] OK: No renderer browser-storage usage for workflow presets found.');
