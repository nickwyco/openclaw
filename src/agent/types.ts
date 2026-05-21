export type Effort = "low" | "medium" | "high" | "max";

export type Mode = "plan" | "content";

export interface BrandBrief {
  name?: string;
  website?: string;
  description?: string;
  goal?: string;
  audience?: string;
  stage?: string;
}

export interface AgentRunOptions {
  effort?: Effort;
  maxTokens?: number;
  onThinking?: (delta: string) => void;
  onText?: (delta: string) => void;
  onSearch?: (query: string) => void;
}
