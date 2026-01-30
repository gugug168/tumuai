// 验证部署是否更新
export default function handler(req, res) {
  const timestamp = new Date().toISOString();
  const commitHash = process.env.VERCEL_GIT_COMMIT_SHA || 'unknown';

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json({
    timestamp,
    deployTime: new Date().toISOString(),
    message: 'Deployment test',
    env: process.env.NODE_ENV,
    commit: commitHash,
    testVersion: 'v1.2'
  });
}
