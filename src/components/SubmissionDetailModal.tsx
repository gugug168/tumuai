import React from 'react';
import {
  X, 
  ExternalLink, 
  User, 
  Calendar, 
  Tag, 
  DollarSign, 
  Image as ImageIcon,
  FileText,
  Link,
  CheckCircle,
  XCircle
} from 'lucide-react';
import type { ToolSubmission } from '../types';
import { getBestDisplayLogoUrl } from '../lib/logoUtils';

interface SubmissionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: ToolSubmission | null;
  onApprove: (submissionId: string) => void;
  onReject: (submissionId: string, notes?: string) => void;
}

const SubmissionDetailModal: React.FC<SubmissionDetailModalProps> = ({
  isOpen,
  onClose,
  submission,
  onApprove,
  onReject
}) => {
  const [rejectNotes, setRejectNotes] = React.useState('');
  const [isProcessing, setIsProcessing] = React.useState(false);

  if (!isOpen || !submission) return null;

  const handleApprove = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await onApprove(submission.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await onReject(submission.id, rejectNotes);
      setRejectNotes('');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待审核';
      case 'approved': return '已通过';
      case 'rejected': return '已拒绝';
      default: return '未知状态';
    }
  };

  const existingTools = submission.existing_tools || [];
  const hasExistingToolHint = !!submission.already_in_tools && existingTools.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">工具提交详情</h2>
            <p className="text-sm text-gray-600 mt-1">ID: {submission.id}</p>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(submission.status)}`}>
              {getStatusText(submission.status)}
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh] p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 左侧：基本信息 */}
            <div className="space-y-6">
              {/* 工具基本信息 */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  工具信息
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-blue-800">工具名称</label>
                    <p className="text-gray-900 font-semibold text-lg">{submission.tool_name}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-blue-800">一句话简介</label>
                    <p className="text-gray-700">{submission.tagline || '暂无简介'}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-blue-800 flex items-center">
                      <Link className="w-4 h-4 mr-1" />
                      官方网址
                    </label>
                    <a 
                      href={submission.website_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline flex items-center"
                    >
                      {submission.website_url}
                      <ExternalLink className="w-4 h-4 ml-1" />
                    </a>
                  </div>

                  {hasExistingToolHint && (
                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-amber-800">可能已入库（避免重复）</div>
                          <div className="text-xs text-amber-700 mt-1">
                            工具库里可能已存在同网址/同域名的工具，建议核对后再审批。
                          </div>
                        </div>
                        {submission.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => {
                              const t = existingTools[0]
                              const note = t
                                ? `疑似重复入库：工具库已存在 ${t.name}（${t.id}）`
                                : '疑似重复入库：工具库已存在同域名工具'
                              setRejectNotes(note)
                            }}
                            className="shrink-0 inline-flex items-center px-3 py-2 rounded-md border border-amber-300 bg-white text-amber-800 text-sm hover:bg-amber-50"
                          >
                            填入重复拒绝理由
                          </button>
                        )}
                      </div>

                      <div className="mt-3 space-y-2">
                        {existingTools.slice(0, 3).map((t) => (
                          <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
                            <div className="text-amber-900">
                              {t.name}
                              <span className="text-xs text-amber-700 ml-2">
                                ({t.match_type === 'exact' ? '同网址' : '同域名'})
                              </span>
                            </div>
                            <a
                              href={`/tools/${t.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-amber-800 underline hover:text-amber-900"
                            >
                              打开
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 详细描述 */}
              {submission.description && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">详细描述</h4>
                  <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {submission.description}
                  </p>
                </div>
              )}

              {/* Logo 预览 */}
              {submission.logo_url && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                    <ImageIcon className="w-4 h-4 mr-1" />
                    Logo 预览
                  </h4>
                  <div className="flex items-center justify-center bg-white border-2 border-dashed border-gray-300 rounded-lg p-6">
                    <img 
                      src={getBestDisplayLogoUrl(
                        submission.logo_url,
                        submission.tool_name,
                        submission.categories || []
                      )}
                      alt={`${submission.tool_name} Logo`}
                      className="max-w-32 max-h-32 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-logo.png';
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 右侧：分类和元信息 */}
            <div className="space-y-6">
              {/* 分类和定价 */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-purple-900 mb-3 flex items-center">
                  <Tag className="w-5 h-5 mr-2" />
                  分类信息
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-purple-800">工具分类</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {submission.categories.map((category, index) => (
                        <span 
                          key={index}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {category}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {submission.pricing && (
                    <div>
                      <label className="text-sm font-medium text-purple-800 flex items-center">
                        <DollarSign className="w-4 h-4 mr-1" />
                        定价模式
                      </label>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
                        submission.pricing === 'Free' ? 'bg-green-100 text-green-800' :
                        submission.pricing === 'Freemium' ? 'bg-blue-100 text-blue-800' :
                        submission.pricing === 'Paid' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {submission.pricing}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 主要功能 */}
              {submission.features && submission.features.length > 0 && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-green-800 mb-2">主要功能</h4>
                  <div className="flex flex-wrap gap-2">
                    {submission.features.map((feature, index) => (
                      <span 
                        key={index}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 提交信息 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                  <User className="w-4 h-4 mr-1" />
                  提交信息
                </h4>
                
                <div className="space-y-2 text-sm">
                  {submission.submitter_email && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">提交者邮箱:</span>
                      <span className="text-gray-900 font-medium">{submission.submitter_email}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600 flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      提交时间:
                    </span>
                    <span className="text-gray-900">{formatDate(submission.created_at)}</span>
                  </div>
                  
                  {submission.updated_at && submission.updated_at !== submission.created_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">更新时间:</span>
                      <span className="text-gray-900">{formatDate(submission.updated_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 管理员备注 */}
              {submission.admin_notes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-yellow-800 mb-2">管理员备注</h4>
                  <p className="text-yellow-700 text-sm">{submission.admin_notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        {submission.status === 'pending' && (
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* 拒绝理由输入 */}
              <div className="flex-1">
                <textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="拒绝理由 (可选)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  rows={2}
                />
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <button
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {isProcessing ? '处理中...' : '通过审核'}
                </button>
                
                <button
                  onClick={handleReject}
                  disabled={isProcessing}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  {isProcessing ? '处理中...' : '拒绝'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubmissionDetailModal;
