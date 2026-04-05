import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import Script from "next/script";

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function safeFloat(v, def = 0) {
  const n = parseFloat(v);
  return isNaN(n) ? def : n;
}

function fmoney(value) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function shortAddr(addr = "") {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

async function hlPost(body) {
  const res = await fetch("/api/hl", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  // _error é injetado pelo proxy quando a HL API retorna erro
  if (data && data._error) return null;
  return data;
}

// Tenta buscar o leaderboard com diferentes formatos de parâmetro
async function fetchLeaderboard(window) {
  // Mapeamento dos valores de window que o Hyperliquid aceita
  const windowMap = {
    allTime: "allTime",
    "30d":   "month",
    "7d":    "week",
    "24h":   "day",
  };
  const hlWindow = windowMap[window] || window;

  // Tentativa 1: formato padrão
  let data = await hlPost({ type: "leaderboard", window: hlWindow });
  if (data) return data;

  // Tentativa 2: sem o parâmetro window
  data = await hlPost({ type: "leaderboard" });
  if (data) return data;

  // Tentativa 3: campo "timeWindow"
  data = await hlPost({ type: "leaderboard", timeWindow: hlWindow });
  return data;
}

function parseLeaderboard(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.leaderboardRows)) return raw.leaderboardRows;
  return [];
}

function getEntryAddress(entry) {
  return entry.ethAddress || entry.address || entry.trader || "";
}

function calcFillsStats(fills) {
  let volume = 0, pnl = 0, fees = 0, coins = new Set();
  (fills || []).forEach((f) => {
    volume += safeFloat(f.px) * safeFloat(f.sz);
    pnl += safeFloat(f.closedPnl);
    fees += safeFloat(f.fee);
    if (f.coin) coins.add(f.coin);
  });
  return { volume, pnl, fees, trades: (fills || []).length, coins: [...coins] };
}

/* ─────────────────────────────────────────────
   Inline styles (dark theme)
───────────────────────────────────────────── */
const S = {
  page: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "24px 16px 48px",
  },
  // Header
  header: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 28,
    paddingBottom: 20,
    borderBottom: "1px solid #21262d",
    flexWrap: "wrap",
  },
  logo: {
    width: 48, height: 48,
    background: "linear-gradient(135deg,#00d4aa,#0088cc)",
    borderRadius: 12,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 24, flexShrink: 0,
  },
  // Search bar
  searchCard: {
    background: "#161b22",
    border: "1px solid #21262d",
    borderRadius: 16,
    padding: "24px",
    marginBottom: 24,
  },
  label: { fontSize: 12, color: "#8b949e", marginBottom: 8, display: "block", textTransform: "uppercase", letterSpacing: "0.5px" },
  inputRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  input: {
    flex: 1, minWidth: 200,
    background: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: 10,
    padding: "12px 16px",
    color: "#c9d1d9",
    fontSize: 14,
    fontFamily: "monospace",
    outline: "none",
  },
  btnPrimary: {
    background: "#00d4aa",
    color: "#000",
    border: "none",
    borderRadius: 10,
    padding: "12px 24px",
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
  },
  tabs: { display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" },
  tab: {
    background: "#0d1117",
    border: "1px solid #21262d",
    borderRadius: 20,
    padding: "5px 16px",
    fontSize: 13,
    color: "#8b949e",
    cursor: "pointer",
  },
  tabActive: {
    background: "#00d4aa",
    color: "#000",
    fontWeight: 700,
    borderColor: "#00d4aa",
  },
  // User card
  userCard: {
    background: "#161b22",
    border: "1px solid #21262d",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    position: "relative",
    overflow: "hidden",
  },
  userCardTop: {
    content: "''",
    position: "absolute",
    top: 0, left: 0, right: 0, height: 3,
    background: "linear-gradient(90deg,#00d4aa,#0088cc,#7c3aed)",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 12,
    marginTop: 20,
  },
  statBox: {
    background: "#0d1117",
    border: "1px solid #21262d",
    borderRadius: 10,
    padding: "12px 14px",
  },
  // Percentile bar
  pctSection: {
    background: "#161b22",
    border: "1px solid #21262d",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  // Leaderboard
  lbSection: {
    background: "#161b22",
    border: "1px solid #21262d",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  // Error / loading
  alertBox: (type) => ({
    background: type === "error" ? "rgba(255,77,109,0.1)" : "rgba(0,212,170,0.08)",
    border: `1px solid ${type === "error" ? "#ff4d6d" : "#00d4aa"}`,
    borderRadius: 10,
    padding: "14px 18px",
    marginBottom: 20,
    color: type === "error" ? "#ff4d6d" : "#00d4aa",
    fontSize: 13,
  }),
};

/* ─────────────────────────────────────────────
   Components
───────────────────────────────────────────── */
function StatBox({ label, value, color }) {
  return (
    <div style={S.statBox}>
      <div style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || "#fff" }}>
        {value}
      </div>
    </div>
  );
}

function PercentileBar({ rank, total }) {
  if (!rank || !total) return null;
  const topPct = (rank / total) * 100;
  const fillPct = Math.min(100, 100 - topPct);
  const youPct = Math.min(99.5, fillPct);

  return (
    <div style={S.pctSection}>
      <div style={{ fontSize: 12, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 14 }}>
        📍 Onde você está no ranking
      </div>
      <div style={{ position: "relative", background: "#0d1117", borderRadius: 8, height: 20, border: "1px solid #21262d", overflow: "visible" }}>
        <div style={{ height: "100%", width: `${youPct}%`, background: "linear-gradient(90deg,#00d4aa,#0088cc)", borderRadius: 8 }} />
        <div style={{
          position: "absolute", top: "50%", left: `${youPct}%`,
          transform: "translateY(-50%) translateX(-50%)",
          width: 16, height: 16,
          background: "#fff", borderRadius: "50%", border: "2.5px solid #00d4aa",
          zIndex: 1,
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8b949e", marginTop: 6 }}>
        <span>Top 0% (Melhor)</span>
        <span style={{ color: "#00d4aa", fontWeight: 600 }}>▲ Você: Top {topPct.toFixed(1)}%</span>
        <span>Top 100% (Pior)</span>
      </div>
      <div style={{ display: "flex", gap: 28, marginTop: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13 }}><span style={{ color: "#8b949e" }}>Rank: </span><strong>#{rank.toLocaleString()}</strong></span>
        <span style={{ fontSize: 13 }}><span style={{ color: "#8b949e" }}>Total traders: </span><strong>{total.toLocaleString()}</strong></span>
        <span style={{ fontSize: 13 }}><span style={{ color: "#8b949e" }}>Você supera: </span><strong style={{ color: "#00d4aa" }}>{(100 - topPct).toFixed(1)}% dos traders</strong></span>
      </div>
    </div>
  );
}

function LeaderboardTable({ rows, userAddress, rank }) {
  if (!rows || rows.length === 0) return null;

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div style={S.lbSection}>
      <h3 style={{ color: "#fff", marginBottom: 4 }}>🏆 HIP-3 Leaderboard — Top 20</h3>
      <p style={{ color: "#8b949e", fontSize: 13, marginBottom: 20 }}>Hyperliquid · Ordenado por Volume</p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #21262d" }}>
              {["Rank", "Trader", "Volume", "PnL", "ROI"].map((h) => (
                <th key={h} style={{ color: "#8b949e", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((entry, i) => {
              const addr = getEntryAddress(entry);
              const isUser = addr.toLowerCase() === userAddress?.toLowerCase();
              const vol = safeFloat(entry.vlm || entry.volume);
              const entryPnl = safeFloat(entry.windowPnl || entry.pnl);
              const entryRoi = safeFloat(entry.windowRoi || entry.roi) * 100;

              return (
                <tr key={i}
                  style={{
                    borderBottom: "1px solid #161b22",
                    background: isUser ? "rgba(0,212,170,0.08)" : "transparent",
                    outline: isUser ? "1px solid rgba(0,212,170,0.25)" : "none",
                  }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "#8b949e", width: 60 }}>
                    {medals[i] || `#${i + 1}`}
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#58a6ff" }}>
                    {shortAddr(addr)}
                    {isUser && (
                      <span style={{ background: "#00d4aa", color: "#000", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, marginLeft: 8 }}>
                        VOCÊ
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: "#fff" }}>{fmoney(vol)}</td>
                  <td style={{ padding: "10px 12px", color: entryPnl >= 0 ? "#00d4aa" : "#ff4d6d" }}>
                    {entryPnl >= 0 ? "+" : ""}{fmoney(entryPnl)}
                  </td>
                  <td style={{ padding: "10px 12px", color: entryRoi >= 0 ? "#00d4aa" : "#ff4d6d" }}>
                    {entryRoi >= 0 ? "+" : ""}{entryRoi.toFixed(2)}%
                  </td>
                </tr>
              );
            })}

            {/* Se o usuário não está no top 20, mostra separador e linha dele */}
            {rank > 20 && (
              <>
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#8b949e", fontSize: 12, padding: 12, background: "#0d1117" }}>
                    ··· {(rank - 21).toLocaleString()} traders ···
                  </td>
                </tr>
                <tr style={{ background: "rgba(0,212,170,0.08)", outline: "1px solid rgba(0,212,170,0.25)" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "#8b949e" }}>#{rank}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#58a6ff" }}>
                    {shortAddr(userAddress)}
                    <span style={{ background: "#00d4aa", color: "#000", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, marginLeft: 8 }}>VOCÊ</span>
                  </td>
                  <td colSpan={3} style={{ padding: "10px 12px", color: "#8b949e", fontSize: 12 }}>← sua posição</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export default function Home() {
  const [address, setAddress] = useState("");
  const [window, setWindow] = useState("allTime");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const inputRef = useRef(null);

  const windowLabels = {
    allTime: "All Time",
    "30d": "30 Days",
    "7d": "7 Days",
    "24h": "24h",
  };

  const handleFetch = async () => {
    const addr = address.trim();
    if (!addr || addr.length < 10) {
      setError("Cole um endereço de carteira válido (começa com 0x...)");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Cada chamada é independente — se uma falhar, as outras continuam
      const [lbRaw, userStateRaw, fillsRaw] = await Promise.all([
        fetchLeaderboard(window).catch(() => null),
        hlPost({ type: "clearinghouseState", user: addr }).catch(() => null),
        hlPost({ type: "userFills", user: addr, startTime: 0 }).catch(() => null),
      ]);

      const leaderboard = parseLeaderboard(lbRaw);
      const fills = Array.isArray(fillsRaw) ? fillsRaw : [];
      const fillsStats = calcFillsStats(fills);

      // Se não temos nem leaderboard nem fills nem estado da conta, algo está errado
      if (!lbRaw && !userStateRaw && !fillsRaw) {
        throw new Error("Nenhum dado retornado. Verifique se o endereço é válido.");
      }

      // Acha o usuário no leaderboard
      const addrLow = addr.toLowerCase();
      let rank = -1;
      let userEntry = {};
      leaderboard.forEach((e, i) => {
        if (getEntryAddress(e).toLowerCase() === addrLow) {
          rank = i + 1;
          userEntry = e;
        }
      });

      // Account value
      const accountValue = safeFloat(userStateRaw?.marginSummary?.accountValue);

      // Stats do usuário: leaderboard tem prioridade sobre fills
      const volume = safeFloat(userEntry.vlm || userEntry.volume || fillsStats.volume);
      const pnl = safeFloat(userEntry.windowPnl || userEntry.pnl || fillsStats.pnl);
      const fees = safeFloat(userEntry.windowFees || fillsStats.fees);
      const roi = safeFloat(userEntry.windowRoi || userEntry.roi) * 100;

      setResult({
        leaderboard,
        top20: leaderboard.slice(0, 20),
        rank,
        total: leaderboard.length,
        volume, pnl, fees, roi, accountValue,
        trades: fillsStats.trades,
        coins: fillsStats.coins,
        noLeaderboard: leaderboard.length === 0,
      });
      setUpdatedAt(new Date().toLocaleString("pt-BR"));
    } catch (err) {
      setError(`Erro ao buscar dados: ${err.message}. Verifique o endereço e tente novamente.`);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") handleFetch();
  };

  const topPct = result && result.rank > 0 ? (result.rank / result.total) * 100 : null;

  return (
    <>
      <Head>
        <title>TradeXYZ Tracker</title>
        <meta name="description" content="Monitor sua posição no leaderboard HIP-3 do TradeXYZ" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div style={S.page}>
        {/* ── Header ── */}
        <div style={S.header}>
          <div style={S.logo}>📊</div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22, color: "#fff", fontWeight: 800 }}>TradeXYZ Tracker</h1>
            <p style={{ fontSize: 13, color: "#8b949e" }}>Monitor seu ranking no leaderboard HIP-3 · Powered by Hyperliquid API</p>
          </div>
          {updatedAt && (
            <div style={{ fontSize: 12, color: "#8b949e", textAlign: "right" }}>
              <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 20, padding: "3px 12px", color: "#00d4aa", fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
                {windowLabels[window]}
              </div>
              Atualizado: {updatedAt}
            </div>
          )}
        </div>

        {/* ── Input de endereço ── */}
        <div style={S.searchCard}>
          <label style={S.label}>🔍 Endereço da Carteira (Hyperliquid)</label>
          <div style={S.inputRow}>
            <input
              ref={inputRef}
              style={S.input}
              type="text"
              placeholder="0x1234...abcd — cole seu endereço aqui"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={handleKey}
              spellCheck={false}
            />
            <button
              style={{ ...S.btnPrimary, opacity: loading ? 0.7 : 1 }}
              onClick={handleFetch}
              disabled={loading}
            >
              {loading ? "Buscando..." : "🔍 Buscar"}
            </button>
          </div>

          {/* Seletor de janela temporal */}
          <div style={S.tabs}>
            <span style={{ fontSize: 12, color: "#8b949e", lineHeight: "28px" }}>Período:</span>
            {Object.entries(windowLabels).map(([key, label]) => (
              <button
                key={key}
                style={{ ...S.tab, ...(window === key ? S.tabActive : {}) }}
                onClick={() => setWindow(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 12, color: "#8b949e", marginTop: 12 }}>
            💡 Seu endereço fica apenas no seu navegador — nenhum dado é armazenado.
          </p>
        </div>

        {/* ── Erro ── */}
        {error && (
          <div style={S.alertBox("error")}>⚠️ {error}</div>
        )}

        {/* ── Aviso leaderboard indisponível ── */}
        {result?.noLeaderboard && (
          <div style={S.alertBox("info")}>
            ⚠️ O leaderboard completo não pôde ser carregado agora (limite da API).
            Mostrando seus dados pessoais de trades abaixo.
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div style={S.alertBox("info")}>
            ⏳ Buscando dados da API Hyperliquid... Isso pode levar alguns segundos.
          </div>
        )}

        {/* ── Resultado ── */}
        {result && (
          <>
            {/* Card principal do usuário */}
            <div style={S.userCard}>
              <div style={S.userCardTop} />

              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
                <div>
                  <p style={{ fontSize: 14, color: "#8b949e", marginBottom: 6 }}>Sua posição no HIP-3 Leaderboard</p>
                  <div style={{ fontSize: 52, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
                    {result.rank > 0 ? `#${result.rank.toLocaleString()}` : "N/A"}
                  </div>
                  <div style={{ fontSize: 14, color: "#00d4aa", fontWeight: 600, marginTop: 4 }}>
                    {result.rank > 0
                      ? `Top ${topPct.toFixed(1)}% de ${result.total.toLocaleString()} traders`
                      : `Não encontrado entre ${result.total.toLocaleString()} traders`}
                  </div>
                </div>

                {result.rank > 0 && (
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 4 }}>Você supera</p>
                    <div style={{ fontSize: 40, fontWeight: 800, color: "#00d4aa" }}>
                      {(100 - topPct).toFixed(1)}%
                    </div>
                    <p style={{ fontSize: 12, color: "#8b949e" }}>dos traders</p>
                  </div>
                )}
              </div>

              <div style={S.statsGrid}>
                <StatBox label="Volume Total" value={fmoney(result.volume)} />
                <StatBox
                  label="PnL"
                  value={`${result.pnl >= 0 ? "+" : ""}${fmoney(result.pnl)}`}
                  color={result.pnl >= 0 ? "#00d4aa" : "#ff4d6d"}
                />
                <StatBox
                  label="Fees Pagas"
                  value={`-${fmoney(Math.abs(result.fees))}`}
                  color="#ff4d6d"
                />
                <StatBox
                  label="ROI"
                  value={`${result.roi >= 0 ? "+" : ""}${result.roi.toFixed(2)}%`}
                  color={result.roi >= 0 ? "#00d4aa" : "#ff4d6d"}
                />
                <StatBox label="Valor da Conta" value={fmoney(result.accountValue)} />
                <StatBox label="Trades" value={result.trades.toLocaleString()} />
              </div>

              {/* Coins negociadas */}
              {result.coins.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <p style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
                    Ativos Negociados ({result.coins.length})
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {result.coins.slice(0, 30).sort().map((c) => (
                      <span key={c} style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 20, padding: "3px 12px", fontSize: 12 }}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Barra de percentil */}
            <PercentileBar rank={result.rank > 0 ? result.rank : null} total={result.total} />

            {/* Leaderboard */}
            <LeaderboardTable rows={result.top20} userAddress={address} rank={result.rank} />

            {/* Nota de rodapé */}
            <div style={{ textAlign: "center", fontSize: 12, color: "#8b949e", paddingTop: 20, borderTop: "1px solid #21262d" }}>
              Dados via{" "}
              <a href="https://api.hyperliquid.xyz" target="_blank" rel="noreferrer">Hyperliquid API</a>
              {" · "}
              <a href="https://app.trade.xyz" target="_blank" rel="noreferrer">TradeXYZ</a>
              {" · Nenhum dado armazenado — open source"}
            </div>
          </>
        )}
      </div>
    </>
  );
}
