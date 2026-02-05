import React, { useCallback } from 'react';
import { FileText, Check } from 'lucide-react';

interface ToolFormStepBasicInfoProps {
  formData: {
    toolName: string;
    shortDescription: string;
    detailedDescription: string;
  };
  errors: Record<string, string>;
  isCompleted: boolean;
  isCurrent: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * ToolFormStepBasicInfo - 表单步骤2: 基本信息
 *
 * 包含:
 * - 工具名称
 * - 一句话简介
 * - 详细描述
 */
const ToolFormStepBasicInfo = React.memo<ToolFormStepBasicInfoProps>(({
  formData,
  errors,
  isCompleted,
  isCurrent,
  onChange
}) => {
  const getInputClassName = useCallback((fieldName: string) => {
    const baseClass = "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ";
    const errorClass = errors[fieldName]
      ? "border-red-300 focus:ring-red-500 focus:border-red-500 "
      : "border-gray-300 hover:border-gray-400 ";
    return baseClass + errorClass + "bg-white text-gray-900 placeholder-gray-500";
  }, [errors]);

  return (
    <div className={`p-8 border-b transition-all duration-300 ${
      isCurrent ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
    }`}>
      <div className="flex items-center mb-4">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 transition-all duration-300 ${
          isCompleted ? 'bg-green-500 text-white' : isCurrent ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
        }`}>
          {isCompleted ? <Check className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
        </div>
        <h3 className="text-lg font-semibold text-gray-900">基本信息</h3>
        {isCompleted && (
          <span className="ml-auto text-sm text-green-600 flex items-center">
            <Check className="w-4 h-4 mr-1" /> 已完成
          </span>
        )}
      </div>

      <div className="max-w-md">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          工具名称 *
        </label>
        <input
          type="text"
          name="toolName"
          value={formData.toolName}
          onChange={onChange}
          className={getInputClassName('toolName')}
          placeholder="例如：StructuralGPT"
        />
        {errors.toolName && (
          <p className="mt-1 text-sm text-red-600">{errors.toolName}</p>
        )}
      </div>

      <div className="mt-6 max-w-md">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          一句话简介 * <span className="text-gray-500">(少于100字)</span>
        </label>
        <input
          type="text"
          name="shortDescription"
          value={formData.shortDescription}
          onChange={onChange}
          maxLength={100}
          className={getInputClassName('shortDescription')}
          placeholder="简洁描述工具的核心功能和价值"
        />
        <div className="flex justify-between mt-1">
          {errors.shortDescription ? (
            <p className="text-sm text-red-600">{errors.shortDescription}</p>
          ) : (
            <div></div>
          )}
          <p className="text-sm text-gray-500">{formData.shortDescription.length}/100</p>
        </div>
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          详细描述 (选填)
        </label>
        <textarea
          name="detailedDescription"
          value={formData.detailedDescription}
          onChange={onChange}
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-all duration-200 bg-white text-gray-900 placeholder-gray-500"
          placeholder="详细描述工具的功能、特点、使用场景等..."
        />
      </div>
    </div>
  );
});

ToolFormStepBasicInfo.displayName = 'ToolFormStepBasicInfo';

export default ToolFormStepBasicInfo;
