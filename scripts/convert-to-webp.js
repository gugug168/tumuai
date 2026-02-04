/**
 * 将 public 目录中的 PNG 图片转换为 WebP 格式
 * 优化压缩质量，同时保持原始 PNG 作为 fallback
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const imagesToConvert = [
  'logo.png',
  'og-image.png',
  'twitter-image.png'
];

async function convertToWebP(filename, quality = 80) {
  const inputPath = path.join(publicDir, filename);
  const outputPath = path.join(publicDir, filename.replace('.png', '.webp'));

  if (!fs.existsSync(inputPath)) {
    console.warn(`源文件不存在: ${inputPath}`);
    return null;
  }

  try {
    // 读取原图片信息
    const metadata = await sharp(inputPath).metadata();
    const originalSize = fs.statSync(inputPath).size;

    // 转换为 WebP
    await sharp(inputPath)
      .webp({
        quality,
        effort: 6, // 0-6，6 是最高压缩但最慢
        nearLossless: true // 接近无损压缩
      })
      .toFile(outputPath);

    const webpSize = fs.statSync(outputPath).size;
    const savings = ((1 - webpSize / originalSize) * 100).toFixed(1);

    console.log(`✅ ${filename}`);
    console.log(`   原始: ${(originalSize / 1024).toFixed(1)} KB (${metadata.width}x${metadata.height})`);
    console.log(`   WebP: ${(webpSize / 1024).toFixed(1)} KB (节省 ${savings}%)`);
    console.log(`   输出: ${outputPath}`);
    console.log('');

    return { originalSize, webpSize, savings };
  } catch (error) {
    console.error(`❌ 转换失败 ${filename}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('开始转换 PNG 到 WebP...\n');

  const results = [];

  for (const image of imagesToConvert) {
    const result = await convertToWebP(image, 80);
    if (result) {
      results.push({ image, ...result });
    }
  }

  // 总结
  if (results.length > 0) {
    const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalWebp = results.reduce((sum, r) => sum + r.webpSize, 0);
    const totalSavings = ((1 - totalWebp / totalOriginal) * 100).toFixed(1);

    console.log('📊 转换总结:');
    console.log(`   原始大小: ${(totalOriginal / 1024).toFixed(1)} KB`);
    console.log(`   WebP 大小: ${(totalWebp / 1024).toFixed(1)} KB`);
    console.log(`   总节省: ${totalSavings}%`);
  }
}

main().catch(console.error);
