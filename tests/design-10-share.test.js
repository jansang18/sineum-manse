const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname,'..');
test('shared site links expose a real 1200x630 PNG and WebP with absolute canonical metadata', async () => {
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const meta=Object.fromEntries([...html.matchAll(/<meta\s+(?:property|name)="(og:[^"]+|twitter:card)"\s+content="([^"]*)"/g)].map(m=>[m[1],m[2]]));
  assert.equal(meta['og:title'],'잔상 만세력','share title is missing');
  assert.equal(meta['og:url'],'https://jansang18.github.io/sineum-manse/');
  assert.equal(meta['og:type'],'website');
  assert.equal(meta['twitter:card'],'summary_large_image');
  assert.equal(meta['og:image'],'https://jansang18.github.io/sineum-manse/og-share.png');
  assert.equal(meta['og:image:width'],'1200');
  assert.equal(meta['og:image:height'],'630');
  assert.ok(meta['og:description'].length>10);
  for(const ext of ['png','webp']) {
    const data=await sharp(path.join(root,'og-share.'+ext)).metadata();
    assert.equal(data.width,1200);assert.equal(data.height,630);
  }
});
