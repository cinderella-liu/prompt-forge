import type { Mode, DetailLevel, Intent, PromptResult, HistoryItem, PromptAsset } from "./types";
import { analyzeIntent, modeApplicable, buildTextPrompt, buildImagePrompt, buildVideoPrompt, buildCodePrompt } from "./generator";
import { updateHistoryPrompt, resolveHistoryResults } from "./history";
import {
  Check,
  Clipboard,
  Code2,
  FileText,
  Image,
  Moon,
  Pencil,
  RotateCcw,
  Settings2,
  Sparkles,
  Trash2,
  Video,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

const historyKey = "prompt.forge.history.v1";
const promptAssetKey = "prompt.forge.assets.v1";

const modeMeta: Record<Mode, { label: string; tag: string; icon: ReactNode; defaultTool: string }> = {
  text: { label: "文本", tag: "写作 / 邮件", icon: <FileText size={18} />, defaultTool: "ChatGPT / Claude / Qwen" },
  image: { label: "图片", tag: "画面生成", icon: <Image size={18} />, defaultTool: "Midjourney / Flux / DALL-E" },
  video: { label: "视频", tag: "镜头运动", icon: <Video size={18} />, defaultTool: "Kling / Runway / Pika" },
  code: { label: "代码", tag: "功能实现", icon: <Code2 size={18} />, defaultTool: "Cursor / Claude Code / Copilot" },
};

const detailLabels: Record<DetailLevel, string> = {
  brief: "简洁",
  standard: "标准",
  detailed: "详尽",
};

const examples = [
  "一个孤独的城市夜晚，霓虹灯下有人撑着伞走",
  "做一个番茄钟 App，支持自定义时长和通知",
];

function compactId(value: string) {
  return value.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function createPromptId(mode: Mode) {
  return `PF-${mode.toUpperCase()}-${compactId(crypto.randomUUID())}`;
}

function createBatchId() {
  return `BATCH-${compactId(crypto.randomUUID())}`;
}

function loadHistory(): HistoryItem[] {
  try {
    const raw = window.localStorage.getItem(historyKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return parsed.map((item: HistoryItem) => ({
      ...item,
      results: item.results.map((result) => ({ ...result, id: result.id || createPromptId(result.mode) })),
    }));
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  window.localStorage.setItem(historyKey, JSON.stringify(items.slice(0, 20)));
}

function loadPromptAssets(): PromptAsset[] {
  try {
    const raw = window.localStorage.getItem(promptAssetKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePromptAssets(items: PromptAsset[]) {
  window.localStorage.setItem(promptAssetKey, JSON.stringify(items.slice(0, 200)));
}

function generateResults(input: string, modes: Mode[], detail: DetailLevel): PromptResult[] {
  const intent = analyzeIntent(input);
  const builders: Record<Mode, (intent: Intent, detail: DetailLevel) => string> = {
    text: buildTextPrompt,
    image: buildImagePrompt,
    video: buildVideoPrompt,
    code: buildCodePrompt,
  };

  return modes.map((mode) => {
    const notApplicable = modeApplicable(mode, input);
    return {
      id: createPromptId(mode),
      mode,
      title: `${modeMeta[mode].label} Prompt`,
      applicable: !notApplicable,
      reason: notApplicable || undefined,
      prompt: notApplicable
        ? `[不适用]\n${notApplicable}\n\n建议：换一个更适合该模态的任务，或补充该模态需要的具体目标。`
        : builders[mode](intent, detail),
    };
  });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function App() {
  const [input, setInput] = useState(examples[0]);
  const [selectedModes, setSelectedModes] = useState<Mode[]>(["text", "image", "video", "code"]);
  const [detail, setDetail] = useState<DetailLevel>("standard");
  const [results, setResults] = useState<PromptResult[]>(() => generateResults(examples[0], ["text", "image", "video", "code"], "standard"));
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [promptAssets, setPromptAssets] = useState<PromptAsset[]>(loadPromptAssets);
  const [editingMode, setEditingMode] = useState<Mode | null>(null);
  const [copiedMode, setCopiedMode] = useState<Mode | null>(null);
  const [copiedAssetId, setCopiedAssetId] = useState<string | null>(null);
  const [intentOpen, setIntentOpen] = useState(false);
  const [promptAssetsOpen, setPromptAssetsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [copyError, setCopyError] = useState("");

  useEffect(() => {
    try { saveHistory(history); } catch { setStorageError("历史记录保存失败，请复制重要内容后检查设备存储。"); }
  }, [history]);

  useEffect(() => {
    try { savePromptAssets(promptAssets); } catch { setStorageError("提示词库保存失败，请复制重要内容后检查设备存储。"); }
  }, [promptAssets]);

  const intent = useMemo(() => analyzeIntent(input), [input]);

  function toggleMode(mode: Mode) {
    setSelectedModes((current) => (current.includes(mode) ? current.filter((item) => item !== mode) : [...current, mode]));
  }

  function runGenerate() {
    const modes = selectedModes.length ? selectedModes : (["text", "image", "video", "code"] as Mode[]);
    const batchId = createBatchId();
    const createdAt = new Date().toISOString();
    const nextResults = generateResults(input, modes, detail);
    setResults(nextResults);
    setPromptAssets((current) => [
      ...nextResults.map((result) => ({
        ...result,
        batchId,
        input,
        detail,
        createdAt,
        updatedAt: createdAt,
      })),
      ...current,
    ].slice(0, 200));
    setHistory((current) => [
      {
        id: batchId,
        input,
        detail,
        modes,
        results: nextResults,
        createdAt,
      },
      ...current,
    ].slice(0, 20));
  }

  function updateResult(mode: Mode, prompt: string) {
    const target = results.find((result) => result.mode === mode);
    setResults((current) => current.map((result) => (result.mode === mode ? { ...result, prompt } : result)));
    if (target) {
      setHistory((items) => updateHistoryPrompt(items, target.id, prompt));
      setPromptAssets((assets) => assets.map((asset) => (asset.id === target.id ? { ...asset, prompt, updatedAt: new Date().toISOString() } : asset)));
    }
  }

  function deleteHistoryItem(id: string) {
    setHistory((current) => current.filter((item) => item.id !== id));
  }

  function deletePromptAsset(id: string) {
    setPromptAssets((current) => current.filter((item) => item.id !== id));
  }

  async function copyPrompt(mode: Mode, prompt: string) {
    try { await navigator.clipboard.writeText(prompt); setCopyError(""); }
    catch { setCopyError("复制失败，请选择提示词文本手动复制。"); return; }
    setCopiedMode(mode);
    window.setTimeout(() => setCopiedMode(null), 1400);
  }

  async function copyPromptAsset(asset: PromptAsset) {
    try { await navigator.clipboard.writeText(asset.prompt); setCopyError(""); }
    catch { setCopyError("复制失败，请选择提示词文本手动复制。"); return; }
    setCopiedAssetId(asset.id);
    window.setTimeout(() => setCopiedAssetId(null), 1400);
  }

  return (
    <main className="app-shell">
      <section className="control-pane">
        {storageError || copyError ? <p role="alert">{storageError || copyError}</p> : null}
        <header className="brand-bar">
          <div>
            <p>输入一句话，生成高质量提示词</p>
            <h1>Prompt Forge</h1>
          </div>
          <button className="icon-button" aria-label="设置">
            <Settings2 size={20} />
          </button>
        </header>

        <section className="composer">
          <label>
            输入一句话
            <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="一个孤独的城市夜晚，霓虹灯下有人撑着伞走" />
          </label>
          <div className="example-block">
            <span>示例，点一下填入</span>
            <div className="example-row">
              {examples.map((example) => (
                <button key={example} type="button" onClick={() => setInput(example)}>
                  {example}
                </button>
              ))}
            </div>
          </div>
          <div className="field-note">支持多选输出类型；图片和视频保留原文，并提供英文结构草稿。</div>
          <div className="mode-grid" aria-label="模态选择">
            {(Object.keys(modeMeta) as Mode[]).map((mode) => (
              <button className={selectedModes.includes(mode) ? "mode-card active" : "mode-card"} key={mode} type="button" onClick={() => toggleMode(mode)}>
                <span className="mode-icon">{modeMeta[mode].icon}</span>
                <span>
                  <strong>{modeMeta[mode].label}</strong>
                  <small>{modeMeta[mode].tag}</small>
                </span>
                <i aria-hidden="true">{selectedModes.includes(mode) ? <Check size={15} /> : null}</i>
              </button>
            ))}
          </div>
          <div className="detail-switch" role="group" aria-label="详细程度">
            {(Object.keys(detailLabels) as DetailLevel[]).map((level) => (
              <button className={detail === level ? "active" : ""} key={level} type="button" onClick={() => setDetail(level)}>
                {detailLabels[level]}
              </button>
            ))}
          </div>
          <button className="generate-button" type="button" onClick={runGenerate} disabled={!input.trim()}>
            <Wand2 size={20} />
            一键生成
          </button>
          <div className="generate-note">{selectedModes.length || 4} 个类型将生成；空输入时不可生成。</div>
        </section>

        <section className="intent-card">
          <button className="intent-toggle" type="button" onClick={() => setIntentOpen((open) => !open)}>
            <span>
              <Sparkles size={18} />
              查看理解
            </span>
            <strong>{intentOpen ? "收起" : "默认隐藏"}</strong>
          </button>
          {intentOpen ? (
            <dl>
              <div>
                <dt>主题</dt>
                <dd>{intent.topic}</dd>
              </div>
              <div>
                <dt>对象</dt>
                <dd>{intent.objects.join("、") || "待识别"}</dd>
              </div>
              <div>
                <dt>风格</dt>
                <dd>{intent.style}</dd>
              </div>
              <div>
                <dt>缺口</dt>
                <dd>{intent.missing.join("；") || "暂无明显缺口"}</dd>
              </div>
            </dl>
          ) : null}
        </section>

      </section>

      <section className="output-pane">
        <div className="output-header">
          <div>
            <p>可复制，可编辑，可测试</p>
            <h2>生成结果</h2>
          </div>
          <span>{results.length} 个 prompt</span>
        </div>

        <div className="result-grid">
          {results.map((result) => (
            <article className={result.applicable ? "result-card" : "result-card muted"} key={result.id}>
              <div className="result-head">
                <div>
                  {modeMeta[result.mode].icon}
                  <span>
                    <strong>{result.title}</strong>
                    <small>{result.id}</small>
                  </span>
                </div>
                <span>{result.applicable ? modeMeta[result.mode].defaultTool : "不适用"}</span>
              </div>
              {result.reason ? <p className="not-applicable">{result.reason}</p> : null}
              {editingMode === result.mode ? (
                <textarea className="prompt-editor" value={result.prompt} onChange={(event) => updateResult(result.mode, event.target.value)} />
              ) : (
                <pre>{result.prompt}</pre>
              )}
              <div className="card-actions">
                <button type="button" onClick={() => copyPrompt(result.mode, result.prompt)}>
                  {copiedMode === result.mode ? <Check size={18} /> : <Clipboard size={18} />}
                  {copiedMode === result.mode ? "已复制" : "复制"}
                </button>
                <button type="button" onClick={() => setEditingMode(editingMode === result.mode ? null : result.mode)}>
                  {editingMode === result.mode ? <X size={18} /> : <Pencil size={18} />}
                  {editingMode === result.mode ? "完成" : "编辑"}
                </button>
              </div>
            </article>
          ))}
        </div>

        <section className="rule-card">
          <Moon size={18} />
          <p>本版测试目标：验证一句自然语言输入能否被结构化，并稳定生成文本、图片、视频、代码四种提示词；当前仍是内置 schema 逻辑，不调用真实模型。</p>
        </section>

        <section className="history-panel prompt-library">
          <button className="history-toggle" type="button" onClick={() => setPromptAssetsOpen((open) => !open)}>
            <span>
              <Clipboard size={18} />
              提示词库
            </span>
            <strong>{promptAssetsOpen ? "收起" : `${promptAssets.length} 条`}</strong>
          </button>
          {promptAssetsOpen ? (
            <div className="asset-list">
              <p>最多保留最近 200 条，超出后移除最早生成的条目。重要内容请另行备份。</p>
              {promptAssets.length ? (
                promptAssets.map((asset) => (
                  <div className="asset-item" key={asset.id}>
                    <button
                      className="asset-load"
                      type="button"
                      onClick={() => {
                        setInput(asset.input);
                        setDetail(asset.detail);
                        setSelectedModes([asset.mode]);
                        setResults([asset]);
                      }}
                    >
                      <span className="asset-topline">
                        <strong>{asset.id}</strong>
                        <small>{modeMeta[asset.mode].label}</small>
                      </span>
                      <span>{asset.input}</span>
                      <small>{formatDate(asset.updatedAt)} 更新</small>
                    </button>
                    <div className="asset-actions">
                      <button type="button" onClick={() => copyPromptAsset(asset)}>
                        {copiedAssetId === asset.id ? <Check size={17} /> : <Clipboard size={17} />}
                      </button>
                      <button type="button" onClick={() => deletePromptAsset(asset.id)}>
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p>生成后，每条提示词会带 ID 保存在这里，最多保留最近 200 条。</p>
              )}
            </div>
          ) : null}
        </section>

        <section className="history-panel history-panel-last">
          <button className="history-toggle" type="button" onClick={() => setHistoryOpen((open) => !open)}>
            <span>
              <RotateCcw size={18} />
              历史记录
            </span>
            <strong>{historyOpen ? "收起" : `${history.length} 条`}</strong>
          </button>
          {historyOpen ? (
            <div className="history-list">
              {history.length ? (
                history.map((item) => (
                  <div className="history-item" key={item.id}>
                    <button
                      className="history-load"
                      type="button"
                      onClick={() => {
                        setInput(item.input);
                        setDetail(item.detail);
                        setSelectedModes(item.modes);
                        setResults(resolveHistoryResults(item, promptAssets));
                      }}
                    >
                      <strong>{item.input}</strong>
                      <span>{formatDate(item.createdAt)}</span>
                    </button>
                    <button className="history-delete" type="button" aria-label="删除历史记录" onClick={() => deleteHistoryItem(item.id)}>
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))
              ) : (
                <p>生成后会保存最近 20 条记录。</p>
              )}
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
