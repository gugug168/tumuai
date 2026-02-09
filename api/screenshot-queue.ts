/**
 * 截图生成队列系统
 * 将耗时的截图生成操作放入队列，异步处理
 *
 * 工作原理：
 * 1. 请求将任务加入队列，立即返回 taskId
 * 2. 后台 Worker 逐步处理队列中的任务
 * 3. 客户端可以轮询任务状态
 */

import { createClient } from '@supabase/supabase-js';

// 任务状态
export enum ScreenshotTaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
}

// 任务数据结构
export interface ScreenshotTask {
  id: string;
  toolId: string;
  websiteUrl: string;
  status: ScreenshotTaskStatus;
  screenshots: string[];
  error?: string;
  createdAt: number;
  updatedAt: number;
  priority: number; // 数字越小优先级越高
}

// 内存中的任务队列（生产环境应使用数据库或 Redis）
const taskQueue = new Map<string, ScreenshotTask>();
const MAX_QUEUE_SIZE = 100;
const TASK_TTL = 30 * 60 * 1000; // 30分钟

// 确保队列不会无限增长
function cleanupOldTasks() {
  const now = Date.now();
  for (const [id, task] of taskQueue.entries()) {
    if (now - task.createdAt > TASK_TTL) {
      taskQueue.delete(id);
    }
  }

  // 如果队列太大，删除最旧的任务
  if (taskQueue.size > MAX_QUEUE_SIZE) {
    const sortedTasks = Array.from(taskQueue.entries())
      .sort(([, a], [, b]) => a.createdAt - b.createdAt);

    const toDelete = sortedTasks.slice(0, sortedTasks.length - MAX_QUEUE_SIZE);
    for (const [id] of toDelete) {
      taskQueue.delete(id);
    }
  }
}

/**
 * 生成唯一的任务 ID
 */
function generateTaskId(): string {
  return `screenshot_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 添加截图任务到队列
 */
export function enqueueScreenshotTask(
  toolId: string,
  websiteUrl: string,
  priority: number = 10
): string {
  cleanupOldTasks();

  const taskId = generateTaskId();
  const task: ScreenshotTask = {
    id: taskId,
    toolId,
    websiteUrl,
    status: ScreenshotTaskStatus.PENDING,
    screenshots: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    priority,
  };

  taskQueue.set(taskId, task);

  // 触发后台处理
  processQueue();

  return taskId;
}

/**
 * 获取任务状态
 */
export function getScreenshotTask(taskId: string): ScreenshotTask | null {
  const task = taskQueue.get(taskId);
  if (!task) return null;

  // 清理过期任务
  if (Date.now() - task.createdAt > TASK_TTL) {
    taskQueue.delete(taskId);
    return null;
  }

  return task;
}

/**
 * 获取所有待处理任务
 */
function getPendingTasks(): ScreenshotTask[] {
  return Array.from(taskQueue.values())
    .filter((t) => t.status === ScreenshotTaskStatus.PENDING)
    .sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);
}

/**
 * 处理单个任务
 */
async function processTask(task: ScreenshotTask, supabaseUrl: string, serviceKey: string): Promise<void> {
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // 更新状态为处理中
    task.status = ScreenshotTaskStatus.PROCESSING;
    task.updatedAt = Date.now();

    // 规范化目标 URL
    const target = normalizeScreenshotTarget(task.websiteUrl);
    if (!target) {
      task.status = ScreenshotTaskStatus.FAILED;
      task.error = 'Invalid website URL';
      return;
    }

    // 确保存储桶存在
    const bucket = 'tool-screenshots';
    const bucketCheck = await supabase.storage.getBucket(bucket);
    if (bucketCheck.error) {
      // 尝试创建存储桶
      await supabase.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: 10485760,
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
      });
    }

    // 只生成 hero 截图以节省时间
    const region = { name: 'hero', width: 1200 };
    const objectPath = `tools/${task.toolId}/${region.name}.webp`;
    const screenshotUrl = `https://image.thum.io/get/noanimate/width/${region.width}/${target}`;

    // 使用安全 fetch
    const response = await fetch(screenshotUrl);
    if (!response.ok) {
      throw new Error(`Screenshot fetch failed: ${response.status}`);
    }

    const bytes = await response.arrayBuffer();
    const maxBytes = 9.5 * 1024 * 1024;

    if (bytes.byteLength > maxBytes) {
      throw new Error(`Screenshot too large: ${bytes.byteLength} bytes`);
    }

    // 上传到 Supabase
    const upload = await supabase.storage
      .from(bucket)
      .upload(objectPath, bytes, {
        upsert: true,
        contentType: 'image/png',
        cacheControl: '2592000'
      });

    if (upload.error) {
      throw new Error(upload.error.message);
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(objectPath);

    task.screenshots = [publicUrl];
    task.status = ScreenshotTaskStatus.COMPLETED;
  } catch (error) {
    task.status = ScreenshotTaskStatus.FAILED;
    task.error = error instanceof Error ? error.message : 'Unknown error';
  } finally {
    task.updatedAt = Date.now();
  }
}

/**
 * 处理队列（每次处理一个任务）
 */
let isProcessing = false;
async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  try {
    const pendingTasks = getPendingTasks();
    if (pendingTasks.length === 0) return;

    // 只处理一个任务，避免超时
    const task = pendingTasks[0];
    await processTask(task, supabaseUrl, serviceKey);
  } finally {
    isProcessing = false;

    // 如果还有待处理任务，继续处理
    if (getPendingTasks().length > 0) {
      setTimeout(() => processQueue(), 1000);
    }
  }
}

/**
 * 规范化截图目标 URL
 */
function normalizeScreenshotTarget(websiteUrl: string): string | null {
  try {
    const url = new URL(websiteUrl);
    return url.hostname;
  } catch {
    return null;
  }
}

/**
 * 获取队列统计信息
 */
export function getQueueStats() {
  const tasks = Array.from(taskQueue.values());
  return {
    total: tasks.length,
    pending: tasks.filter(t => t.status === ScreenshotTaskStatus.PENDING).length,
    processing: tasks.filter(t => t.status === ScreenshotTaskStatus.PROCESSING).length,
    completed: tasks.filter(t => t.status === ScreenshotTaskStatus.COMPLETED).length,
    failed: tasks.filter(t => t.status === ScreenshotTaskStatus.FAILED).length,
  };
}
