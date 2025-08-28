s/return {\s*statusCode: 405,\s*body: JSON\.stringify({ error: 'Method not allowed' })\s*}/return response.status(405).json({ error: 'Method not allowed' })/g
s/return {\s*statusCode: 401,\s*body: JSON\.stringify({ error: '未提供认证信息' })\s*}/return response.status(401).json({ error: '未提供认证信息' })/g
s/return {\s*statusCode: 401,\s*body: JSON\.stringify({ error: '无效的认证信息' })\s*}/return response.status(401).json({ error: '无效的认证信息' })/g
s/return {\s*statusCode: 403,\s*body: JSON\.stringify({ error: '无管理员权限' })\s*}/return response.status(403).json({ error: '无管理员权限' })/g
s/return {\s*statusCode: 400,\s*body: JSON\.stringify({ error: '无效的操作' })\s*}/return response.status(400).json({ error: '无效的操作' })/g
