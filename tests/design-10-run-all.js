// Execute every required historical test without bypasses; retain complete logs
// and count TAP tests / explicit browser PASS markers separately from suites.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const args = process.argv.slice(2);
const value = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const root = path.resolve(value('--root', path.join(__dirname, '..')));
const output = path.resolve(value('--output', path.join(root, 'output', 'design-10-tests')));
const appRoot = path.resolve(value('--app-root', root));
const jobs = Number(value('--jobs', '2'));
const timeoutMs = Number(value('--timeout', '300000'));
const discovered = fs.readdirSync(path.join(root, 'tests')).filter(name => /\.test\.(?:js|mjs)$|-ui\.js$|^ui-regression\.js$/.test(name)).sort();
const results = [];
fs.mkdirSync(output, { recursive: true });
const report = () => {
  const summary = {
    root, appRoot, output, requiredFiles: discovered, startedAt,
    finishedAt: new Date().toISOString(),
    suiteCounts: { total: results.length, passed: results.filter(x => x.passed).length, failed: results.filter(x => !x.passed).length },
    tapCounts: { passed: results.reduce((n, x) => n + (x.tap?.passed || 0), 0), failed: results.reduce((n, x) => n + (x.tap?.failed || 0), 0) },
    browserPassMarkers: results.reduce((n, x) => n + x.passMarkers.length, 0), results,
  };
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
  return summary;
};
const startedAt = new Date().toISOString();
function run(file) {
  return new Promise(resolve => {
    const env = { ...process.env, APP_ROOT: appRoot, UI_ROOT: root, WEB_ROOT: root };
    // Inherited focus/URL switches must not silently narrow or retarget the run.
    for (const key of Object.keys(env)) if (/^(?:TEST_GROUP|TEST_URL|SKIP_SOURCE_CONTRACTS|DAY_URL|INK_URL|HEADER_URL|NATAL_URL|PEOPLE_URL|CALENDAR_NOTE_URL|DESIGN_WIDTHS|DESIGN_SCHEMES|DAY_WIDTHS|DAY_THEMES|INK_WIDTHS|INK_PROBE_VARIANTS|INK_SCALE|HEADER_WIDTHS|NATAL_WIDTHS|NATAL_SCHEMES|PEOPLE_WIDTHS|PEOPLE_SCHEMES|CALENDAR_NOTE_WIDTHS|CALENDAR_NOTE_THEMES)$/.test(key)) delete env[key];
    let stdout = '', stderr = '', timedOut = false;
    const start = Date.now();
    const child = spawn(process.execPath, [path.join(root, 'tests', file)], { cwd: root, env, windowsHide: true });
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.on('error', error => { stderr += error.stack; });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const log = `${stdout}\n--- STDERR ---\n${stderr}`;
      const passMatch = stdout.match(/^(?:#|ℹ) pass (\d+)$/m), failMatch = stdout.match(/^(?:#|ℹ) fail (\d+)$/m);
      const result = {
        file, passed: code === 0 && !timedOut, exitCode: code, signal, timedOut, durationMs: Date.now() - start,
        tap: passMatch ? { passed: Number(passMatch[1]), failed: Number(failMatch?.[1] || 0) } : null,
        passMarkers: stdout.split(/\r?\n/).filter(line => /\bPASS\b/.test(line)),
        errorSummary: stderr.split(/\r?\n/).filter(Boolean).slice(0, 12),
        log: path.join(output, `${file}.log`),
      };
      fs.writeFileSync(result.log, log);
      results.push(result); report();
      console.log(`${result.passed ? 'PASS' : 'FAIL'} ${file} (${result.durationMs}ms)${result.tap ? `; TAP ${result.tap.passed}/${result.tap.failed}` : ''}`);
      resolve();
    });
  });
}
(async () => {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.max(1, jobs) }, async () => { while (cursor < discovered.length) await run(discovered[cursor++]); }));
  results.sort((a, b) => a.file.localeCompare(b.file));
  const summary = report();
  console.log(JSON.stringify({ suiteCounts: summary.suiteCounts, tapCounts: summary.tapCounts, browserPassMarkers: summary.browserPassMarkers, summary: path.join(output, 'summary.json') }));
  process.exitCode = summary.suiteCounts.failed ? 1 : 0;
})();
