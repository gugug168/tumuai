/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 主色调 - 深灰色
        primary: {
          50: '#F8F9FA',
          100: '#E9ECEF',
          200: '#DEE2E6',
          300: '#CED4DA',
          400: '#ADB5BD',
          500: '#6C757D',
          600: '#495057',
          700: '#343A40',
          800: '#2C3E50', // 主色调
          900: '#212529',
        },
        // 强调色 - 明亮的蓝色
        accent: {
          50: '#EBF8FF',
          100: '#BEE3F8',
          200: '#90CDF4',
          300: '#63B3ED',
          400: '#4299E1',
          500: '#3498DB', // 强调色
          600: '#2B77CB',
          700: '#2C5AA0',
          800: '#2A4A7C',
          900: '#1A365D',
        },
        // 辅助色系
        secondary: {
          50: '#F7FAFC',
          100: '#EDF2F7',
          200: '#E2E8F0',
          300: '#CBD5E0',
          400: '#A0AEC0',
          500: '#718096',
          600: '#4A5568',
          700: '#2D3748',
          800: '#1A202C',
          900: '#171923',
        },
        // 背景色系
        background: {
          primary: '#FFFFFF',
          secondary: '#F8F9FA',
          tertiary: '#F1F3F4',
        }
      },
      fontFamily: {
        // 中文优先的字体栈
        'sans': [
          'Source Han Sans SC',
          'Source Han Sans',
          'Noto Sans SC',
          'PingFang SC',
          'Microsoft YaHei',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ],
        // 英文标题字体
        'heading': [
          'Source Han Sans SC',
          'sans-serif'
        ],
        // 正文字体
        'body': [
          'Source Han Sans SC',
          'sans-serif'
        ]
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'medium': '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'strong': '0 10px 40px -10px rgba(0, 0, 0, 0.15), 0 2px 10px -2px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
};
