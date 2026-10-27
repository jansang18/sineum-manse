const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const puppeteer=require('puppeteer-core');
(async()=>{
  const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    for(const width of [390,1440]) for(const theme of ['light','dark']) {
      const page=await browser.newPage();
      await page.setViewport({width,height:900});
      await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
      await page.evaluateOnNewDocument(theme=>localStorage.setItem('saju_theme',theme),theme);
      await page.goto(pathToFileURL(path.resolve(__dirname,'..','index.html')).href,{waitUntil:'load'});
      if(width===390&&theme==='light') {
        await page.click('#calcBtn');
        await page.waitForFunction(()=>!document.querySelector('#inErr').classList.contains('show'),{timeout:7000});
        const error=await page.$eval('#inBirth',el=>({invalid:el.getAttribute('aria-invalid'),copy:document.getElementById('inBirthError').textContent}));
        assert.equal(error.invalid,'true','an untouched invalid field must not silently become valid after the toast expires');
        assert.ok(error.copy.length>0,'inline field error must persist until revalidation');
      }
      await page.type('#inputName','A'.repeat(40));await page.type('#inBirth','19890319');
      await page.click('#calcBtn');await page.waitForSelector('#view-result.active .pillar-block');
      await page.click('#tab-fortune');await page.waitForSelector('.reading-navigation');
      const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        clipped:[...document.querySelectorAll('.fortune-head .nm,.reading-section__head h2')].filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.className||el.id)}));
      assert.ok(state.overflow<=1,`${width}/${theme}: long-name page overflow`);
      assert.deepEqual(state.clipped,[],`${width}/${theme}: long-name title is clipped`);
      await page.close();
    }
    console.log('Design10 edge UI PASS: persistent errors and long names in two widths/two themes');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
