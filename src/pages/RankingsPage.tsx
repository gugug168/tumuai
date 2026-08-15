import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Sparkles, Star, TrendingUp, Eye } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext';
import { useMetaTags } from '../hooks/useMetaTags';
import { getToolsViaAPI } from '../lib/supabase';
import { getRankingsPageUIText, translateCategory, translatePricing, formatRelativeDate } from '../lib/translations';
import OptimizedImage from '../components/OptimizedImage';
import ToolFallbackIcon from '../components/ToolFallbackIcon';
import type { Tool } from '../types';

/**
 * 榜单页 —— SEO 流量入口（"最好的土木 AI 工具"类长尾搜索词）。
 * 三个锚点分区（非 tab）：静态回退/SSR 可见全部内容，搜索引擎不吃亏。
 * 诚实性约束：upvotes 是存量值（无用户写入路径），只做总榜不做虚构"周增榜"；
 * "本周新增"按 date_added 真实过滤。
 */

type RankMetric = 'upvotes' | 'date' | 'views';

function RankingRow({ rank, tool, lang, metric }: { rank: number; tool: Tool; lang: string; metric: RankMetric }) {
  const medalClass = rank === 1
    ? 'bg-amber-100 text-amber-700'
    : rank === 2
      ? 'bg-slate-200 text-slate-700'
      : rank === 3
        ? 'bg-orange-100 text-orange-700'
        : 'bg-blue-50 text-blue-600';

  const metricNode = metric === 'date'
    ? <span className="text-xs text-gray-400">{formatRelativeDate(tool.date_added, lang) || ''}</span>
    : (
      <span className="flex items-center gap-1 text-sm font-semibold text-gray-700">
        {metric === 'views' ? <Eye className="w-3.5 h-3.5 text-gray-400" /> : <TrendingUp className="w-3.5 h-3.5 text-gray-400" />}
        {metric === 'views' ? (tool.views || 0) : (tool.upvotes || 0)}
      </span>
    );

  return (
    <Link
      to={`/tools/${tool.id}`}
      className="flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3 rounded-xl hover:bg-blue-50/60 transition-colors group"
    >
      <span className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold ${medalClass}`}>
        {rank}
      </span>
      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
        <OptimizedImage
          src={tool.logo_url || undefined}
          alt={tool.name}
          width="40px"
          height="40px"
          objectFit="contain"
          background={false}
          fallback={<ToolFallbackIcon name={tool.name} categories={tool.categories || []} />}
          priority={false}
          lazyLoad={true}
          sizes="40px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
            {tool.name}
          </span>
          {tool.categories?.[0] && (
            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md text-xs font-semibold">
              {translateCategory(tool.categories[0], lang)}
            </span>
          )}
          <span className="text-xs font-medium text-blue-600">{translatePricing(tool.pricing, lang)}</span>
        </div>
        <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">{tool.tagline || tool.description || ''}</p>
      </div>
      {metricNode}
    </Link>
  );
}

function RankingSection({ id, icon, title, desc, tools, lang, metric }: {
  id: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  tools: Tool[];
  lang: string;
  metric: RankMetric;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-baseline gap-3 mb-4">
        {icon}
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">{desc}</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 p-2 md:p-3">
        {tools.map((tool, i) => (
          <RankingRow key={tool.id} rank={i + 1} tool={tool} lang={lang} metric={metric} />
        ))}
      </div>
    </section>
  );
}

const RankingsPage = React.memo(() => {
  const { locale } = useLocale();
  const lang = locale;
  const isEn = locale === 'en';

  useMetaTags({
    title: `${getRankingsPageUIText('title', lang)} - TumuAI.net`,
    description: getRankingsPageUIText('metaDesc', lang),
    canonical: isEn ? 'https://www.tumuai.net/en/rankings' : 'https://www.tumuai.net/rankings'
  });

  const [hot, setHot] = useState<Tool[]>([]);
  const [latest, setLatest] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [hotResult, latestResult] = await Promise.all([
          // 诚实性：upvotes 全站为 0（无用户写入路径），热门榜按真实浏览量排序
          getToolsViaAPI(20, 0, false, undefined, { sortBy: 'views' }),
          getToolsViaAPI(50, 0, false, undefined, { sortBy: 'date_added' }),
        ]);
        if (cancelled) return;
        setHot(Array.isArray(hotResult.tools) ? hotResult.tools : []);
        setLatest(Array.isArray(latestResult.tools) ? latestResult.tools : []);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 本周新增：过去 7 天内真实收录（date_added），可能为空
  const weekAgo = Date.now() - 7 * 86400000;
  const thisWeek = latest.filter(t => t.date_added && new Date(t.date_added).getTime() >= weekAgo);
  const recent = thisWeek.length > 0 ? thisWeek : latest.slice(0, 6);
  const isWeekMode = thisWeek.length > 0;

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex items-center justify-center py-24 text-gray-500">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
          {getRankingsPageUIText('loading', lang)}
        </div>
      </main>
    );
  }

  if (failed && hot.length === 0 && latest.length === 0) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center py-24 text-gray-500">{getRankingsPageUIText('loadFailed', lang)}</div>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 md:py-12">
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          {getRankingsPageUIText('title', lang)}
        </h1>
        <p className="text-gray-500">{getRankingsPageUIText('subtitle', lang)}</p>
      </header>

      <div className="space-y-12">
        <RankingSection
          id="hot"
          icon={<Flame className="w-6 h-6 text-orange-500 flex-shrink-0" />}
          title={getRankingsPageUIText('hotTitle', lang)}
          desc={getRankingsPageUIText('hotDesc', lang)}
          tools={hot}
          lang={lang}
          metric="views"
        />

        <RankingSection
          id="week"
          icon={<Star className="w-6 h-6 text-blue-500 flex-shrink-0" />}
          title={isWeekMode ? getRankingsPageUIText('weekTitle', lang) : getRankingsPageUIText('newTitle', lang)}
          desc={isWeekMode ? getRankingsPageUIText('weekDesc', lang) : getRankingsPageUIText('newDesc', lang)}
          tools={recent}
          lang={lang}
          metric="date"
        />

        {isWeekMode && latest.length > 0 && (
          <RankingSection
            id="latest"
            icon={<Sparkles className="w-6 h-6 text-cyan-500 flex-shrink-0" />}
            title={getRankingsPageUIText('newTitle', lang)}
            desc={getRankingsPageUIText('newDesc', lang)}
            tools={latest.slice(0, 12)}
            lang={lang}
            metric="date"
          />
        )}

        <p className="text-center">
          <Link to="/tools?sortBy=date_added" className="text-blue-600 hover:text-blue-700 font-medium">
            {getRankingsPageUIText('viewAllNew', lang)}
          </Link>
        </p>
      </div>
    </main>
  );
});

export default RankingsPage;
