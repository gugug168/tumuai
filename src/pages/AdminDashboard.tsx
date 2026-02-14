import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Download,
  Ban,
  Check,
  Image
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  checkAdminStatus,
  reviewToolSubmission,
  deleteTool,
  deleteCategory,
  toggleUserStatus,
  deleteUser,
  updateToolStatus,
  batchDeleteTools,
  batchReviewSubmissions,
  exportToolsToCSV,
  exportUsersToCSV,
  refreshToolLogo,
  refreshToolScreenshots,
  batchRefreshToolLogos
} from '../lib/admin';
import type { ToolSubmission } from '../types';
import ToolManagementModal from '../components/ToolManagementModal';
import CategoryManagementModal from '../components/CategoryManagementModal';
import SubmissionDetailModal from '../components/SubmissionDetailModal';
import { useToast, createToastHelpers } from '../components/Toast';

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
  const { showToast } = useToast();
  const toast = createToastHelpers(showToast);

  const SUBMISSIONS_PER_PAGE = 50;
  const [searchParams, setSearchParams] = useSearchParams();

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
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [submissionSearchTerm, setSubmissionSearchTerm] = useState('');
  const [debouncedSubmissionSearchTerm, setDebouncedSubmissionSearchTerm] = useState('');
  const [submissionPage, setSubmissionPage] = useState(1);
  const [submissionPagination, setSubmissionPagination] = useState({ page: 1, perPage: SUBMISSIONS_PER_PAGE, total: 0, totalPages: 1 });
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showToolModal, setShowToolModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState<ToolSubmission | null>(null);
  // 批量选择状态
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<string>>(new Set());
  // Logo 刷新状态
  const [refreshingLogos, setRefreshingLogos] = useState<Set<string>>(new Set());
  const [batchRefreshing, setBatchRefreshing] = useState(false);
  // 截图生成状态
  const [refreshingScreenshots, setRefreshingScreenshots] = useState<Set<string>>(new Set());
  const [batchRefreshingScreenshots, setBatchRefreshingScreenshots] = useState(false);
  // 按需加载状态 - 每个 tab 独立的 loading 状态
  const [loadingStates, setLoadingStates] = useState({
    stats: true,
    submissions: false,
    tools: false,
    categories: false,
    users: false
  });
  // 已加载的 tab 标记 - 使用 useRef 避免触发重渲染导致的无限循环
  const loadedTabsRef = useRef<Set<string>>(new Set(['stats']));
  // 用户分页
  const [userPage, setUserPage] = useState(1);
  const [userPagination, setUserPagination] = useState({ page: 1, perPage: 20, total: 0, totalPages: 1 });
  const navigate = useNavigate();

  // URL 参数同步（tab + submissions 的状态/搜索/页码）
  useEffect(() => {
    const allowedTabs = new Set(['overview', 'submissions', 'tools', 'categories', 'users']);
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && allowedTabs.has(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }

    const wantsSubmissions = (tabFromUrl === 'submissions') || (activeTab === 'submissions');
    if (!wantsSubmissions) return;

    const statusFromUrl = (searchParams.get('subStatus') || '').trim();
    const validStatuses = new Set(['pending', 'unapproved', 'reviewed', 'approved', 'rejected', 'all']);
    if (statusFromUrl && validStatuses.has(statusFromUrl) && statusFromUrl !== filterStatus) {
      setFilterStatus(statusFromUrl);
    }

    const qFromUrl = (searchParams.get('subQ') || '').trim();
    if (qFromUrl !== submissionSearchTerm) {
      setSubmissionSearchTerm(qFromUrl);
    }

    const pageFromUrlRaw = (searchParams.get('subPage') || '').trim();
    const pageFromUrl = pageFromUrlRaw ? parseInt(pageFromUrlRaw, 10) : 1;
    const safePageFromUrl = Number.isFinite(pageFromUrl) && pageFromUrl > 0 ? pageFromUrl : 1;
    if (safePageFromUrl !== submissionPage) {
      setSubmissionPage(safePageFromUrl);
    }
  }, [activeTab, filterStatus, searchParams, submissionPage, submissionSearchTerm]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (next.get('tab') !== activeTab) next.set('tab', activeTab);
    if (activeTab !== 'submissions') {
      if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
      return;
    }
    next.set('subStatus', filterStatus);
    // Use the debounced term to avoid rapid history.replaceState calls while typing.
    if (debouncedSubmissionSearchTerm.trim()) next.set('subQ', debouncedSubmissionSearchTerm.trim());
    else next.delete('subQ');
    if (submissionPage > 1) next.set('subPage', String(submissionPage));
    else next.delete('subPage');

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [activeTab, debouncedSubmissionSearchTerm, filterStatus, submissionPage, searchParams, setSearchParams]);

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
          navigate('/admin-login', { replace: true });
          return;
        }
        
        console.log('✅ 权限验证通过');
        setIsAuthorized(true);
      } catch (error) {
        console.error('❌ 权限验证异常:', error);
        navigate('/admin-login', { replace: true });
      } finally {
        setAuthChecking(false);
      }
    };
    
    checkAuth();
  }, [navigate]);

  // 按需加载统计信息（轻量级，总是加载）
  const loadStats = useCallback(async () => {
    // 防止重复加载
    if (loadedTabsRef.current.has('stats')) return;

    try {
      setError(null);
      setLoadingStates(prev => ({ ...prev, stats: true }));
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error('未登录');

      const response = await fetch('/api/admin-api?action=datasets&sections=stats', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) throw new Error('获取统计失败');

      const data = await response.json();
      if (data.stats) {
        setStats(prevStats => ({ ...prevStats, ...data.stats }));
      }
      loadedTabsRef.current = new Set(loadedTabsRef.current).add('stats');
    } catch (error) {
      console.error('加载统计失败:', error);
      const message = error instanceof Error ? error.message : '加载统计失败';
      setError(message);
    } finally {
      setLoadingStates(prev => ({ ...prev, stats: false }));
    }
  }, []);

  // 按需加载提交列表
  const loadSubmissions = useCallback(async () => {
    try {
      setError(null);
      setLoadingStates(prev => ({ ...prev, submissions: true }));
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error('未登录');

      const params = new URLSearchParams();
      params.set('sections', 'submissions');
      params.set('page', String(submissionPage));
      params.set('limit', String(SUBMISSIONS_PER_PAGE));
      params.set('submissionStatus', filterStatus);
      if (debouncedSubmissionSearchTerm.trim()) params.set('q', debouncedSubmissionSearchTerm.trim());

      const response = await fetch(`/api/admin-api?action=datasets&${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) throw new Error('获取提交失败');

      const data = await response.json();
      setSubmissions((data.submissions || []) as ToolSubmission[]);
      setSubmissionPagination(data.submissionsPagination || { page: submissionPage, perPage: SUBMISSIONS_PER_PAGE, total: (data.submissions || []).length, totalPages: 1 });
      setSelectedSubmissions(new Set());
      loadedTabsRef.current = new Set(loadedTabsRef.current).add('submissions');
    } catch (error) {
      console.error('加载提交失败:', error);
      const message = error instanceof Error ? error.message : '加载提交失败';
      setError(message);
    } finally {
      setLoadingStates(prev => ({ ...prev, submissions: false }));
    }
  }, [SUBMISSIONS_PER_PAGE, debouncedSubmissionSearchTerm, filterStatus, submissionPage]);

  // 按需加载工具列表
  const loadTools = useCallback(async () => {
    try {
      setError(null);
      setLoadingStates(prev => ({ ...prev, tools: true }));
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error('未登录');

      const response = await fetch('/api/admin-api?action=datasets&sections=tools', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) throw new Error('获取工具失败');

      const data = await response.json();
      setTools(data.tools || []);
      loadedTabsRef.current = new Set(loadedTabsRef.current).add('tools');
    } catch (error) {
      console.error('加载工具失败:', error);
      const message = error instanceof Error ? error.message : '加载工具失败';
      setError(message);
    } finally {
      setLoadingStates(prev => ({ ...prev, tools: false }));
    }
  }, []);

  // 按需加载分类列表
  const loadCategories = useCallback(async () => {
    try {
      setError(null);
      setLoadingStates(prev => ({ ...prev, categories: true }));
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error('未登录');

      const response = await fetch('/api/admin-api?action=datasets&sections=categories', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) throw new Error('获取分类失败');

      const data = await response.json();
      setCategories(data.categories || []);
      loadedTabsRef.current = new Set(loadedTabsRef.current).add('categories');
    } catch (error) {
      console.error('加载分类失败:', error);
      const message = error instanceof Error ? error.message : '加载分类失败';
      setError(message);
    } finally {
      setLoadingStates(prev => ({ ...prev, categories: false }));
    }
  }, []);

  // 按需加载用户列表（带分页）
  const loadUsers = useCallback(async (page = 1) => {
    try {
      setError(null);
      setLoadingStates(prev => ({ ...prev, users: true }));
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error('未登录');

      const response = await fetch(`/api/admin-api?action=users&page=${page}&perPage=20`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) throw new Error('获取用户失败');

      const data = await response.json();
      setUsers(data.users || []);
      setUserPagination(data.pagination);
      loadedTabsRef.current = new Set(loadedTabsRef.current).add('users');
    } catch (error) {
      console.error('加载用户失败:', error);
      const message = error instanceof Error ? error.message : '加载用户失败';
      setError(message);
    } finally {
      setLoadingStates(prev => ({ ...prev, users: false }));
    }
  }, []);

  // 获取访问令牌辅助函数
  async function getAccessToken() {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || null;
    if (!token || token === 'null' || token === 'undefined') return null;
    return token;
  }

  // 监听 activeTab 变化，按需加载数据
  useEffect(() => {
    if (!isAuthorized) return;

    // 统计信息只加载一次
    if (!loadedTabsRef.current.has('stats')) {
      loadStats();
    }

    // 根据当前 tab 加载对应数据
    if (activeTab === 'tools' && !loadedTabsRef.current.has('tools')) {
      loadTools();
    } else if (activeTab === 'categories' && !loadedTabsRef.current.has('categories')) {
      loadCategories();
    } else if (activeTab === 'users' && !loadedTabsRef.current.has('users')) {
      loadUsers(1);
    }
  }, [activeTab, isAuthorized, loadStats, loadTools, loadCategories, loadUsers]);

  // 提交搜索 - debounce
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSubmissionSearchTerm(submissionSearchTerm);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [submissionSearchTerm]);

  // 工具提交列表：随页码/筛选/搜索变化加载
  useEffect(() => {
    if (!isAuthorized) return;
    if (activeTab !== 'submissions') return;
    loadSubmissions();
  }, [activeTab, isAuthorized, loadSubmissions]);

  // 手动刷新当前 tab 的数据
  const refreshCurrentTab = useCallback(() => {
    switch (activeTab) {
      case 'overview':
        loadStats();
        break;
      case 'submissions':
        loadedTabsRef.current.delete('submissions');
        loadSubmissions();
        break;
      case 'tools':
        loadedTabsRef.current.delete('tools');
        loadTools();
        break;
      case 'categories':
        loadedTabsRef.current.delete('categories');
        loadCategories();
        break;
      case 'users':
        loadedTabsRef.current.delete('users');
        loadUsers(userPage);
        break;
    }
  }, [activeTab, loadStats, loadSubmissions, loadTools, loadCategories, loadUsers, userPage]);

  const handleUserPageChange = useCallback((nextPage: number) => {
    if (nextPage === userPage) return;
    if (!Number.isFinite(nextPage) || nextPage < 1) return;
    if (userPagination.totalPages && nextPage > userPagination.totalPages) return;

    setUserPage(nextPage);
    loadUsers(nextPage);
  }, [loadUsers, userPage, userPagination.totalPages]);

  const handleReviewSubmission = async (submissionId: string, status: 'approved' | 'rejected', notes?: string) => {
    try {
      await reviewToolSubmission(submissionId, status, notes);
      // 增量更新：从列表中移除已处理的提交
      setSubmissions(prev => prev.filter(s => s.id !== submissionId));
      // 直接更新统计：减少待审核数量
      setStats(prev => ({
        ...prev,
        pendingSubmissions: Math.max(0, prev.pendingSubmissions - 1)
      }));
      setShowSubmissionModal(null);
    } catch (error) {
      console.error('Review failed:', error);
      toast.error('操作失败', '请重试');
    }
  };

  const handleDeleteTool = async (toolId: string) => {
    if (!confirm('确定删除该工具？此操作不可撤销。')) return;

    try {
      await deleteTool(toolId);
      // 增量更新：从列表中移除已删除的工具
      setTools(prev => prev.filter(t => t.id !== toolId));
      // 直接更新统计：减少工具数量
      setStats(prev => ({
        ...prev,
        totalTools: Math.max(0, prev.totalTools - 1)
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      console.error('Delete tool failed:', error);
      toast.error('删除失败', `原因: ${message}`);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('确定删除该分类？相关工具将失去此分类。')) return;

    try {
      await deleteCategory(categoryId);
      // 增量更新：从列表中移除已删除的分类
      setCategories(prev => prev.filter(c => c.id !== categoryId));
    } catch (error) {
      console.error('Delete category failed:', error);
      toast.error('删除失败', '删除分类失败，请重试');
    }
  };

  // 用户管理函数
  const handleToggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      await toggleUserStatus(userId, isActive);
      // 增量更新用户状态
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, is_active: isActive } : u
      ));
    } catch (error) {
      console.error('Toggle user status failed:', error);
      toast.error('操作失败', '请重试');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('确定删除该用户？此操作不可撤销。')) return;

    try {
      await deleteUser(userId);
      // 增量更新：从列表中移除已删除的用户
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Delete user failed:', error);
      toast.error('删除失败', '删除用户失败，请重试');
    }
  };

  // 工具状态管理
  const handleUpdateToolStatus = async (toolId: string, status: 'draft' | 'published' | 'archived') => {
    try {
      await updateToolStatus(toolId, status);
      // 增量更新工具状态
      setTools(prev => prev.map(t =>
        t.id === toolId ? { ...t, status } : t
      ));
    } catch (error) {
      console.error('Update tool status failed:', error);
      toast.error('更新失败', '更新工具状态失败，请重试');
    }
  };

  // 批量删除工具
  const handleBatchDeleteTools = async () => {
    if (selectedTools.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedTools.size} 个工具？此操作不可撤销。`)) return;

    try {
      const deletedCount = selectedTools.size;
      const result = await batchDeleteTools(Array.from(selectedTools));
      toast.success('批量删除完成', `成功 ${result.success} 个，失败 ${result.failed} 个`);
      // 增量更新：从列表中移除已删除的工具
      setTools(prev => prev.filter(t => !selectedTools.has(t.id)));
      setSelectedTools(new Set());
      // 直接更新统计：减少工具数量
      setStats(prev => ({
        ...prev,
        totalTools: Math.max(0, prev.totalTools - deletedCount)
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      console.error('Batch delete tools failed:', error);
      toast.error('批量删除失败', `原因: ${message}`);
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
      const processedCount = selectedSubmissions.size;
      const result = await batchReviewSubmissions(Array.from(selectedSubmissions), status);
      toast.success('批量审核完成', `成功 ${result.success} 个，失败 ${result.failed} 个`);
      // 增量更新：从列表中移除已处理的提交
      setSubmissions(prev => prev.filter(s => !selectedSubmissions.has(s.id)));
      setSelectedSubmissions(new Set());
      // 直接更新统计：减少待审核数量
      setStats(prev => ({
        ...prev,
        pendingSubmissions: Math.max(0, prev.pendingSubmissions - processedCount)
      }));
    } catch (error) {
      console.error('Batch review failed:', error);
      toast.error('批量审核失败', '请重试');
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
      toast.error('导出失败', '导出工具列表失败，请重试');
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
      toast.error('导出失败', '导出用户列表失败，请重试');
    }
  };

  // ==================== Logo 刷新功能 ====================

  // 刷新单个工具的 Logo
  const handleRefreshSingleLogo = async (toolId: string, websiteUrl: string) => {
    setRefreshingLogos(prev => new Set(prev).add(toolId));

    try {
      const result = await refreshToolLogo(toolId, websiteUrl);

      if (result.success) {
        toast.success('图标已更新', `成功获取 ${result.logoUrl}`);
        // 增量更新：更新工具的 logo_url
        setTools(prev => prev.map(t =>
          t.id === toolId ? { ...t, logo_url: result.logoUrl } : t
        ));
      } else {
        toast.error('刷新失败', result.error || '无法获取网站图标');
      }
    } catch (error) {
      console.error('Refresh logo failed:', error);
      toast.error('刷新失败', '请稍后重试');
    } finally {
      setRefreshingLogos(prev => {
        const newSet = new Set(prev);
        newSet.delete(toolId);
        return newSet;
      });
    }
  };

  // 生成/刷新单个工具的官网截图（存入 Supabase Storage）
  const handleRefreshSingleScreenshots = async (toolId: string) => {
    setRefreshingScreenshots(prev => new Set(prev).add(toolId));

    try {
      const result = await refreshToolScreenshots(toolId);
      if (result.success) {
        toast.success('截图已生成', `生成 ${result.screenshots?.length || 0} 张`)
      } else {
        toast.error('生成失败', result.error || '无法生成截图')
      }
    } catch (error) {
      console.error('Refresh screenshots failed:', error);
      toast.error('生成失败', '请稍后重试');
    } finally {
      setRefreshingScreenshots(prev => {
        const newSet = new Set(prev);
        newSet.delete(toolId);
        return newSet;
      });
    }
  };

  // 批量刷新 Logo
  const handleBatchRefreshLogos = async () => {
    const toolsToRefresh = selectedTools.size > 0
      ? Array.from(selectedTools)
      : tools.filter(t => !t.logo_url || t.logo_url.includes('google') || t.logo_url.includes('placeholder')).map(t => t.id);

    if (toolsToRefresh.length === 0) {
      toast.info('提示', '请先选择需要刷新图标的工具');
      return;
    }

    if (!confirm(`确定刷新 ${toolsToRefresh.length} 个工具的图标？`)) return;

    setBatchRefreshing(true);

    try {
      const result = await batchRefreshToolLogos(toolsToRefresh);
      toast.success(
        '批量刷新完成',
        `成功 ${result.success} 个，失败 ${result.failed} 个`
      );
      setSelectedTools(new Set());
      // 批量刷新后，图标已经通过 API 更新到数据库
      // 用户可以手动点击"刷新数据"按钮查看最新 logo，避免自动刷新影响体验
    } catch (error) {
      console.error('Batch refresh logos failed:', error);
      toast.error('批量刷新失败', '请稍后重试');
    } finally {
      setBatchRefreshing(false);
    }
  };

  // 批量生成截图（对选择的工具逐个执行，避免单次函数超时）
  const handleBatchRefreshScreenshots = async () => {
    const toolsToRefresh = selectedTools.size > 0 ? Array.from(selectedTools) : [];

    if (toolsToRefresh.length === 0) {
      toast.info('提示', '请先选择需要生成截图的工具');
      return;
    }

    if (!confirm(`确定为 ${toolsToRefresh.length} 个工具生成官网截图？`)) return;

    setBatchRefreshingScreenshots(true);

    try {
      let success = 0;
      let failed = 0;

      for (const toolId of toolsToRefresh) {
        try {
          const result = await refreshToolScreenshots(toolId);
          if (result.success) success += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
      }

      toast.success('批量生成完成', `成功 ${success} 个，失败 ${failed} 个`);
      setSelectedTools(new Set());
    } finally {
      setBatchRefreshingScreenshots(false);
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
              onClick={refreshCurrentTab}
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
          <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Database className="h-5 w-5 text-blue-600" />
                </div>
                <div className="ml-4">
                  <dt className="text-sm font-medium text-gray-500">工具总数</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.totalTools}</dd>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div className="ml-4">
                  <dt className="text-sm font-medium text-gray-500">用户总数</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.totalUsers}</dd>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div className="ml-4">
                  <dt className="text-sm font-medium text-gray-500">待审核</dt>
                  <dd className="mt-1 text-3xl font-semibold text-orange-600">{stats.pendingSubmissions}</dd>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Tag className="h-5 w-5 text-purple-600" />
                </div>
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
                      value={submissionSearchTerm}
                      onChange={(e) => { setSubmissionSearchTerm(e.target.value); setSubmissionPage(1); }}
                      className="block w-64 max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      data-testid="submissions-search-input"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">状态</span>
                      <select
                        value={filterStatus}
                        onChange={(e) => { setFilterStatus(e.target.value); setSubmissionPage(1); setSelectedSubmissions(new Set()); }}
                        className="block min-w-[120px] rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        data-testid="submissions-status-filter"
                      >
                        <option value="pending">待审核</option>
                        <option value="unapproved">未通过</option>
                        <option value="reviewed">已审批</option>
                        <option value="approved">已通过</option>
                        <option value="rejected">已拒绝</option>
                        <option value="all">全部</option>
                      </select>
                      {filterStatus !== 'pending' && (
                        <button
                          type="button"
                          onClick={() => { setFilterStatus('pending'); setSubmissionPage(1); setSelectedSubmissions(new Set()); }}
                          className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700"
                        >
                          只看待审核
                        </button>
                      )}
                    </div>
                    <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
                      <span data-testid="submissions-pagination-info">
                        共 {submissionPagination.total} 条，第 {submissionPagination.page}/{submissionPagination.totalPages} 页
                      </span>
                      <button
                        type="button"
                        onClick={() => { setSelectedSubmissions(new Set()); setSubmissionPage(p => Math.max(1, p - 1)); }}
                        disabled={submissionPagination.page <= 1 || loadingStates.submissions}
                        className="px-2 py-1 rounded border border-gray-300 bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        data-testid="submissions-prev-page"
                      >
                        上一页
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSelectedSubmissions(new Set()); setSubmissionPage(p => Math.min(submissionPagination.totalPages, p + 1)); }}
                        disabled={submissionPagination.page >= submissionPagination.totalPages || loadingStates.submissions}
                        className="px-2 py-1 rounded border border-gray-300 bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        data-testid="submissions-next-page"
                      >
                        下一页
                      </button>
                    </div>
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
                {loadingStates.submissions ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                    <p className="text-gray-600">加载提交列表...</p>
                  </div>
                ) : submissions.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">暂无符合条件的工具提交</p>
                ) : (
                  <div className="space-y-4">
                    {/* 全选/取消全选 */}
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={selectedSubmissions.size === submissions.length && submissions.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSubmissions(new Set(submissions.map(s => s.id)));
                          } else {
                            setSelectedSubmissions(new Set());
                          }
                        }}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>全选 ({submissions.length})</span>
                    </div>
                    {submissions.map((submission) => (
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
                              {submission.already_in_tools && submission.existing_tools?.length ? (
                                <div className="mt-2 text-xs text-amber-700">
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 mr-2"
                                    title={submission.existing_tools.map(t => `${t.name} (${t.match_type === 'exact' ? '同网址' : '同域名'})`).join(' / ')}
                                  >
                                    可能已入库
                                  </span>
                                  <a
                                    href={`/tools/${submission.existing_tools[0].id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline hover:text-amber-900"
                                  >
                                    查看：{submission.existing_tools[0].name}
                                  </a>
                                </div>
                              ) : null}
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
                              {submission.already_in_tools && submission.existing_tools?.length ? (
                                <button
                                  onClick={() => {
                                    const t = submission.existing_tools?.[0]
                                    const note = t
                                      ? `疑似重复入库：工具库已存在 ${t.name}（${t.id}）`
                                      : '疑似重复入库：工具库已存在同域名工具'
                                    handleReviewSubmission(submission.id, 'rejected', note)
                                  }}
                                  className="inline-flex items-center px-3 py-1.5 border border-amber-300 text-sm leading-4 font-medium rounded-md text-amber-800 bg-amber-50 hover:bg-amber-100 focus:outline-none"
                                  data-testid={`reject-duplicate-submission-${submission.id}`}
                                  title="发现工具库可能已存在同一官网的工具，可直接按重复拒绝"
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  重复拒绝
                                </button>
                              ) : null}
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
                          onClick={handleBatchRefreshLogos}
                          disabled={batchRefreshing}
                          className="inline-flex items-center px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RefreshCw className={`h-4 w-4 mr-1 ${batchRefreshing ? 'animate-spin' : ''}`} />
                          批量刷新图标 ({selectedTools.size})
                        </button>
                        <button
                          onClick={handleBatchRefreshScreenshots}
                          disabled={batchRefreshingScreenshots}
                          className="inline-flex items-center px-3 py-2 rounded-md bg-slate-700 text-white text-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="为选中的工具生成官网截图（存入 Supabase Storage）"
                        >
                          <Image className={`h-4 w-4 mr-1 ${batchRefreshingScreenshots ? 'animate-spin' : ''}`} />
                          批量生成截图 ({selectedTools.size})
                        </button>
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
                {loadingStates.tools ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                    <p className="text-gray-600">加载工具列表...</p>
                  </div>
                ) : tools.length === 0 ? (
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
                                    onChange={(e) => handleUpdateToolStatus(tool.id, e.target.value as 'draft' | 'published' | 'archived')}
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
                                title="编辑"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleRefreshSingleLogo(tool.id, tool.website_url)}
                                disabled={refreshingLogos.has(tool.id)}
                                className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="刷新图标"
                              >
                                <RefreshCw className={`h-4 w-4 ${refreshingLogos.has(tool.id) ? 'animate-spin' : ''}`} />
                              </button>
                              <button
                                onClick={() => handleRefreshSingleScreenshots(tool.id)}
                                disabled={refreshingScreenshots.has(tool.id)}
                                className="text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="生成官网截图（存入 Supabase Storage）"
                              >
                                <Image className={`h-4 w-4 ${refreshingScreenshots.has(tool.id) ? 'animate-spin' : ''}`} />
                              </button>
                              <button
                                onClick={() => handleDeleteTool(tool.id)}
                                className="text-red-600 hover:text-red-900"
                                title="删除"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <a
                                href={tool.website_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-600 hover:text-gray-900"
                                title="访问网站"
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
                {loadingStates.categories ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                    <p className="text-gray-600">加载分类列表...</p>
                  </div>
                ) : categories.length === 0 ? (
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
                {loadingStates.users ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                    <p className="text-gray-600">加载用户列表...</p>
                  </div>
                ) : users.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">暂无用户数据</p>
                ) : (
                  <div className="space-y-4">
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

                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <div>
                        第 {userPagination.page} / {userPagination.totalPages} 页，共 {userPagination.total} 用户
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUserPageChange(userPagination.page - 1)}
                          disabled={userPagination.page <= 1 || loadingStates.users}
                          className="px-3 py-1 rounded border bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          上一页
                        </button>
                        <button
                          onClick={() => handleUserPageChange(userPagination.page + 1)}
                          disabled={userPagination.page >= userPagination.totalPages || loadingStates.users}
                          className="px-3 py-1 rounded border bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          下一页
                        </button>
                      </div>
                    </div>
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
        onSave={() => { refreshCurrentTab() }}
        tool={editingTool || undefined}
        categories={categories.map(c => ({ id: c.id, name: c.name }))}
        mode={editingTool ? 'edit' : 'create'}
      />
      {/* 分类创建/编辑弹窗 */}
      <CategoryManagementModal
        isOpen={showCategoryModal || !!editingCategory}
        onClose={() => { setShowCategoryModal(false); setEditingCategory(null) }}
        onSave={() => { refreshCurrentTab() }}
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
