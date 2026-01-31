import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  Bug,
  CheckCircle2,
  Code2,
  Github,
  Globe,
  GitPullRequest,
  Lightbulb,
  Mail,
  MessageSquare,
  PenTool,
  Sparkles,
  Target,
  Users
} from 'lucide-react';
import CountUpAnimation from '../components/CountUpAnimation';
import { useMetaTags } from '../hooks/useMetaTags';
import { getCategories, getToolsCount } from '../lib/supabase';

interface SiteStats {
  toolsCount: number;
  categoriesCount: number;
}

const values = [
  {
    icon: Target,
    title: '专业专注',
    description: '专注土木工程领域，按工作流与场景组织工具，减少信息噪音。'
  },
  {
    icon: Users,
    title: '服务工程师',
    description: '从工程师真实需求出发，优先提升可用性、易用性和查找效率。'
  },
  {
    icon: Award,
    title: '质量优先',
    description: '尽量保证信息清晰、链接可用、分类合理，并持续纠错更新。'
  },
  {
    icon: Lightbulb,
    title: '持续创新',
    description: '关注 AI 新进展与新工具，把最新的有效工具及时带给你。'
  }
] as const;

const teamMembers = [
  {
    name: '产品与运营',
    role: '需求洞察 · 体验打磨',
    description: '从一线工程师工作流出发，持续优化导航、搜索、筛选和提交体验。',
    icon: Sparkles
  },
  {
    name: '工程与数据',
    role: '稳定性 · 数据质量',
    description: '维护数据结构与分类体系，推动性能优化，让你更快找到更准的工具。',
    icon: Code2
  },
  {
    name: '内容与评测',
    role: '工具评测 · 内容策划',
    description: '关注行业新工具、新用法，输出更贴近工程场景的推荐与对比。',
    icon: PenTool
  }
] as const;

const AboutPage = React.memo(() => {
  const [stats, setStats] = useState<SiteStats>({ toolsCount: 0, categoriesCount: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useMetaTags({
    title: '关于我们 - TumuAI.net',
    description:
      '了解 TumuAI.net：面向土木工程师的 AI 工具导航与评测平台。我们持续收录、分类与更新优质工具，支持提交与共建。',
    canonical: 'https://www.tumuai.net/about',
    ogTitle: '关于我们 - TumuAI.net',
    ogDescription: '面向土木工程师的 AI 工具导航与评测平台：持续收录、分类与更新，支持提交与共建。'
  });

  const workflowSteps = useMemo(
    () => [
      {
        title: '提交工具',
        description: '填写官网与简介，我们会自动辅助识别 Logo、分类与描述。',
        href: '/submit'
      },
      {
        title: '快速审核',
        description: '进行可用性与信息完整度检查，尽量保证收录信息清晰可用。',
        href: '/submit'
      },
      {
        title: '发布收录',
        description: '审核通过后进入“工具中心”，可分类浏览、搜索筛选与查看详情。',
        href: '/tools'
      },
      {
        title: '持续更新',
        description: '基于反馈持续修正信息、补充标签与分类，保持工具库“活”的状态。',
        href: '/tools'
      }
    ],
    []
  );

  const reviewCriteria = useMemo(
    () => [
      {
        title: '信息清晰',
        points: ['名称/简介/网址可识别', '分类与定价信息尽量完整', 'Logo/素材不影响浏览体验']
      },
      {
        title: '工程相关',
        points: ['面向结构/BIM/施工/造价/项目管理等场景', '能明显提升效率或质量', '贴近工程常见输入输出']
      },
      {
        title: '可用性',
        points: ['页面可访问、功能可体验', '有持续维护迹象', '不收录明显失效或跳转异常的链接']
      },
      {
        title: '可更新',
        points: ['支持后续补充资料与修正', '欢迎作者提供更准确素材', '对比信息会持续迭代']
      }
    ],
    []
  );

  const faqItems = useMemo(
    () => [
      {
        q: '如何提交新工具？',
        a: '点击“提交工具”，填入官网地址和简介即可。你也可以补充分类、功能标签与 Logo，我们会在审核时进一步完善信息。'
      },
      {
        q: '为什么有些工具的 Logo 显示不出来？',
        a: '部分网站会限制图标访问或路径会变化。我们会提供兜底图标，不影响使用；你也可以在提交时上传更稳定的 Logo。'
      },
      {
        q: '发现工具信息有误/链接失效怎么办？',
        a: '可以通过邮件或 GitHub 提交反馈，我们会持续修正与更新。'
      },
      {
        q: '我可以参与共建吗？',
        a: '当然可以：提交工具、反馈问题、补充分类与标签，或在 GitHub 提交 PR 都非常欢迎。'
      }
    ],
    []
  );

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const isDev = import.meta.env.DEV;

        // Tools count
        let toolsCount = 0;
        if (isDev) {
          toolsCount = await getToolsCount();
        } else {
          const toolsResponse = await fetch('/api/tools-cache?limit=1&includeCount=true');
          if (toolsResponse.ok) {
            const toolsData = await toolsResponse.json();
            toolsCount = toolsData.count || 0;
          } else {
            toolsCount = await getToolsCount();
          }
        }

        // Categories count
        let categoriesCount = 0;
        if (isDev) {
          const categories = await getCategories();
          categoriesCount = categories.length || 0;
        } else {
          const categoriesResponse = await fetch('/api/categories-cache');
          if (categoriesResponse.ok) {
            const categoriesData = await categoriesResponse.json();
            categoriesCount = categoriesData?.categories?.length || 0;
          } else {
            const categories = await getCategories();
            categoriesCount = categories.length || 0;
          }
        }

        setStats({ toolsCount, categoriesCount });
      } catch (error) {
        console.error('获取统计数据失败:', error);
        setStats({ toolsCount: 0, categoriesCount: 0 });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-blue-200/40 blur-3xl"></div>
          <div className="absolute -bottom-32 -left-24 w-80 h-80 rounded-full bg-indigo-200/40 blur-3xl"></div>
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 border border-blue-100 text-blue-700 text-sm font-medium shadow-sm">
            <Sparkles className="w-4 h-4" />
            <span>面向土木工程师的 AI 工具导航与评测</span>
          </div>

          <h1 className="mt-6 text-4xl md:text-5xl font-bold text-gray-900">关于 TumuAI.net</h1>

          <p className="mt-6 text-xl text-gray-700 leading-relaxed max-w-3xl mx-auto">
            我们希望把分散在互联网各处的优质工具，整理成一个“好找、好用、可持续更新”的工具库。
            让你把时间用在工程本身，而不是耗在搜索与筛选上。
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/tools"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              浏览工具中心
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
            <Link
              to="/submit"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-lg bg-white text-blue-700 font-medium border border-blue-200 hover:bg-blue-50 transition-colors"
            >
              提交你的工具
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm text-gray-600">
            {[
              { href: '#mission', label: '使命' },
              { href: '#workflow', label: '收录流程' },
              { href: '#criteria', label: '筛选标准' },
              { href: '#faq', label: 'FAQ' },
              { href: '#contact', label: '联系' }
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="px-3 py-1 rounded-full bg-white/70 border border-gray-200 hover:border-blue-200 hover:text-blue-700 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 text-left max-w-4xl mx-auto">
            <div className="bg-white/70 border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">收录工具</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">
                {isLoading ? (
                  <span className="inline-block animate-pulse">...</span>
                ) : (
                  <CountUpAnimation end={stats.toolsCount} suffix="+" duration={1200} />
                )}
              </div>
            </div>
            <div className="bg-white/70 border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">工具分类</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">
                {isLoading ? (
                  <span className="inline-block animate-pulse">...</span>
                ) : (
                  <CountUpAnimation end={stats.categoriesCount} suffix="+" duration={1200} delay={100} />
                )}
              </div>
            </div>
            <div className="bg-white/70 border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">更新状态</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">持续更新</div>
            </div>
            <div className="bg-white/70 border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">共建方式</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">提交 / 反馈 / PR</div>
            </div>
          </div>
        </div>
      </section>

      <section id="mission" className="scroll-mt-24 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">我们的使命</h2>
              <p className="text-lg text-gray-700 leading-relaxed">
                让每一位土木工程师都能更快找到并用上真正“能落地”的工具：不只收录，更重视分类、信息清晰与可持续更新。
              </p>

              <div className="mt-6 space-y-3 text-gray-700">
                {[
                  '把工具按工程场景重新组织：结构、BIM、施工、造价、项目管理…',
                  '减少信息噪音：提供更清晰的简介、标签与分类',
                  '让共建更简单：支持提交工具、反馈修正、开源协作'
                ].map((text) => (
                  <div key={text} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {values.map((value) => {
                const Icon = value.icon;
                return (
                  <div
                    key={value.title}
                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-blue-700" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">{value.title}</h3>
                    <p className="mt-2 text-gray-600 leading-relaxed text-sm">{value.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="story" className="scroll-mt-24 py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">我们的故事</h2>
            <p className="text-lg text-gray-600">从“找工具很费时间”开始</p>
          </div>

          <div className="space-y-6 text-gray-700 leading-relaxed text-lg">
            <p>
              TumuAI.net 诞生于一个很现实的痛点：AI 工具越来越多，但工程师真正需要的那几个，往往被埋在搜索结果与信息噪音里。
            </p>
            <p>
              我们想做的是一张更贴近工程场景的“工具地图”：把工具按专业领域和工作流整理好，让你用更少的时间找到更合适的工具。
            </p>
            <p>
              这不是一次性的整理，而是持续的共建。工具会更新、网址会变化、功能会迭代，所以我们把“可持续更新”和“社区反馈”放在更高优先级。
            </p>
          </div>
        </div>
      </section>

      <section id="workflow" className="scroll-mt-24 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">工具收录流程</h2>
            <p className="text-lg text-gray-600">让提交、审核与更新更顺畅</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {workflowSteps.map((step, idx) => (
              <div key={step.title} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700 font-bold">
                    {idx + 1}
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-300" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-2 text-gray-600 text-sm leading-relaxed">{step.description}</p>
                <div className="mt-4">
                  <Link to={step.href} className="text-blue-700 hover:text-blue-800 font-medium text-sm inline-flex items-center">
                    了解更多
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="criteria" className="scroll-mt-24 py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">我们如何筛选工具</h2>
            <p className="text-lg text-gray-600">目标是“信息靠谱、场景相关、可持续更新”</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reviewCriteria.map((c) => (
              <div key={c.title} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">{c.title}</h3>
                <div className="mt-4 space-y-3">
                  {c.points.map((p) => (
                    <div key={p} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-700 text-sm leading-relaxed">{p}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="team" className="scroll-mt-24 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">我们是谁</h2>
            <p className="text-lg text-gray-600">由工程师、开发者与内容编辑共同维护</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {teamMembers.map((member) => {
              const Icon = member.icon;
              return (
                <div
                  key={member.name}
                  className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-blue-700" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">{member.name}</h3>
                  <p className="mt-1 text-blue-700 font-medium">{member.role}</p>
                  <p className="mt-3 text-gray-600 leading-relaxed text-sm">{member.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center text-white">
            <div className="group cursor-default">
              <div className="text-4xl md:text-5xl font-bold mb-2 group-hover:scale-110 transition-transform duration-300">
                {isLoading ? (
                  <span className="inline-block animate-pulse">...</span>
                ) : (
                  <CountUpAnimation end={stats.toolsCount} suffix="+" duration={1800} />
                )}
              </div>
              <div className="text-blue-100">收录工具</div>
            </div>
            <div className="group cursor-default">
              <div className="text-4xl md:text-5xl font-bold mb-2 group-hover:scale-110 transition-transform duration-300">
                {isLoading ? (
                  <span className="inline-block animate-pulse">...</span>
                ) : (
                  <CountUpAnimation end={stats.categoriesCount} suffix="+" duration={1800} delay={150} />
                )}
              </div>
              <div className="text-blue-100">工具分类</div>
            </div>
            <div className="group cursor-default">
              <div className="text-4xl md:text-5xl font-bold mb-2 group-hover:scale-110 transition-transform duration-300">
                <span className="inline-block">∞</span>
              </div>
              <div className="text-blue-100">持续更新</div>
            </div>
            <div className="group cursor-default">
              <div className="text-4xl md:text-5xl font-bold mb-2 group-hover:scale-110 transition-transform duration-300">
                <CountUpAnimation end={100} suffix="%" duration={1800} delay={300} />
              </div>
              <div className="text-blue-100">用心服务</div>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">常见问题</h2>
            <p className="text-lg text-gray-600">提交、收录与共建相关</p>
          </div>

          <div className="space-y-4">
            {faqItems.map((item) => (
              <details key={item.q} className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer list-none flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-5 h-5 text-blue-700 mt-0.5 flex-shrink-0" />
                    <span className="text-base font-semibold text-gray-900">{item.q}</span>
                  </div>
                  <span className="text-gray-400 group-open:rotate-90 transition-transform">
                    <ArrowRight className="w-5 h-5" />
                  </span>
                </summary>
                <p className="mt-3 text-gray-700 leading-relaxed text-sm pl-8">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="scroll-mt-24 py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">联系我们</h2>
          <p className="text-lg text-gray-600 mb-8">有建议、合作或问题反馈？欢迎联系我们或在 GitHub 提交 Issue/PR。</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="mailto:contact@tumuai.net"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-white border border-gray-200 text-gray-700 hover:text-blue-700 hover:border-blue-200 transition-colors shadow-sm"
            >
              <Mail className="w-5 h-5" />
              <span>contact@tumuai.net</span>
            </a>
            <a
              href="https://github.com/gugug168/tumuai"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-white border border-gray-200 text-gray-700 hover:text-blue-700 hover:border-blue-200 transition-colors shadow-sm"
            >
              <Github className="w-5 h-5" />
              <span>GitHub</span>
            </a>
            <a
              href="https://www.tumuai.net"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-white border border-gray-200 text-gray-700 hover:text-blue-700 hover:border-blue-200 transition-colors shadow-sm"
            >
              <Globe className="w-5 h-5" />
              <span>官网</span>
            </a>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-gray-900 font-semibold">
                <Bug className="w-5 h-5 text-blue-700" />
                反馈问题
              </div>
              <p className="mt-2 text-gray-600 text-sm leading-relaxed">
                发现链接失效、描述不准确、分类不合理？欢迎提交反馈，我们会持续修正。
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-gray-900 font-semibold">
                <GitPullRequest className="w-5 h-5 text-blue-700" />
                提交 PR
              </div>
              <p className="mt-2 text-gray-600 text-sm leading-relaxed">你也可以在 GitHub 直接提交 PR，共建分类、文案与功能改进。</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-gray-900 font-semibold">
                <MessageSquare className="w-5 h-5 text-blue-700" />
                合作共创
              </div>
              <p className="mt-2 text-gray-600 text-sm leading-relaxed">若你是工具作者或团队，欢迎联系：我们可以一起完善介绍与案例展示。</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
});

AboutPage.displayName = 'AboutPage';

export default AboutPage;
