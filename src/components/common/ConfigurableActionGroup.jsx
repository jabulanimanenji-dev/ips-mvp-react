import React from 'react';
import { useCMS } from '../../context/CMSContext';
import ConfigurableAction from './ConfigurableAction';

export default function ConfigurableActionGroup({ ids, portal, area, className = '', style = {}, actionClassName = '', actionStyle = {} }) {
  const { config } = useCMS();
  const buttons = Object.values(config.buttons || {})
    .filter(button => ids ? ids.includes(button.id) : button.portal === portal && button.area === area)
    .sort((a, b) => a.position - b.position);
  return (
    <div className={className} style={style}>
      {buttons.map(button => <ConfigurableAction key={button.id} button={button} className={actionClassName} style={actionStyle} />)}
    </div>
  );
}
