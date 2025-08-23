import React, { useEffect, useState } from 'react'
import { X, Save } from 'lucide-react'
import { createCategory, updateCategory } from '../lib/admin'

interface Category {
	id?: string
	name: string
	slug?: string
	description?: string
	color?: string
	icon?: string
	sort_order?: number
	is_active?: boolean
}

interface Props {
	isOpen: boolean
	onClose: () => void
	onSave: () => void
	category?: Category | null
	mode: 'create' | 'edit'
}

const CategoryManagementModal: React.FC<Props> = ({ isOpen, onClose, onSave, category, mode }) => {
	const [form, setForm] = useState<Category>({
		name: '',
		slug: '',
		description: '',
		color: '#3B82F6',
		icon: 'Folder',
		sort_order: 0,
		is_active: true
	})
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (category) {
			setForm({
				id: category.id,
				name: category.name || '',
				slug: category.slug || '',
				description: category.description || '',
				color: category.color || '#3B82F6',
				icon: category.icon || 'Folder',
				sort_order: category.sort_order ?? 0,
				is_active: category.is_active ?? true
			})
		} else {
			setForm({ name: '', slug: '', description: '', color: '#3B82F6', icon: 'Folder', sort_order: 0, is_active: true })
		}
	}, [category, isOpen])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setLoading(true)
		setError(null)
		try {
			if (!form.name?.trim()) throw new Error('请填写分类名称')
			if (mode === 'create') {
				await createCategory({
					name: form.name.trim(),
					slug: form.slug?.trim() || '',
					description: form.description?.trim() || '',
					color: form.color,
					icon: form.icon,
					sort_order: form.sort_order ?? 0,
					is_active: form.is_active !== false
				})
			} else if (form.id) {
				await updateCategory(form.id, {
					name: form.name.trim(),
					slug: form.slug?.trim() || '',
					description: form.description?.trim() || '',
					color: form.color,
					icon: form.icon,
					sort_order: form.sort_order ?? 0,
					is_active: form.is_active !== false
				})
			}
			onSave()
			onClose()
		} catch (err: any) {
			setError(err?.message || '保存失败')
		} finally {
			setLoading(false)
		}
	}

	if (!isOpen) return null

	return (
		<div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
			<div className="bg-white rounded-lg max-w-lg w-full">
				<div className="flex items-center justify-between p-4 border-b">
					<h2 className="text-lg font-semibold">{mode === 'create' ? '新增分类' : '编辑分类'}</h2>
					<button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="关闭">
						<X className="h-5 w-5" />
					</button>
				</div>
				{error && (
					<div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-b border-red-200">{error}</div>
				)}
				<form onSubmit={handleSubmit} className="p-4 space-y-4">
					<div>
						<label className="block text-sm font-medium mb-1">分类名称</label>
						<input
							type="text"
							value={form.name}
							onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
							className="w-full rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 placeholder-gray-500"
							placeholder="例如：结构设计"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium mb-1">描述</label>
						<textarea
							value={form.description}
							onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
							rows={3}
							className="w-full rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 placeholder-gray-500"
							placeholder="分类描述"
						/>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium mb-1">颜色</label>
							<input type="text" value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} className="w-full rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 placeholder-gray-500" placeholder="#颜色代码" />
						</div>
						<div>
							<label className="block text-sm font-medium mb-1">图标</label>
							<input type="text" value={form.icon} onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))} className="w-full rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 placeholder-gray-500" placeholder="图标名称" />
						</div>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium mb-1">排序</label>
							<input type="number" value={form.sort_order ?? 0} onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) }))} className="w-full rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 placeholder-gray-500" placeholder="排序数字" />
						</div>
						<div className="flex items-center mt-6">
							<input id="active" type="checkbox" checked={form.is_active !== false} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
							<label htmlFor="active" className="ml-2 text-sm">启用</label>
						</div>
					</div>
					<div className="flex justify-end gap-3 pt-2">
						<button type="button" onClick={onClose} className="px-4 py-2 border rounded-md">取消</button>
						<button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50 flex items-center">
							<Save className="h-4 w-4 mr-2" />保存
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}

export default CategoryManagementModal


