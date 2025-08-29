import React from 'react';

const Hero = () => {

  return (
    <section className="bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 py-8 min-h-[40vh] flex items-center relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-100/30 via-blue-100/20 to-transparent"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-200/20 to-transparent rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-purple-200/20 to-transparent rounded-full blur-3xl"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            发现最好的
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">土木工程AI工具</span>
          </h1>
          <p className="text-lg md:text-xl mb-4 max-w-4xl mx-auto leading-relaxed text-gray-700">
            <span className="text-blue-600 font-semibold">500+</span> 个土木工具和 
            <span className="text-purple-600 font-semibold">8</span> 个分类，已收录于最大的土木工具导航站。
          </p>
          <p className="text-sm text-gray-500 mb-6">
            土木工具列表和GPTs列表通过ChatGPT每天自动更新。
          </p>
        </div>
      </div>
    </section>
  );
};

export default Hero;