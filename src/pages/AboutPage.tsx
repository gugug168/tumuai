import React from 'react';
import { Target, Users, Award, Lightbulb, Mail, Github, Linkedin } from 'lucide-react';
import CountUpAnimation from '../components/CountUpAnimation';

const teamMembers = [
  {
    name: '张工程师',
    role: '创始人 & 产品负责人',
    description: '15年结构设计经验，致力于推动AI在土木工程中的应用',
    avatar: 'https://images.pexels.com/photos/3785079/pexels-photo-3785079.jpeg?auto=compress&cs=tinysrgb&w=200'
  },
  {
    name: '李工程师',
    role: '技术总监',
    description: 'BIM专家，专注于建筑信息化和智能化解决方案',
    avatar: 'https://images.pexels.com/photos/3777943/pexels-photo-3777943.jpeg?auto=compress&cs=tinysrgb&w=200'
  },
  {
    name: '王工程师',
    role: '内容策划',
    description: '施工管理专家，负责工具评测和内容策划',
    avatar: 'https://images.pexels.com/photos/3785077/pexels-photo-3785077.jpeg?auto=compress&cs=tinysrgb&w=200'
  }
];

const values = [
  {
    icon: Target,
    title: '专业专注',
    description: '专注于土木工程领域，深度理解行业需求，提供最相关的工具推荐'
  },
  {
    icon: Users,
    title: '服务工程师',
    description: '以工程师的实际需求为出发点，帮助提升工作效率和专业能力'
  },
  {
    icon: Award,
    title: '质量保证',
    description: '严格筛选每一个工具，确保推荐的都是经过验证的优质解决方案'
  },
  {
    icon: Lightbulb,
    title: '创新驱动',
    description: '关注最新的AI技术发展，第一时间发现和分享创新工具'
  }
];

const AboutPage = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            关于 TumuAI.net
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed">
            我们致力于为土木工程师打造最专业、最全面的AI工具导航平台，
            帮助工程师发现和使用最新的人工智能技术，提升工作效率和专业能力。
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">我们的使命</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              让每一位土木工程师都能轻松找到并使用最适合的AI工具，推动整个行业的数字化转型
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => {
              const IconComponent = value.icon;
              return (
                <div key={index} className="text-center">
                  <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <IconComponent className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{value.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{value.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">我们的故事</h2>
          </div>
          
          <div className="prose prose-lg mx-auto text-gray-600">
            <p className="text-lg leading-relaxed mb-6">
            TumuAI.net诞生于一群资深土木工程师的共同愿景。在日常工作中，我们发现AI技术正在快速发展，
              但很多优秀的工具分散在互联网的各个角落，工程师们往往需要花费大量时间去寻找和筛选。
            </p>
            
            <p className="text-lg leading-relaxed mb-6">
              作为从业多年的工程师，我们深知时间的宝贵。每一个项目都有严格的时间节点，
              每一次计算都关乎工程安全。如果能有一个专门的平台，汇集所有与土木工程相关的AI工具，
              那将为整个行业带来巨大的价值。
            </p>
            
            <p className="text-lg leading-relaxed mb-6">
              于是，TumuAI.net 应运而生。我们不仅仅是一个工具目录，更是一个专业的推荐平台。
              每一个工具都经过我们团队的亲自测试和评估，确保推荐给用户的都是真正有价值的解决方案。
            </p>
            
            <p className="text-lg leading-relaxed">
              我们相信，通过AI技术的赋能，土木工程师可以将更多精力投入到创造性的工作中，
              推动整个行业向更高效、更智能的方向发展。
            </p>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">核心团队</h2>
            <p className="text-lg text-gray-600">
              由资深土木工程师组成的专业团队
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {teamMembers.map((member, index) => (
              <div key={index} className="text-center group">
                <div className="relative inline-block mb-4">
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-32 h-32 rounded-full mx-auto object-cover group-hover:scale-105 group-hover:shadow-xl transition-all duration-300 border-4 border-white shadow-lg"
                  />
                  <div className="absolute inset-0 rounded-full bg-blue-600/0 group-hover:bg-blue-600/10 transition-all duration-300"></div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">{member.name}</h3>
                <p className="text-blue-600 font-medium mb-3">{member.role}</p>
                <p className="text-gray-600 leading-relaxed">{member.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center text-white">
            <div className="group cursor-default">
              <div className="text-4xl md:text-5xl font-bold mb-2 group-hover:scale-110 transition-transform duration-300">
                <CountUpAnimation end={88} suffix="+" duration={2000} />
              </div>
              <div className="text-blue-100">收录工具</div>
            </div>
            <div className="group cursor-default">
              <div className="text-4xl md:text-5xl font-bold mb-2 group-hover:scale-110 transition-transform duration-300">
                <CountUpAnimation end={7} suffix="+" duration={2000} delay={200} />
              </div>
              <div className="text-blue-100">工具分类</div>
            </div>
            <div className="group cursor-default">
              <div className="text-4xl md:text-5xl font-bold mb-2 group-hover:scale-110 transition-transform duration-300">
                <span className="inline-block animate-pulse">∞</span>
              </div>
              <div className="text-blue-100">持续更新</div>
            </div>
            <div className="group cursor-default">
              <div className="text-4xl md:text-5xl font-bold mb-2 group-hover:scale-110 transition-transform duration-300">
                <CountUpAnimation end={100} suffix="%" duration={2000} delay={400} />
              </div>
              <div className="text-blue-100">用心服务</div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">联系我们</h2>
          <p className="text-lg text-gray-600 mb-8">
            有任何建议或合作意向，欢迎与我们联系
          </p>
          
          <div className="flex justify-center space-x-6">
            <a
              href="mailto:contact@tumuai.net"
              className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Mail className="w-5 h-5" />
              <span>contact@tumuai.net</span>
            </a>
            <a
              href="https://github.com/gugug168/tumuai"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Github className="w-5 h-5" />
              <span>GitHub</span>
            </a>
            <a
              href="https://www.tumuai.net"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Linkedin className="w-5 h-5" />
              <span>官网</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;