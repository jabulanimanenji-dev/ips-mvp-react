import React from 'react';
import {useCMS} from '../../context/CMSContext';
import ConfigurableAction from './ConfigurableAction';

const academicLaunch=import.meta.env.VITE_STUDENT_LAUNCH==='true';
const academicActions={
  clientRequestService:{label:'Get a Quote',target:'/#request-support',textColor:'#15344e',backgroundColor:'#ffffff'},
  clientAcademicOrder:{label:'My Projects',target:'/client/services',textColor:'#ffffff',backgroundColor:''},
  clientOpenServiceHub:{label:'My Projects',target:'/client/services',textColor:'',backgroundColor:''},
  writerServiceJobs:{label:'My Assignments',target:'/writer/services',textColor:'#15344e',backgroundColor:'#ffffff'},
  writerAcademicJobs:{label:'Academic Assignments',target:'/writer/orders',textColor:'#ffffff',backgroundColor:''}
};
export default function ConfigurableActionGroup({ids,portal,area,className='',style={},actionClassName='',actionStyle={}}){
  const {config}=useCMS();
  const buttons=Object.values(config.buttons||{})
    .filter(button=>ids?ids.includes(button.id):button.portal===portal&&button.area===area)
    .sort((a,b)=>a.position-b.position);
  return <div className={className} style={style}>
    {buttons.map(button=><ConfigurableAction key={button.id}
      button={academicLaunch&&academicActions[button.id]?{...button,...academicActions[button.id]}:button}
      className={actionClassName} style={actionStyle}/>)}
  </div>;
}
