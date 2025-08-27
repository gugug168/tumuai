import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
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
        manualChunks: {
          // 核心框架
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          
          // UI库按使用频率分割
          'vendor-icons': ['lucide-react'],
          'vendor-auth': ['@supabase/supabase-js'],
          
          // 业务模块分割
          'features-auth': [
            './src/contexts/AuthContext.tsx',
            './src/lib/auth.ts'
          ],
          'features-admin': ['./src/lib/admin.ts'],
          'features-cache': [
            './src/lib/cache.ts', 
            './src/hooks/useCache.ts'
          ],
          
          // 页面按访问频率分割  
          'pages-core': [
            './src/pages/HomePage.tsx',
            './src/pages/ToolsPage.tsx'
          ],
          'pages-user': [
            './src/pages/ProfilePage.tsx', 
            './src/pages/FavoritesPage.tsx'
          ],
          
          // 工具函数
          'utils': [
            './src/hooks/usePerformance.ts',
            './src/hooks/useAccessibility.ts',
            './src/utils/performanceMonitor.ts',
            './src/utils/typeGuards.ts'
          ]
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
    
    // 构建报告
    reportCompressedSize: true,
    
    // 清理输出目录
    emptyOutDir: true
  },

  // 开发服务器优化
  server: {
    port: 5173,
    host: true,
    cors: true,
    
    // HMR优化
    hmr: {
      overlay: true
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
});
