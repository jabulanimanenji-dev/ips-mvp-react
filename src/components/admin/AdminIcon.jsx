import React from 'react';

const glyphs={
  overview:<><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></>,
  quotes:<><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="m4.5 7 7.5 6 7.5-6"/></>,
  telegram:<><path d="m21 3-4 18-5.9-5.3-4.2 3.1.9-5.6L3 11z"/><path d="m8 13 9-7"/></>,
  messages:<><path d="M20 16a3 3 0 0 1-3 3H8l-4 2V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z"/><path d="M8 9h8M8 13h6"/></>,
  support:<><circle cx="12" cy="12" r="9"/><path d="M9.3 9.2a3 3 0 0 1 5.6 1.2c0 2-2.9 2.3-2.9 4.1M12 17.8h.01"/></>,
  clients:<><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5.5a3 3 0 0 1 0 5.5M18.5 20v-2a5.8 5.8 0 0 0-2.5-4.8"/></>,
  specialists:<><path d="M4 20h16M6 20V8l6-4 6 4v12M9 11h6M9 15h6"/></>,
  projects:<><rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 4.5V2M16 4.5V2M8 10h8M8 14h8M8 18h5"/></>,
  reports:<><path d="M4 20V4M4 20h16M8 16v-5M13 16V7M18 16v-9"/></>,
  access:<><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 11.4-2.6"/><circle cx="18" cy="17" r="3"/><path d="M18 14v-2M15.2 15.4l-1.8-1.1M20.8 15.4l1.8-1.1"/></>,
  settings:<><path d="M9.5 3.8 10 2h4l.5 1.8 1.8 1 1.8-.5 2 3.4-1.4 1.3v2l1.4 1.3-2 3.4-1.8-.5-1.8 1L14 18h-4l-.5-1.8-1.8-1-1.8.5-2-3.4L5.3 11V9L3.9 7.7l2-3.4 1.8.5z" transform="translate(0 2)"/><circle cx="12" cy="12" r="2.7"/></>,
  payments:<><rect x="2.8" y="5" width="18.4" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>,
  arrow:<path d="M5 12h14m-6-6 6 6-6 6"/>,
  chevron:<path d="m9 18 6-6-6-6"/>,
  search:<><circle cx="10.7" cy="10.7" r="6.8"/><path d="m15.8 15.8 5 5"/></>,
  refresh:<><path d="M20 8a8 8 0 0 0-14-2L4 8m0-5v5h5M4 16a8 8 0 0 0 14 2l2-2m0 5v-5h-5"/></>,
  check:<path d="m4.5 12 5 5 10-10"/>,
  alert:<><path d="m12 3 10 18H2z"/><path d="M12 9v5M12 17.5h.01"/></>,
  clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
  lock:<><rect x="5.5" y="10" width="13" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  plus:<path d="M12 4v16M4 12h16"/>,
  menu:<path d="M4 7h16M4 12h16M4 17h16"/>,
  close:<path d="M5 5l14 14M19 5 5 19"/>,
  logout:<><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M13 16l4-4-4-4M9 12h8"/></>,
  shield:<><path d="m12 2 8 3v6c0 5-3 8-8 11-5-3-8-6-8-11V5z"/><path d="m8 12 2.5 2.5 5-5"/></>,
  file:<><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h4M9 12h6M9 16h6"/></>,
  activity:<><path d="M2 12h4l3-7 5 14 3-7h5"/></>
};
export default function AdminIcon({name='overview',size=19,className='',...props}){
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false" {...props}>{glyphs[name]||glyphs.overview}</svg>;
}
