import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

const AboutPage = React.memo(() => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<SiteStats>({ toolsCount: 0, categoriesCount: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // 动态生成 values 数组以支持翻译
  const values = useMemo(() => [
    {
      icon: Target,
      title: t('about.value1Title'),
      description: t('about.value1Desc')
    },
    {
      icon: Users,
      title: t('about.value2Title'),
      description: t('about.value2Desc')
    },
    {
      icon: Award,
      title: t('about.value3Title'),
      description: t('about.value3Desc')
    },
    {
      icon: Lightbulb,
      title: t('about.value4Title'),
      description: t('about.value4Desc')
    }
  ], [t]);

  // 动态生成 teamMembers 数组以支持翻译
  const teamMembers = useMemo(() => [
    {
      name: t('about.team1Name'),
      role: t('about.team1Role'),
      description: t('about.team1Desc'),
      icon: Sparkles
    },
    {
      name: t('about.team2Name'),
      role: t('about.team2Role'),
      description: t('about.team2Desc'),
      icon: Code2
    },
    {
      name: t('about.team3Name'),
      role: t('about.team3Role'),
      description: t('about.team3Desc'),
      icon: PenTool
    }
  ], [t]);

  useMetaTags({
    title: `${t('about.title')} - TumuAI.net`,
    description: t('about.metaDesc'),
    canonical: 'https://www.tumuai.net/about',
    ogTitle: `${t('about.title')} - TumuAI.net`,
    ogDescription: t('about.metaDesc')
  });

  const workflowSteps = useMemo(
    () => [
      {
        title: t('about.workflow1Title'),
        description: t('about.workflow1Desc'),
        href: '/submit'
      },
      {
        title: t('about.workflow2Title'),
        description: t('about.workflow2Desc'),
        href: '/submit'
      },
      {
        title: t('about.workflow3Title'),
        description: t('about.workflow3Desc'),
        href: '/tools'
      },
      {
        title: t('about.workflow4Title'),
        description: t('about.workflow4Desc'),
        href: '/tools'
      }
    ],
    [t]
  );

  const reviewCriteria = useMemo(
    () => [
      {
        title: t('about.criteria1Title'),
        points: [t('about.criteria1p1'), t('about.criteria1p2'), t('about.criteria1p3')]
      },
      {
        title: t('about.criteria2Title'),
        points: [t('about.criteria2p1'), t('about.criteria2p2'), t('about.criteria2p3')]
      },
      {
        title: t('about.criteria3Title'),
        points: [t('about.criteria3p1'), t('about.criteria3p2'), t('about.criteria3p3')]
      },
      {
        title: t('about.criteria4Title'),
        points: [t('about.criteria4p1'), t('about.criteria4p2'), t('about.criteria4p3')]
      }
    ],
    [t]
  );

  const faqItems = useMemo(
    () => [
      {
        q: t('about.faq1Q'),
        a: t('about.faq1A')
      },
      {
        q: t('about.faq2Q'),
        a: t('about.faq2A')
      },
      {
        q: t('about.faq3Q'),
        a: t('about.faq3A')
      },
      {
        q: t('about.faq4Q'),
        a: t('about.faq4A')
      }
    ],
    [t]
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
          const toolsResponse = await fetch('/api/public-api?action=tools&limit=1&includeCount=true');
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
          const categoriesResponse = await fetch('/api/public-api?action=categories');
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
            <span>{t('about.badge')}</span>
          </div>

          <h1 className="mt-6 text-4xl md:text-5xl font-bold text-gray-900">{t('about.pageTitle')}</h1>

          <p className="mt-6 text-xl text-gray-700 leading-relaxed max-w-3xl mx-auto">
            {t('about.intro')}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/tools"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              {t('about.browseTools')}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
            <Link
              to="/submit"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-lg bg-white text-blue-700 font-medium border border-blue-200 hover:bg-blue-50 transition-colors"
            >
              {t('about.submitTool')}
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm text-gray-600">
            {[
              { href: '#mission', label: t('about.navMission') },
              { href: '#workflow', label: t('about.navWorkflow') },
              { href: '#criteria', label: t('about.navCriteria') },
              { href: '#faq', label: t('about.navFaq') },
              { href: '#privacy', label: t('about.navPrivacy') },
              { href: '#terms', label: t('about.navTerms') },
              { href: '#contact', label: t('about.navContact') }
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
              <div className="text-xs text-gray-500">{t('about.statsTools')}</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">
                {isLoading ? (
                  <span className="inline-block animate-pulse">...</span>
                ) : (
                  <CountUpAnimation end={stats.toolsCount} suffix="+" duration={1200} />
                )}
              </div>
            </div>
            <div className="bg-white/70 border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">{t('about.statsCategories')}</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">
                {isLoading ? (
                  <span className="inline-block animate-pulse">...</span>
                ) : (
                  <CountUpAnimation end={stats.categoriesCount} suffix="+" duration={1200} delay={100} />
                )}
              </div>
            </div>
            <div className="bg-white/70 border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">{t('about.statsUpdate')}</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{t('about.statsUpdateValue')}</div>
            </div>
            <div className="bg-white/70 border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">{t('about.statsContribute')}</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{t('about.statsContributeValue')}</div>
            </div>
          </div>
        </div>
      </section>

      <section id="mission" className="scroll-mt-24 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">{t('about.missionTitle')}</h2>
              <p className="text-lg text-gray-700 leading-relaxed">
                {t('about.missionDesc')}
              </p>

              <div className="mt-6 space-y-3 text-gray-700">
                {[
                  t('about.missionPoint1'),
                  t('about.missionPoint2'),
                  t('about.missionPoint3')
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
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t('about.storyTitle')}</h2>
            <p className="text-lg text-gray-600">{t('about.storySubtitle')}</p>
          </div>

          <div className="space-y-6 text-gray-700 leading-relaxed text-lg">
            <p>
              {t('about.storyP1')}
            </p>
            <p>
              {t('about.storyP2')}
            </p>
            <p>
              {t('about.storyP3')}
            </p>
          </div>
        </div>
      </section>

      <section id="workflow" className="scroll-mt-24 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t('about.workflowTitle')}</h2>
            <p className="text-lg text-gray-600">{t('about.workflowSubtitle')}</p>
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
                    {t('about.learnMore')}
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
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t('about.criteriaTitle')}</h2>
            <p className="text-lg text-gray-600">{t('about.criteriaSubtitle')}</p>
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
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t('about.teamTitle')}</h2>
            <p className="text-lg text-gray-600">{t('about.teamSubtitle')}</p>
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
              <div className="text-blue-100">{t('about.statsTools')}</div>
            </div>
            <div className="group cursor-default">
              <div className="text-4xl md:text-5xl font-bold mb-2 group-hover:scale-110 transition-transform duration-300">
                {isLoading ? (
                  <span className="inline-block animate-pulse">...</span>
                ) : (
                  <CountUpAnimation end={stats.categoriesCount} suffix="+" duration={1800} delay={150} />
                )}
              </div>
              <div className="text-blue-100">{t('about.statsCategories')}</div>
            </div>
            <div className="group cursor-default">
              <div className="text-4xl md:text-5xl font-bold mb-2 group-hover:scale-110 transition-transform duration-300">
                <span className="inline-block">∞</span>
              </div>
              <div className="text-blue-100">{t('about.statsUpdateValue')}</div>
            </div>
            <div className="group cursor-default">
              <div className="text-4xl md:text-5xl font-bold mb-2 group-hover:scale-110 transition-transform duration-300">
                <CountUpAnimation end={100} suffix="%" duration={1800} delay={300} />
              </div>
              <div className="text-blue-100">{t('about.statsService')}</div>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t('about.faqTitle')}</h2>
            <p className="text-lg text-gray-600">{t('about.faqSubtitle')}</p>
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

      <section id="privacy" className="scroll-mt-24 py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t('about.privacyTitle')}</h2>
            <p className="text-lg text-gray-600">{t('about.privacySubtitle')}</p>
          </div>

          <div className="space-y-4 text-gray-700 leading-relaxed">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-2">{t('about.privacyCollectTitle')}</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>{t('about.privacyCollect1')}</li>
                <li>{t('about.privacyCollect2')}</li>
                <li>{t('about.privacyCollect3')}</li>
              </ul>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-2">{t('about.privacyUseTitle')}</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>{t('about.privacyUse1')}</li>
                <li>{t('about.privacyUse2')}</li>
              </ul>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-2">{t('about.privacyStorageTitle')}</h3>
              <p className="text-sm">
                {t('about.privacyStorageDesc')}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-2">{t('about.contactUs')}</h3>
              <p className="text-sm">
                {t('about.privacyContactDesc')}
              </p>
              <p className="text-xs text-gray-500 mt-2">{t('about.privacyNote')}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="terms" className="scroll-mt-24 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t('about.termsTitle')}</h2>
            <p className="text-lg text-gray-600">{t('about.termsSubtitle')}</p>
          </div>

          <div className="space-y-4 text-gray-700 leading-relaxed">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-2">{t('about.termsDisclaimerTitle')}</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>{t('about.termsDisclaimer1')}</li>
                <li>{t('about.termsDisclaimer2')}</li>
              </ul>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-2">{t('about.termsContentTitle')}</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>{t('about.termsContent1')}</li>
                <li>{t('about.termsContent2')}</li>
              </ul>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-2">{t('about.termsUpdateTitle')}</h3>
              <p className="text-sm">{t('about.termsUpdateDesc')}</p>
              <p className="text-xs text-gray-500 mt-2">{t('about.privacyNote')}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="scroll-mt-24 py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">{t('about.contactUs')}</h2>
          <p className="text-lg text-gray-600 mb-8">{t('about.contactSubtitle')}</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <div className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-white border border-gray-200 text-gray-700 shadow-sm">
              <MessageSquare className="w-5 h-5" />
              <span>{t('about.wechat')}: fuyesq168</span>
            </div>
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
              <span>{t('about.website')}</span>
            </a>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-gray-900 font-semibold">
                <Bug className="w-5 h-5 text-blue-700" />
                {t('about.feedbackTitle')}
              </div>
              <p className="mt-2 text-gray-600 text-sm leading-relaxed">
                {t('about.feedbackDesc')}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-gray-900 font-semibold">
                <GitPullRequest className="w-5 h-5 text-blue-700" />
                {t('about.prTitle')}
              </div>
              <p className="mt-2 text-gray-600 text-sm leading-relaxed">{t('about.prDesc')}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-gray-900 font-semibold">
                <MessageSquare className="w-5 h-5 text-blue-700" />
                {t('about.collabTitle')}
              </div>
              <p className="mt-2 text-gray-600 text-sm leading-relaxed">{t('about.collabDesc')}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
});

AboutPage.displayName = 'AboutPage';

export default AboutPage;
