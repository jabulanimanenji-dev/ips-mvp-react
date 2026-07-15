import React from 'react';
import { BADGE_STYLES } from '../../utils/constants';

export default function Badge({ status, children, className = '' }) {
  const styleClass = status && BADGE_STYLES[status] ? BADGE_STYLES[status] : '';
  const combined = ['badge', styleClass, className].filter(Boolean).join(' ');

  return (
    <span className={combined}>
      {children || status}
    </span>
  );
}
