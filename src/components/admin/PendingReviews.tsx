/**
 * PendingReviews 组件 - 待审核工具列表
 *
 * 从 AdminDashboard 提取的待审核列表逻辑
 */

import React from 'react';
import { CheckCircle, XCircle, Eye } from 'lucide-react';
import type { ToolSubmission } from '../../lib/admin';

interface PendingReviewsProps {
  submissions: ToolSubmission[];
  selectedSubmissions: Set<string>;
  searchTerm: string;
  filterStatus: string;
  onSearchTermChange: (term: string) => void;
  onFilterStatusChange: (status: string) => void;
  onSelectSubmission: (id: string) => void;
  onSelectAll: () => void;
  onReviewSubmission: (id: string, status: 'approved' | 'rejected') => void;
  onViewDetails: (submission: ToolSubmission) => void;
  onBatchReview: (status: 'approved' | 'rejected') => void;
}

const PendingReviews: React.FC<PendingReviewsProps> = ({
  submissions,
  selectedSubmissions,
  searchTerm,
  filterStatus,
  onSearchTermChange,
  onFilterStatusChange,
  onSelectSubmission,
  onSelectAll,
  onReviewSubmission,
  onViewDetails,
  onBatchReview
}) => {
  // 过滤后的提交列表
  const filteredSubmissions = submissions.filter(submission => {
    const toolName = submission.tool_name || '';
    const tagline = submission.tagline || '';
    const searchTermLower = searchTerm.toLowerCase();

    const matchesSearch = toolName.toLowerCase().includes(searchTermLower) ||
                         tagline.toLowerCase().includes(searchTermLower);
    const matchesStatus = filterStatus === 'all' || submission.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const hasSelection = selectedSubmissions.size > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">工具审核</h3>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="搜索提交..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <select
            value={filterStatus}
            onChange={(e) => onFilterStatusChange(e.target.value)}
            className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="all">全部状态</option>
            <option value="pending">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已拒绝</option>
          </select>
          {hasSelection && (
            <>
              <button
                onClick={() => onBatchReview('approved')}
                className="inline-flex items-center px-3 py-2 rounded-md bg-green-600 text-white text-sm hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                批量通过 ({selectedSubmissions.size})
              </button>
              <button
                onClick={() => onBatchReview('rejected')}
                className="inline-flex items-center px-3 py-2 rounded-md bg-red-600 text-white text-sm hover:bg-red-700"
              >
                <XCircle className="h-4 w-4 mr-1" />
                批量拒绝 ({selectedSubmissions.size})
              </button>
            </>
          )}
        </div>
      </div>

      {filteredSubmissions.length === 0 ? (
        <p className="text-gray-500 text-center py-8">暂无符合条件的工具提交</p>
      ) : (
        <div className="space-y-4">
          {/* 全选/取消全选 */}
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={selectedSubmissions.size === filteredSubmissions.length && filteredSubmissions.length > 0}
              onChange={onSelectAll}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>全选 ({filteredSubmissions.length})</span>
          </div>

          {filteredSubmissions.map((submission) => (
            <div
              key={submission.id}
              className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                selectedSubmissions.has(submission.id) ? 'bg-indigo-50 border-indigo-300' : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-start space-x-3 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedSubmissions.has(submission.id)}
                    onChange={() => onSelectSubmission(submission.id)}
                    className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 text-lg">{submission.tool_name}</h4>
                    <p className="text-sm text-gray-600 mt-1">{submission.tagline}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      提交时间: {new Date(submission.created_at).toLocaleString()}
                    </p>
                    {submission.submitter_email && (
                      <p className="text-xs text-gray-500">提交者: {submission.submitter_email}</p>
                    )}
                  </div>
                </div>
                <div className="ml-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      submission.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : submission.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {submission.status === 'pending' ? '待审核' : submission.status === 'approved' ? '已通过' : '已拒绝'}
                  </span>
                </div>
              </div>
              {submission.description && (
                <p className="text-sm text-gray-600 mt-3 line-clamp-2">{submission.description}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {submission.categories.map((category) => (
                  <span
                    key={category}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {category}
                  </span>
                ))}
              </div>
              <div className="flex items-center space-x-2 mt-4">
                {submission.status === 'pending' && (
                  <>
                    <button
                      onClick={() => onReviewSubmission(submission.id, 'approved')}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      通过
                    </button>
                    <button
                      onClick={() => onReviewSubmission(submission.id, 'rejected')}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      拒绝
                    </button>
                  </>
                )}
                <button
                  onClick={() => onViewDetails(submission)}
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
  );
};

export default PendingReviews;
