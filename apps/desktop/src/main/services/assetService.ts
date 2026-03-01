import path from 'node:path';
import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { pathToFileURL } from 'node:url';

function resolveProjectPath(projectRoot: string, relativePath: string): string {
  return path.join(projectRoot, relativePath);
}

function toMediaMimeType(extension: string): string {
  if (extension === '.png') {
    return 'image/png';
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }
  if (extension === '.webp') {
    return 'image/webp';
  }
  if (extension === '.gif') {
    return 'image/gif';
  }
  if (extension === '.bmp') {
    return 'image/bmp';
  }
  if (extension === '.mp4') {
    return 'video/mp4';
  }
  if (extension === '.webm') {
    return 'video/webm';
  }
  if (extension === '.mov') {
    return 'video/quicktime';
  }
  if (extension === '.m4v') {
    return 'video/x-m4v';
  }
  if (extension === '.mkv') {
    return 'video/x-matroska';
  }
  if (extension === '.avi') {
    return 'video/x-msvideo';
  }
  if (extension === '.mp3') {
    return 'audio/mpeg';
  }
  if (extension === '.wav') {
    return 'audio/wav';
  }
  if (extension === '.flac') {
    return 'audio/flac';
  }
  if (extension === '.m4a') {
    return 'audio/mp4';
  }
  if (extension === '.ogg') {
    return 'audio/ogg';
  }
  if (extension === '.aac') {
    return 'audio/aac';
  }

  return 'application/octet-stream';
}

export async function getAssetThumbnailDataUrl(params: {
  projectRoot: string | null;
  relativePath: string;
}): Promise<string | null> {
  const { projectRoot, relativePath } = params;
  if (!projectRoot || !relativePath) {
    return null;
  }

  const absolutePath = resolveProjectPath(projectRoot, relativePath);
  try {
    await fs.access(absolutePath, fsConstants.R_OK);
    const buffer = await fs.readFile(absolutePath);
    const extension = path.extname(absolutePath).toLowerCase();
    const mimeType = extension === '.png' ? 'image/png' : 'image/jpeg';
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function getAssetFileUrl(params: {
  projectRoot: string | null;
  relativePath: string;
}): Promise<string | null> {
  const { projectRoot, relativePath } = params;
  if (!projectRoot || !relativePath) {
    return null;
  }

  const absolutePath = resolveProjectPath(projectRoot, relativePath);
  try {
    await fs.access(absolutePath, fsConstants.R_OK);
    return pathToFileURL(absolutePath).toString();
  } catch {
    return null;
  }
}

export async function getAssetMediaDataUrl(params: {
  projectRoot: string | null;
  relativePath: string;
}): Promise<string | null> {
  const { projectRoot, relativePath } = params;
  if (!projectRoot || !relativePath) {
    return null;
  }

  const absolutePath = resolveProjectPath(projectRoot, relativePath);
  try {
    await fs.access(absolutePath, fsConstants.R_OK);
    const buffer = await fs.readFile(absolutePath);
    const extension = path.extname(absolutePath).toLowerCase();
    const mimeType = toMediaMimeType(extension);
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}
