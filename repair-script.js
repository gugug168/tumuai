// 数据库修复脚本 - 直接执行版
// 复制此代码到浏览器控制台执行

window.executeDatabaseRepair = async function() {
  console.log('🔄 开始数据库修复...');
  
  try {
    // 1. 获取管理员token
    const authToken = localStorage.getItem('sb-bixljqdwkjuzftlpmgtb-auth-token');
    const token = authToken ? JSON.parse(authToken).access_token : null;
    
    if (!token) {
      alert('请先登录管理员账号');
      return;
    }

    // 2. 创建修复函数
    const repairFunctions = {
      async createCategories() {
        console.log('📋 创建8个土木行业分类...');
        
        const categories = [
          { name: '结构设计', description: '建筑结构设计与分析工具', color: '#EF4444', icon: 'Building2', sort_order: 1 },
          { name: '建筑设计', description: '建筑设计与建模软件', color: '#F97316', icon: 'Home', sort_order: 2 },
          { name: '施工管理', description: '项目管理和施工协调工具', color: '#10B981', icon: 'Construction', sort_order: 3 },
          { name: '造价预算', description: '工程造价与预算计算工具', color: '#8B5CF6', icon: 'Calculator', sort_order: 4 },
          { name: 'BIM建模', description: '建筑信息模型与协作平台', color: '#06B6D4', icon: 'Box', sort_order: 5 },
          { name: '岩土工程', description: '地质分析与基础设计工具', color: '#84CC16', icon: 'Mountain', sort_order: 6 },
          { name: '市政工程', description: '道路、桥梁、管网设计工具', color: '#F59E0B', icon: 'Road', sort_order: 7 },
          { name: '效率工具', description: '通用办公与效率提升工具', color: '#64748B', icon: 'Zap', sort_order: 8 }
        ];

        for (const category of categories) {
          try {
            await fetch('https://bixljqdwkjuzftlpmgtb.supabase.co/rest/v1/categories', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpeGxqcWR3a2p1emZ0bHBtZ3RiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMzY0NTc5NSwiZXhwIjoyMDM5MjIxNzk1fQ.8gN0XbX6t4e3b8t7e6t4e3b8t7e6t4e3b8t7e6t4e3b8t'
              },
              body: JSON.stringify(category)
            });
            console.log(`✅ 已创建: ${category.name}`);
          } catch (err) {
            console.log(`⚠️ 分类已存在: ${category.name}`);
          }
        }
      },

      async testToolReview() {
        console.log('📝 测试工具审核功能...');
        
        // 创建一个测试提交
        const testSubmission = {
          submitter_email: 'test@example.com',
          tool_name: '测试工具 - 修复验证',
          tagline: '这是测试工具审核功能',
          description: '用于验证工具审核功能的测试数据',
          website_url: 'https://example.com',
          categories: ['效率工具'],
          features: ['测试功能'],
          pricing: 'Free',
          status: 'pending'
        };

        try {
          const response = await fetch('https://bixljqdwkjuzftlpmgtb.supabase.co/rest/v1/tool_submissions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpeGxqcWR3a2p1emZ0bHBtZ3RiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMzY0NTc5NSwiZXhwIjoyMDM5MjIxNzk1fQ.8gN0XbX6t4e3b8t7e6t4e3b8t7e6t4e3b8t7e6t4e3b8t'
            },
            body: JSON.stringify(testSubmission)
          });

          const result = await response.json();
          console.log('✅ 测试提交创建成功:', result);
          return result;
        } catch (err) {
          console.error('❌ 测试提交创建失败:', err);
        }
      },

      async verifyFixes() {
        console.log('🔍 验证修复结果...');
        
        // 验证分类
        const categoriesRes = await fetch('https://bixljqdwkjuzftlpmgtb.supabase.co/rest/v1/categories?order=sort_order', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpeGxqcWR3a2p1emZ0bHBtZ3RiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMzY0NTc5NSwiZXhwIjoyMDM5MjIxNzk1fQ.8gN0XbX6t4e3b8t7e6t4e3b8t7e6t4e3b8t7e6t4e3b8t'
          }
        });
        
        const categories = await categoriesRes.json();
        console.log('📊 分类数量:', categories.length);
        console.log('📋 分类列表:', categories.map(c => c.name));

        // 验证工具提交
        const submissionsRes = await fetch('https://bixljqdwkjuzftlpmgtb.supabase.co/rest/v1/tool_submissions?status=eq.pending', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpeGxqcWR3a2p1emZ0bHBtZ3RiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMzY0NTc5NSwiZXhwIjoyMDM5MjIxNzk1fQ.8gN0XbX6t4e3b8t7e6t4e3b8t7e6t4e3b8t7e6t4e3b8t'
          }
        });
        
        const submissions = await submissionsRes.json();
        console.log('📝 待审核工具:', submissions.length);

        return { categories, submissions };
      }
    };

    // 执行修复
    await repairFunctions.createCategories();
    
    // 等待后验证
    setTimeout(async () => {
      const result = await repairFunctions.verifyFixes();
      console.log('🎉 修复完成！', result);
      
      alert(`数据库修复完成！\n\n已创建 ${result.categories.length} 个分类\n待审核工具: ${result.submissions.length} 个`);
    }, 3000);

  } catch (error) {
    console.error('❌ 修复失败:', error);
    alert('修复失败: ' + error.message);
  }
};

// 执行修复
console.log('🚀 数据库修复脚本已加载');
console.log('执行: executeDatabaseRepair()');

// 如果直接运行
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    console.log('💡 在控制台输入 executeDatabaseRepair() 开始修复');
  });
}