const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const puppeteer = require('puppeteer-core');
const root = process.env.DESIGN_ROOT || path.resolve(__dirname, '..');
(async () => {
  const browser = await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    for (const theme of ['dark','light']) {
      const page = await browser.newPage();
      await page.setViewport({width:390,height:844});
      await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:theme==='dark'?'light':'dark'},{name:'prefers-reduced-motion',value:'reduce'}]);
      await page.evaluateOnNewDocument(value => {localStorage.setItem('saju_theme',value);localStorage.setItem('theme',value);},theme);
      await page.goto(pathToFileURL(path.join(root,'index.html')).href,{waitUntil:'load'});
      const result = await page.evaluate(() => ({html:getComputedStyle(document.documentElement).backgroundColor,body:getComputedStyle(document.body).backgroundColor,scheme:getComputedStyle(document.documentElement).colorScheme,meta:[...document.querySelectorAll('meta[name="theme-color"]')].filter(m=>!m.media||matchMedia(m.media).matches).map(m=>m.content)}));
      assert.equal(result.html,result.body,`${theme}: root backdrop does not match body`);
      assert.equal(result.scheme,theme,`${theme}: native color scheme is not explicit`);
      assert.ok(result.meta.includes(theme==='dark'?'#0b1115':'#f4f1e9'),`${theme}: meta follows OS instead of selected theme`);
      await page.click('#themeToggleBtn');
      const flipped=await page.evaluate(()=>({dark:document.documentElement.classList.contains('dark'),body:document.body.classList.contains('dark')}));
      assert.equal(flipped.dark,flipped.body,'theme toggle root and body diverge');
      await page.close();
    }
    console.log('Design10 presentation UI PASS: explicit selected theme on root/body/meta');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
