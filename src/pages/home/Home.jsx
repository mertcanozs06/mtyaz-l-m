import React from 'react';
import Header from '../../components/header/Header';
import Slick from '../../components/slider/Slick';

import TanıtımHeaderContent from '../../components/tanıtım-header/TanıtımHeaderContent';
import Tanitim from '../../components/tanıtım/Tanıtım';
import QrÖzellik from '../../components/qrözellik/QrÖzellik';
import NedenBizi from '../../components/nedenbizi/NedenBizi';
import Footer from '../../components/footer/Footer';
import FAQ from '../../components/faq/FAQ';
const Home = () => {
  return (
    <main className="w-full min-h-screen overflow-x-hidden">
      <div className='p-2 bg-blue-700 w-full  text-xl text-center text-white'>
        Hemen Üye Ol 30 Gün Ücretsiz Deneme Hakkından Yararlan.
      </div>
      <Header />
      <Slick />
      <NedenBizi/>
      <Tanitim/>
      <TanıtımHeaderContent/>
      <QrÖzellik/>
      <FAQ/>
      <Footer/>
    </main>
  );
};

export default Home;