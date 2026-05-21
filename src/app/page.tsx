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
    title: "Researches the market",
    body: "Tempo searches the web to understand the brand, its category, and its competitors before recommending anything.",
  },
  {
    title: "Diagnoses the constraint",
    body: "It finds where growth is actually blocked, then prioritizes channels and experiments by impact against effort.",
  },
  {
    title: "Ships a plan",
    body: "You get a 90-day roadmap, a ranked experiment backlog, and the metrics that ladder up to a north star.",
  },
];

export default function Page() {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "96px 24px 120px",
      }}
    >
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
        The world&apos;s first AI Head of Growth.
      </h1>

      <p style={{ fontSize: 19, lineHeight: 1.6, color: "#b6b6bd", margin: 0 }}>
        Hand Tempo a brand. It researches the market, diagnoses what is holding
        growth back, and delivers a 90-day plan you could start on Monday.
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
        npm run tempo -- plan &quot;a B2B tool that turns SQL into dashboards&quot;
        <br />
        npm run tempo -- content --name Tempo --site withtempo.ai
      </code>

      <h2 style={{ fontSize: 15, color: "#8a8a93", margin: "32px 0 12px" }}>
        Or call the API
      </h2>
      <code style={codeStyle}>
        curl -N localhost:3000/api/growth \
        <br />
        {"  "}-H &apos;content-type: application/json&apos; \
        <br />
        {"  "}-d &apos;{"{"}&quot;mode&quot;:&quot;plan&quot;,&quot;name&quot;:&quot;Tempo&quot;,&quot;goal&quot;:&quot;300 paid teams&quot;{"}"}&apos;
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
        Powered by Claude. The growth plan streams as plain text from{" "}
        <code style={{ color: "#9c9ca4" }}>/api/growth</code>.
      </p>
    </main>
  );
}
