export type Mode = "text" | "image" | "video" | "code";
export type DetailLevel = "brief" | "standard" | "detailed";

export type Intent = {
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

export type PromptResult = {
  id: string;
  mode: Mode;
  title: string;
  applicable: boolean;
  reason?: string;
  prompt: string;
};

export type HistoryItem = {
  id: string;
  input: string;
  createdAt: string;
  detail: DetailLevel;
  modes: Mode[];
  results: PromptResult[];
};

export type PromptAsset = PromptResult & {
  batchId: string;
  input: string;
  detail: DetailLevel;
  createdAt: string;
  updatedAt: string;
};

