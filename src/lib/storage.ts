import { supabase } from './supabase';

/**
 * 上传工具 logo 到 Supabase Storage
 * @param file 图片文件
 * @param toolName 工具名称（用于生成唯一文件名）
 * @returns 上传成功后的公共 URL
 */
export async function uploadToolLogo(file: File, toolName: string): Promise<string> {
  try {
    // 生成唯一的文件名
    const fileExt = file.name.split('.').pop();
    const fileName = `${toolName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_${Date.now()}.${fileExt}`;
    
    // 上传文件到 tool-logos bucket
    const { data, error } = await supabase.storage
      .from('tool-logos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('文件上传失败:', error);
      throw new Error(`文件上传失败: ${error.message}`);
    }

    // 获取公共 URL
    const { data: { publicUrl } } = supabase.storage
      .from('tool-logos')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error('上传工具 logo 时发生错误:', error);
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
