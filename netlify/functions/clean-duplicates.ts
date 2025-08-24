import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const handler: Handler = async (event) => {
  // 只允许POST请求
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    
    if (!supabaseUrl || !serviceKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing Supabase server config' })
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // 查找重复的工具（基于name）
    const { data: duplicates, error: queryError } = await supabase
      .from('tools')
      .select('id, name, created_at')
      .order('name')
      .order('created_at', { ascending: true })

    if (queryError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: queryError.message })
      }
    }

    // 分组找出重复项
    const nameGroups: { [key: string]: any[] } = {}
    
    duplicates?.forEach(tool => {
      if (!nameGroups[tool.name]) {
        nameGroups[tool.name] = []
      }
      nameGroups[tool.name].push(tool)
    })

    const duplicateGroups = Object.entries(nameGroups)
      .filter(([_, tools]) => tools.length > 1)
      .map(([name, tools]) => ({
        name,
        count: tools.length,
        tools: tools.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      }))

    // 如果是查看模式，只返回重复项信息
    if (event.body && JSON.parse(event.body).action === 'view') {
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: `发现 ${duplicateGroups.length} 组重复工具`,
          duplicates: duplicateGroups,
          totalDuplicates: duplicateGroups.reduce((sum, group) => sum + group.count - 1, 0)
        })
      }
    }

    // 清理重复项（保留最早创建的）
    let deletedCount = 0
    const deletedTools: any[] = []

    for (const group of duplicateGroups) {
      const toolsToDelete = group.tools.slice(1) // 保留第一个，删除其余的
      
      for (const tool of toolsToDelete) {
        const { error: deleteError } = await supabase
          .from('tools')
          .delete()
          .eq('id', tool.id)

        if (!deleteError) {
          deletedCount++
          deletedTools.push(tool)
          console.log(`已删除重复工具: ${tool.name} (ID: ${tool.id})`)
        } else {
          console.error(`删除失败: ${tool.name} (ID: ${tool.id})`, deleteError)
        }
      }
    }

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: `清理完成！删除了 ${deletedCount} 个重复工具`,
        deletedCount,
        duplicateGroups: duplicateGroups.length,
        deletedTools: deletedTools.map(t => ({ id: t.id, name: t.name }))
      })
    }

  } catch (err: any) {
    console.error('清理数据库时出错:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message || 'Unexpected error' })
    }
  }
}

export { handler }