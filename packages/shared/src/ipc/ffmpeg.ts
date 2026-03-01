export interface FfmpegHealthResponse {
  available: boolean;
  version: string | null;
  message: string;
}

export interface ProxyResponse {
  success: boolean;
  message: string;
  proxyRelativePath?: string;
}

