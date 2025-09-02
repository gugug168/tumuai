# AI智能填入功能配置指南

## 🚀 功能概述

AI智能填入功能可以自动分析网站内容，智能生成工具信息，大幅提升工具提交效率。

### 主要特性
- 🌐 **网站内容抓取** - 自动获取网站标题、描述等关键信息
- 🤖 **AI智能分析** - 使用DeepSeek API分析生成工具详情  
- 🔄 **实时重复检测** - 避免重复提交相同工具
- 🎯 **智能分类推荐** - 自动推荐合适的工具分类
- 💡 **Mock模式兜底** - 没有API密钥时自动使用模拟数据

## 📋 配置步骤

### 1. 获取DeepSeek API密钥

1. 访问 [DeepSeek官网](https://platform.deepseek.com/)
2. 注册账号并登录
3. 进入API控制台，创建新的API密钥
4. 复制生成的API密钥（格式类似：`sk-xxxxxxxxxxxxxxxxxxxxxx`）

### 2. 本地开发环境配置

创建 `.env.local` 文件（不要提交到Git）：

```env
# Supabase 配置
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI智能填入配置
DEEPSEEK_API_KEY=sk-your-actual-deepseek-api-key

# 后端服务密钥
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Vercel生产环境配置

1. 进入 Vercel Dashboard
2. 选择项目 → Settings → Environment Variables  
3. 添加以下环境变量：

| 名称 | 值 | 环境 |
|-----|-----|------|
| `DEEPSEEK_API_KEY` | `sk-your-actual-api-key` | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | `your-service-role-key` | Production, Preview |

### 4. 验证配置

重新部署项目后，测试AI智能填入功能：

1. 进入工具提交页面
2. 输入任意网站URL（如：`https://chatgpt.com`）
3. 点击"AI智能填入"按钮
4. 检查是否成功生成工具信息

## 🔧 技术架构

### API端点
- **主要接口**: `/api/ai-smart-fill`
- **Mock接口**: `/api/ai-smart-fill-mock` （兜底方案）
- **健康检查**: `/api/ai-smart-fill?health=true`

### 工作流程
```
用户输入URL → 重复检测 → AI智能分析 → 结果填入表单
     ↓              ↓            ↓          ↓
 URL验证     检查数据库    调用DeepSeek   自动填写字段
                                ↓
                         Mock模式（无密钥时）
```

### 智能切换逻辑
1. **优先使用真实API** - 如果配置了`DEEPSEEK_API_KEY`
2. **自动降级Mock** - 密钥未配置时使用模拟数据
3. **错误恢复** - API调用失败时的优雅降级

## 💰 成本控制

### DeepSeek定价（2025年）
- **价格**: $0.14 / 1K tokens
- **预估成本**: 每次分析约 0.05-0.1 美分
- **Token限制**: 最大2000 tokens输出

### 成本优化策略
- ✅ 设置合理的`maxTokens`限制
- ✅ 使用缓存避免重复分析
- ✅ 实现请求频率限制
- ✅ 监控API使用量和成本

## 🐛 故障排除

### 常见问题

**1. AI按钮不显示**
- 检查URL是否通过重复检测
- 确认`enableAIFill`属性为true
- 查看浏览器控制台是否有错误

**2. API调用失败**
- 验证`DEEPSEEK_API_KEY`是否正确配置
- 检查网络连接和防火墙设置
- 查看Vercel Functions日志

**3. 分析结果不准确**
- 检查网站是否可正常访问
- 确认网站内容是否可抓取
- 尝试调整温度参数提高一致性

### 调试工具

**开发环境检查**:
```bash
# 检查环境变量
echo $DEEPSEEK_API_KEY

# 测试API连接
curl -X POST http://localhost:3000/api/ai-smart-fill \
  -H "Content-Type: application/json" \
  -d '{"websiteUrl": "https://chatgpt.com"}'
```

**生产环境监控**:
- Vercel Functions 日志
- 浏览器开发者工具 Network 面板
- API响应时间和错误率统计

## 🔒 安全注意事项

1. **API密钥保护** - 永远不要在客户端代码中暴露API密钥
2. **请求限制** - 实施适当的请求频率限制
3. **输入验证** - 严格验证所有用户输入
4. **错误处理** - 不在错误信息中泄露敏感信息

## 📚 相关文档

- [DeepSeek API文档](https://platform.deepseek.com/api-docs/)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Supabase配置指南](https://supabase.com/docs/guides/getting-started)

---

*如有问题，请联系技术团队或查看项目GitHub Issues* 🐱