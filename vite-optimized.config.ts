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
          // 第三方库单独打包
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-ui': ['lucide-react'],
          'vendor-supabase': ['@supabase/supabase-js'],
          
          // 只手动分割直接导入的页面组件
          'pages-main': [
            './src/pages/HomePage.tsx',
            './src/pages/ToolsPage.tsx'
          ]
          // 移除React.lazy懒加载的页面，让Vite自动处理它们的代码分割
          // ToolDetailPage, SubmitToolPage, AboutPage等将作为独立chunk被动态加载
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
    open: true,
    cors: true,
    
    // HMR优化
    hmr: {
      overlay: true
    }
  },

  // 预览服务器配置
  preview: {
    port: 4173,
    host: true
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