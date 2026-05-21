export type Effort = "low" | "medium" | "high" | "max";

export type AdFormat = "static" | "video";

export type FormatMix = "static" | "video" | "mixed";

export interface ProductBrief {
  name?: string;
  brand?: string;
  url?: string;
  description?: string;
  price?: string;
  audience?: string;
}

export interface AdReasoning {
  product_insight: string;
  customer_angle: string;
  performance_hypothesis: string;
}

export interface Ad {
  id: string;
  persona: string;
  angle: string;
  format: AdFormat;
  hook: string;
  primary_text: string;
  headline: string;
  cta: string;
  offer: string;
  visual_direction: string;
  reasoning: AdReasoning;
}

export interface WeeklyStrategy {
  theme: string;
  rationale: string;
  angles_to_test: string[];
  personas_to_test: string[];
  format_mix: string;
}

export interface CreativeBatch {
  brand: string;
  weekly_strategy: WeeklyStrategy;
  ads: Ad[];
}

export interface ResearchOptions {
  effort?: Effort;
  onThinking?: () => void;
  onSearch?: (query: string) => void;
}

export interface GenerateOptions {
  effort?: Effort;
  count: number;
  formatMix: FormatMix;
  onThinking?: () => void;
}
