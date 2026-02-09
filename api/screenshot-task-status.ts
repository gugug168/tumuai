/**
 * 截图任务状态查询 API
 * GET /api/screenshot-task-status?taskId=xxx
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getScreenshotTask, getQueueStats, ScreenshotTaskStatus } from './screenshot-queue';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 只允许 GET 请求
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const taskId = req.query.taskId as string;

  // 如果没有 taskId，返回队列统计
  if (!taskId) {
    const stats = getQueueStats();
    return res.status(200).json(stats);
  }

  const task = getScreenshotTask(taskId);

  if (!task) {
    return res.status(404).json({
      error: 'Task not found or expired',
      taskId,
    });
  }

  // 返回任务状态
  return res.status(200).json({
    id: task.id,
    toolId: task.toolId,
    status: task.status,
    screenshots: task.screenshots,
    error: task.error,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    isComplete: task.status === ScreenshotTaskStatus.COMPLETED,
    isFailed: task.status === ScreenshotTaskStatus.FAILED,
    isPending: task.status === ScreenshotTaskStatus.PENDING,
    isProcessing: task.status === ScreenshotTaskStatus.PROCESSING,
  });
}
