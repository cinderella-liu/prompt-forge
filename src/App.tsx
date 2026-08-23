import {
  Check,
  Clipboard,
  Code2,
  FileText,
  Image,
  Moon,
  Pencil,
  Play,
  RotateCcw,
  Settings2,
  Sparkles,
  Video,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

type Mode = "text" | "image" | "video" | "code";
type DetailLevel = "brief" | "standard" | "detailed";

type Intent = {
  original: string;
  language: "zh" | "en";
  topic: string;
  subject: string;
  scene: string;
  mood: string;
  style: string;
  purpose: string;
  objects: string[];
  constraints: string[];
  missing: string[];
};

type PromptResult = {
  mode: Mode;
  title: string;
  applicable: boolean;
  reason?: string;
  prompt: string;
};

type HistoryItem = {
  id: string;
  input: string;
  createdAt: string;
  detail: DetailLevel;
  modes: Mode[];
  results: PromptResult[];
};

const historyKey = "prompt.forge.history.v1";

const modeMeta: Record<Mode, { label: string; tag: string; icon: ReactNode; defaultTool: string }> = {
  text: { label: "文本", tag: "文章 / 论证", icon: <FileText size={18} />, defaultTool: "ChatGPT / Claude / Qwen" },
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

function loadHistory(): HistoryItem[] {
  try {
    const raw = window.localStorage.getItem(historyKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  window.localStorage.setItem(historyKey, JSON.stringify(items.slice(0, 20)));
}

function detectLanguage(input: string): Intent["language"] {
  return /[\u4e00-\u9fff]/.test(input) ? "zh" : "en";
}

function includesAny(input: string, terms: string[]) {
  const lower = input.toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
}

function pickMood(input: string) {
  const moods = [
    ["孤独", "lonely, quiet, introspective"],
    ["温暖", "warm, gentle, hopeful"],
    ["赛博", "cyberpunk, neon, high contrast"],
    ["恐怖", "tense, unsettling, dark"],
    ["浪漫", "romantic, soft, intimate"],
    ["荒诞", "surreal, absurd, playful"],
    ["电影", "cinematic, dramatic, atmospheric"],
    ["学术", "analytical, rigorous, evidence-based"],
    ["极简", "minimal, clean, restrained"],
  ];
  return moods.find(([term]) => input.includes(term))?.[1] ?? "clear, focused, coherent";
}

function pickStyle(input: string) {
  if (includesAny(input, ["论文", "论证", "综述", "分析", "报告"])) return "academic analytical";
  if (includesAny(input, ["赛博", "霓虹", "城市夜晚"])) return "cinematic cyberpunk noir";
  if (includesAny(input, ["代码", "app", "应用", "网页", "程序", "功能"])) return "product engineering";
  if (includesAny(input, ["猫", "月球", "地球", "画面", "海报"])) return "cinematic visual";
  return "balanced and practical";
}

function extractObjects(input: string) {
  const known = ["城市", "夜晚", "霓虹灯", "雨伞", "猫", "月球", "地球", "番茄钟", "App", "远程办公", "中小企业", "论文", "视频", "代码"];
  const found = known.filter((item) => input.toLowerCase().includes(item.toLowerCase()));
  if (found.length) return Array.from(new Set(found)).slice(0, 8);
  return input
    .replace(/[，。,.!?！？]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 2)
    .slice(0, 6);
}

function analyzeIntent(input: string): Intent {
  const clean = input.trim();
  const isCode = includesAny(clean, ["做一个", "开发", "代码", "app", "应用", "网页", "程序", "功能", "组件"]);
  const isText = includesAny(clean, ["论文", "文章", "论证", "分析", "报告", "写一篇", "综述"]);
  const isVisual = includesAny(clean, ["城市", "夜晚", "霓虹", "猫", "月球", "海报", "画面", "镜头", "风格"]);
  const objects = extractObjects(clean);
  const missing = [
    clean.length < 10 ? "意图太短，建议补充对象、用途或风格。" : "",
    isCode && !includesAny(clean, ["web", "网页", "ios", "android", "cli", "桌面"]) ? "代码任务建议补充目标平台。" : "",
    isText && !includesAny(clean, ["字", "论文", "报告", "读者", "引用"]) ? "文本任务建议补充字数、读者或引用要求。" : "",
    isVisual && !includesAny(clean, ["横屏", "竖屏", "16:9", "9:16", "海报"]) ? "视觉任务可补充画幅比例。" : "",
  ].filter(Boolean);

  return {
    original: clean,
    language: detectLanguage(clean),
    topic: isText ? "argument or long-form writing" : isCode ? "software feature" : isVisual ? "visual concept" : "general intent",
    subject: objects[0] || clean.slice(0, 18),
    scene: isVisual ? clean : "not explicitly specified",
    mood: pickMood(clean),
    style: pickStyle(clean),
    purpose: isCode ? "build a working software feature" : isText ? "produce a structured written argument" : isVisual ? "create a visual or motion prompt" : "clarify and execute the user's intent",
    objects,
    constraints: missing,
    missing,
  };
}

function modeApplicable(mode: Mode, input: string) {
  if (mode === "code" && !includesAny(input, ["做", "开发", "代码", "app", "应用", "网页", "程序", "功能", "组件", "脚本"])) {
    return "该意图没有明确软件功能，不适合直接生成代码 prompt。可以改成“做一个展示该场景的网页/动画”。";
  }
  if (mode === "text" && includesAny(input, ["一只猫", "画面", "镜头", "海报"]) && !includesAny(input, ["论文", "文章", "分析", "故事"])) {
    return "该意图更像视觉概念，不适合直接生成论文/深度文章 prompt。";
  }
  return "";
}

function detailSuffix(detail: DetailLevel) {
  if (detail === "brief") return "Keep the output concise and executable.";
  if (detail === "detailed") return "Include optional fields, assumptions, and notes for refinement.";
  return "Use a complete but not overlong standard prompt.";
}

function buildTextPrompt(intent: Intent, detail: DetailLevel) {
  return `# Role
你是一位${intent.style.includes("academic") ? "相关学科领域的研究者" : "结构化写作专家"}，擅长把模糊意图转成清晰论证。

# Task
围绕以下核心意图撰写一篇${intent.original.includes("论文") ? "论述文/课程论文" : "深度分析文章"}：
「${intent.original}」

# Structure
- 引言：交代背景，提出核心问题
- 正文：3-4 个分论点，每段围绕一个判断展开
- 反方或限制：指出该观点的边界
- 结论：回扣核心问题，给出开放思考

# Constraints
- 语气：${intent.mood.includes("academic") ? "学术、克制、证据导向" : "清晰、具体、少套话"}
- 必须包含具体案例、数据或可核查事实；如果缺少资料，请标注 [需要补充来源]
- 避免空泛定义、重复表述和“众所周知”式开头
- ${detailSuffix(detail)}

# Output Format
纯文本，段落间空行，小标题用 **加粗**。

${intent.missing.length ? `[⚠️ 建议补充：${intent.missing.join("；")}]` : ""}`;
}

function buildImagePrompt(intent: Intent, detail: DetailLevel) {
  const subject = intent.objects.join(", ") || intent.subject;
  const aspect = intent.original.includes("竖") || intent.original.includes("手机") ? "9:16" : intent.original.includes("海报") ? "3:4" : "16:9";
  return `# 中文理解
- 主体：${subject || "用户意图中的核心对象"}
- 场景：${intent.scene}
- 情绪：${intent.mood}
- 风格：${intent.style}
- 构图建议：${intent.mood.includes("lonely") ? "远景、留白、主体偏画面一侧，强化孤独感" : "中景、主体清晰、空间关系明确"}
- 画幅：${aspect}

# 英文执行稿
Use this prompt directly in Midjourney / Flux / DALL-E:

## Subject
${subject}, ${intent.original}

## Scene & Environment
${intent.scene}; rich environmental detail, clear spatial relationship, no vague abstraction.

## Composition
- Shot size: ${intent.mood.includes("lonely") ? "wide shot with negative space" : "medium shot"}
- Camera angle: eye-level, cinematic framing
- Subject position: rule-of-thirds, readable silhouette

## Lighting & Atmosphere
${intent.mood}; practical lighting, controlled contrast, coherent color palette.

## Style & Medium
cinematic still, high-detail, ${intent.style}
Artist/era reference: optional, only if stylistically relevant.

## Technical Params
- Aspect ratio: --ar ${aspect}
- Detail level: high detail, clean edges, consistent anatomy
- ${detailSuffix(detail)}

# Negative Prompt
blurry, deformed hands, extra limbs, watermark, text overlay, oversaturated, low quality, inconsistent perspective`;
}

function buildVideoPrompt(intent: Intent, detail: DetailLevel) {
  const aspect = intent.original.includes("竖") || intent.original.includes("短视频") ? "9:16" : "16:9";
  const camera = intent.mood.includes("lonely") ? "slow tracking shot from behind, slight dolly-in" : "single continuous shot with controlled movement";
  const pacing = intent.mood.includes("slow") || intent.mood.includes("lonely") ? "slow and contemplative" : "steady, readable, single-take";

  return `# 中文理解
- 画面：${intent.original}
- 时间结构：单镜头，5-10 秒，必须有起点、动作变化、结束状态
- 镜头运动：${camera}
- 主体动作：主体先静止或缓慢移动，再做一个清晰动作，让画面状态发生变化
- 节奏：${pacing}
- 画幅：${aspect}

# 英文执行稿
Use this prompt directly in Kling / Runway / Pika:

## Scene Description
${intent.original}. The scene has a clear beginning, middle, and end. The subject is visible, the environment is readable, and the mood is ${intent.mood}.

## Camera Movement
${camera}

## Subject Motion
The main subject starts still or slow, then performs one readable action that changes the scene state.

## Duration & Pacing
- Duration: 5-10 seconds
- Pacing: ${pacing}

## Style & Tone
cinematic motion, consistent lighting, ${intent.style}
Color palette: coherent, not oversaturated

## Audio Direction
Optional ambience that supports the scene without overpowering it.

## Technical Params
- Resolution: 1080p
- Aspect ratio: ${aspect}
- FPS: 24
- ${detailSuffix(detail)}

# Negative Prompt
jittery motion, morphing faces, inconsistent lighting, text artifacts, broken anatomy, sudden camera jumps`;
}

function buildCodePrompt(intent: Intent, detail: DetailLevel) {
  const platform = includesAny(intent.original, ["iOS", "Swift"]) ? "iOS" : includesAny(intent.original, ["网页", "Web", "web"]) ? "Web" : "Web";
  const stack = platform === "iOS" ? "SwiftUI" : "React + TypeScript + Vite";
  return `# Feature
Build ${intent.original}. The implementation should be usable as a real MVP, not just a demo mockup.

# Tech Stack
- Language: ${platform === "iOS" ? "Swift" : "TypeScript"}
- Framework/Lib: ${stack} [⚠️ 已自动选择，可按项目需要调整]
- Target Platform: ${platform}

# Inputs & Outputs
- Input: user-configurable values and visible controls relevant to the feature
- Output/UI: clear main screen, primary actions, state feedback, empty/error states

# Constraints
- Keep the first version small and maintainable
- Avoid unnecessary dependencies
- Persist user settings locally if useful
- ${detailSuffix(detail)}

# Edge Cases
- Invalid or empty user input
- User refreshes or leaves and returns
- Repeated start/stop/reset actions
- Small mobile viewport

# Code Structure Requirements
- Use clear component boundaries
- Include type annotations
- Include error handling
- Add at least 3 focused test cases or manual verification steps
- Comments only where logic is not obvious

# Output Format
完整可运行代码 + 运行说明（3 行以内）+ 测试命令`;
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
  const [editingMode, setEditingMode] = useState<Mode | null>(null);
  const [copiedMode, setCopiedMode] = useState<Mode | null>(null);
  const [intentOpen, setIntentOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const intent = useMemo(() => analyzeIntent(input), [input]);

  function toggleMode(mode: Mode) {
    setSelectedModes((current) => (current.includes(mode) ? current.filter((item) => item !== mode) : [...current, mode]));
  }

  function runGenerate() {
    const modes = selectedModes.length ? selectedModes : (["text", "image", "video", "code"] as Mode[]);
    const nextResults = generateResults(input, modes, detail);
    setResults(nextResults);
    setHistory((current) => [
      {
        id: crypto.randomUUID(),
        input,
        detail,
        modes,
        results: nextResults,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ].slice(0, 20));
  }

  function updateResult(mode: Mode, prompt: string) {
    setResults((current) => current.map((result) => (result.mode === mode ? { ...result, prompt } : result)));
  }

  async function copyPrompt(mode: Mode, prompt: string) {
    await navigator.clipboard.writeText(prompt);
    setCopiedMode(mode);
    window.setTimeout(() => setCopiedMode(null), 1400);
  }

  return (
    <main className="app-shell">
      <section className="control-pane">
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
          <div className="field-note">支持多选输出类型；图片和视频会生成英文执行稿。</div>
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
            <article className={result.applicable ? "result-card" : "result-card muted"} key={result.mode}>
              <div className="result-head">
                <div>
                  {modeMeta[result.mode].icon}
                  <strong>{result.title}</strong>
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
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setInput(item.input);
                      setDetail(item.detail);
                      setSelectedModes(item.modes);
                      setResults(item.results);
                    }}
                  >
                    <strong>{item.input}</strong>
                    <span>{formatDate(item.createdAt)}</span>
                  </button>
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
