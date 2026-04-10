import { useState, useEffect } from "react";
import Head from "next/head";

/* ── helpers ─────────────────────────────────────────────── */
const fmt = (n) => {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return "$" + (n / 1e3).toFixed(2) + "K";
  return "$" + n.toFixed(2);
};
const shortAddr = (a) => (a ? a.slice(0, 6) + "..." + a.slice(-4) : "");
const pColor = (v) => (v > 0 ? "#4ade80" : v < 0 ? "#f87171" : "#94a3b8");

/* ── DEX & period configs ────────────────────────────────── */
const DEXES = [
  { id: "xyz", label: "TradeXYZ" },
  { id: "km", label: "KiloMarkets" },
  { id: "flx", label: "Felix" },
];
const PERIODS = [
  { id: "all_time", label: "All Time" },
  { id: "30d", label: "30 Days" },
  { id: "7d", label: "7 Days" },
  { id: "1d", label: "24h" },
];

/* ── Main page component ─────────────────────────────────── */
export default function Home() {
  const [address, setAddress] = useState("");
  const [saved, setSaved] = useState([]);
  const [dex, setDex] = useState("xyz");
  const [period, setPeriod] = useState("all_time");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Leaderboard data (top 10 for display)
  const [topEntries, setTopEntries] = useState([]);
  const [totalEntries, setTotalEntries] = useState(0);

  // Wallet stats (extracted from leaderboard search)
  const [myEntry, setMyEntry] = useState(null);

  /* load saved addresses from localStorage */
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("hs_addrs") || "[]");
      setSaved(s);
      if (s.length > 0) setAddress(s[0]);
    } catch {}
  }, []);

  const saveAddr = (a) => {
    const lower = a.toLowerCase();
    const next = [a, ...saved.filter((x) => x.toLowerCase() !== lower)].slice(
      0,
      5
    );
    setSaved(next);
    localStorage.setItem("hs_addrs", JSON.stringify(next));
  };

  /* ── Fetch leaderboard only (the wallet endpoint needs auth) ── */
  const doSearch = async () => {
    const addr = address.trim();
    if (!addr) return;
    setLoading(true);
    setError("");
    setMyEntry(null);
    saveAddr(addr);

    try {
      // Fetch full leaderboard (up to 5000 to find the user)
      const lbRes = await fetch(
        `/api/hs?path=leaderboard&limit=5000&offset=0&period=${period}&sortBy=volume&dex=${dex}`
      );
      const lbJson = await lbRes.json();

      if (lbJson._error) {
        setError("Erro ao buscar leaderboard: " + lbJson._error);
        setLoading(false);
        return;
      }

      const entries = lbJson?.data?.entries || [];
      setTotalEntries(entries.length);
      setTopEntries(entries.slice(0, 10));

      // Find user in leaderboard
      const found = entries.find(
        (e) => e.address?.toLowerCase() === addr.toLowerCase()
      );

      if (found) {
        setMyEntry(found);
      } else {
        // User not in leaderboard — could be outside top 5000 or no activity
        setMyEntry(null);
        setError(
          "Carteira nao encontrada no leaderboard HIP-3 (Top " +
            entries.length +
            "). Verifique se o endereco esta correto e se tem atividade na DEX selecionada."
        );
      }
    } catch (err) {
      setError("Erro de rede: " + err.message);
    }
    setLoading(false);
  };

  /* ── Auto-load leaderboard on mount and when dex/period change ── */
  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const lbRes = await fetch(
          `/api/hs?path=leaderboard&limit=5000&offset=0&period=${period}&sortBy=volume&dex=${dex}`
        );
        const lbJson = await lbRes.json();
        const entries = lbJson?.data?.entries || [];
        setTotalEntries(entries.length);
        setTopEntries(entries.slice(0, 10));
      } catch {}
    };
    loadLeaderboard();
  }, [dex, period]);

  /* derived wallet stats from leaderboard entry */
  const rank = myEntry?.rank_by_volume || myEntry?.rank || null;
  const volume = myEntry?.volume || 0;
  const pnl = myEntry?.pnl || 0;
  const fees = myEntry?.fees || 0;
  const trades = myEntry?.trade_count || myEntry?.trades || 0;
  const pctTop =
    rank && totalEntries ? ((rank / totalEntries) * 100).toFixed(1) : null;

  /* ── Styles ─────────────────────────────────────────────── */
  const bg = "#0f1117";
  const card = "#1a1d27";
  const border = "#2a2d37";
  const accent = "#3b82f6";

  return (
    <>
      <Head>
        <title>TradeXYZ Tracker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ background: bg, minHeight: "100vh", color: "#e2e8f0", fontFamily: "system-ui, -apple-system, sans-serif", padding: "20px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{ width: 36, height: 36, background: accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18 }}>
              T
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>TradeXYZ Tracker</h1>
              <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>HIP-3 Leaderboard + Stats</p>
            </div>
          </div>

          {/* Search */}
          <div style={{ background: card, borderRadius: 12, padding: 20, border: `1px solid ${border}`, marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>
              Endereco da Carteira
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                placeholder="0x..."
                style={{ flex: 1, background: "#0f1117", border: `1px solid ${border}`, borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14, outline: "none" }}
              />
              <button
                onClick={doSearch}
                disabled={loading}
                style={{ background: accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1 }}
              >
                {loading ? "..." : "Buscar"}
              </button>
            </div>

            {/* Saved addresses */}
            {saved.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {saved.map((a) => (
                  <button
                    key={a}
                    onClick={() => { setAddress(a); }}
                    style={{ background: "#0f1117", border: `1px solid ${border}`, borderRadius: 6, padding: "4px 10px", color: "#94a3b8", fontSize: 12, cursor: "pointer" }}
                  >
                    {shortAddr(a)}
                  </button>
                ))}
              </div>
            )}

            {/* Period & DEX selectors */}
            <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>Periodo:</span>
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  style={{
                    background: period === p.id ? accent : "transparent",
                    color: period === p.id ? "#fff" : "#94a3b8",
                    border: `1px solid ${period === p.id ? accent : border}`,
                    borderRadius: 6, padding: "4px 12px", fontSize: 13, cursor: "pointer",
                  }}
                >
                  {p.label}
                </button>
              ))}

              <span style={{ fontSize: 13, color: "#64748b", marginLeft: 8 }}>DEX:</span>
              {DEXES.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDex(d.id)}
                  style={{
                    background: dex === d.id ? accent : "transparent",
                    color: dex === d.id ? "#fff" : "#94a3b8",
                    border: `1px solid ${dex === d.id ? accent : border}`,
                    borderRadius: 6, padding: "4px 12px", fontSize: 13, cursor: "pointer",
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: "#1c1520", border: "1px solid #7f1d1d", borderRadius: 10, padding: 14, marginBottom: 16, color: "#fca5a5", fontSize: 14 }}>
              {error}
            </div>
          )}

          {/* Rank card */}
          {myEntry && (
            <div style={{ background: card, borderRadius: 12, padding: 20, border: `1px solid ${border}`, marginBottom: 16, textAlign: "center" }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: rank <= 3 ? "#fbbf24" : "#e2e8f0" }}>
                #{rank}
              </div>
              <div style={{ color: "#94a3b8", fontSize: 14 }}>
                {pctTop ? `Top ${pctTop}%` : ""} de {totalEntries.toLocaleString()} traders
              </div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                {shortAddr(address)} &bull;{" "}
                {DEXES.find((d) => d.id === dex)?.label} &bull;{" "}
                {PERIODS.find((p) => p.id === period)?.label}
              </div>
            </div>
          )}

          {/* Stats cards */}
          {myEntry && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
              <StatCard label="Volume" value={fmt(volume)} color="#e2e8f0" />
              <StatCard label="PnL Realizado" value={fmt(pnl)} color={pColor(pnl)} />
              <StatCard label="Taxas Pagas" value={fees ? "-" + fmt(Math.abs(fees)) : "—"} color="#f87171" />
              <StatCard label="Total de Trades" value={trades > 0 ? trades.toLocaleString() : "—"} color="#e2e8f0" />
            </div>
          )}

          {/* Net PnL card */}
          {myEntry && (pnl !== 0 || fees !== 0) && (
            <div style={{ background: card, borderRadius: 12, padding: 20, border: `1px solid ${border}`, marginBottom: 16 }}>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>PnL Liquido (apos taxas)</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: pColor(pnl - Math.abs(fees)), marginTop: 4 }}>
                {fmt(pnl - Math.abs(fees))}
              </div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                PnL {fmt(pnl)} - Fees {fmt(Math.abs(fees))}
              </div>
            </div>
          )}

          {/* Top 10 Leaderboard */}
          <div style={{ background: card, borderRadius: 12, padding: 20, border: `1px solid ${border}` }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>
              Top 10 — Leaderboard HIP-3
            </h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ color: "#64748b", textAlign: "left" }}>
                    <th style={{ padding: "8px 12px" }}>#</th>
                    <th style={{ padding: "8px 12px" }}>Endereco</th>
                    <th style={{ padding: "8px 12px" }}>Volume</th>
                    <th style={{ padding: "8px 12px" }}>PnL</th>
                    <th style={{ padding: "8px 12px" }}>Fees</th>
                  </tr>
                </thead>
                <tbody>
                  {topEntries.map((e, i) => {
                    const isMe = e.address?.toLowerCase() === address.toLowerCase();
                    return (
                      <tr
                        key={e.address || i}
                        style={{
                          borderTop: `1px solid ${border}`,
                          background: isMe ? "#1e293b" : "transparent",
                        }}
                      >
                        <td style={{ padding: "10px 12px", color: i < 3 ? "#fbbf24" : "#e2e8f0", fontWeight: i < 3 ? 700 : 400 }}>
                          #{e.rank_by_volume || e.rank || i + 1}
                        </td>
                        <td style={{ padding: "10px 12px", fontFamily: "monospace", color: isMe ? accent : "#e2e8f0" }}>
                          {shortAddr(e.address)}
                          {isMe && <span style={{ marginLeft: 6, fontSize: 11, color: accent }}>(voce)</span>}
                        </td>
                        <td style={{ padding: "10px 12px" }}>{fmt(e.volume)}</td>
                        <td style={{ padding: "10px 12px", color: pColor(e.pnl) }}>{e.pnl ? fmt(e.pnl) : "—"}</td>
                        <td style={{ padding: "10px 12px", color: "#f87171" }}>{e.fees ? "-" + fmt(Math.abs(e.fees)) : "—"}</td>
                      </tr>
                    );
                  })}
                  {topEntries.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#64748b" }}>
                        {loading ? "Carregando..." : "Nenhum dado disponivel"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: "#475569", textAlign: "center" }}>
              Dados via HypeStats &bull; {totalEntries.toLocaleString()} traders no ranking
            </div>
          </div>

          {/* Info note */}
          <div style={{ marginTop: 16, padding: 14, background: "#111827", borderRadius: 10, border: "1px solid #1e293b", fontSize: 12, color: "#64748b", textAlign: "center" }}>
            Nota: PnL, Fees e Trades podem aparecer como "—" pois o leaderboard publico do HypeStats disponibiliza principalmente dados de Volume e Rank.
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Stat card component ─────────────────────────────────── */
function StatCard({ label, value, color }) {
  return (
    <div style={{ background: "#1a1d27", borderRadius: 10, padding: 16, border: "1px solid #2a2d37" }}>
      <div style={{ color: "#94a3b8", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}
