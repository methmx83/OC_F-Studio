import path from 'node:path';
import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import type { FfmpegHealthResponse, ProxyResponse } from '@shared/ipc/ffmpeg';
import type { AudioWaveformResponse } from '@shared/ipc/assets';

function resolveProjectPath(projectRoot: string, relativePath: string): string {
  return path.join(projectRoot, relativePath);
}

export async function createVideoThumbnail(inputPath: string, outputPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-ss',
      '0.5',
      '-i',
      inputPath,
      '-frames:v',
      '1',
      '-q:v',
      '2',
      outputPath,
    ]);

    let stderr = '';

    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    ffmpeg.on('error', (error) => {
      reject(error);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
    });
  });
}

async function runFfmpeg(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);

    let stderr = '';

    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    ffmpeg.on('error', (error) => {
      reject(error);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
    });
  });
}

export async function probeVideoDurationSeconds(inputPath: string): Promise<number | null> {
  try {
    const output = await new Promise<string>((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        inputPath,
      ]);

      let stdout = '';
      let stderr = '';

      ffprobe.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      ffprobe.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      ffprobe.on('error', (error) => {
        reject(error);
      });

      ffprobe.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `ffprobe exited with code ${code}`));
          return;
        }
        resolve(stdout.trim());
      });
    });

    const parsed = Number(output);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return Math.round(parsed * 1000) / 1000;
  } catch {
    return null;
  }
}

export async function getFfmpegHealth(): Promise<FfmpegHealthResponse> {
  try {
    const result = await new Promise<{ version: string | null }>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ['-version']);
      let stdout = '';
      let stderr = '';

      ffmpeg.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      ffmpeg.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      ffmpeg.on('error', (error) => {
        reject(error);
      });
      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `ffmpeg -version exited with code ${code}`));
          return;
        }

        const firstLine = stdout.split(/\r?\n/)[0] ?? '';
        resolve({ version: firstLine.trim() || null });
      });
    });

    return {
      available: true,
      version: result.version,
      message: result.version ? `FFmpeg ready: ${result.version}` : 'FFmpeg ready',
    };
  } catch (error) {
    const message = (error as Error).message || 'FFmpeg not available';
    return {
      available: false,
      version: null,
      message,
    };
  }
}

export async function getAudioWaveformPeaks(params: {
  projectRoot: string | null;
  relativeAudioPath: string;
  bins: number;
}): Promise<AudioWaveformResponse> {
  const { projectRoot, relativeAudioPath } = params;
  const bins = Math.max(16, Math.min(1024, Math.round(params.bins || 96)));

  if (!projectRoot) {
    return { success: false, message: 'No project loaded. Cannot load audio waveform.', peaks: [] };
  }

  if (!relativeAudioPath) {
    return { success: false, message: 'Missing audio path.', peaks: [] };
  }

  const sourceAbsolutePath = resolveProjectPath(projectRoot, relativeAudioPath);
  const sourceExt = path.extname(relativeAudioPath).toLowerCase();
  const supportedInput = ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac'];
  if (!supportedInput.includes(sourceExt)) {
    return { success: false, message: `Unsupported audio extension: ${sourceExt || '(none)'}`, peaks: [] };
  }

  try {
    await fs.access(sourceAbsolutePath, fsConstants.R_OK);
  } catch {
    return { success: false, message: `Audio file is not readable: ${relativeAudioPath}`, peaks: [] };
  }

  const cacheKey = createHash('sha1').update(`${relativeAudioPath}|${bins}`).digest('hex').slice(0, 24);
  const cacheRelativePath = path.posix.join('cache/waveforms', `${cacheKey}.json`);
  const cacheAbsolutePath = resolveProjectPath(projectRoot, cacheRelativePath);

  try {
    await fs.mkdir(path.dirname(cacheAbsolutePath), { recursive: true });

    let canReuseCache = false;
    try {
      const [sourceStat, cacheStat] = await Promise.all([fs.stat(sourceAbsolutePath), fs.stat(cacheAbsolutePath)]);
      canReuseCache = cacheStat.mtimeMs >= sourceStat.mtimeMs;
    } catch {
      canReuseCache = false;
    }

    if (canReuseCache) {
      const cached = JSON.parse(await fs.readFile(cacheAbsolutePath, 'utf-8')) as { peaks?: number[] };
      if (Array.isArray(cached.peaks) && cached.peaks.length > 0) {
        return { success: true, message: 'Audio waveform loaded from cache', peaks: cached.peaks };
      }
    }

    const peaks = await extractAudioPeaks(sourceAbsolutePath, bins);
    await fs.writeFile(cacheAbsolutePath, JSON.stringify({ peaks }, null, 2), 'utf-8');
    return { success: true, message: 'Audio waveform generated', peaks };
  } catch (error) {
    return { success: false, message: `Audio waveform extraction failed: ${(error as Error).message}`, peaks: [] };
  }
}

async function extractAudioPeaks(inputPath: string, bins: number): Promise<number[]> {
  const rawBuffer = await new Promise<Buffer>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-v',
      'error',
      '-i',
      inputPath,
      '-ac',
      '1',
      '-ar',
      '2000',
      '-f',
      'f32le',
      'pipe:1',
    ]);

    const chunks: Buffer[] = [];
    let stderr = '';

    ffmpeg.stdout.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
    });

    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    ffmpeg.on('error', (error) => reject(error));
    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `ffmpeg exited with code ${code}`));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
  });

  const sampleCount = Math.floor(rawBuffer.length / 4);
  if (sampleCount <= 0) {
    return Array.from({ length: bins }, () => 0);
  }

  const peaks = Array.from({ length: bins }, () => 0);
  for (let index = 0; index < sampleCount; index += 1) {
    const value = Math.abs(rawBuffer.readFloatLE(index * 4));
    const bin = Math.min(bins - 1, Math.floor((index / sampleCount) * bins));
    if (value > peaks[bin]) {
      peaks[bin] = value;
    }
  }

  const max = peaks.reduce((acc, current) => Math.max(acc, current), 0);
  if (max <= 0) {
    return peaks;
  }

  return peaks.map((value) => Number((value / max).toFixed(4)));
}

export async function ensureVideoProxy(params: {
  projectRoot: string | null;
  relativeVideoPath: string;
}): Promise<ProxyResponse> {
  const { projectRoot, relativeVideoPath } = params;

  if (!projectRoot) {
    return { success: false, message: 'No project loaded. Cannot create proxy.' };
  }

  if (!relativeVideoPath) {
    return { success: false, message: 'Missing source video path.' };
  }

  const sourceAbsolutePath = resolveProjectPath(projectRoot, relativeVideoPath);
  const sourceExt = path.extname(relativeVideoPath).toLowerCase();
  const supportedInput = ['.mp4', '.mov', '.mkv', '.webm', '.m4v', '.avi'];
  if (!supportedInput.includes(sourceExt)) {
    return { success: false, message: `Unsupported source extension: ${sourceExt || '(none)'}` };
  }

  try {
    await fs.access(sourceAbsolutePath, fsConstants.R_OK);
  } catch {
    return { success: false, message: `Source file is not readable: ${relativeVideoPath}` };
  }

  const key = createHash('sha1').update(relativeVideoPath).digest('hex').slice(0, 16);
  const proxyRelativePath = path.posix.join('cache/proxies', `${key}.mp4`);
  const proxyAbsolutePath = resolveProjectPath(projectRoot, proxyRelativePath);

  try {
    await fs.mkdir(path.dirname(proxyAbsolutePath), { recursive: true });

    let shouldRegenerate = true;
    try {
      const [sourceStat, proxyStat] = await Promise.all([fs.stat(sourceAbsolutePath), fs.stat(proxyAbsolutePath)]);
      shouldRegenerate = proxyStat.mtimeMs < sourceStat.mtimeMs;
    } catch {
      shouldRegenerate = true;
    }

    if (shouldRegenerate) {
      await runFfmpeg([
        '-y',
        '-i',
        sourceAbsolutePath,
        '-vf',
        'scale=1280:-2',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '21',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        '-c:a',
        'aac',
        '-b:a',
        '160k',
        proxyAbsolutePath,
      ]);
    }

    return {
      success: true,
      message: shouldRegenerate ? 'Proxy generated' : 'Proxy already up to date',
      proxyRelativePath,
    };
  } catch (error) {
    return {
      success: false,
      message: `Proxy generation failed: ${(error as Error).message}`,
    };
  }
}
