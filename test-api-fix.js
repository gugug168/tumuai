#!/usr/bin/env node

/**
 * API修复测试脚本
 * 验证Vercel API路由配置是否正确
 */

const https = require('https');
const http = require('http');

// 测试配置
const TEST_ENDPOINTS = [
  '/api/admin-auth-check',
  '/api/admin-check',
  '/api/tools'
];

// 获取部署URL（如果可用）
const DEPLOY_URL = process.env.VERCEL_URL || process.env.DEPLOY_URL || 'localhost:5173';
const protocol = DEPLOY_URL.includes('localhost') ? 'http:' : 'https:';

console.log('🧪 开始测试API路由修复...\n');
console.log(`🌐 目标URL: ${protocol}//${DEPLOY_URL}`);

// 测试单个端点
async function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const url = `${protocol}//${DEPLOY_URL}${endpoint}`;
    const client = protocol === 'https:' ? https : http;
    
    const req = client.get(url, (res) => {
      const contentType = res.headers['content-type'] || '';
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const isJSON = contentType.includes('application/json');
        const isHTML = contentType.includes('text/html') || data.trim().startsWith('<');
        
        resolve({
          endpoint,
          status: res.statusCode,
          contentType,
          isJSON,
          isHTML,
          preview: data.substring(0, 100).replace(/\n/g, ' ')
        });
      });
    });
    
    req.on('error', (error) => {
      resolve({
        endpoint,
        status: 'ERROR',
        error: error.message
      });
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        endpoint,
        status: 'TIMEOUT',
        error: '请求超时'
      });
    });
  });
}

// 运行所有测试
async function runTests() {
  const results = [];
  
  for (const endpoint of TEST_ENDPOINTS) {
    console.log(`📡 测试: ${endpoint}`);
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    // 输出结果
    if (result.error) {
      console.log(`  ❌ 失败: ${result.error}\n`);
    } else {
      const statusIcon = result.status < 300 ? '✅' : result.status < 500 ? '⚠️' : '❌';
      const typeIcon = result.isJSON ? '📋' : result.isHTML ? '📄' : '❓';
      
      console.log(`  ${statusIcon} 状态: ${result.status}`);
      console.log(`  ${typeIcon} 类型: ${result.contentType}`);
      console.log(`  📝 预览: ${result.preview}...\n`);
    }
  }
  
  // 生成报告
  console.log('📊 测试报告:');
  console.log('='.repeat(50));
  
  const successful = results.filter(r => !r.error && r.isJSON);
  const htmlResponses = results.filter(r => r.isHTML);
  const errors = results.filter(r => r.error);
  
  console.log(`✅ JSON响应: ${successful.length}/${TEST_ENDPOINTS.length}`);
  console.log(`📄 HTML响应: ${htmlResponses.length}/${TEST_ENDPOINTS.length}`);
  console.log(`❌ 错误请求: ${errors.length}/${TEST_ENDPOINTS.length}`);
  
  if (htmlResponses.length > 0) {
    console.log('\n⚠️ 检测到HTML响应(可能是路由配置问题):');
    htmlResponses.forEach(r => {
      console.log(`   - ${r.endpoint}: ${r.status}`);
    });
  }
  
  if (successful.length === TEST_ENDPOINTS.length) {
    console.log('\n🎉 所有API端点都返回了正确的JSON响应！');
  } else if (successful.length > 0) {
    console.log('\n✨ 部分API端点工作正常，修复已生效！');
  } else {
    console.log('\n💭 建议检查Vercel部署状态或使用客户端兜底方案');
  }
}

// 执行测试
runTests().catch(console.error);