import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  return {
  plugins: [react()],

  // 基础路径配置 - 确保资源正确加载
  base: '/',

  // 优化依赖处理
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js'
    ]
  },

  // 构建优化配置
  build: {
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    
    rollupOptions: {
      output: {
        // 更智能的代码分割策略
        manualChunks(id) {
          // 核心框架 - 最稳定的依赖
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          // 路由
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router';
          }
          // 图标库 - 单独分割以便按需加载
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          // 虚拟滚动
          if (id.includes('node_modules/react-virtuoso')) {
            return 'vendor-virtuoso';
          }
          // Supabase 客户端
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase';
          }
          // 其他 node_modules
          if (id.includes('node_modules')) {
            return 'vendor-others';
          }
        },
        
        // 资源文件命名
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name!.split('.');
          const ext = info[info.length - 1];
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(assetInfo.name!)) {
            return `img/[name]-[hash].${ext}`;
          }
          if (/\.(css)$/i.test(assetInfo.name!)) {
            return `css/[name]-[hash].${ext}`;
          }
          return `assets/[name]-[hash].${ext}`;
        }
      }
    },
    
    // 资源内联阈值 (4KB以下内联为base64)
    assetsInlineLimit: 4096,
    
    // sourcemap配置 (生产环境关闭)
    sourcemap: false,

    // chunk 大小警告阈值 (KB) - 降低以在移动端获得更好性能
    chunkSizeWarningLimit: 200,

    // 构建报告
    reportCompressedSize: true,

    // 清理输出目录
    emptyOutDir: true
  },

  // esbuild 优化：生产环境移除低价值日志，减轻主线程压力并缩小 bundle
  esbuild: isProd ? {
    drop: ['debugger'],
    pure: ['console.log', 'console.debug', 'console.info']
  } : undefined,

  // 开发服务器优化
  server: {
    port: 5173,
    host: true,
    cors: true,
    
    // HMR优化
    hmr: {
      overlay: true
    },
    
    // API代理配置 - 开发环境API路由
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          // 如果代理服务器不可用，使用mock数据
          proxy.on('error', (err, req, res) => {
            console.log('Proxy error, using mock data:', err.message);
            if (req.url?.includes('/api/ai-smart-fill')) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: true,
                data: {
                  name: 'Claude AI',
                  tagline: 'Advanced AI assistant for conversations and analysis',
                  description: 'Claude is an AI assistant created by Anthropic that can help with a wide variety of tasks including writing, analysis, math, coding, and creative projects.',
                  features: ['Natural conversation', 'Text analysis', 'Code assistance', 'Creative writing'],
                  pricing: 'Freemium',
                  categories: ['AI Assistant', 'Productivity'],
                  confidence: 0.9,
                  reasoning: 'Mock data for development testing'
                },
                apiUsage: {
                  promptTokens: 350,
                  completionTokens: 180,
                  totalTokens: 530,
                  cost: 0.074
                },
                metadata: {
                  analysisTime: 1200,
                  timestamp: new Date().toISOString(),
                  websiteContentFetched: true,
                  apiVersion: '1.0'
                }
              }));
            } else {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'API service unavailable' }));
            }
          });
        }
      }
    }
  },

  // 路径别名
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@lib': resolve(__dirname, 'src/lib'),
      '@types': resolve(__dirname, 'src/types')
    }
  }
  };
});
