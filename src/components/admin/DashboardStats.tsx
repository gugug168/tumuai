/**
 * DashboardStats 组件 - 管理后台统计卡片
 *
 * 从 AdminDashboard 提取的统计卡片显示逻辑
 */

import React from 'react';
import { Users, Database, Clock, Tag } from 'lucide-react';

interface DashboardStatsProps {
  stats: {
    totalTools: number;
    totalUsers: number;
    pendingSubmissions: number;
    totalCategories: number;
  };
}

const CARD_CONFIG = [
  { key: 'totalTools', label: '工具总数', icon: Database, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
  { key: 'totalUsers', label: '用户总数', icon: Users, bgColor: 'bg-green-100', iconColor: 'text-green-600' },
  { key: 'pendingSubmissions', label: '待审核', icon: Clock, bgColor: 'bg-orange-100', iconColor: 'text-orange-600', valueColor: 'text-orange-600' },
  { key: 'totalCategories', label: '分类总数', icon: Tag, bgColor: 'bg-purple-100', iconColor: 'text-purple-600', valueColor: 'text-purple-600' }
] as const;

const DashboardStats: React.FC<DashboardStatsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      {CARD_CONFIG.map(({ key, label, icon: Icon, bgColor, iconColor, valueColor }) => {
        const value = stats[key as keyof typeof stats];

        return (
          <div key={key} className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className={`p-2 ${bgColor} rounded-lg`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                <div className="ml-4">
                  <dt className="text-sm font-medium text-gray-500">{label}</dt>
                  <dd className={`mt-1 text-3xl font-semibold ${valueColor || 'text-gray-900'}`}>{value}</dd>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DashboardStats;
