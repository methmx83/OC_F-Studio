import type { Asset } from '../types.js';

export interface AssetImportResponse {
  success: boolean;
  message: string;
  asset?: Asset;
}

export interface AudioWaveformResponse {
  success: boolean;
  message: string;
  peaks: number[];
}

