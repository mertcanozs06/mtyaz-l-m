import React from 'react'
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { BiFullscreen } from 'react-icons/bi';
import image1 from '../../../src/assets/Images/images1.jpg';
import image2 from '../../../src/assets/Images/images2.jpg';

const Slick = () => {
    var settings = {
    dots: false,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
  };
  return (
    <div className='w-full  overflow-hidden h-[200px] md:h-[400px] lg:h-[500px] mb-6'>
    <Slider {...settings} className=''>
      <div className='h-[200px] md:h-[400px] lg:h-[500px]'> 
        <img src={image1} className='w-full h-full object-cover object-center'/>
      </div>
      <div className='h-[200px] md:h-[400px] lg:h-[500px] relative'> 
        <h1 className='absolute left-110 top-110 text-4xl'>MT YAZILIMLA FİRMANIZI İLERİYE TAŞIYIN</h1>
        <img src={image2} alt="imagesNull" className='w-full h-full object-cover object-center'/>
      </div>
      <div className='h-[200px] md:h-[400px] lg:h-[500px]'>
        <img src={image2} alt="imagesNull" className='w-full h-full object-cover object-center'/>
      </div>
      <div className='h-[200px] md:h-[400px] lg:h-[500px]'>
        <img src={image1} alt="imagesNull" className='w-full h-full object-cover object-center'/>
      </div>
      <div className='h-[200px] md:h-[400px] lg:h-[500px]'>
        <img src={image2} alt="imagesNull" className='w-full h-full object-cover object-center'/>
      </div>
      <div className='h-[200px] md:h-[400px] lg:h-[500px]'>
        <img src={image1} alt="imagesNull" className='w-full h-full object-cover object-center'/>
      </div>
    </Slider>
    </div> 
    );
}

export default Slick