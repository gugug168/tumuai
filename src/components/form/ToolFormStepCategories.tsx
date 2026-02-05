import React, { useCallback } from 'react';
import { Tag, Check } from 'lucide-react';

interface ToolFormStepCategoriesProps {
  formData: {
    categories: string[];
    mainFeatures: string;
  };
  availableCategories: string[];
  categoriesLoading: boolean;
  errors: Record<string, string>;
  isCompleted: boolean;
  isCurrent: boolean;
  onCategoryChange: (category: string) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * ToolFormStepCategories - 表单步骤3: 分类和功能
 *
 * 包含:
 * - 分类选择（多选）
 * - 主要功能标签
 */
const ToolFormStepCategories = React.memo<ToolFormStepCategoriesProps>(({
  formData,
  availableCategories,
  categoriesLoading,
  errors,
  isCompleted,
  isCurrent,
  onCategoryChange,
  onChange
}) => {
  return (
    <div className={`p-8 border-b transition-all duration-300 ${
      isCurrent ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
    }`}>
      <div className="flex items-center mb-4">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 transition-all duration-300 ${
          isCompleted ? 'bg-green-500 text-white' : isCurrent ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
        }`}>
          {isCompleted ? <Check className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
        </div>
        <h3 className="text-lg font-semibold text-gray-900">分类和功能</h3>
        {isCompleted && (
          <span className="ml-auto text-sm text-green-600 flex items-center">
            <Check className="w-4 h-4 mr-1" /> 已完成
          </span>
        )}
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          选择分类 * <span className="text-gray-500">(可多选)</span>
        </label>
        {categoriesLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
            加载分类数据中...
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {availableCategories.map((category) => (
              <label key={category} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.categories.includes(category)}
                  onChange={() => onCategoryChange(category)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">{category}</span>
              </label>
            ))}
          </div>
        )}
        {errors.categories && (
          <p className="mt-2 text-sm text-red-600">{errors.categories}</p>
        )}
        {!categoriesLoading && availableCategories.length === 0 && (
          <p className="mt-2 text-sm text-amber-600">
            暂时无法获取分类数据，请稍后重试
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          主要功能 (选填)
        </label>
        <input
          type="text"
          name="mainFeatures"
          value={formData.mainFeatures}
          onChange={onChange}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-all duration-200 bg-white text-gray-900 placeholder-gray-500"
          placeholder="用逗号分隔，例如：AI优化, 参数化设计, 成本估算"
        />
      </div>
    </div>
  );
});

ToolFormStepCategories.displayName = 'ToolFormStepCategories';

export default ToolFormStepCategories;
