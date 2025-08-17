import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Settings, 
  BarChart3, 
  FileText, 
  Shield, 
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  UserCheck,
  Plus,
  Edit,
  Trash2,
  Eye,
  Tag,
  Palette,
  Folder,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Save,
  Cancel,
  AlertTriangle,
  Check,
  ExternalLink,
  Copy,
  EyeOff,
  Wrench
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  checkAdminStatus, 
  getSystemStats, 
  getToolSubmissions, 
  reviewToolSubmission,
  getUsers,
  getToolsAdmin,
  getAdminLogs,
  createTool,
  updateTool,
  deleteTool,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type AdminUser,
  type ToolSubmission,
  type AdminLog
} from '../lib/admin';
import DatabaseRepair from '../components/DatabaseRepair';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color: string;
  icon: string;
  parent_id?: string;
  sort_order: number;
  is_active: boolean;
  tools_count: number;
}

interface Tool {
  id: string;
  name: string;
  tagline: string;
  description?: string;
  website_url: string;
  logo_url?: string;
  categories: string[];
  features: string[];
  pricing: string;
  featured: boolean;
  date_added: string;
  upvotes: number;
  views: number;
  rating: number;
  review_count: number;
}

const EnhancedAdminDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalTools: 0,
    totalUsers: 0,
    pendingSubmissions: 0,
    totalReviews: 0,
    totalFavorites: 0,
    totalCategories: 0
  });
  const [submissions, setSubmissions] = useState<ToolSubmission[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showToolModal, setShowToolModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState<ToolSubmission | null>(null);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 开始加载管理数据...');
      
      // 检查管理员权限
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
      const adminStatus = await Promise.race([checkAdminStatus(), timeout]);
      
      if (adminStatus === null) {
        console.warn('⚠️ 管理员校验超时，继续加载数据由后端函数再次鉴权');
      } else if (!adminStatus) {
        console.error('❌ 用户不是管理员');
        setError('您没有管理员权限，无法访问此页面');
        navigate('/');
        return;
      }
      
      console.log('✅ 管理员权限验证通过');
      
      // 加载所有数据
      const loaders = [
        loadStats(),
        loadSubmissions(),
        loadUsers(),
        loadTools(),
        loadLogs(),
        loadCategories()
      ].map(p => p.catch((e) => console.error('❌ 子任务失败:', e)))

      const hardCap = new Promise<void>((resolve) => setTimeout(() => {
        console.warn('⏱️ 管理数据加载达到硬性超时(15s)，继续渲染已到达的数据')
        resolve()
      }, 15000))

      await Promise.race([
        Promise.allSettled(loaders).then(() => undefined),
        hardCap
      ])

      console.log('🎉 管理数据加载流程结束（全部完成或达成硬性超时）');
    } catch (error: any) {
      console.error('❌ 管理数据加载失败:', error);
      setError(`管理数据加载失败: ${error.message || '请检查网络连接或联系技术支持'}`);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const loadStats = async () => {
    try {
      const data = await getSystemStats();
      setStats(prev => ({ ...prev, ...data }));
    } catch (error) {
      console.error('❌ 统计数据加载失败:', error);
    }
  };

  const loadSubmissions = async () => {
    try {
      const data = await getToolSubmissions();
      setSubmissions(data);
    } catch (error) {
      console.error('❌ 提交数据加载失败:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (error) {
      console.error('❌ 用户数据加载失败:', error);
    }
  };

  const loadTools = async () => {
    try {
      const data = await getToolsAdmin();
      setTools(data);
    } catch (error) {
      console.error('❌ 工具数据加载失败:', error);
    }
  };

  const loadLogs = async () => {
    try {
      const data = await getAdminLogs();
      setLogs(data);
    } catch (error) {
      console.error('❌ 日志数据加载失败:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error('❌ 分类数据加载失败:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReviewSubmission = async (submissionId: string, status: 'approved' | 'rejected', notes?: string) => {
    try {
      await reviewToolSubmission(submissionId, status, notes);
      await loadData();
      setShowSubmissionModal(null);
    } catch (error) {
      console.error('Review failed:', error);
      alert('操作失败，请重试');
    }
  };

  const handleCreateTool = async (toolData: any) => {
    try {
      await createTool(toolData);
      await loadData();
      setShowToolModal(false);
    } catch (error) {
      console.error('Create tool failed:', error);
      alert('创建失败，请重试');
    }
  };

  const handleUpdateTool = async (toolId: string, updates: any) => {
    try {
      await updateTool(toolId, updates);
      await loadData();
      setEditingTool(null);
    } catch (error) {
      console.error('Update tool failed:', error);
      alert('更新失败，请重试');
    }
  };

  const handleDeleteTool = async (toolId: string) => {
    if (!confirm('确定删除该工具？此操作不可撤销。')) return;
    
    try {
      await deleteTool(toolId);
      await loadData();
    } catch (error) {
      console.error('Delete tool failed:', error);
      alert('删除失败，请重试');
    }
  };

  const handleCreateCategory = async (categoryData: any) => {
    try {
      await createCategory(categoryData);
      await loadData();
      setShowCategoryModal(false);
    } catch (error) {
      console.error('Create category failed:', error);
      alert('创建分类失败，请重试');
    }
  };

  const handleUpdateCategory = async (categoryId: string, updates: any) => {
    try {
      await updateCategory(categoryId, updates);
      await loadData();
      setEditingCategory(null);
    } catch (error) {
      console.error('Update category failed:', error);
      alert('更新分类失败，请重试');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('确定删除该分类？相关工具将失去此分类。')) return;
    
    try {
      await deleteCategory(categoryId);
      await loadData();
    } catch (error) {
      console.error('Delete category failed:', error);
      alert('删除分类失败，请重试');
    }
  };

  const filteredSubmissions = submissions.filter(submission => {
    const matchesSearch = submission.tool_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         submission.tagline.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || submission.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const tabs = [
    { id: 'overview', label: '概览', icon: BarChart3 },
    { id: 'submissions', label: '工具审核', icon: FileText, count: stats.pendingSubmissions },
    { id: 'tools', label: '工具管理', icon: Database },
    { id: 'categories', label: '分类管理', icon: Tag },
    { id: 'users', label: '用户管理', icon: Users },
    { id: 'repair', label: '数据库修复', icon: Wrench }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载管理数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-indigo-600" />
              <h1 className="ml-3 text-2xl font-bold text-gray-900">管理员控制台</h1>
            </div>
            <button
              onClick={loadData}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新数据
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">错误</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 概览卡片 */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <Database className="h-6 w-6 text-gray-400" />
                <div className="ml-4">
                  <dt className="text-sm font-medium text-gray-500">工具总数</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.totalTools}</dd>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <Users className="h-6 w-6 text-gray-400" />
                <div className="ml-4">
                  <dt className="text-sm font-medium text-gray-500">用户总数</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.totalUsers}</dd>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <Clock className="h-6 w-6 text-orange-400" />
                <div className="ml-4">
                  <dt className="text-sm font-medium text-gray-500">待审核</dt>
                  <dd className="mt-1 text-3xl font-semibold text-orange-600">{stats.pendingSubmissions}</dd>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <Tag className="h-6 w-6 text-purple-400" />
                <div className="ml-4">
                  <dt className="text-sm font-medium text-gray-500">分类总数</dt>
                  <dd className="mt-1 text-3xl font-semibold text-purple-600">{stats.totalCategories}</dd>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 标签页 */}
        <div className="bg-white shadow rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6 overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="h-5 w-5 inline mr-2" />
                  {tab.label}
                  {tab.count && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* 工具审核 */}
            {activeTab === 'submissions' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">工具审核</h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="搜索提交..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="all">全部状态</option>
                      <option value="pending">待审核</option>
                      <option value="approved">已通过</option>
                      <option value="rejected">已拒绝</option>
                    </select>
                  </div>
                </div>
                {filteredSubmissions.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">暂无符合条件的工具提交</p>
                ) : (
                  <div className="space-y-4">
                    {filteredSubmissions.map((submission) => (
                      <div key={submission.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 text-lg">{submission.tool_name}</h4>
                            <p className="text-sm text-gray-600 mt-1">{submission.tagline}</p>
                            <p className="text-xs text-gray-500 mt-2">
                              提交时间: {new Date(submission.created_at).toLocaleString()}
                            </p>
                            {submission.submitter_email && (
                              <p className="text-xs text-gray-500">
                                提交者: {submission.submitter_email}
                              </p>
                            )}
                          </div>
                          <div className="ml-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              submission.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              submission.status === 'approved' ? 'bg-green-100 text-green-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {submission.status === 'pending' ? '待审核' :
                               submission.status === 'approved' ? '已通过' : '已拒绝'}
                            </span>
                          </div>
                        </div>
                        {submission.description && (
                          <p className="text-sm text-gray-600 mt-3 line-clamp-2">{submission.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {submission.categories.map((category) => (
                            <span key={category} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {category}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center space-x-2 mt-4">
                          {submission.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleReviewSubmission(submission.id, 'approved')}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                通过
                              </button>
                              <button
                                onClick={() => handleReviewSubmission(submission.id, 'rejected')}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                拒绝
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setShowSubmissionModal(submission)}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            详情
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 工具管理 */}
            {activeTab === 'tools' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">工具管理</h3>
                  <button
                    onClick={() => setShowToolModal(true)}
                    className="inline-flex items-center px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    新增工具
                  </button>
                </div>
                {tools.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">暂无工具</p>
                ) : (
                  <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">名称</th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">分类</th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">定价</th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">状态</th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {tools.map((tool) => (
                          <tr key={tool.id}>
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              <div>
                                <div className="font-medium text-gray-900">{tool.name}</div>
                                <div className="text-gray-500">{tool.tagline}</div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              <div className="flex flex-wrap gap-1">
                                {tool.categories.slice(0, 2).map((cat) => (
                                  <span key={cat} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                    {cat}
                                  </span>
                                ))}
                                {tool.categories.length > 2 && (
                                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                                    +{tool.categories.length - 2}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                tool.pricing === 'Free' ? 'bg-green-100 text-green-800' :
                                tool.pricing === 'Freemium' ? 'bg-blue-100 text-blue-800' :
                                tool.pricing === 'Paid' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {tool.pricing}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                tool.featured ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {tool.featured ? '精选' : '普通'}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm space-x-2">
                              <button
                                onClick={() => setEditingTool(tool)}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteTool(tool.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <a
                                href={tool.website_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-600 hover:text-gray-900"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 分类管理 */}
            {activeTab === 'categories' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">分类管理</h3>
                  <button
                    onClick={() => setShowCategoryModal(true)}
                    className="inline-flex items-center px-3 py-2 rounded-md bg-purple-600 text-white text-sm hover:bg-purple-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    新增分类
                  </button>
                </div>
                {categories.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">暂无分类</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categories.map((category) => (
                      <div key={category.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <div 
                                className="w-4 h-4 rounded mr-2"
                                style={{ backgroundColor: category.color }}
                              ></div>
                              <h4 className="font-medium text-gray-900">{category.name}</h4>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{category.description || '暂无描述'}</p>
                            <div className="flex items-center mt-2 space-x-4 text-xs text-gray-500">
                              <span>排序: {category.sort_order}</span>
                              <span>
                                状态: {category.is_active ? (
                                  <span className="text-green-600">启用</span>
                                ) : (
                                  <span className="text-red-600">禁用</span>
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="flex space-x-1">
                            <button
                              onClick={() => setEditingCategory(category)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(category.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 用户管理 */}
            {activeTab === 'users' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">用户管理</h3>
                {users.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">暂无用户数据</p>
                ) : (
                  <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                            用户
                          </th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                            邮箱
                          </th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                            注册时间
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {users.map((user) => (
                          <tr key={user.id}>
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                              {user.full_name || user.email}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{user.email}</td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {new Date(user.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 数据库修复 */}
            {activeTab === 'repair' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">数据库修复</h3>
                <DatabaseRepair />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedAdminDashboard;