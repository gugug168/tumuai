import React from 'react';
import { Calendar, Sparkles, Heart, Users, Chrome, Smartphone } from 'lucide-react';

const quickFilters = [
  { id: 'today', label: '今天', icon: Calendar, color: 'bg-purple-600' },
  { id: 'latest', label: '最新AI', icon: Sparkles, color: 'bg-blue-600' },
  { id: 'favorites', label: '最多收藏', icon: Heart, color: 'bg-red-500' },
  { id: 'popular', label: '最多人使用', icon: Users, color: 'bg-green-600' },
  { id: 'browser', label: '浏览器插件', icon: Chrome, color: 'bg-yellow-600' },
  { id: 'apps', label: 'Apps', icon: Smartphone, color: 'bg-indigo-600' }
];

const QuickFilters = () => {
  return (
    <section className="py-8 bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap justify-center gap-4">
          {quickFilters.map((filter) => {
            const IconComponent = filter.icon;
            return (
              <button
                key={filter.id}
                className={`${filter.color} text-white px-6 py-3 rounded-full font-medium hover:opacity-90 transition-opacity flex items-center space-x-2`}
              >
                <IconComponent className="w-4 h-4" />
                <span>{filter.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default QuickFilters;