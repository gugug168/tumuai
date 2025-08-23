import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, AlertCircle, Settings } from 'lucide-react';

const DiagnosticPage = () => {
  const [diagnostics, setDiagnostics] = useState({
    supabaseConnection: { status: 'checking', message: '检查中...' },
    envVariables: { status: 'checking', message: '检查中...' },
    tablesExist: { status: 'checking', message: '检查中...' },
    rlsPolicies: { status: 'checking', message: '检查中...' },
    basicQueries: { status: 'checking', message: '检查中...' }
  });

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    // 1. 检查环境变量
    const checkEnvVariables = () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        return { status: 'error', message: '缺少Supabase环境变量' };
      }
      
      if (!supabaseUrl.includes('supabase.co')) {
        return { status: 'error', message: 'Supabase URL格式不正确' };
      }
      
      return { status: 'success', message: '环境变量配置正确' };
    };

    // 2. 检查Supabase连接
    const checkSupabaseConnection = async () => {
      try {
        const { count, error } = await supabase.from('tools').select('id', { count: 'exact', head: true });
        if (error) throw error;
        return { status: 'success', message: `连接成功，工具表约 ${count || 0} 条记录` };
      } catch (error: any) {
        return { status: 'error', message: `连接失败: ${error.message}` };
      }
    };

    // 3. 检查必要的表是否存在
    const checkTablesExist = async () => {
      const tables = ['tools', 'tool_submissions', 'user_profiles', 'admin_users'];
      const results = [];
      
      for (const table of tables) {
        try {
          const { error } = await supabase.from(table).select('*').limit(1);
          if (error) {
            results.push(`${table}: ❌ ${error.message}`);
          } else {
            results.push(`${table}: ✅`);
          }
        } catch (error) {
          results.push(`${table}: ❌ ${error.message}`);
        }
      }
      
      const hasErrors = results.some(r => r.includes('❌'));
      return {
        status: hasErrors ? 'warning' : 'success',
        message: results.join('\n')
      };
    };

    // 4. 检查RLS策略
    const checkRLSPolicies = async () => {
      try {
        // 尝试插入一条测试数据到tool_submissions
        const { error } = await supabase
          .from('tool_submissions')
          .insert([{
            tool_name: 'Test Tool',
            tagline: 'Test',
            website_url: 'https://test.com',
            pricing: 'Free'
          }]);
        
        if (error) {
          return { status: 'error', message: `RLS策略阻止插入: ${error.message}` };
        }
        
        // 删除测试数据
        await supabase
          .from('tool_submissions')
          .delete()
          .eq('tool_name', 'Test Tool');
        
        return { status: 'success', message: 'RLS策略配置正确' };
      } catch (error) {
        return { status: 'error', message: `RLS检查失败: ${error.message}` };
      }
    };

    // 5. 检查基本查询
    const checkBasicQueries = async () => {
      try {
        const { data: tools, error: toolsError } = await supabase
          .from('tools')
          .select('*')
          .limit(5);
        
        if (toolsError) throw toolsError;
        
        const { data: submissions, error: submissionsError } = await supabase
          .from('tool_submissions')
          .select('*')
          .limit(5);
        
        if (submissionsError) throw submissionsError;
        
        return { 
          status: 'success', 
          message: `查询成功 - 工具: ${tools?.length || 0}, 提交: ${submissions?.length || 0}` 
        };
      } catch (error) {
        return { status: 'error', message: `查询失败: ${error.message}` };
      }
    };

    // 运行所有诊断
    setDiagnostics(prev => ({ ...prev, envVariables: checkEnvVariables() }));
    
    const supabaseResult = await checkSupabaseConnection();
    setDiagnostics(prev => ({ ...prev, supabaseConnection: supabaseResult }));
    
    if (supabaseResult.status === 'success') {
      const tablesResult = await checkTablesExist();
      setDiagnostics(prev => ({ ...prev, tablesExist: tablesResult }));
      
      const rlsResult = await checkRLSPolicies();
      setDiagnostics(prev => ({ ...prev, rlsPolicies: rlsResult }));
      
      const queriesResult = await checkBasicQueries();
      setDiagnostics(prev => ({ ...prev, basicQueries: queriesResult }));
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <Settings className="w-6 h-6 mr-3 text-blue-600" />
            系统诊断
          </h1>
          
          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              {getStatusIcon(diagnostics.envVariables.status)}
              <div>
                <h3 className="font-semibold text-gray-900">环境变量检查</h3>
                <p className="text-gray-600 whitespace-pre-line">{diagnostics.envVariables.message}</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              {getStatusIcon(diagnostics.supabaseConnection.status)}
              <div>
                <h3 className="font-semibold text-gray-900">Supabase连接</h3>
                <p className="text-gray-600 whitespace-pre-line">{diagnostics.supabaseConnection.message}</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              {getStatusIcon(diagnostics.tablesExist.status)}
              <div>
                <h3 className="font-semibold text-gray-900">数据库表检查</h3>
                <p className="text-gray-600 whitespace-pre-line">{diagnostics.tablesExist.message}</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              {getStatusIcon(diagnostics.rlsPolicies.status)}
              <div>
                <h3 className="font-semibold text-gray-900">RLS策略检查</h3>
                <p className="text-gray-600 whitespace-pre-line">{diagnostics.rlsPolicies.message}</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              {getStatusIcon(diagnostics.basicQueries.status)}
              <div>
                <h3 className="font-semibold text-gray-900">基本查询测试</h3>
                <p className="text-gray-600 whitespace-pre-line">{diagnostics.basicQueries.message}</p>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={runDiagnostics}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              重新检查
            </button>
          </div>
          
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">环境信息</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Supabase URL: {import.meta.env.VITE_SUPABASE_URL || '未配置'}</p>
              <p>Supabase Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '已配置' : '未配置'}</p>
              <p>当前域名: {window.location.origin}</p>
              <p>用户代理: {navigator.userAgent}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticPage;