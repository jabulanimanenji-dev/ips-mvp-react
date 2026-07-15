import React, { useState, useEffect, useCallback } from 'react';

let toastId = 0;
const toastQueue = [];
let toastListeners = [];

function notify() {
  toastListeners.forEach(fn => fn([...toastQueue]));
}

export function addToast(message, type = 'info', duration = 4000) {
  const id = ++toastId;
  const toast = { id, message, type, duration };
  toastQueue.push(toast);
  notify();

  if (duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }

  return id;
}

export function removeToast(id) {
  const idx = toastQueue.findIndex(t => t.id === id);
  if (idx !== -1) {
    toastQueue.splice(idx, 1);
    notify();
  }
}

export default function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const listener = (list) => setToasts(list);
    toastListeners.push(listener);
    setToasts([...toastQueue]);
    return () => {
      toastListeners = toastListeners.filter(fn => fn !== listener);
    };
  }, []);

  const handleDismiss = useCallback((id) => {
    removeToast(id);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            onClick={() => handleDismiss(t.id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '1rem',
              lineHeight: 1,
              padding: '0.25rem'
            }}
            aria-label="Dismiss toast"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
