import React from 'react';
import { Link } from 'react-router-dom';
import GirişYap from './girişyap/GirişYap';
import ÜyeOl from './üyeol/ÜyeOl';
const Links = ({isOpen}) => {
  return (
   <div className='flex overflow-x-hidden   gap-4  ml-6'>
     <GirişYap/> 
     <ÜyeOl/> 

   </div>
    
  )
}

export default Links