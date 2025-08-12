import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Settings, 
  BarChart3, 
  FileText, 
  Shield, 
  Activity,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Database,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  checkAdminStatus, 
  getSystemStats, 
  getToolSubmissions, 
  reviewToolSubmission,
  getUsers,
  getToolsAdmin,
  getAdminLogs,
  initializeAdmin,
  type AdminUser,
  type ToolSubmission
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
  const [users, setUsers] = useState([]);
  const [tools, setTools] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔄 开始加载管理数据...');
      
      // 检查管理员权限
      const adminStatus = await checkAdminStatus();
      console.log('👤 管理员状态检查:', adminStatus);
      
      if (!adminStatus) {
        console.error('❌ 用户不是管理员');
        alert('❌ 您没有管理员权限，无法访问此页面');
        return;
      }
      
      console.log('✅ 管理员权限验证通过');
      
      // 逐步加载数据
      console.log('📊 开始加载统计数据...');
      const statsData = await getSystemStats();
      console.log('✅ 统计数据加载完成:', statsData);
      setStats(statsData);
      
      console.log('📝 开始加载提交数据...');
      const submissionsData = await getToolSubmissions();
      console.log('✅ 提交数据加载完成:', submissionsData.length, '条记录');
      setSubmissions(submissionsData);
      
      console.log('👥 开始加载用户数据...');
      const usersData = await getUsers();
      console.log('✅ 用户数据加载完成:', usersData.length, '条记录');
      setUsers(usersData);
      
      console.log('🔧 开始加载工具数据...');
      const toolsData = await getToolsAdmin();
      console.log('✅ 工具数据加载完成:', toolsData.length, '条记录');
      setTools(toolsData);
      
      console.log('📋 开始加载日志数据...');
      const logsData = await getAdminLogs();
      console.log('✅ 日志数据加载完成:', logsData.length, '条记录');
      setLogs(logsData);

      console.log('🎉 所有管理数据加载完成');
    } catch (error) {
      console.error('❌ 管理数据加载失败:', error);
      alert(`❌ 管理数据加载失败: ${error.message || '请检查网络连接或联系技术支持'}`);
    } finally {
      setLoading(false);
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
    { id: 'users', label: '用户管理', icon: Users },
    { id: 'logs', label: '操作日志', icon: Activity }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Shield className="w-8 h-8 mr-3 text-blue-600" />
                管理员后台
              </h1>
              <p className="text-gray-600 mt-2">系统管理控制台</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-8">
              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-8">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">系统概览</h3>
                
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <div className="flex items-center">
                      <Database className="w-8 h-8 text-blue-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-blue-600">总工具数</p>
                        <p className="text-2xl font-bold text-blue-900">{stats.totalTools}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 p-6 rounded-lg">
                    <div className="flex items-center">
                      <UserCheck className="w-8 h-8 text-green-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-green-600">注册用户</p>
                        <p className="text-2xl font-bold text-green-900">{stats.totalUsers}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-yellow-50 p-6 rounded-lg">
                    <div className="flex items-center">
                      <Clock className="w-8 h-8 text-yellow-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-yellow-600">待审核</p>
                        <p className="text-2xl font-bold text-yellow-900">{stats.pendingSubmissions}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-purple-50 p-6 rounded-lg">
                    <div className="flex items-center">
                      <TrendingUp className="w-8 h-8 text-purple-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-purple-600">总评价</p>
                        <p className="text-2xl font-bold text-purple-900">{stats.totalReviews}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-red-50 p-6 rounded-lg">
                    <div className="flex items-center">
                      <Eye className="w-8 h-8 text-red-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-red-600">总收藏</p>
                        <p className="text-2xl font-bold text-red-900">{stats.totalFavorites}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h4 className="text-md font-semibold text-gray-900 mb-4">最近活动</h4>
                  <div className="space-y-3">
                    {logs.slice(0, 5).map((log: any) => (
                      <div key={log.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                          {log.action} - {log.target_type}
                        </span>
                        <span className="text-gray-400">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Submissions Tab */}
            {activeTab === 'submissions' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">工具提交审核</h3>
                
                <div className="space-y-4">
                  {submissions.map((submission) => (
                    <div key={submission.id} className="bg-gray-50 p-6 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-gray-900">{submission.tool_name}</h4>
                          <p className="text-gray-600 mb-2">{submission.tagline}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>网址: {submission.website_url}</span>
                            <span>定价: {submission.pricing}</span>
                            <span>提交时间: {new Date(submission.created_at).toLocaleDateString()}</span>
                          </div>
                          {submission.submitter_email && (
                            <p className="text-sm text-gray-500 mt-1">
                              提交者: {submission.submitter_email}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            submission.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            submission.status === 'approved' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {submission.status === 'pending' ? '待审核' :
                             submission.status === 'approved' ? '已批准' : '已拒绝'}
                          </span>
                          
                          {submission.status === 'pending' && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleReviewSubmission(submission.id, 'approved')}
                                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors flex items-center"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                批准
                              </button>
                              <button
                                onClick={() => handleReviewSubmission(submission.id, 'rejected', '不符合收录标准')}
                                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors flex items-center"
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                拒绝
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tools Tab */}
            {activeTab === 'tools' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">工具管理</h3>
                <div className="bg-gray-50 p-6 rounded-lg text-center">
                  <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">工具管理功能开发中...</p>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">用户管理</h3>
                <div className="bg-gray-50 p-6 rounded-lg text-center">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">用户管理功能开发中...</p>
                </div>
              </div>
            )}

            {/* Logs Tab */}
            {activeTab === 'logs' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">操作日志</h3>
                <div className="space-y-2">
                  {logs.map((log: any) => (
                    <div key={log.id} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-900">{log.action}</span>
                          <span className="text-gray-600 ml-2">- {log.target_type}</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;