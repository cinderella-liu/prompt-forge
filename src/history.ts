import type { HistoryItem, PromptAsset } from "./types";

export function updateHistoryPrompt(items: HistoryItem[], id: string, prompt: string): HistoryItem[] {
  return items.map(item => ({ ...item, results: item.results.map(result => result.id === id ? { ...result, prompt } : result) }));
}

// Older installations may contain an edited asset and an outdated history copy.
export function resolveHistoryResults(item: HistoryItem, assets: PromptAsset[]) {
  return item.results.map(result => {
    const asset = assets.find(asset => asset.id === result.id);
    return asset ? { ...result, prompt: asset.prompt } : result;
  });
}
