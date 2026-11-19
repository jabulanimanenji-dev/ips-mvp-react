import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import previewUnavailable from '../api/preview-unavailable.js';

test('Vercel read-only IPS preview rejects /api with truthful HTTP 503 JSON',async()=>{
  const cfg=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.equal(cfg.framework,'vite');
  assert.equal(cfg.rewrites[0].source,'/api/(.*)');
  assert.equal(cfg.rewrites[0].destination,'/api/preview-unavailable');
  assert.equal(cfg.rewrites[1].destination,'/index.html');
  const response={code:0,headers:{},payload:null,
    setHeader(k,v){this.headers[k]=v;return this;},
    status(n){this.code=n;return this;},
    json(data){this.payload=data;return this;}
  };
  previewUnavailable({},response);
  assert.equal(response.code,503);
  assert.equal(response.payload.ready,false);
  assert.equal(response.payload.backend,'not_connected');
  assert.match(response.payload.error,/read-only design preview/);
  assert.equal(response.headers['Cache-Control'],'no-store');
});
