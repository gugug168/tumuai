/**
 * 统一截图 API
 * 合并了 screenshot-queue 和 screenshot-task-status
 * 队列系统内联在此文件中
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// 任务状态枚举
enum ScreenshotTaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// 任务数据结构
interface ScreenshotTask {
  id: string
  toolId: string
  websiteUrl: string
  status: ScreenshotTaskStatus
  screenshots: string[]
  error?: string
  createdAt: number
  updatedAt: number
}

// 内存中的任务队列
const taskQueue = new Map<string, ScreenshotTask>()
const MAX_QUEUE_SIZE = 100
const TASK_TTL = 30 * 60 * 1000 // 30分钟

// 清理旧任务
function cleanupOldTasks() {
  const now = Date.now()
  for (const [id, task] of taskQueue.entries()) {
    if (now - task.createdAt > TASK_TTL) {
      taskQueue.delete(id)
    }
  }
}

// 生成任务ID
function generateTaskId(): string {
  return `screenshot_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// 添加任务到队列
function enqueueScreenshotTask(toolId: string, websiteUrl: string): string {
  cleanupOldTasks()

  if (taskQueue.size >= MAX_QUEUE_SIZE) {
    const oldestTask = Array.from(taskQueue.values()).sort((a, b) => a.createdAt - b.createdAt)[0]
    if (oldestTask) {
      taskQueue.delete(oldestTask.id)
    }
  }

  const taskId = generateTaskId()
  taskQueue.set(taskId, {
    id: taskId,
    toolId,
    websiteUrl,
    status: ScreenshotTaskStatus.PENDING,
    screenshots: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  // 触发后台处理
  processQueue()
  return taskId
}

// 获取任务状态
function getScreenshotTask(taskId: string): ScreenshotTask | null {
  const task = taskQueue.get(taskId)
  if (!task) return null
  if (Date.now() - task.createdAt > TASK_TTL) {
    taskQueue.delete(taskId)
    return null
  }
  return task
}

// 获取队列统计
function getQueueStats() {
  const tasks = Array.from(taskQueue.values())
  return {
    total: tasks.length,
    pending: tasks.filter(t => t.status === ScreenshotTaskStatus.PENDING).length,
    processing: tasks.filter(t => t.status === ScreenshotTaskStatus.PROCESSING).length,
    completed: tasks.filter(t => t.status === ScreenshotTaskStatus.COMPLETED).length,
    failed: tasks.filter(t => t.status === ScreenshotTaskStatus.FAILED).length,
  }
}

// 处理单个任务
async function processTask(task: ScreenshotTask, supabaseUrl: string, serviceKey: string): Promise<void> {
  const supabase = createClient(supabaseUrl, serviceKey)
  try {
    task.status = ScreenshotTaskStatus.PROCESSING
    task.updatedAt = Date.now()

    // 规范化目标 URL
    let target: string | null = null
    try {
      target = new URL(task.websiteUrl).hostname
    } catch {
      target = null
    }

    if (!target) {
      task.status = ScreenshotTaskStatus.FAILED
      task.error = 'Invalid website URL'
      return
    }

    // 确保存储桶存在
    const bucket = 'tool-screenshots'
    const bucketCheck = await supabase.storage.getBucket(bucket)
    if (bucketCheck.error) {
      await supabase.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: 10485760,
      })
    }

    // 生成 hero 截图
    const region = { name: 'hero', width: 1200 }
    const objectPath = `tools/${task.toolId}/${region.name}.webp`
    const screenshotUrl = `https://image.thum.io/get/noanimate/width/${region.width}/${target}`

    const response = await fetch(screenshotUrl)
    if (!response.ok) {
      throw new Error(`Screenshot fetch failed: ${response.status}`)
    }

    const bytes = await response.arrayBuffer()
    const maxBytes = 9.5 * 1024 * 1024

    if (bytes.byteLength > maxBytes) {
      throw new Error(`Screenshot too large: ${bytes.byteLength} bytes`)
    }

    // 上传到 Supabase
    const upload = await supabase.storage
      .from(bucket)
      .upload(objectPath, bytes, {
        upsert: true,
        contentType: 'image/png',
        cacheControl: '2592000'
      })

    if (upload.error) {
      throw new Error(upload.error.message)
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(objectPath)

    task.screenshots = [publicUrl]
    task.status = ScreenshotTaskStatus.COMPLETED
  } catch (error) {
    task.status = ScreenshotTaskStatus.FAILED
    task.error = error instanceof Error ? error.message : 'Unknown error'
  } finally {
    task.updatedAt = Date.now()
  }
}

// 处理队列
let isProcessing = false
async function processQueue(): Promise<void> {
  if (isProcessing) return
  isProcessing = true

  const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  try {
    const pendingTasks = Array.from(taskQueue.values())
      .filter(t => t.status === ScreenshotTaskStatus.PENDING)
      .sort((a, b) => a.createdAt - b.createdAt)

    if (pendingTasks.length === 0) return

    // 只处理一个任务，避免超时
    const task = pendingTasks[0]
    await processTask(task, supabaseUrl, serviceKey)
  } finally {
    isProcessing = false
    // 如果还有待处理任务，继续处理
    if (Array.from(taskQueue.values()).some(t => t.status === ScreenshotTaskStatus.PENDING)) {
      setTimeout(() => processQueue(), 1000)
    }
  }
}

// POST 处理：添加任务
async function handleEnqueue(request: VercelRequest, response: VercelResponse) {
  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body
    const { toolId, websiteUrl } = body || {}

    if (!toolId || !websiteUrl) {
      return response.status(400).json({ error: 'Missing required fields: toolId, websiteUrl' })
    }

    const taskId = enqueueScreenshotTask(toolId, websiteUrl)

    return response.status(200).json({
      success: true,
      taskId,
      message: 'Screenshot task enqueued',
      statusUrl: `/api/screenshot-api?action=status&taskId=${taskId}`
    })
  } catch (error) {
    console.error('Enqueue error:', error)
    return response.status(500).json({ error: 'Failed to enqueue task' })
  }
}

// GET 处理：查询状态
async function handleStatus(request: VercelRequest, response: VercelResponse) {
  const url = new URL(request.url || '', `http://${request.headers.host}`)
  const taskId = url.searchParams.get('taskId')

  if (!taskId) {
    return response.status(400).json({ error: 'Missing taskId parameter' })
  }

  const task = getScreenshotTask(taskId)

  if (!task) {
    return response.status(404).json({
      error: 'Task not found or expired',
      taskId
    })
  }

  return response.status(200).json({
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
    isProcessing: task.status === ScreenshotTaskStatus.PROCESSING
  })
}

// GET 处理：队列统计
async function handleStats(response: VercelResponse) {
  const stats = getQueueStats()
  return response.status(200).json(stats)
}

// 主处理器
export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.setHeader('Content-Type', 'application/json')

  if (request.method === 'OPTIONS') {
    return response.status(200).end()
  }

  const url = new URL(request.url || '', `http://${request.headers.host}`)
  const action = url.searchParams.get('action') || 'status'

  switch (action) {
    case 'enqueue':
      if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' })
      }
      return handleEnqueue(request, response)
    case 'status':
      return handleStatus(request, response)
    case 'stats':
      return handleStats(response)
    default:
      return response.status(400).json({ error: 'Invalid action', availableActions: ['enqueue', 'status', 'stats'] })
  }
}
