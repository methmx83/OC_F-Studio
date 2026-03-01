/* eslint-disable no-unused-vars */
import path from 'node:path';
import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import type {
  WorkflowCatalogCategory,
  WorkflowCatalogEntry,
  WorkflowCatalogResponse,
  WorkflowMetaDefaults,
  WorkflowMetaDefinition,
  WorkflowMetaInputDefinition,
} from '@shared/workflows';

const WORKFLOW_CATALOG_CATEGORIES: readonly WorkflowCatalogCategory[] = ['images', 'videos', 'audio'];

export interface WorkflowCatalogService {
  listCatalog(): Promise<WorkflowCatalogResponse>;
}

export interface CreateWorkflowCatalogServiceOptions {
  getCurrentProjectRoot(): string | null;
  resolveProjectPath(projectRoot: string, relativePath: string): string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function isReadableFile(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function readWorkflowMetaFile(
  absoluteMetaPath: string,
  expectedCategory: WorkflowCatalogCategory,
): Promise<WorkflowMetaDefinition> {
  const raw = await fs.readFile(absoluteMetaPath, 'utf-8');
  const parsed = JSON.parse(raw) as unknown;
  return parseWorkflowMetaDefinition(parsed, expectedCategory);
}

function parseWorkflowMetaDefinition(
  value: unknown,
  expectedCategory: WorkflowCatalogCategory,
): WorkflowMetaDefinition {
  if (!isRecord(value)) {
    throw new Error('Meta file must contain a JSON object.');
  }

  const id = readRequiredString(value, 'id');
  const name = readRequiredString(value, 'name');
  const category = readRequiredString(value, 'category');
  const templateFile = readRequiredString(value, 'templateFile');
  const rawInputs = value.inputs;
  const rawDefaults = value.defaults;

  if (!WORKFLOW_CATALOG_CATEGORIES.includes(category as WorkflowCatalogCategory)) {
    throw new Error(`Unsupported category "${category}".`);
  }
  if (category !== expectedCategory) {
    throw new Error(`Category mismatch. File is in "${expectedCategory}" but meta says "${category}".`);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error(`Invalid id "${id}". Allowed: letters, numbers, "-" and "_".`);
  }
  if (path.isAbsolute(templateFile) || templateFile.includes('..')) {
    throw new Error(`templateFile "${templateFile}" is not allowed.`);
  }
  if (!templateFile.toLowerCase().endsWith('.api.json')) {
    throw new Error(`templateFile "${templateFile}" must end with ".api.json".`);
  }

  if (!Array.isArray(rawInputs)) {
    throw new Error('inputs must be an array.');
  }

  const inputs = rawInputs.map((entry, index) => parseWorkflowMetaInputDefinition(entry, index));
  const defaults = parseWorkflowMetaDefaults(rawDefaults);

  return {
    id,
    name,
    category: category as WorkflowCatalogCategory,
    templateFile,
    inputs,
    defaults,
  };
}

function parseWorkflowMetaInputDefinition(
  value: unknown,
  index: number,
): WorkflowMetaInputDefinition {
  if (!isRecord(value)) {
    throw new Error(`inputs[${index}] must be an object.`);
  }

  const key = readRequiredString(value, 'key');
  const type = readRequiredString(value, 'type');
  const label = readRequiredString(value, 'label');
  const requiredValue = value.required;

  if (!['image', 'video', 'audio'].includes(type)) {
    throw new Error(`inputs[${index}].type "${type}" is invalid.`);
  }
  if (typeof requiredValue !== 'boolean') {
    throw new Error(`inputs[${index}].required must be boolean.`);
  }

  return {
    key,
    type: type as WorkflowMetaInputDefinition['type'],
    label,
    required: requiredValue,
  };
}

function parseWorkflowMetaDefaults(value: unknown): WorkflowMetaDefaults {
  if (!isRecord(value)) {
    throw new Error('defaults must be an object.');
  }

  return {
    width: readFiniteNumber(value, 'width'),
    height: readFiniteNumber(value, 'height'),
    fps: readFiniteNumber(value, 'fps'),
    frames: readFiniteNumber(value, 'frames'),
    steps: readFiniteNumber(value, 'steps'),
  };
}

function readRequiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`"${key}" must be a non-empty string.`);
  }
  return value.trim();
}

function readFiniteNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`defaults.${key} must be a finite number.`);
  }
  return value;
}

export function createWorkflowCatalogService(
  options: CreateWorkflowCatalogServiceOptions,
): WorkflowCatalogService {
  return {
    async listCatalog(): Promise<WorkflowCatalogResponse> {
      const projectRoot = options.getCurrentProjectRoot();
      if (!projectRoot) {
        return {
          success: false,
          message: 'No project loaded. Create or load a project first.',
          warnings: [],
          workflows: [],
        };
      }

      const workflowsRoot = options.resolveProjectPath(projectRoot, 'workflows');
      const entries: WorkflowCatalogEntry[] = [];
      const warnings: string[] = [];

      for (const category of WORKFLOW_CATALOG_CATEGORIES) {
        const categoryDir = options.resolveProjectPath(workflowsRoot, category);

        let dirEntries: import('node:fs').Dirent[] = [];
        try {
          dirEntries = await fs.readdir(categoryDir, { withFileTypes: true });
        } catch (error) {
          const nodeError = error as Error & { code?: string };
          if (nodeError.code === 'ENOENT') {
            continue;
          }
          warnings.push(`Failed to read workflows/${category}: ${nodeError.message}`);
          continue;
        }

        const metaFiles = dirEntries
          .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.meta.json'))
          .map((entry) => entry.name)
          .sort((a, b) => a.localeCompare(b));

        for (const metaFileName of metaFiles) {
          const absoluteMetaPath = path.join(categoryDir, metaFileName);
          try {
            const parsedMeta = await readWorkflowMetaFile(absoluteMetaPath, category);
            const metaRelativePath = path.posix.join('workflows', category, metaFileName);
            const templateRelativePath = path.posix.join('workflows', category, parsedMeta.templateFile);
            const templateAbsolutePath = options.resolveProjectPath(projectRoot, templateRelativePath);
            const templateExists = await isReadableFile(templateAbsolutePath);

            entries.push({
              ...parsedMeta,
              metaRelativePath,
              templateRelativePath,
              templateExists,
            });
          } catch (error) {
            warnings.push(
              `Invalid workflow meta (${path.posix.join('workflows', category, metaFileName)}): ${(error as Error).message}`,
            );
          }
        }
      }

      const sortedEntries = entries.sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
      });

      const message = sortedEntries.length > 0
        ? `Loaded ${sortedEntries.length} workflow meta file(s).`
        : 'No workflow meta files found in project workflows folders.';

      return {
        success: true,
        message,
        projectWorkflowsRoot: workflowsRoot,
        warnings,
        workflows: sortedEntries,
      };
    },
  };
}
