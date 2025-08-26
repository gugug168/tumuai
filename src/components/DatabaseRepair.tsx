import React, { useState } from 'react';
import { Wrench, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

const DatabaseRepair = () => {
  const [repairing, setRepairing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const executeDatabaseRepair = async () => {
    setRepairing(true);
    setError(null);
    setResult(null);

    try {
      // 使用 Supabase 会话令牌（避免 401）
      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes?.session?.access_token || '';
      
      // 简化数据库修复 - 直接提示用户联系管理员
      setMessage('数据库修复功能已迁移到服务器端，请联系管理员进行维护。')
      return
    } catch (err) {
      setError(err.message);
      console.error('网络错误:', err);
    } finally {
      setRepairing(false);
    }
  };

  const verifyCategories = async () => {
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes?.session?.access_token || '';
      
      // 直接提示功能已迁移
      setMessage('分类刷新功能已迁移到服务器端，请联系管理员。')
      return

      const data = await response.json();
      return data.data || [];
    } catch (err) {
      console.error('验证失败:', err);
      return [];
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center mb-4">
        <Wrench className="h-6 w-6 text-orange-500 mr-2" />
        <h3 className="text-lg font-medium text-gray-900">数据库修复工具</h3>
      </div>

      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          <p>此工具将修复以下问题：</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>修复分类表slug约束错误</li>
            <li>创建8个土木行业标准分类</li>
            <li>修复工具审核功能</li>
            <li>确保外键关联正常</li>
          </ul>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={executeDatabaseRepair}
            disabled={repairing}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
          >
            {repairing ? (
              <>
                <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                修复中...
              </>
            ) : (
              <>
                <Wrench className="h-4 w-4 mr-2" />
                执行修复
              </>
            )}
          </button>

          <button
            onClick={verifyCategories}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            验证分类
          </button>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">修复失败</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="rounded-md bg-green-50 p-4">
            <div className="flex">
              <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">修复成功</h3>
                <div className="mt-1 text-sm text-green-700">
                  <p>已创建 {result.categoriesCount || 0} 个分类</p>
                  <ul className="mt-1 space-y-0.5">
                    {result.categories?.map(cat => (
                      <li key={cat.id} className="flex items-center">
                        <span 
                          className="w-3 h-3 rounded mr-2" 
                          style={{ backgroundColor: cat.color }}
                        ></span>
                        {cat.name}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabaseRepair;