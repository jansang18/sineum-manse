// Free, deterministic brand-art export; no online design or generation service.
const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
const root=path.resolve(__dirname,'..');
(async()=>{
  const logo=fs.readFileSync(path.join(root,'main-logo.png')).toString('base64');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#0b1115"/>
    <rect x="28" y="28" width="1144" height="574" rx="24" fill="#111a20" stroke="#5a5140"/>
    <image x="60" y="140" width="350" height="350" xlink:href="data:image/png;base64,${logo}"/>
    <path d="M460 145v340" stroke="#5a5140"/>
    <g font-family="Malgun Gothic,Noto Sans KR,sans-serif">
      <text x="520" y="265" fill="#eee8dc" font-size="66" font-weight="700">잔상 만세력</text>
      <text x="522" y="335" fill="#c5a76f" font-size="29">나의 명반, 차분하게 읽는 운의 흐름</text>
      <text x="522" y="414" fill="#b7b3a7" font-size="25">원국 · 연도 풀이 · 12개월 월운 · 날짜 메모</text>
      <text x="522" y="469" fill="#b7b3a7" font-size="22">jansang18.github.io/sineum-manse</text>
    </g>
  </svg>`;
  const image=sharp(Buffer.from(svg));
  await image.clone().png().toFile(path.join(root,'og-share.png'));
  await image.clone().webp({quality:90}).toFile(path.join(root,'og-share.webp'));
  console.log('Share preview PNG/WebP exported:1200x630');
})().catch(error=>{console.error(error);process.exitCode=1;});
