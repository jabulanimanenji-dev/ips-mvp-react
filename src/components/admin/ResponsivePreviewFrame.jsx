import React, { useCallback, useEffect, useRef } from 'react';

export default function ResponsivePreviewFrame({
  width,
  height,
  scale,
  title,
  config,
  pageId,
  device,
  previewState,
  selectedElementId,
  selectedNativeKey,
  onDocument,
  onHeight,
  onSection,
  onElement,
  onNativeElement,
  onNativeCatalog
}) {
  const iframe = useRef(null);

  const sendUpdate = useCallback(() => {
    iframe.current?.contentWindow?.postMessage({
      type: 'ips-preview-update',
      config,
      pageId,
      device,
      previewState,
      selectedElementId,
      selectedNativeKey
    }, window.location.origin);
  }, [config, pageId, device, previewState, selectedElementId, selectedNativeKey]);

  useEffect(() => {
    sendUpdate();
  }, [sendUpdate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      iframe.current?.contentWindow?.postMessage({
        type: 'ips-preview-request-native-catalog',
        pageId
      }, window.location.origin);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [pageId, device, previewState]);

  useEffect(() => {
    const pullCatalog = () => {
      try {
        const detail = iframe.current?.contentWindow?.__IPS_STUDIO_CATALOG__;
        if (detail?.pageId === pageId && Array.isArray(detail.elements)) onNativeCatalog?.(detail.elements);
      } catch {
        // The preview is same-origin in Platform Studio. Ignore a transient read while it reloads.
      }
    };
    pullCatalog();
    const timer = window.setInterval(pullCatalog, 300);
    return () => window.clearInterval(timer);
  }, [pageId, device, previewState, onNativeCatalog]);

  useEffect(() => {
    const receive = event => {
      if (event.origin !== window.location.origin || event.source !== iframe.current?.contentWindow) return;
      if (event.data?.type === 'ips-preview-ready') sendUpdate();
      if (event.data?.type === 'ips-preview-height' && event.data.pageId === pageId) onHeight?.(Number(event.data.height) || height);
      if (event.data?.type === 'ips-preview-section' && event.data.pageId === pageId) onSection?.(event.data.section);
      if (event.data?.type === 'ips-preview-element' && event.data.pageId === pageId) onElement?.(event.data.elementId);
      if (event.data?.type === 'ips-preview-native-element' && event.data.pageId === pageId) onNativeElement?.(event.data.key);
      if (event.data?.type === 'ips-preview-native-catalog' && event.data.pageId === pageId) onNativeCatalog?.(event.data.elements || []);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [height, onElement, onHeight, onNativeCatalog, onNativeElement, onSection, pageId, sendUpdate]);

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
