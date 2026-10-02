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

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_NODE_ENV': JSON.stringify(rawNodeEnv),
      'import.meta.env.VITE_IS_PRODUCTION_ENV': JSON.stringify(isProdEnv),
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
  };
});
