import React, { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, TrendingUp, AlertTriangle, CheckCircle, Clock, Zap } from 'lucide-react';
import { performanceMonitor } from '../lib/performance-monitor';
import { errorTracker } from '../lib/error-tracker';
import { useServiceWorker } from '../hooks/useServiceWorker';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  type: 'timing' | 'counter' | 'gauge';
}

interface WebVitalScore {
  name: string;
  value: number;
  threshold: { good: number; needsImprovement: number };
  rating: 'good' | 'needs-improvement' | 'poor';
}

/**
 * 性能监控仪表板组件
 *
 * 功能:
 * - Core Web Vitals 可视化
 * - 自定义指标展示
 * - 错误追踪展示
 * - Service Worker 状态
 * - 实时性能图表
 */
const PerformanceDashboard = React.memo<{
  onClose?: () => void;
}>(function PerformanceDashboard({ onClose }) {
  const [isOpen, setIsOpen] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'web-vitals' | 'errors' | 'metrics'>('overview');

  const { report, webVitals: webVitalsMetrics } = performanceMonitor.getPerformanceReport();
  const errorReport = errorTracker.getReport();
  const { isOffline, updateAvailable } = useServiceWorker();

  // 刷新数据
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // 强制刷新数据
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  }, []);

  // 关闭面板
  const handleClose = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  if (!isOpen) return null;

  // Core Web Vitals 数据
  const webVitals: WebVitalScore[] = [
    {
      name: 'LCP',
      value: webVitalsMetrics.LCP || 0,
      threshold: { good: 2500, needsImprovement: 4000 },
      rating: getRating(webVitalsMetrics.LCP || 0, { good: 2500, needsImprovement: 4000 })
    },
    {
      name: 'FID',
      value: webVitalsMetrics.FID || 0,
      threshold: { good: 100, needsImprovement: 300 },
      rating: getRating(webVitalsMetrics.FID || 0, { good: 100, needsImprovement: 300 })
    },
    {
      name: 'CLS',
      value: webVitalsMetrics.CLS || 0,
      threshold: { good: 0.1, needsImprovement: 0.25 },
      rating: getRating(webVitalsMetrics.CLS || 0, { good: 0.1, needsImprovement: 0.25 })
    },
    {
      name: 'FCP',
      value: webVitalsMetrics.FCP || 0,
      threshold: { good: 1800, needsImprovement: 3000 },
      rating: getRating(webVitalsMetrics.FCP || 0, { good: 1800, needsImprovement: 3000 })
    },
    {
      name: 'TTFB',
      value: webVitalsMetrics.TTFB || 0,
      threshold: { good: 600, needsImprovement: 1500 },
      rating: getRating(webVitalsMetrics.TTFB || 0, { good: 600, needsImprovement: 1500 })
    }
  ];

  // 计算总体评分
  const goodCount = webVitals.filter(v => v.rating === 'good').length;
  const totalCount = webVitals.length;
  const overallScore = Math.round((goodCount / totalCount) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${
              overallScore >= 80 ? 'bg-green-100 text-green-600' :
              overallScore >= 50 ? 'bg-yellow-100 text-yellow-600' :
              'bg-red-100 text-red-600'
            }`}>
              {overallScore >= 80 ? <CheckCircle className="w-5 h-5" /> :
               overallScore >= 50 ? <AlertTriangle className="w-5 h-5" /> :
               <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">性能监控仪表板</h2>
              <p className="text-sm text-gray-500">
                总体评分: {overallScore}/100 · {isOffline ? '离线' : '在线'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              aria-label="刷新"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
              aria-label="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
            概览
          </TabButton>
          <TabButton active={activeTab === 'web-vitals'} onClick={() => setActiveTab('web-vitals')}>
            Core Web Vitals
          </TabButton>
          <TabButton active={activeTab === 'errors'} onClick={() => setActiveTab('errors')}>
            错误追踪
          </TabButton>
          <TabButton active={activeTab === 'metrics'} onClick={() => setActiveTab('metrics')}>
            自定义指标
          </TabButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 总体评分卡片 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ScoreCard
                  title="总体评分"
                  score={overallScore}
                  maxScore={100}
                  color={overallScore >= 80 ? 'green' : overallScore >= 50 ? 'yellow' : 'red'}
                />
                <StatCard
                  title="总错误数"
                  value={errorReport.summary.total.toString()}
                  icon={<AlertTriangle className="w-5 h-5" />}
                  trend={errorReport.summary.total > 10 ? 'up' : 'stable'}
                />
                <StatCard
                  title="缓存状态"
                  value={updateAvailable ? '更新可用' : '已是最新'}
                  icon={<Clock className="w-5 h-5" />}
                  trend={updateAvailable ? 'up' : 'stable'}
                />
              </div>

              {/* Web Vitals 快速概览 */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Core Web Vitals</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {webVitals.map(vital => (
                    <VitalCard key={vital.name} vital={vital} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Web Vitals Tab */}
          {activeTab === 'web-vitals' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Core Web Vitals 详情</h3>
              <div className="space-y-4">
                {webVitals.map(vital => (
                  <VitalDetailCard key={vital.name} vital={vital} />
                ))}
              </div>

              {/* Web Vitals 说明 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">评分标准</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li><strong>良好 (绿色)</strong>: 75% 以上用户体验达到此指标</li>
                  <li><strong>需改进 (黄色)</strong>: 指标需要改进，影响用户体验</li>
                  <li><strong>较差 (红色)</strong>: 指标严重低于标准，急需优化</li>
                </ul>
              </div>
            </div>
          )}

          {/* Errors Tab */}
          {activeTab === 'errors' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">错误追踪</h3>
                <span className="text-sm text-gray-500">
                  共 {errorReport.summary.total} 个错误
                </span>
              </div>

              {/* 按类型分组 */}
              <div className="space-y-4">
                {Object.entries(errorReport.summary.byType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium capitalize">{type}</span>
                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                      {count}
                    </span>
                  </div>
                ))}
              </div>

              {/* Top Errors */}
              {errorReport.summary.topErrors.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">最常见错误</h4>
                  <div className="space-y-2">
                    {errorReport.summary.topErrors.slice(0, 5).map(error => (
                      <div key={error.id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-red-900 truncate">{error.message}</p>
                            <p className="text-xs text-red-600 mt-1">
                              {error.count}次 · {new Date(error.lastSeen).toLocaleString()}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            error.resolved
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {error.resolved ? '已解决' : '未解决'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Metrics Tab */}
          {activeTab === 'metrics' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">自定义指标</h3>
                <span className="text-sm text-gray-500">
                  共 {report.summary.length} 个指标
                </span>
              </div>

              {report.summary.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left font-medium text-gray-700">名称</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-700">平均值</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-700">最小值</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-700">最大值</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-700">P95</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">单位</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.summary.map((metric, index) => (
                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">{metric.name}</td>
                          <td className="px-4 py-2 text-right">{metric.avg.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">{metric.min.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">{metric.max.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">{metric.p95.toFixed(2)}</td>
                          <td className="px-4 py-2">{metric.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  暂无自定义指标数据
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
          <span>数据采集时间: {new Date().toLocaleString()}</span>
          <button
            onClick={() => {
              performanceMonitor.printReport();
              errorTracker.printReport();
            }}
            className="text-blue-600 hover:underline"
          >
            在控制台查看详细报告
          </button>
        </div>
      </div>
    </div>
  );
});

// 辅助组件
function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
        active
          ? 'text-blue-600 border-blue-600'
          : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

function ScoreCard({
  title,
  score,
  maxScore,
  color
}: {
  title: string;
  score: number;
  maxScore: number;
  color: 'green' | 'yellow' | 'red';
}) {
  const colors = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500'
  };

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
      <div className="text-sm text-gray-600 mb-2">{title}</div>
      <div className="flex items-end space-x-2">
        <span className="text-3xl font-bold text-gray-900">{score}</span>
        <span className="text-sm text-gray-400 mb-1">/{maxScore}</span>
      </div>
      <div className={`mt-2 h-2 bg-gray-100 rounded-full overflow-hidden`}>
        <div
          className={`h-full ${colors[color]} transition-all duration-500`}
          style={{ width: `${(score / maxScore) * 100}%` }}
        />
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  trend
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
}) {
  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-600">{title}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function VitalCard({ vital }: { vital: WebVitalScore }) {
  const colors = {
    good: 'bg-green-100 text-green-700 border-green-200',
    'needs-improvement': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    poor: 'bg-red-100 text-red-700 border-red-200'
  };

  const icons = {
    good: <CheckCircle className="w-4 h-4" />,
    'needs-improvement': <AlertTriangle className="w-4 h-4" />,
    poor: <Zap className="w-4 h-4" />
  };

  return (
    <div className={`p-3 rounded-lg border ${colors[vital.rating]} text-center`}>
      <div className="flex items-center justify-center mb-1">
        {icons[vital.rating]}
      </div>
      <div className="text-xs font-medium mb-1">{vital.name}</div>
      <div className="text-lg font-bold">{vital.value.toFixed(0)}ms</div>
    </div>
  );
}

function VitalDetailCard({ vital }: { vital: WebVitalScore }) {
  const percentage = Math.min((vital.value / vital.threshold.needsImprovement) * 100, 100);
  const color = vital.rating === 'good' ? 'bg-green-500' : vital.rating === 'needs-improvement' ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-gray-900">{vital.name}</span>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            vital.rating === 'good' ? 'bg-green-100 text-green-700' :
            vital.rating === 'needs-improvement' ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>
            {vital.rating === 'good' ? '良好' : vital.rating === 'needs-improvement' ? '需改进' : '较差'}
          </span>
        </div>
        <div className="text-2xl font-bold text-gray-900">{vital.value.toFixed(0)}ms</div>
      </div>

      <div className="mb-2">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>目标阈值</span>
          <span>{vital.threshold.needsImprovement}ms</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${color} transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="text-xs text-gray-500">
        <p>良好: &lt; {vital.threshold.good}ms</p>
        <p>需改进: {vital.threshold.good} - {vital.threshold.needsImprovement}ms</p>
      </div>
    </div>
  );
}

// 辅助函数
function getRating(
  value: number,
  thresholds: { good: number; needsImprovement: number }
): 'good' | 'needs-improvement' | 'poor' {
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.needsImprovement) return 'needs-improvement';
  return 'poor';
}

PerformanceDashboard.displayName = 'PerformanceDashboard';

export default PerformanceDashboard;
