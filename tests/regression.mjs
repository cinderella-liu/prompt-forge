import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';
const dir = mkdtempSync(join(tmpdir(), 'prompt-forge-test-'));
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
async function load(name) {
  const path = join(dir, `${name}.mjs`);
  writeFileSync(path, ts.transpileModule(readFileSync(new URL(`../src/${name}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText);
  return import(pathToFileURL(path).href);
}
const g = await load('generator');
const h = await load('history');
const generate = (mode, input, detail = 'standard') => g[`build${mode}Prompt`](g.analyzeIntent(input), detail);
test('Android requirement is preserved without imposing a Web stack', () => {
  const result = generate('Code', '开发一个 Android 记账 App');
  assert.match(result, /Target Platform: Android/);
  assert.doesNotMatch(result, /React|Vite|Target Platform: Web/);
});
test('English Python CLI is applicable and keeps its language and platform', () => {
  const input = 'Build a Python CLI to rename files';
  assert.equal(g.modeApplicable('code', input), '');
  assert.match(generate('Code', input), /Language: Python/);
  assert.match(generate('Code', input), /Target Platform: CLI/);
});
test('email remains an email with the original length requirement', () => {
  const result = generate('Text', '写一封简短的道歉邮件');
  assert.match(result, /完成邮件\/信件/);
  assert.match(result, /写一封简短的道歉邮件/);
  assert.doesNotMatch(result, /撰写一篇|3-4 个分论点/);
});
test('explicit image/video aspect ratios take precedence over defaults', () => {
  assert.match(generate('Image', '画一张 1:1 的猫咪海报'), /Aspect ratio: 1:1/);
  assert.match(generate('Video', '竖屏 4：3 视频，时长 20 秒'), /Aspect ratio: 4:3/);
  assert.match(generate('Video', '竖屏 4：3 视频，时长 20 秒'), /Duration: 20 秒/);
});
test('brief templates are materially shorter while retaining the original intent', () => {
  for (const mode of ['Text', 'Image', 'Video', 'Code']) {
    const input = '开发一个 Android App，展示 1:1 的猫咪画面';
    const brief = generate(mode, input, 'brief');
    const standard = generate(mode, input);
    assert.ok(brief.length < standard.length * 0.8, mode);
    assert.ok(brief.includes(input));
  }
});
test('unrecognized code platform is not silently changed to Web', () => {
  assert.match(generate('Code', '开发一个工具'), /Target Platform: 未指定/);
});
const history = [{ id: 'batch', results: [{ id: 'a', mode: 'text', prompt: 'old' }, { id: 'b', mode: 'image', prompt: 'other' }] }];
test('edit updates history; reload and second edit preserve the latest text', () => {
  const edited = h.updateHistoryPrompt(history, 'a', 'edited');
  assert.equal(edited[0].results[0].prompt, 'edited');
  assert.equal(edited[0].results[1].prompt, 'other');
  assert.equal(history[0].results[0].prompt, 'old');
  const restored = JSON.parse(JSON.stringify(edited));
  assert.equal(h.resolveHistoryResults(restored[0], [])[0].prompt, 'edited');
  assert.equal(h.updateHistoryPrompt(restored, 'a', 'edited again')[0].results[0].prompt, 'edited again');
});
test('legacy stale history uses latest asset text and keeps missing assets', () => {
  const results = h.resolveHistoryResults(history[0], [{ id: 'a', prompt: 'latest' }]);
  assert.equal(results[0].prompt, 'latest');
  assert.equal(results[1].prompt, 'other');
});
