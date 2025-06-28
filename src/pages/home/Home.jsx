import React from 'react';
import Header from '../../components/header/Header';
import Slick from '../../components/slider/Slick';

const Home = () => {
  return (
    <main className="w-full min-h-screen overflow-x-hidden">
      <Header />
      <Slick />
    </main>
  );
};

export default Home;