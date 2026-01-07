import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // 获取后端地址：优先使用环境变量，否则使用 Docker 服务名
    const backendUrl = env.VITE_API_URL || process.env.VITE_API_URL || 'http://backend:8000';
    
    return {
      server: {
        port: 5173,  // Vite 默认端口，在 Docker 中映射到 3000
        host: '0.0.0.0',
        // 配置代理：将 /v1/* 和 /api/* 代理到后端
        proxy: {
          '/v1': {
            target: backendUrl,
            changeOrigin: true,
            secure: false,
            // SSE 流需要特殊配置
            configure: (proxy, _options) => {
              proxy.on('proxyReq', (proxyReq, req, _res) => {
                // 设置 SSE 相关 headers
                if (req.url?.includes('/paper_search')) {
                  proxyReq.setHeader('Accept', 'text/event-stream');
                  proxyReq.setHeader('Cache-Control', 'no-cache');
                }
              });
            },
          },
          '/api': {
            target: backendUrl,
            changeOrigin: true,
            secure: false,
            rewrite: (path) => path.replace(/^\/api/, ''),
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
