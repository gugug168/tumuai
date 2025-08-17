// 测试收藏和评论功能的简单脚本
// 在浏览器控制台中运行或在Node.js环境中测试

// 模拟测试数据
const testToolId = 'test-tool-123'; // 替换为实际的工具ID

// 测试收藏功能
async function testFavoriteFeature() {
  console.log('🧪 测试收藏功能...');
  
  try {
    // 测试添加收藏
    console.log('尝试添加收藏...');
    const addResult = await fetch('/.netlify/functions/user-favorites', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 需要添加实际的认证token
      },
      body: JSON.stringify({ toolId: testToolId })
    });
    
    if (addResult.ok) {
      console.log('✅ 添加收藏成功');
    } else {
      console.error('❌ 添加收藏失败:', addResult.status);
    }
    
    // 测试检查收藏状态
    console.log('检查收藏状态...');
    const checkResult = await fetch(`/.netlify/functions/user-favorites?toolId=${testToolId}`);
    const isFavorited = await checkResult.json();
    console.log('收藏状态:', isFavorited);
    
  } catch (error) {
    console.error('收藏功能测试失败:', error);
  }
}

// 测试评论功能
async function testCommentFeature() {
  console.log('🧪 测试评论功能...');
  
  try {
    // 测试添加评论
    console.log('尝试添加评论...');
    const commentResult = await fetch('/.netlify/functions/tools', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 需要添加实际的认证token
      },
      body: JSON.stringify({
        toolId: testToolId,
        content: '这是一个测试评论',
        action: 'addComment'
      })
    });
    
    if (commentResult.ok) {
      console.log('✅ 添加评论成功');
    } else {
      console.error('❌ 添加评论失败:', commentResult.status);
    }
    
    // 测试获取评论
    console.log('获取评论列表...');
    const commentsResult = await fetch(`/.netlify/functions/tools?toolId=${testToolId}&action=getComments`);
    const comments = await commentsResult.json();
    console.log('评论数量:', comments.length);
    
  } catch (error) {
    console.error('评论功能测试失败:', error);
  }
}

// 运行测试
console.log('🚀 开始测试社区功能...');
// testFavoriteFeature();
// testCommentFeature();

console.log('💡 测试脚本已准备就绪');
console.log('请在浏览器控制台中运行：');
console.log('1. testFavoriteFeature() - 测试收藏功能');
console.log('2. testCommentFeature() - 测试评论功能');