import React, { useState, useEffect } from 'react';
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
  UserCheck
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
  type AdminUser,
  type ToolSubmission,
  type AdminLog
} from '../lib/admin';

const AdminDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalTools: 0,
    totalUsers: 0,
    pendingSubmissions: 0,
    totalReviews: 0,
    totalFavorites: 0
  });
  const [submissions, setSubmissions] = useState<ToolSubmission[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 开始加载管理数据...');
      
      // 检查管理员权限（增加超时兜底，避免卡住）
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
      const adminStatus = await Promise.race([checkAdminStatus(), timeout]);
      console.log('👤 管理员状态检查:', adminStatus);
      
      if (adminStatus === null) {
        console.warn('⚠️ 管理员校验超时，继续加载数据由后端函数再次鉴权');
      } else if (!adminStatus) {
        console.error('❌ 用户不是管理员');
        setError('您没有管理员权限，无法访问此页面');
        navigate('/');
        return;
      }
      
      console.log('✅ 管理员权限验证通过');
      
      // 分步加载数据，避免阻塞；增加硬性超时，避免某个Promise永久悬挂
      const loaders = [
        loadStats(),
        loadSubmissions(),
        loadUsers(),
        loadTools(),
        loadLogs()
      ].map(p => p.catch((e) => console.error('❌ 子任务失败:', e)))

      const hardCap = new Promise<void>((resolve) => setTimeout(() => {
        console.warn('⏱️ 管理数据加载达到硬性超时(10s)，继续渲染已到达的数据')
        resolve()
      }, 10000))

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
  };

  const loadStats = async () => {
    try {
      console.log('📊 开始加载统计数据...');
      const statsData = await getSystemStats();
      console.log('✅ 统计数据加载完成:', statsData);
      setStats(statsData);
    } catch (error) {
      console.error('❌ 统计数据加载失败:', error);
    }
  };

  const loadSubmissions = async () => {
    try {
      console.log('📝 开始加载提交数据...');
      const submissionsData = await getToolSubmissions();
      console.log('✅ 提交数据加载完成:', submissionsData.length, '条记录');
      setSubmissions(submissionsData);
    } catch (error) {
      console.error('❌ 提交数据加载失败:', error);
    }
  };

  const loadUsers = async () => {
    try {
      console.log('👥 开始加载用户数据...');
      const usersData = await getUsers();
      console.log('✅ 用户数据加载完成:', usersData.length, '条记录');
      setUsers(usersData);
    } catch (error) {
      console.error('❌ 用户数据加载失败:', error);
    }
  };

  const loadTools = async () => {
    try {
      console.log('🔧 开始加载工具数据...');
      const toolsData = await getToolsAdmin();
      console.log('✅ 工具数据加载完成:', toolsData.length, '条记录');
      setTools(toolsData);
    } catch (error) {
      console.error('❌ 工具数据加载失败:', error);
    }
  };

  const loadLogs = async () => {
    try {
      console.log('📋 开始加载日志数据...');
      const logsData = await getAdminLogs();
      console.log('✅ 日志数据加载完成:', logsData.length, '条记录');
      setLogs(logsData);
    } catch (error) {
      console.error('❌ 日志数据加载失败:', error);
    }
  };

  const handleReviewSubmission = async (submissionId: string, status: 'approved' | 'rejected', notes?: string) => {
    try {
      await reviewToolSubmission(submissionId, status, notes);
      await loadData(); // 重新加载数据
      alert(`工具提交已${status === 'approved' ? '批准' : '拒绝'}`);
    } catch (error) {
      console.error('Review failed:', error);
      alert('操作失败，请重试');
    }
  };

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

  const tabs = [
    { id: 'overview', label: '概览', icon: BarChart3 },
    { id: 'submissions', label: '工具审核', icon: FileText },
    { id: 'tools', label: '工具管理', icon: Settings },
    { id: 'users', label: '用户管理', icon: Users }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-indigo-600" />
            <h1 className="ml-3 text-2xl font-bold text-gray-900">管理员控制台</h1>
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
                <div className="mt-4">
                  <button
                    onClick={loadData}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    重试
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-lg text-gray-600">加载中...</span>
          </div>
        ) : !error ? (
          <>
            {/* 概览卡片 */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-8">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <Database className="h-6 w-6 text-gray-400" />
                    <div className="ml-4">
                      <dt className="text-sm font-medium text-gray-500 truncate">工具总数</dt>
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
                      <dt className="text-sm font-medium text-gray-500 truncate">用户总数</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.totalUsers}</dd>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <Clock className="h-6 w-6 text-gray-400" />
                    <div className="ml-4">
                      <dt className="text-sm font-medium text-gray-500 truncate">待审核</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.pendingSubmissions}</dd>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 标签页 */}
            <div className="bg-white shadow rounded-lg">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`${
                      activeTab === 'overview'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    <BarChart3 className="h-5 w-5 inline mr-2" />
                    概览
                  </button>
                  <button
                    onClick={() => setActiveTab('submissions')}
                    className={`${
                      activeTab === 'submissions'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    <FileText className="h-5 w-5 inline mr-2" />
                    工具审核 ({stats.pendingSubmissions})
                  </button>
                  <button
                    onClick={() => setActiveTab('users')}
                    className={`${
                      activeTab === 'users'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    <UserCheck className="h-5 w-5 inline mr-2" />
                    用户管理
                  </button>
                </nav>
              </div>

              <div className="p-6">
                {activeTab === 'overview' && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">系统概览</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium text-gray-900">工具统计</h4>
                        <p className="mt-2 text-2xl font-semibold">{stats.totalTools}</p>
                        <p className="text-sm text-gray-500">已收录工具</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium text-gray-900">用户统计</h4>
                        <p className="mt-2 text-2xl font-semibold">{stats.totalUsers}</p>
                        <p className="text-sm text-gray-500">注册用户</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium text-gray-900">待审核</h4>
                        <p className="mt-2 text-2xl font-semibold">{stats.pendingSubmissions}</p>
                        <p className="text-sm text-gray-500">工具提交</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'submissions' && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">工具审核</h3>
                    {submissions.length === 0 ? (
                      <p className="text-gray-500">暂无待审核的工具提交</p>
                    ) : (
                      <div className="space-y-4">
                        {submissions.map((submission) => (
                          <div key={submission.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex justify-between">
                              <div>
                                <h4 className="font-medium text-gray-900">{submission.tool_name}</h4>
                                <p className="text-sm text-gray-500">{submission.tagline}</p>
                                <p className="text-sm text-gray-500 mt-1">
                                  提交时间: {new Date(submission.created_at).toLocaleString()}
                                </p>
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleReviewSubmission(submission.id, 'approved')}
                                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  通过
                                </button>
                                <button
                                  onClick={() => handleReviewSubmission(submission.id, 'rejected')}
                                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none"
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  拒绝
                                </button>
                              </div>
                            </div>
                            {submission.description && (
                              <p className="text-sm text-gray-600 mt-2">{submission.description}</p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-2">
                              {submission.categories.map((category) => (
                                <span key={category} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {category}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'users' && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">用户管理</h3>
                    {users.length === 0 ? (
                      <p className="text-gray-500">暂无用户数据</p>
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
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default AdminDashboard;