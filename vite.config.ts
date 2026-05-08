import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Use '.' instead of process.cwd() for better Docker compatibility
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      // Priority: Docker Env Var (process.env) -> .env file (env)
      'process.env.API_KEY': JSON.stringify(process.env.API_KEY || env.API_KEY),
      'process.env.OLLAMA_HOST': JSON.stringify(process.env.OLLAMA_HOST || env.OLLAMA_HOST || '/api/v1'),
      'process.env.AI_MODEL': JSON.stringify(process.env.AI_MODEL || env.AI_MODEL || 'gemma4:e2b'),
      'process.env.OLLAMA_API_KEY': JSON.stringify(
        process.env.OLLAMA_API_KEY || env.OLLAMA_API_KEY || env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || ''
      ),
      'process.env.OLLAMA_API_BASE': JSON.stringify(
        process.env.OLLAMA_API_BASE || env.OLLAMA_API_BASE || '/api/v1/'
      ),
      'process.env.OLLAMA_MODEL': JSON.stringify(
        process.env.OLLAMA_MODEL || env.OLLAMA_MODEL || 'gemma4:e2b'
      ),
    },
    server: {
      port: 3000,
      host: true, // Expose to network
      allowedHosts: ['cwi.thegeekybeng.com'], // CRITICAL: Allows access via Cloudflare tunnel domain
    },
  };
});