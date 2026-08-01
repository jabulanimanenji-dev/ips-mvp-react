import React, { useCallback, useEffect, useRef } from 'react';

export default function ResponsivePreviewFrame({
  width,
  height,
  scale,
  title,
  config,
  pageId,
  device,
  selectedElementId,
  onDocument,
  onHeight,
  onSection,
  onElement
}) {
  const iframe = useRef(null);

  const sendUpdate = useCallback(() => {
    iframe.current?.contentWindow?.postMessage({
      type: 'ips-preview-update',
      config,
      pageId,
      device,
      selectedElementId
    }, window.location.origin);
  }, [config, pageId, device, selectedElementId]);

  useEffect(() => {
    sendUpdate();
  }, [sendUpdate]);

  useEffect(() => {
    const receive = event => {
      if (event.origin !== window.location.origin || event.source !== iframe.current?.contentWindow) return;
      if (event.data?.type === 'ips-preview-ready') sendUpdate();
      if (event.data?.type === 'ips-preview-height' && event.data.pageId === pageId) onHeight?.(Number(event.data.height) || height);
      if (event.data?.type === 'ips-preview-section' && event.data.pageId === pageId) onSection?.(event.data.section);
      if (event.data?.type === 'ips-preview-element' && event.data.pageId === pageId) onElement?.(event.data.elementId);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [height, onElement, onHeight, onSection, pageId, sendUpdate]);

  useEffect(() => () => onDocument?.(null), [onDocument]);

  const loaded = () => {
    onDocument?.(iframe.current?.contentDocument || null);
    sendUpdate();
  };

  return (
    <div className="page-designer-device-track" style={{ width: width * scale, height: height * scale }}>
      <iframe
        ref={iframe}
        className="page-designer-device-frame"
        src="/__platform-preview"
        title={title}
        onLoad={loaded}
        style={{ width, height, transform: `scale(${scale})` }}
      />
    </div>
  );
}
