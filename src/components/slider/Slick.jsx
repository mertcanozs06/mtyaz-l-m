import React from 'react';
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import image1 from '../../../src/assets/Images/images1.jpg';
import image2 from '../../../src/assets/Images/images2.jpg';

const Slick = () => {
  const settings = {
    dots: false,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: false,
    autoplay: true,
    autoplaySpeed: 3000,
  };

  return (
    <div className="w-screen overflow-hidden h-[250px] md:h-[400px] lg:h-[500px]">
      <Slider {...settings}>
        {/* SLIDE 1 */}
        <div className="relative w-full h-[250px] md:h-[400px] lg:h-[500px]">
          <img
            src={image1}
            alt="slide1"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>

        {/* SLIDE 2 - Metin Üstünde */}
        <div className="relative w-full h-[250px] md:h-[400px] lg:h-[500px]">
          <img
            src={image2}
            alt="slide2"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <h1 className="absolute z-10 text-white text-xl md:text-4xl font-bold top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center w-[90%]">
            MT YAZILIMLA FİRMANIZI İLERİYE TAŞIYIN
          </h1>
        </div>

        {/* SLIDE 3 */}
        <div className="relative w-full h-[250px] md:h-[400px] lg:h-[500px]">
          <img
            src={image2}
            alt="slide3"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>

        {/* SLIDE 4 */}
        <div className="relative w-full h-[250px] md:h-[400px] lg:h-[500px]">
          <img
            src={image1}
            alt="slide4"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      </Slider>
    </div>
  );
};

export default Slick;