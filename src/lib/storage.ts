import { supabase } from './supabase';

/**
 * 上传工具 logo 到 Supabase Storage
 * @param file 图片文件
 * @param toolName 工具名称（用于生成唯一文件名）
 * @returns 上传成功后的公共 URL
 */
export async function uploadToolLogo(file: File, toolName: string): Promise<string> {
  try {
    console.log('📤 开始上传Logo文件:', {
      fileName: file.name,
      fileSize: `${(file.size / 1024).toFixed(1)}KB`,
      fileType: file.type,
      toolName: toolName
    });
    
    // 生成唯一的文件名
    const fileExt = file.name.split('.').pop();
    const fileName = `${toolName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_${Date.now()}.${fileExt}`;
    console.log('📝 生成文件名:', fileName);
    
    // 上传文件到 tool-logos bucket
    const { error } = await supabase.storage
      .from('tool-logos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('📤 文件上传失败:', error);
      
      // 提供更用户友好的错误信息
      if (error.message.includes('duplicate') || error.message.includes('already exists')) {
        throw new Error('文件名冲突，请稍后重试或重新命名工具');
      } else if (error.message.includes('size') || error.message.includes('too large')) {
        throw new Error('文件过大，请选择小于5MB的图片');
      } else if (error.message.includes('policy') || error.message.includes('permission')) {
        throw new Error('上传权限不足，请检查网络连接后重试');
      } else if (error.message.includes('bucket') || error.message.includes('not found')) {
        throw new Error('存储配置错误，请联系管理员');
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        throw new Error('网络连接超时，请检查网络后重试');
      } else {
        throw new Error(`上传失败: ${error.message}`);
      }
    }

    console.log('✅ 文件上传成功:', fileName);

    // 获取公共 URL
    const { data: { publicUrl } } = supabase.storage
      .from('tool-logos')
      .getPublicUrl(fileName);

    console.log('🔗 获得公开URL:', publicUrl);
    
    // 验证URL是否可以访问（可选的额外验证）
    try {
      const response = await fetch(publicUrl, { method: 'HEAD' });
      if (response.ok) {
        console.log('✅ URL验证成功，文件可正常访问');
      } else {
        console.warn('⚠️ URL验证失败，但继续使用该URL:', response.status);
      }
    } catch (urlError) {
      console.warn('⚠️ URL验证时发生错误:', urlError);
      // 不抛出错误，继续使用生成的URL
    }

    return publicUrl;
  } catch (error) {
    console.error('❌ 上传工具Logo时发生错误:', error);
    throw error;
  }
}

/**
 * 验证文件是否为有效的图片格式
 * @param file 要验证的文件
 * @returns 验证结果和错误信息
 */
export function validateImageFile(file: File): { isValid: boolean; error?: string } {
  // 检查文件类型
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: '请上传 JPEG、PNG、GIF 或 WebP 格式的图片'
    };
  }

  // 检查文件大小 (5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: '图片文件大小不能超过 5MB'
    };
  }

  return { isValid: true };
}
