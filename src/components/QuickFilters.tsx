import React from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();

  const handleFilterClick = (filterId: string) => {
    // 统一使用URLSearchParams对象构建查询参数
    const queryParams = new URLSearchParams();
    
    switch (filterId) {
      case 'today':
        queryParams.set('sortBy', 'date_added');
        queryParams.set('sortOrder', 'desc');
        break;
      case 'latest':
        queryParams.set('category', 'AI结构设计');
        queryParams.set('sortBy', 'date_added');
        queryParams.set('sortOrder', 'desc');
        break;
      case 'favorites':
        queryParams.set('sortBy', 'upvotes');
        queryParams.set('sortOrder', 'desc');
        break;
      case 'popular':
        queryParams.set('sortBy', 'views');
        queryParams.set('sortOrder', 'desc');
        break;
      case 'browser':
        queryParams.set('search', '插件');
        queryParams.set('sortBy', 'upvotes');
        queryParams.set('sortOrder', 'desc');
        break;
      case 'apps':
        queryParams.set('search', '应用');
        queryParams.set('sortBy', 'upvotes');
        queryParams.set('sortOrder', 'desc');
        break;
      default:
        // 无参数，直接跳转
        navigate('/tools');
        return;
    }
    
    navigate(`/tools?${queryParams.toString()}`);
  };

  return (
    <section className="py-8 bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap justify-center gap-4">
          {quickFilters.map((filter) => {
            const IconComponent = filter.icon;
            return (
              <button
                key={filter.id}
                onClick={() => handleFilterClick(filter.id)}
                className={`${filter.color} text-white px-6 py-3 rounded-full font-medium hover:opacity-90 transition-opacity flex items-center space-x-2 hover:scale-105 transform transition-transform`}
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