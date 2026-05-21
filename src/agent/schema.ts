// JSON Schema for a Tempo creative batch, used with structured outputs
// (output_config.format). Structured outputs require additionalProperties:
// false and every property listed in `required` on each object.

const reasoning = {
  type: "object",
  additionalProperties: false,
  properties: {
    product_insight: {
      type: "string",
      description: "The fact about the product this ad is built on.",
    },
    customer_angle: {
      type: "string",
      description: "The customer motivation or objection this ad plays to.",
    },
    performance_hypothesis: {
      type: "string",
      description: "Why this creative is expected to perform — what it tests.",
    },
  },
  required: ["product_insight", "customer_angle", "performance_hypothesis"],
};

const ad = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", description: "Short id, e.g. AD-01." },
    persona: { type: "string", description: "The specific buyer this targets." },
    angle: { type: "string", description: "The marketing angle." },
    format: { type: "string", enum: ["static", "video"] },
    hook: { type: "string", description: "The scroll-stopping opening line." },
    primary_text: { type: "string", description: "Meta primary text." },
    headline: { type: "string", description: "Short Meta headline." },
    cta: { type: "string", description: "Call-to-action button label." },
    offer: { type: "string", description: "The offer variant for this ad." },
    visual_direction: {
      type: "string",
      description:
        "Art direction for a static image, or the shot sequence for a light-motion video.",
    },
    reasoning,
  },
  required: [
    "id",
    "persona",
    "angle",
    "format",
    "hook",
    "primary_text",
    "headline",
    "cta",
    "offer",
    "visual_direction",
    "reasoning",
  ],
};

export const CREATIVE_BATCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    brand: { type: "string" },
    weekly_strategy: {
      type: "object",
      additionalProperties: false,
      properties: {
        theme: { type: "string", description: "This week's creative theme." },
        rationale: {
          type: "string",
          description: "Why this is the right thing to test now.",
        },
        angles_to_test: { type: "array", items: { type: "string" } },
        personas_to_test: { type: "array", items: { type: "string" } },
        format_mix: { type: "string", description: "The static/video split." },
      },
      required: [
        "theme",
        "rationale",
        "angles_to_test",
        "personas_to_test",
        "format_mix",
      ],
    },
    ads: { type: "array", items: ad },
  },
  required: ["brand", "weekly_strategy", "ads"],
} as const;
