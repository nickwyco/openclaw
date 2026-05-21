const codeStyle: React.CSSProperties = {
  display: "block",
  background: "#141416",
  border: "1px solid #26262b",
  borderRadius: 10,
  padding: "16px 18px",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: 13.5,
  lineHeight: 1.7,
  color: "#cfcfd4",
  overflowX: "auto",
};

const capabilities: { title: string; body: string }[] = [
  {
    title: "Researches the product",
    body: "Tempo searches the web to learn the product, its buyers, and how competitors advertise — before it writes anything.",
  },
  {
    title: "Generates the batch",
    body: "It ships a week of ad creative: persona-based angles, scroll-stopping hooks, offer variants, and Meta-ready copy across static and video.",
  },
  {
    title: "Shows its reasoning",
    body: "Every ad carries the product insight, customer angle, and performance hypothesis it was built on — so you can inspect and edit, not guess.",
  },
];

export default function Page() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "96px 24px 120px" }}>
      <div
        style={{
          fontSize: 13,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "#8a8a93",
          marginBottom: 20,
        }}
      >
        Tempo
      </div>

      <h1
        style={{
          fontSize: 46,
          lineHeight: 1.1,
          margin: "0 0 20px",
          fontWeight: 700,
          letterSpacing: -1,
        }}
      >
        An agentic growth engine for ecommerce.
      </h1>

      <p style={{ fontSize: 19, lineHeight: 1.6, color: "#b6b6bd", margin: 0 }}>
        Hand Tempo a product. It researches the market, decides what is worth
        testing, and delivers a week of ad creative — ready to run on Meta, with
        the reasoning behind every concept.
      </p>

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "1fr",
          margin: "48px 0",
        }}
      >
        {capabilities.map((c) => (
          <div
            key={c.title}
            style={{
              background: "#111113",
              border: "1px solid #232328",
              borderRadius: 12,
              padding: "18px 20px",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{c.title}</div>
            <div style={{ color: "#9c9ca4", fontSize: 14.5, lineHeight: 1.6 }}>
              {c.body}
            </div>
          </div>
        ))}
      </section>

      <h2 style={{ fontSize: 15, color: "#8a8a93", margin: "0 0 12px" }}>
        Run it from the command line
      </h2>
      <code style={codeStyle}>
        npm install
        <br />
        echo &quot;ANTHROPIC_API_KEY=sk-ant-...&quot; &gt; .env
        <br />
        npm run tempo -- ads &quot;a $39 ceramic non-stick pan for home cooks&quot; --count 10
      </code>

      <h2 style={{ fontSize: 15, color: "#8a8a93", margin: "32px 0 12px" }}>
        Or call the API
      </h2>
      <code style={codeStyle}>
        curl localhost:3000/api/creatives \
        <br />
        {"  "}-H &apos;content-type: application/json&apos; \
        <br />
        {"  "}-d &apos;{"{"}&quot;name&quot;:&quot;Trailhead Boots&quot;,&quot;count&quot;:8{"}"}&apos;
      </code>

      <p
        style={{
          marginTop: 56,
          fontSize: 13,
          color: "#5f5f68",
          borderTop: "1px solid #1f1f23",
          paddingTop: 20,
        }}
      >
        Powered by Claude. <code style={{ color: "#9c9ca4" }}>/api/creatives</code>{" "}
        returns the weekly batch as JSON — a strategy plus inspectable ad objects.
      </p>
    </main>
  );
}
