import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function ConfigurableAction({ button, className = '', style = {}, onAction }) {
  const location = useLocation();
  const navigate = useNavigate();
  if (!button?.visible) return null;

  const visibilityClass = button.showOn === 'desktop'
    ? 'config-desktop-only'
    : button.showOn === 'mobile'
      ? 'config-mobile-only'
      : '';
  const buttonClass = `btn btn-${button.variant || 'primary'} ${visibilityClass} ${className}`.trim();
  const configuredStyle = {
    ...style,
    ...(button.backgroundColor ? { background: button.backgroundColor } : {}),
    ...(button.textColor ? { color: button.textColor } : {})
  };
  const label = <>{button.icon && <span aria-hidden="true">{button.icon}</span>}{button.label}</>;

  if (button.target?.startsWith('#') || button.actionType === 'anchor') {
    const handleClick = () => {
      onAction?.();
      const scroll = () => document.querySelector(button.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (location.pathname !== '/') {
        navigate('/');
        window.setTimeout(scroll, 80);
      } else {
        scroll();
      }
    };
    return <button type="button" className={buttonClass} style={configuredStyle} onClick={handleClick}>{label}</button>;
  }

  return <Link className={buttonClass} style={configuredStyle} to={button.target || '/'} onClick={onAction}>{label}</Link>;
}
