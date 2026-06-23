import { defineConfig } from 'vite';

// Vite 配置:固定端口方便调试
export default defineConfig({
  server: {
    port: 5173,
    open: true,           // 自动打开浏览器
    host: '127.0.0.1'
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
