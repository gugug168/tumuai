import React, { useState } from 'react';
import { Mail, Send, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Newsletter = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);

    // 模拟API调用
    setTimeout(() => {
      setIsSubscribed(true);
      setIsLoading(false);
      setEmail('');
    }, 1000);
  };

  if (isSubscribed) {
    return (
      <section className="py-16 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {t('newsletter.successTitle')}
            </h3>
            <p className="text-gray-600">
              {t('newsletter.successMessage')}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-blue-100 p-4 rounded-full">
              <Mail className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            {t('newsletter.title')}
          </h3>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            {t('newsletter.description')}
          </p>

          <form onSubmit={handleSubmit} className="max-w-md mx-auto">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('newsletter.emailPlaceholder')}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-gray-900 placeholder-gray-500"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {t('newsletter.subscribe')}
                    <Send className="ml-2 w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <p className="text-xs text-gray-500 mt-4">
            {t('newsletter.privacyNote')}
          </p>

          {/* 订阅统计 */}
          <div className="flex items-center justify-center space-x-8 mt-8 pt-6 border-t border-gray-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">5,000+</div>
              <div className="text-sm text-gray-500">{t('newsletter.statsSubscribers')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">98%</div>
              <div className="text-sm text-gray-500">{t('newsletter.statsSatisfaction')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{t('newsletter.statsFrequency')}</div>
              <div className="text-sm text-gray-500">{t('newsletter.statsFrequencyLabel')}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Newsletter;