import React from 'react'

const TanıtımHeaderContent = () => {
  return (
    <div className="bg-gray-800 text-white py-10 px-4">
      <div className="w-full max-w-5xl mx-auto text-center">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6 leading-snug">
          İşletmenizi kolayca <span className="text-sky-400">MT Yazılım</span> ile{' '}
          <span className="text-sky-400">KOLAYCA</span> ve{' '}
          <span className="text-sky-400">TEK</span> yerden yönetin
        </h1>
        <p className="text-sm sm:text-base md:text-lg text-gray-300 leading-relaxed">
          Cafe, restoran, lokanta özetle işletmenizin gücünü artıracak, müşteri memnuniyetini
          geliştirecek ve hizmetlerinizi kolayca sunmanızı sağlayacak özellikleri sizin için tek bir
          restaurant cafe adisyon programında topladık.
        </p>
      </div>
    </div>
  );
};

export default TanıtımHeaderContent;
