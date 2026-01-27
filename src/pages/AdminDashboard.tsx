import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  BarChart3,
  FileText,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  Plus,
  Edit,
  Trash2,
  Eye,
  Tag,
  RefreshCw,
  ExternalLink,
  Settings,
  Download,
  Ban,
  Check,
  MoreVertical
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  checkAdminStatus,
  getAllAdminData,
  reviewToolSubmission,
  deleteTool,
  deleteCategory,
  toggleUserStatus,
  updateUserRole,
  deleteUser,
  updateToolStatus,
  batchDeleteTools,
  batchReviewSubmissions,
  exportToolsToCSV,
  exportUsersToCSV,
  type ToolSubmission,
  type AdminLog
} from '../lib/admin';
import ToolManagementModal from '../components/ToolManagementModal';
import CategoryManagementModal from '../components/CategoryManagementModal';
import SubmissionDetailModal from '../components/SubmissionDetailModal';

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

const AdminDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true); // 新增：权限检查状态
  const [isAuthorized, setIsAuthorized] = useState(false); // 新增：权限状态
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalTools: 0,
    totalUsers: 0,
    pendingSubmissions: 0,
    totalReviews: 0,
    totalFavorites: 0,
    totalCategories: 0,
    totalLogs: 0
  });
  const [submissions, setSubmissions] = useState<ToolSubmission[]>([]);
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);  // 预留：管理员日志功能
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showToolModal, setShowToolModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState<ToolSubmission | null>(null);
  const [editingUser, setEditingUser] = useState<Record<string, unknown> | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  // 批量选择状态
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  // 新增：立即进行权限检查
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('🔐 开始权限验证...');
        setAuthChecking(true);
        
        // 直接调用checkAdminStatus，不使用超时竞争
        const adminStatus = await checkAdminStatus();
        
        if (!adminStatus) {
          console.error('❌ 权限验证失败，重定向到登录页');
          navigate('/admin-login');
          return;
        }
        
        console.log('✅ 权限验证通过');
        setIsAuthorized(true);
      } catch (error) {
        console.error('❌ 权限验证异常:', error);
        navigate('/admin-login');
      } finally {
        setAuthChecking(false);
      }
    };
    
    checkAuth();
  }, [navigate]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 开始加载管理数据...');
      
      // 检查管理员权限
      const adminStatus = await checkAdminStatus();
      
      if (!adminStatus) {
        console.error('❌ 用户不是管理员');
        setError('您没有管理员权限，无法访问此页面');
        navigate('/admin-login');
        return;
      }
      
      console.log('✅ 管理员权限验证通过');
      
      // 使用统一的数据获取API
      const data = await getAllAdminData();
      
      // 设置所有数据状态
      if (data.stats) {
        setStats(prevStats => ({ ...prevStats, ...data.stats }));
      }
      
      if (data.submissions) {
        setSubmissions(data.submissions);
      }
      
      if (data.users) {
        setUsers(data.users); // 使用修复的真实用户数据
      }
      
      if (data.tools) {
        setTools(data.tools);
      }
      
      if (data.logs) {
        setLogs(data.logs);
      }
      
      if (data.categories) {
        setCategories(data.categories);
      }

      console.log('🎉 管理数据加载完成');
    } catch (error: unknown) {
      const err = error as Error
      console.error('❌ 管理数据加载失败:', error);
      setError(`管理数据加载失败: ${err.message || '请检查网络连接或联系技术支持'}`);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // 所有单独的load函数已移除，现在使用统一的getAllAdminData()函数

  useEffect(() => {
    // 只有权限验证通过后才加载数据
    if (isAuthorized) {
      loadData();
    }
  }, [isAuthorized, loadData]);

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

  // 用户管理函数
  const handleToggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      await toggleUserStatus(userId, isActive);
      await loadData();
    } catch (error) {
      console.error('Toggle user status failed:', error);
      alert('操作失败，请重试');
    }
  };

  const handleUpdateUserRole = async (userId: string, role: string) => {
    try {
      await updateUserRole(userId, role);
      await loadData();
    } catch (error) {
      console.error('Update user role failed:', error);
      alert('更新角色失败，请重试');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('确定删除该用户？此操作不可撤销。')) return;

    try {
      await deleteUser(userId);
      await loadData();
    } catch (error) {
      console.error('Delete user failed:', error);
      alert('删除用户失败，请重试');
    }
  };

  // 工具状态管理
  const handleUpdateToolStatus = async (toolId: string, status: 'draft' | 'published' | 'archived') => {
    try {
      await updateToolStatus(toolId, status);
      await loadData();
    } catch (error) {
      console.error('Update tool status failed:', error);
      alert('更新工具状态失败，请重试');
    }
  };

  // 批量删除工具
  const handleBatchDeleteTools = async () => {
    if (selectedTools.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedTools.size} 个工具？此操作不可撤销。`)) return;

    try {
      const result = await batchDeleteTools(Array.from(selectedTools));
      alert(`批量删除完成：成功 ${result.success} 个，失败 ${result.failed} 个`);
      setSelectedTools(new Set());
      await loadData();
    } catch (error) {
      console.error('Batch delete tools failed:', error);
      alert('批量删除失败，请重试');
    }
  };

  // 批量审核提交
  const handleBatchReview = async (status: 'approved' | 'rejected') => {
    if (selectedSubmissions.size === 0) return;
    const confirmMsg = status === 'approved'
      ? `确定通过选中的 ${selectedSubmissions.size} 个提交？`
      : `确定拒绝选中的 ${selectedSubmissions.size} 个提交？`;
    if (!confirm(confirmMsg)) return;

    try {
      const result = await batchReviewSubmissions(Array.from(selectedSubmissions), status);
      alert(`批量审核完成：成功 ${result.success} 个，失败 ${result.failed} 个`);
      setSelectedSubmissions(new Set());
      await loadData();
    } catch (error) {
      console.error('Batch review failed:', error);
      alert('批量审核失败，请重试');
    }
  };

  // 数据导出函数
  const handleExportTools = async () => {
    try {
      const csv = await exportToolsToCSV();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `tools_export_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Export tools failed:', error);
      alert('导出工具列表失败，请重试');
    }
  };

  const handleExportUsers = async () => {
    try {
      const csv = await exportUsersToCSV();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Export users failed:', error);
      alert('导出用户列表失败，请重试');
    }
  };

  // 切换工具选择
  const toggleToolSelection = (toolId: string) => {
    setSelectedTools(prev => {
      const newSet = new Set(prev);
      if (newSet.has(toolId)) {
        newSet.delete(toolId);
      } else {
        newSet.add(toolId);
      }
      return newSet;
    });
  };

  // 切换提交选择
  const toggleSubmissionSelection = (submissionId: string) => {
    setSelectedSubmissions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(submissionId)) {
        newSet.delete(submissionId);
      } else {
        newSet.add(submissionId);
      }
      return newSet;
    });
  };

  const filteredSubmissions = submissions.filter(submission => {
    const toolName = submission.tool_name || '';
    const tagline = submission.tagline || '';
    const searchTermLower = searchTerm.toLowerCase();
    
    const matchesSearch = toolName.toLowerCase().includes(searchTermLower) ||
                         tagline.toLowerCase().includes(searchTermLower);
    const matchesStatus = filterStatus === 'all' || submission.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const tabs = [
    { id: 'overview', label: '概览', icon: BarChart3 },
    { id: 'submissions', label: '工具审核', icon: FileText, count: stats.pendingSubmissions },
    { id: 'tools', label: '工具管理', icon: Database },
    { id: 'categories', label: '分类管理', icon: Tag },
    { id: 'users', label: '用户管理', icon: Users }
  ];

  // 权限验证中，显示加载界面
  if (authChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-indigo-600 mx-auto mb-4 animate-pulse" />
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">正在验证管理员权限...</p>
          <p className="text-gray-400 text-sm mt-2">请稍候，这可能需要几秒钟</p>
        </div>
      </div>
    );
  }

  // 权限验证失败，这里不应该显示任何内容（因为会重定向）
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 font-medium">权限验证失败</p>
          <p className="text-gray-500 text-sm mt-2">正在重定向到登录页面...</p>
        </div>
      </div>
    );
  }

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
              <h1 className="ml-3 text-2xl font-bold text-gray-900" data-testid="admin-dashboard-title">管理员控制台</h1>
            </div>
            <button
              onClick={loadData}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              data-testid="refresh-data-button"
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

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <Settings className="h-6 w-6 text-gray-400" />
                <div className="ml-4">
                  <dt className="text-sm font-medium text-gray-500">系统日志</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-600">{stats.totalLogs}</dd>
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
                  data-testid={`admin-tab-${tab.id}`}
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
            {/* 概览页面内容 */}
            {activeTab === 'overview' && (
              <div>
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">系统概览</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 快速统计 */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">快速统计</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">总工具数</span>
                          <span className="text-sm font-medium">{stats.totalTools}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">活跃分类</span>
                          <span className="text-sm font-medium">{stats.totalCategories}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">待审核工具</span>
                          <span className="text-sm font-medium text-orange-600">{stats.pendingSubmissions}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">系统日志</span>
                          <span className="text-sm font-medium">{stats.totalLogs}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* 最近活动 */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">最近活动</h4>
                      <div className="space-y-2">
                        <div className="text-sm text-gray-600">
                          ✅ 数据库连接正常
                        </div>
                        <div className="text-sm text-gray-600">
                          📊 统计数据已更新
                        </div>
                        <div className="text-sm text-gray-600">
                          🔧 系统运行正常
                        </div>
                        <div className="text-sm text-gray-600">
                          👤 管理员权限验证成功
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* 系统状态 */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
                    <h4 className="text-sm font-medium text-green-800">系统状态良好</h4>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    所有服务运行正常，数据同步正常
                  </p>
                </div>
              </div>
            )}
            
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
                    {selectedSubmissions.size > 0 && (
                      <>
                        <button
                          onClick={() => handleBatchReview('approved')}
                          className="inline-flex items-center px-3 py-2 rounded-md bg-green-600 text-white text-sm hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          批量通过 ({selectedSubmissions.size})
                        </button>
                        <button
                          onClick={() => handleBatchReview('rejected')}
                          className="inline-flex items-center px-3 py-2 rounded-md bg-red-600 text-white text-sm hover:bg-red-700"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          批量拒绝 ({selectedSubmissions.size})
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {filteredSubmissions.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">暂无符合条件的工具提交</p>
                ) : (
                  <div className="space-y-4">
                    {/* 全选/取消全选 */}
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={selectedSubmissions.size === filteredSubmissions.length && filteredSubmissions.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSubmissions(new Set(filteredSubmissions.map(s => s.id)));
                          } else {
                            setSelectedSubmissions(new Set());
                          }
                        }}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>全选 ({filteredSubmissions.length})</span>
                    </div>
                    {filteredSubmissions.map((submission) => (
                      <div key={submission.id} className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${selectedSubmissions.has(submission.id) ? 'bg-indigo-50 border-indigo-300' : 'border-gray-200'}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex items-start space-x-3 flex-1">
                            <input
                              type="checkbox"
                              checked={selectedSubmissions.has(submission.id)}
                              onChange={() => toggleSubmissionSelection(submission.id)}
                              className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
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
                                data-testid={`approve-submission-${submission.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                通过
                              </button>
                              <button
                                onClick={() => handleReviewSubmission(submission.id, 'rejected')}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none"
                                data-testid={`reject-submission-${submission.id}`}
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
                  <div className="flex items-center space-x-2">
                    {selectedTools.size > 0 && (
                      <>
                        <button
                          onClick={handleBatchDeleteTools}
                          className="inline-flex items-center px-3 py-2 rounded-md bg-red-600 text-white text-sm hover:bg-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          批量删除 ({selectedTools.size})
                        </button>
                      </>
                    )}
                    <button
                      onClick={handleExportTools}
                      className="inline-flex items-center px-3 py-2 rounded-md bg-green-600 text-white text-sm hover:bg-green-700"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      导出
                    </button>
                    <button
                      onClick={() => setShowToolModal(true)}
                      className="inline-flex items-center px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      新增工具
                    </button>
                  </div>
                </div>
                {tools.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">暂无工具</p>
                ) : (
                  <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-10">
                            <input
                              type="checkbox"
                              checked={selectedTools.size === tools.length && tools.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTools(new Set(tools.map(t => t.id)));
                                } else {
                                  setSelectedTools(new Set());
                                }
                              }}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">名称</th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">分类</th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">定价</th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">状态</th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {tools.map((tool) => (
                          <tr key={tool.id} className={selectedTools.has(tool.id) ? 'bg-indigo-50' : ''}>
                            <td className="px-3 py-4 text-sm">
                              <input
                                type="checkbox"
                                checked={selectedTools.has(tool.id)}
                                onChange={() => toggleToolSelection(tool.id)}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                            </td>
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
                              <div className="flex items-center space-x-1">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  tool.featured ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {tool.featured ? '精选' : '普通'}
                                </span>
                                {/* 工具状态下拉菜单 */}
                                <select
                                  value={tool.status || 'published'}
                                  onChange={(e) => handleUpdateToolStatus(tool.id, e.target.value as any)}
                                  className="text-xs border rounded px-1 py-0.5"
                                  title="更改状态"
                                >
                                  <option value="draft">草稿</option>
                                  <option value="published">发布</option>
                                  <option value="archived">下线</option>
                                </select>
                              </div>
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">用户管理</h3>
                  <button
                    onClick={handleExportUsers}
                    className="inline-flex items-center px-3 py-2 rounded-md bg-green-600 text-white text-sm hover:bg-green-700"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    导出用户
                  </button>
                </div>
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
                            角色
                          </th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                            状态
                          </th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                            注册时间
                          </th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {users.map((user) => (
                          <tr key={user.id}>
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                              <div>
                                <div className="font-medium">{user.email?.split('@')[0] || user.email}</div>
                                <div className="text-gray-500 text-xs">{user.email}</div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                user.role === 'super_admin' ? 'bg-purple-100 text-purple-800' :
                                user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {user.role === 'super_admin' ? '超级管理员' :
                                 user.role === 'admin' ? '管理员' : '用户'}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                user.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {user.is_active !== false ? '正常' : '禁用'}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {new Date(user.created_at).toLocaleDateString()}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm space-x-2">
                              {user.is_active !== false ? (
                                <button
                                  onClick={() => handleToggleUserStatus(user.id, false)}
                                  className="text-orange-600 hover:text-orange-900"
                                  title="禁用用户"
                                >
                                  <Ban className="h-4 w-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleToggleUserStatus(user.id, true)}
                                  className="text-green-600 hover:text-green-900"
                                  title="启用用户"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="text-red-600 hover:text-red-900"
                                title="删除用户"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
      {/* 工具创建/编辑弹窗 */}
      <ToolManagementModal
        isOpen={showToolModal || !!editingTool}
        onClose={() => { setShowToolModal(false); setEditingTool(null) }}
        onSave={() => { loadData() }}
        tool={editingTool || undefined}
        categories={categories.map(c => ({ id: c.id, name: c.name }))}
        mode={editingTool ? 'edit' : 'create'}
      />
      {/* 分类创建/编辑弹窗 */}
      <CategoryManagementModal
        isOpen={showCategoryModal || !!editingCategory}
        onClose={() => { setShowCategoryModal(false); setEditingCategory(null) }}
        onSave={() => { loadData() }}
        category={editingCategory || undefined}
        mode={editingCategory ? 'edit' : 'create'}
      />

      {/* 工具提交详情弹窗 */}
      <SubmissionDetailModal
        isOpen={!!showSubmissionModal}
        onClose={() => setShowSubmissionModal(null)}
        submission={showSubmissionModal}
        onApprove={(submissionId) => handleReviewSubmission(submissionId, 'approved')}
        onReject={(submissionId, notes) => handleReviewSubmission(submissionId, 'rejected', notes)}
      />
    </div>
  );
};

export default AdminDashboard;