export const apiRequest = async <T>(promise: Promise<T>): Promise<T> => {
  try {
    const response = await promise;
    return response;
  } catch (error: any) {
    console.error('API请求失败:', error);
    
    // 提供用户友好的错误信息
    if (error.code === 'ETIMEDOUT' || error.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接');
    }
    
    if (error.status === 503 || error.status === 500) {
      throw new Error('服务器暂时不可用，请稍后重试');
    }
    
    throw new Error('数据加载失败，请重试');
  }
};