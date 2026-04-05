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

import Head from "next/head";

function fmt(v) {
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  if (a >= 1e9) return s + "$" + (a/1e9).toFixed(2) + "B";
  if (a >= 1e6) return s + "$" + (a/1e6).toFixed(2) + "M";
  if (a >= 1e3) return s + "$" + (a/1e3).toFixed(2) + "K";
  return s + "$" + a.toFixed(2);
}

function pct(n, total) {
  if (!total) return "?";
  return ((n / total) * 100).toFixed(1) + "%";
}

function shortAddr(a) {
  return a ? a.slice(0,6) + "..." + a.slice(-4) : "";
}

const PERIODS = [
  { label: "All Time", value: "all_time" },
  { label: "30 Days", value: "30d" },
  { label: "7 Days", value: "7d" },
  { label: "24h", value: "1d" },
];

const DEXES = [
  { label: "TradeXYZ", value: "xyz" },
  { label: "KiloMarkets", value: "km" },
  { label: "Felix", value: "flx" },
];

export default function Home() {
  const [input, setInput] = useState("");
  const [addr, setAddr] = useState("");
  const [period, setPeriod] = useState("all_time");
  const [dex, setDex] = useState("xyz");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [data, setData] = useState(null);
  const [saved, setSaved] = useState([]);

  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem("hl_addrs") || "[]")); } catch {}
  }, []);

  async function fetchData(address, p, d) {
    if (!address || address.length < 10) { setErr("Endereço inválido."); return; }
    setLoading(true); setErr(null); setData(null);
    try {
      const upd = [address, ...saved.filter(a => a !== address)].slice(0, 5);
      setSaved(upd);
      localStorage.setItem("hl_addrs", JSON.stringify(upd));

      const [walletRes, lbRes] = await Promise.all([
        fetch("/api/hs?path=wallet-hip3-stats/batch&addresses=" + address),
        fetch("/api/hs?path=leaderboard&limit=2000&offset=0&period=" + p + "&sortBy=volume&dex=" + d),
      ]);

      const walletJson = await walletRes.json();
      const lbJson = await lbRes.json();

      const wData = walletJson?.wallets?.[address]?.data || {};
      const dexStats = wData?.byDex?.[d] || {};
      const entries = lbJson?.data?.entries || [];
      const total = entries.length;

      const vol = dexStats.volume || wData.totalVolume || 0;
      const pnl = dexStats.pnl || wData.totalPnl || 0;
      const fees = dexStats.fees || wData.totalFees || 0;
      const trades = dexStats.tradeCount || wData.totalTrades || 0;

      const myEntry = entries.find(e => e.address?.toLowerCase() === address.toLowerCase());
      const rank = myEntry?.rank_by_volume || null;

      const top10 = entries.slice(0, 10);

      setData({ vol, pnl, fees, trades, rank, total, top10, address });
    } catch(e) { setErr("Erro: " + e.message); }
    finally { setLoading(false); }
  }

  function search(e) {
    e && e.preventDefault();
    const a = input.trim();
    setAddr(a); fetchData(a, period, dex);
  }

  function changePeriod(p) { setPeriod(p); if (addr) fetchData(addr, p, dex); }
  function changeDex(d) { setDex(d); if (addr) fetchData(addr, period, d); }

  const C = { bg:"#0a0a0f", card:"#12121c", border:"#1e1e2e", green:"#00d4aa", red:"#ff4757", muted:"#666", accent:"#a0a8ff" };
  const btn = (active) => ({ background: active ? "linear-gradient(135deg,#00d4aa,#0066ff)" : "#1a1a2e", border: active ? "none" : "1px solid #2a2a3e", borderRadius: 6, color:"#fff", padding:"5px 14px", cursor:"pointer", fontSize:12, fontWeight:600 });

  return (
    <>
      <Head><title>TradeXYZ Tracker</title></Head>
      <div style={{minHeight:"100vh", background:C.bg, color:"#e0e0e0", fontFamily:"monospace"}}>
        <div style={{borderBottom:"1px solid "+C.border, padding:"16px 24px", display:"flex", alignItems:"center", gap:12}}>
          <div style={{width:36, height:36, background:"linear-gradient(135deg,#00d4aa,#0066ff)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20}}>&#x1F4CA;</div>
          <div>
            <div style={{fontWeight:700, fontSize:18, color:"#fff"}}>TradeXYZ Tracker</div>
            <div style={{fontSize:11, color:C.muted}}>HIP-3 Leaderboard + Stats · Powered by HypeStats &amp; Hyperliquid</div>
          </div>
        </div>

        <div style={{maxWidth:960, margin:"0 auto", padding:"24px 16px"}}>

          <div style={{background:C.card, border:"1px solid "+C.border, borderRadius:12, padding:20, marginBottom:24}}>
            <form onSubmit={search}>
              <div style={{fontSize:11, color:C.muted, marginBottom:8, letterSpacing:1}}>ENDERECO DA CARTEIRA (HYPERLIQUID)</div>
              <div style={{display:"flex", gap:10}}>
                <input value={input} onChange={e=>setInput(e.target.value)} placeholder="0x1234...abcd"
                  style={{flex:1, background:C.bg, border:"1px solid #2a2a3e", borderRadius:8, color:"#e0e0e0", padding:"10px 14px", fontSize:13, fontFamily:"monospace", outline:"none"}} />
                <button type="submit" disabled={loading} style={{background:loading?"#1a1a2e":"linear-gradient(135deg,#00d4aa,#0066ff)", border:"none", borderRadius:8, color:"#fff", padding:"10px 24px", fontWeight:700, cursor:loading?"not-allowed":"pointer", fontSize:14}}>
                  {loading ? "Buscando..." : "Buscar"}</button>
              </div>
            </form>
            {saved.length > 0 && (
              <div style={{marginTop:12, display:"flex", flexWrap:"wrap", gap:8}}>
                {saved.map(a => (
                  <button key={a} onClick={()=>{setInput(a); setAddr(a); fetchData(a,period,dex);}}
                    style={{background:"#1a1a2e", border:"1px solid #2a2a3e", borderRadius:6, color:C.green, fontSize:11, padding:"4px 10px", cursor:"pointer", fontFamily:"monospace"}}>
                    {shortAddr(a)}</button>
                ))}
              </div>
            )}
            <div style={{marginTop:14, display:"flex", gap:16, flexWrap:"wrap"}}>
              <div style={{display:"flex", gap:8, alignItems:"center"}}>
                <span style={{fontSize:12, color:C.muted}}>Periodo:</span>
                {PERIODS.map(p => <button key={p.value} onClick={()=>changePeriod(p.value)} style={btn(period===p.value)}>{p.label}</button>)}
              </div>
              <div style={{display:"flex", gap:8, alignItems:"center"}}>
                <span style={{fontSize:12, color:C.muted}}>DEX:</span>
                {DEXES.map(d => <button key={d.value} onClick={()=>changeDex(d.value)} style={btn(dex===d.value)}>{d.label}</button>)}
              </div>
            </div>
          </div>

          {err && <div style={{background:"#1a0a0a", border:"1px solid #ff4757", borderRadius:8, padding:"12px 16px", marginBottom:20, color:"#ff4757", fontSize:13}}>Erro: {err}</div>}

          {data && (
            <>
              {data.rank && (
                <div style={{background:"linear-gradient(135deg,#0d1f2d,#0d2d1f)", border:"1px solid #1e3a2e", borderRadius:12, padding:"20px 24px", marginBottom:24, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16}}>
                  <div>
                    <div style={{fontSize:11, color:C.muted, marginBottom:4}}>RANKING HIP-3 ({PERIODS.find(p=>p.value===period)?.label})</div>
                    <div style={{fontSize:48, fontWeight:900, color:C.green}}>#{data.rank}</div>
                    <div style={{fontSize:14, color:"#aaa", marginTop:2}}>Top {pct(data.rank, data.total)} de {data.total.toLocaleString()} traders</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:11, color:C.muted, marginBottom:4}}>CARTEIRA</div>
                    <div style={{fontSize:14, color:C.accent}}>{shortAddr(data.address)}</div>
                    <div style={{fontSize:11, color:C.muted, marginTop:4}}>{DEXES.find(d2=>d2.value===dex)?.label}</div>
                  </div>
                </div>
              )}

              <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:16, marginBottom:24}}>
                {[
                  {label:"Volume", val:fmt(data.vol), color:"#fff"},
                  {label:"PnL Realizado", val:fmt(data.pnl), color:data.pnl>=0?C.green:C.red},
                  {label:"Taxas Pagas", val:"-"+fmt(data.fees), color:"#ff6b6b"},
                  {label:"Total de Trades", val:data.trades.toLocaleString(), color:C.accent},
                ].map(c => (
                  <div key={c.label} style={{background:C.card, border:"1px solid "+C.border, borderRadius:12, padding:20}}>
                    <div style={{fontSize:12, color:C.muted, marginBottom:6}}>{c.label}</div>
                    <div style={{fontSize:22, fontWeight:700, color:c.color}}>{c.val}</div>
                  </div>
                ))}
              </div>

              <div style={{background:C.card, border:"1px solid "+C.border, borderRadius:12, padding:20, marginBottom:24}}>
                <div style={{fontSize:12, color:C.muted, marginBottom:8}}>PnL Liquido (apos taxas)</div>
                <div style={{fontSize:28, fontWeight:700, color:(data.pnl-data.fees)>=0?C.green:C.red}}>{fmt(data.pnl-data.fees)}</div>
                <div style={{fontSize:12, color:"#555", marginTop:6}}>PnL {fmt(data.pnl)} - Fees {fmt(data.fees)}</div>
              </div>

              {data.top10.length > 0 && (
                <div style={{background:C.card, border:"1px solid "+C.border, borderRadius:12, padding:20}}>
                  <div style={{fontSize:14, fontWeight:700, color:"#fff", marginBottom:16}}>Top 10 - Leaderboard HIP-3 ({DEXES.find(d2=>d2.value===dex)?.label})</div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%", borderCollapse:"collapse", fontSize:12}}>
                      <thead><tr style={{color:C.muted, borderBottom:"1px solid "+C.border}}>
                        {["#","Endereco","Volume","PnL","Fees","Trades"].map(h=><th key={h} style={{padding:"8px 10px", textAlign:"left", fontWeight:600}}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {data.top10.map((e,i) => {
                          const isMe = e.address?.toLowerCase() === data.address?.toLowerCase();
                          return (
                            <tr key={i} style={{borderBottom:"1px solid #0f0f1a", background:isMe?"#0d1f15":"transparent"}}>
                              <td style={{padding:"8px 10px", color:i===0?"#ffd700":i===1?"#c0c0c0":i===2?"#cd7f32":C.muted, fontWeight:700}}>#{e.rank_by_volume||i+1}</td>
                              <td style={{padding:"8px 10px", color:isMe?C.green:C.accent, fontWeight:isMe?700:400}}>{shortAddr(e.address)}{isMe?" (voce)":""}</td>
                              <td style={{padding:"8px 10px", color:"#fff"}}>{fmt(e.volume||0)}</td>
                              <td style={{padding:"8px 10px", color:(e.pnl||0)>=0?C.green:C.red}}>{fmt(e.pnl||0)}</td>
                              <td style={{padding:"8px 10px", color:"#ff6b6b"}}>-{fmt(e.fees||0)}</td>
                              <td style={{padding:"8px 10px", color:C.muted}}>{(e.tradeCount||0).toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {!data && !loading && !err && (
            <div style={{textAlign:"center", color:"#333", padding:"60px 0", fontSize:14}}>
              <div style={{fontSize:48, marginBottom:16}}>&#x1F4CA;</div>
              <div>Cole seu endereco para ver seu ranking no leaderboard HIP-3.</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
                            }
