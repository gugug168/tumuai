import React from 'react';
import { DollarSign, Check, Image, RefreshCw } from 'lucide-react';
import { SUBMIT_PRICING_OPTIONS } from '../../lib/config';

interface ToolFormStepPricingProps {
  formData: {
    pricingModel: string;
    logoFile: File | null;
  };
  logoPreviewUrl: string | null;
  fetchedLogoUrl: string | null;
  isFetchingLogo: boolean;
  errors: Record<string, string>;
  isCompleted: boolean;
  isCurrent: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRefreshLogo: () => void;
  setLogoPreviewUrl: (url: string | null) => void;
}

/**
 * ToolFormStepPricing - 表单步骤4: 定价和Logo
 *
 * 包含:
 * - 定价模式选择
 * - Logo 上传/预览
 */
const ToolFormStepPricing = React.memo<ToolFormStepPricingProps>(({
  formData,
  logoPreviewUrl,
  fetchedLogoUrl,
  isFetchingLogo,
  errors,
  isCompleted,
  isCurrent,
  onChange,
  onFileChange,
  onRefreshLogo,
  setLogoPreviewUrl
}) => {
  return (
    <div className={`p-8 border-b transition-all duration-300 ${
      isCurrent ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
    }`}>
      <div className="flex items-center mb-4">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 transition-all duration-300 ${
          isCompleted ? 'bg-green-500 text-white' : isCurrent ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
        }`}>
          {isCompleted ? <Check className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
        </div>
        <h3 className="text-lg font-semibold text-gray-900">定价和Logo</h3>
        {isCompleted && (
          <span className="ml-auto text-sm text-green-600 flex items-center">
            <Check className="w-4 h-4 mr-1" /> 已完成
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            定价模式 *
          </label>
          <select
            name="pricingModel"
            value={formData.pricingModel}
            onChange={onChange}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.pricingModel ? 'border-red-300' : 'border-gray-300'
            } bg-white text-gray-900`}
          >
            <option value="">请选择定价模式</option>
            {SUBMIT_PRICING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.pricingModel && (
            <p className="mt-1 text-sm text-red-600">{errors.pricingModel}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            工具Logo (可选)
          </label>

          {/* Logo 预览区域 */}
          {(logoPreviewUrl || fetchedLogoUrl) && (
            <div className="mb-3 flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-white shadow-sm flex items-center justify-center">
                <img
                  src={logoPreviewUrl || fetchedLogoUrl || undefined}
                  alt="Logo预览"
                  className="w-full h-full object-contain"
                  onError={() => setLogoPreviewUrl(null)}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">
                  {formData.logoFile ? formData.logoFile.name : '自动获取的图标'}
                </p>
                <p className="text-xs text-gray-500">
                  {formData.logoFile ? '用户上传' : '来自网站自动提取'}
                </p>
              </div>
              {fetchedLogoUrl && !formData.logoFile && (
                <button
                  type="button"
                  onClick={onRefreshLogo}
                  disabled={isFetchingLogo}
                  className="p-2 text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  title="刷新图标"
                >
                  <RefreshCw className={`w-4 h-4 ${isFetchingLogo ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          )}

          {/* 自动获取状态 */}
          {isFetchingLogo && (
            <div className="mb-3 flex items-center text-sm text-blue-600">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
              正在从网站获取图标...
            </div>
          )}

          {/* 上传区域 */}
          <div className="space-y-2">
            <div className="relative flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={onFileChange}
                className="hidden"
                id="logo-upload"
              />
              <label
                htmlFor="logo-upload"
                className={`w-full px-3 py-2 border-2 border-dashed rounded-lg cursor-pointer hover:border-blue-400 transition-colors flex items-center justify-center ${
                  errors.logoFile ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <Image className="w-5 h-5 mr-2 text-gray-400" />
                <span className="text-gray-600">
                  {formData.logoFile ? formData.logoFile.name : '点击上传图片'}
                </span>
              </label>
            </div>

            {errors.logoFile && (
              <p className="mt-1 text-sm text-red-600">{errors.logoFile}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              支持 JPG、PNG 格式，文件大小不超过 5MB
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

ToolFormStepPricing.displayName = 'ToolFormStepPricing';

export default ToolFormStepPricing;
