import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Helper to parse key=value lines from .env files directly without Vite filtering
function getRawEnvValue(key: string): string {
  const envPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const match = content.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)`, 'm'));
      if (match) {
        return match[1].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  return '';
}

export default defineConfig(({ mode }) => {
  const rawNodeEnv = getRawEnvValue('NODE_ENV') || process.env.NODE_ENV || 'development';
  const isProdEnv = rawNodeEnv === 'production';
  const port = getRawEnvValue('PORT') || process.env.PORT || '4000';
  const envBackendUrl =
    getRawEnvValue('VITE_API_BASE_URL') ||
    getRawEnvValue('VITE_BACKEND_URL') ||
    getRawEnvValue('BACKEND_URL');

  const targetUrl =
    envBackendUrl && envBackendUrl.startsWith('http')
      ? envBackendUrl
      : `http://localhost:${port}`;

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_NODE_ENV': JSON.stringify(rawNodeEnv),
      'import.meta.env.VITE_IS_PRODUCTION_ENV': JSON.stringify(isProdEnv),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(getRawEnvValue('VITE_API_BASE_URL')),
      'import.meta.env.VITE_BACKEND_URL': JSON.stringify(envBackendUrl),
      'import.meta.env.VITE_PROXY_TARGET': JSON.stringify(targetUrl),
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: targetUrl,
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: targetUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
