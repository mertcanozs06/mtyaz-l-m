import React from 'react'
import Header from '../../components/header/Header'
import Slick from '../../components/slider/Slick'
import FiyatListesi from '../../components/fiyatlistesi/FiyatListesi'
import Footer from '../../components/footer/Footer'
const Fiyatlar = () => {
  return (
    <div className="overflow-x-hidden">
        <Header/>
        <FiyatListesi/>
        <Footer/>
    </div>
  )
}

export default Fiyatlar