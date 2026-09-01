import type { Mode, DetailLevel, Intent } from "./types";

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

export function analyzeIntent(input: string): Intent {
  const clean = input.trim();
  const isCode = isCodeTask(clean);
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

export function modeApplicable(mode: Mode, input: string) {
  if (mode === "code" && !isCodeTask(input)) {
    return "该意图没有明确软件功能，不适合直接生成代码 prompt。可以改成“做一个展示该场景的网页/动画”。";
  }
  if (mode === "text" && includesAny(input, ["一只猫", "画面", "镜头", "海报"]) && !includesAny(input, ["论文", "文章", "分析", "故事", "邮件", "文案", "email", "story"])) {
    return "该意图更像视觉概念，不适合直接生成论文/深度文章 prompt。";
  }
  return "";
}

function detailSuffix(detail: DetailLevel) {
  if (detail === "brief") return "Keep the output concise and executable.";
  if (detail === "detailed") return "Include optional fields, assumptions, and notes for refinement.\n\n## Requirement review\n- Check every explicit constraint in the original request.\n- Label inferred choices as suggestions; remove any that conflict with the request.\n- List missing information only when it prevents a usable result.\n- Provide verification steps appropriate to the requested output.";
  return "Use a complete but not overlong standard prompt.";
}

export function buildTextPrompt(intent: Intent, detail: DetailLevel) {
  const task = includesAny(intent.original, ["邮件", "email", "letter", "信件"]) ? "邮件/信件"
    : includesAny(intent.original, ["故事", "story"]) ? "故事"
    : includesAny(intent.original, ["论文", "分析", "报告", "essay", "report"]) ? "文章/报告" : "用户指定的文本";
  const base = `# Task
按照以下原始要求完成${task}：
${intent.original}

# Constraints
保留用户明确指定的语言、长度、语气和格式。未指定时保持清晰、简洁；不要擅自改成分析文章。`;
  if (detail === "brief") return base;
  return `${base}
不要编造事实或来源；需要但缺少的资料用 [待补充] 标出。

# Output Format
直接输出${task}，结构服从原始要求。${detail === "detailed" ? "\n\n# Review\n核对是否满足原始要求中的受众、目的、长度和语气；仅在必要时标注待确认的信息。" : ""}`;
}

function isCodeTask(input: string) {
  return includesAny(input, ["开发", "代码", "应用", "网页", "程序", "功能", "组件", "脚本", "做一个"])
    || /\b(app|application|web|website|cli|script|python|javascript|typescript|swift|kotlin|code|program)\b/i.test(input);
}

function aspectRatio(input: string, fallback: string) {
  const explicit = input.match(/(?:^|[^\d])(\d{1,3})\s*[:：]\s*(\d{1,3})(?!\d)/);
  if (explicit && Number(explicit[1]) > 0 && Number(explicit[2]) > 0) return `${explicit[1]}:${explicit[2]}`;
  if (includesAny(input, ["正方形", "square"])) return "1:1";
  if (includesAny(input, ["竖", "portrait"])) return "9:16";
  if (includesAny(input, ["横", "landscape"])) return "16:9";
  return fallback;
}

export function buildImagePrompt(intent: Intent, detail: DetailLevel) {
  const subject = intent.objects.join(", ") || intent.subject;
  const aspect = aspectRatio(intent.original, intent.original.includes("海报") ? "3:4" : "16:9");
  if (detail === "brief") return `# 图片提示词\n${intent.original}\n画幅：${aspect}。保留原始要求中的风格、主体和构图；未指定的细节不强制补充。`;
  return `# 中文理解
- 主体：${subject || "用户意图中的核心对象"}
- 场景：${intent.scene}
- 情绪：${intent.mood}
- 风格：${intent.style}
- 构图建议：${intent.mood.includes("lonely") ? "远景、留白、主体偏画面一侧，强化孤独感" : "中景、主体清晰、空间关系明确"}
- 画幅：${aspect}

# 执行草稿（保留原文，含英文结构）
Adapt parameters to your target image tool. Explicit user requirements override all suggestions below.

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
- Aspect ratio: ${aspect}
- Detail level: high detail, clean edges, consistent anatomy
- ${detailSuffix(detail)}

# Negative Prompt
blurry, deformed hands, extra limbs, watermark, text overlay, oversaturated, low quality, inconsistent perspective`;
}

export function buildVideoPrompt(intent: Intent, detail: DetailLevel) {
  const aspect = aspectRatio(intent.original, intent.original.includes("短视频") ? "9:16" : "16:9");
  const duration = intent.original.match(/\d+(?:\s*[-–]\s*\d+)?\s*(?:秒|seconds?)/i)?.[0] || "5-10 seconds (suggested default)";
  if (detail === "brief") return `# 视频提示词\n${intent.original}\n画幅：${aspect}；时长：${duration}。动作与镜头遵循原始要求。`;
  const camera = intent.mood.includes("lonely") ? "slow tracking shot from behind, slight dolly-in" : "single continuous shot with controlled movement";
  const pacing = intent.mood.includes("slow") || intent.mood.includes("lonely") ? "slow and contemplative" : "steady, readable, single-take";

  return `# 中文理解
- 画面：${intent.original}
- 时间结构：${duration}；镜头数量遵循原始要求，未指定时建议单镜头
- 镜头运动：${camera}
- 主体动作：主体先静止或缓慢移动，再做一个清晰动作，让画面状态发生变化
- 节奏：${pacing}
- 画幅：${aspect}

# 执行草稿（保留原文，含英文结构）
Adapt parameters to your target video tool. Explicit user requirements override all suggestions below.

## Scene Description
${intent.original}. The scene has a clear beginning, middle, and end. The subject is visible, the environment is readable, and the mood is ${intent.mood}.

## Camera Movement
${camera}

## Subject Motion
The main subject starts still or slow, then performs one readable action that changes the scene state.

## Duration & Pacing
- Duration: ${duration}
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

export function buildCodePrompt(intent: Intent, detail: DetailLevel) {
  const platform = /\bcli\b|命令行/i.test(intent.original) ? "CLI"
    : /android|安卓/i.test(intent.original) ? "Android"
    : /ios|iphone|ipad/i.test(intent.original) ? "iOS"
    : /web|网页|网站/i.test(intent.original) ? "Web"
    : /桌面|desktop/i.test(intent.original) ? "Desktop" : "未指定，请按原始需求确认";
  const language = intent.original.match(/\b(Python|TypeScript|JavaScript|Swift|Kotlin|Java|Rust|Go|C\+\+)\b/i)?.[0] || "未指定，不强制选择";
  const stack = intent.original.match(/\b(React|Vue|SwiftUI|Flutter|Django|FastAPI|Express)\b/i)?.[0] || "按用户指定的平台及语言选择，需说明假设";
  if (detail === "brief") return `# Feature\n${intent.original}\nTarget Platform: ${platform}\nLanguage: ${language}\n保留原始要求，给出可运行实现和运行方式。`;
  return `# Feature
Build ${intent.original}. The implementation should be usable as a real MVP, not just a demo mockup.

# Tech Stack
- Language: ${language}
- Framework/Lib: ${stack}
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

