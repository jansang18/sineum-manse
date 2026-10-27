// Post-deployment verification: no request interception and no saved user data.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const puppeteer=require('puppeteer-core');
const root=path.resolve(__dirname,'..');
const output=path.resolve(root,'../../outputs/design-10/live');
const origin='https://jansang18.github.io/sineum-manse/';
const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const report={revision,origin,assets:[],cases:[],failures:[],startedAt:new Date().toISOString()};
  for(const file of ['index.html','apple.css','reading.css','building-lookup.css','presentation.js','reading-navigation.js','share.js','sw.js','og-share.png']) {
    const response=await fetch(origin+file+'?verify='+revision,{cache:'no-store'});
    const bytes=Buffer.from(await response.arrayBuffer());
    const expected=execFileSync('git',['show',`HEAD:${file}`],{cwd:root,maxBuffer:4*1024*1024});
    const equal=response.ok&&hash(bytes)===hash(expected);
    report.assets.push({file,status:response.status,equal,sha256:hash(bytes),expected:hash(expected)});
    if(!equal)report.failures.push(`Deployed asset differs:${file}`);
  }
  const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    for(const width of [390,1440])for(const theme of ['light','dark']) {
      const context=await browser.createBrowserContext();
      const page=await context.newPage(),errors=[],consoleErrors=[],networkFailures=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
      page.on('requestfailed',request=>networkFailures.push({url:request.url(),error:request.failure()?.errorText}));
      await page.setViewport({width,height:1000,deviceScaleFactor:1});await page.setCacheEnabled(false);
      await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-motion',value:'reduce'}]);
      await page.evaluateOnNewDocument(theme=>localStorage.setItem('saju_theme',theme),theme);
      await page.goto(origin+'index.html?verify='+revision,{waitUntil:'networkidle2',timeout:30000});
      const capture=async name=>{await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});await page.screenshot({path:path.join(output,`${width}-${theme}-${name}.png`)});};
      await capture('input');
      await page.type('#inBirth','19890319');await page.type('#inTime','1430');await page.click('#calcBtn');
      await page.waitForSelector('#view-result.active .pillar-block');await capture('result');
      await page.click('#tab-fortune');await page.waitForSelector('.reading-navigation');await capture('fortune');
      for(const tab of ['calendar','saved']){await page.click('#tab-'+tab);await page.waitForSelector('#view-'+tab+':not([hidden])');await capture(tab);}
      await page.click('#tab-input');
      await page.waitForNetworkIdle({idleTime:500,timeout:15000}).catch(()=>{});
      const state=await page.evaluate(async()=>({html:getComputedStyle(document.documentElement).backgroundColor,body:getComputedStyle(document.body).backgroundColor,scheme:getComputedStyle(document.documentElement).colorScheme,
        versions:[...document.querySelectorAll('link[rel="stylesheet"],script[src]')].map(el=>el.getAttribute('href')||el.getAttribute('src')),
        workers:navigator.serviceWorker?(await navigator.serviceWorker.getRegistrations()).length:0,
        legacyCaches:'caches'in window?(await caches.keys()).filter(key=>key.startsWith('jansang-manse-')):[]}));
      if(state.html!==state.body||state.scheme!==theme)report.failures.push(`${width}/${theme}: theme mismatch`);
      if(state.workers||state.legacyCaches.length)report.failures.push(`${width}/${theme}: legacy cache remains`);
      if(errors.length||consoleErrors.length)report.failures.push(`${width}/${theme}: browser errors`);
      report.cases.push({width,theme,...state,errors,consoleErrors,networkFailures});
      await context.close();console.log(`Live smoke ${width}px ${theme}: errors${errors.length}/${consoleErrors.length}`);
    }
  }finally{await browser.close();report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));}
  console.log(JSON.stringify({revision,assets:report.assets.length,cases:report.cases.length,failures:report.failures,output}));
  process.exitCode=report.failures.length?1:0;
})().catch(error=>{console.error(error);process.exitCode=1;});
