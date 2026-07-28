import React, { useEffect, useState } from 'react';
import { addToast } from '../common/Toast';

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'The media request failed.');
  return data;
};

const toDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('The selected file could not be read.'));
  reader.readAsDataURL(file);
});

export default function MediaLibrary({ canManage = true }) {
  const [assets, setAssets] = useState([]);
  const [file, setFile] = useState(null);
  const [altText, setAltText] = useState('');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [working, setWorking] = useState('');

  const load = async () => {
    try {
      const data = await request('/api/admin/media');
      setAssets(data.assets || []);
    } catch (error) {
      addToast(error.message, 'error');
    }
  };

  useEffect(() => { load(); }, []);

  const upload = async event => {
    event.preventDefault();
    if (!file) return;
    const form = event.currentTarget;
    setWorking('upload');
    try {
      const data = await toDataUrl(file);
      await request('/api/admin/media', {
        method: 'POST',
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type,
          data,
          altText,
          caption,
          tags: tags.split(',').map(tag => tag.trim()).filter(Boolean)
        })
      });
      setFile(null);
      setAltText('');
      setCaption('');
      setTags('');
      form.reset();
      await load();
      addToast('Media uploaded to the governed library.', 'success');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setWorking('');
    }
  };

  const remove = async asset => {
    if (!window.confirm(`Delete ${asset.original_name}? Used media cannot be deleted.`)) return;
    setWorking(asset.asset_id);
    try {
      await request(`/api/admin/media/${asset.asset_id}`, { method: 'DELETE' });
      await load();
      addToast('Media removed.', 'success');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setWorking('');
    }
  };

  return (
    <div className="phase12-content-grid">
      <section className="phase12-panel">
        <div className="phase12-panel-heading"><span>Upload media</span><small>Validated and access-controlled</small></div>
        <form className="flex flex-col gap-3" onSubmit={upload}>
          <input className="form-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" onChange={event => setFile(event.target.files?.[0] || null)} required disabled={!canManage} />
          <small style={{ color: 'var(--text-muted)' }}>Images up to 8 MB. Loop videos up to 25 MB. SVG and executable formats are blocked.</small>
          <input className="form-input" value={altText} onChange={event => setAltText(event.target.value)} placeholder="Accessibility description" />
          <textarea className="form-textarea" value={caption} onChange={event => setCaption(event.target.value)} placeholder="Internal caption or usage note" />
          <input className="form-input" value={tags} onChange={event => setTags(event.target.value)} placeholder="Tags separated by commas" />
          <button className="btn btn-primary" disabled={!canManage || working === 'upload'}>{working === 'upload' ? 'Uploading…' : 'Upload to library'}</button>
        </form>
      </section>

      <section className="phase12-panel phase12-content-wide">
        <div className="phase12-panel-heading"><span>Media library</span><small>{assets.length} assets</small></div>
        {assets.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No media has been uploaded yet.</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '1rem' }}>
            {assets.map(asset => (
              <article key={asset.asset_id} style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: 'var(--bg-surface-2)' }}>
                <div style={{ height: 150, background: '#050814', display: 'grid', placeItems: 'center' }}>
                  {asset.media_type === 'video'
                    ? <video src={`/api/media/${asset.asset_id}`} controls muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <img src={`/api/media/${asset.asset_id}`} alt={asset.alt_text || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ padding: '.8rem' }}>
                  <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{asset.original_name}</strong>
                  <small style={{ color: 'var(--text-muted)' }}>{asset.media_type} · {(asset.size / 1024 / 1024).toFixed(2)} MB</small>
                  <code style={{ display: 'block', fontSize: '.7rem', margin: '.5rem 0', overflowWrap: 'anywhere' }}>{asset.asset_id}</code>
                  {canManage && <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(asset)} disabled={working === asset.asset_id}>Delete</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
