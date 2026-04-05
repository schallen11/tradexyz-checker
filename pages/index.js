import { useState, useEffect } from "react";
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
    if (!address || address.length < 10) { setErr("Endereco invalido."); return; }
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
      const wData = walletJson && walletJson.wallets && walletJson.wallets[address] && walletJson.wallets[address].data ? walletJson.wallets[address].data : {};
      const dexStats = wData && wData.byDex && wData.byDex[d] ? wData.byDex[d] : {};
      const entries = lbJson && lbJson.data && lbJson.data.entries ? lbJson.data.entries : [];
      const total = entries.length;
      const vol = dexStats.volume || wData.totalVolume || 0;
      const pnl = dexStats.pnl || wData.totalPnl || 0;
      const fees = dexStats.fees || wData.totalFees || 0;
      const trades = dexStats.tradeCount || wData.totalTrades || 0;
      const myEntry = entries.find(function(e) { return e.address && e.address.toLowerCase() === address.toLowerCase(); });
      const rank = myEntry ? myEntry.rank_by_volume : null;
      const top10 = entries.slice(0, 10);
      setData({ vol, pnl, fees, trades, rank, total, top10, address });
    } catch(e) { setErr("Erro: " + e.message); }
    finally { setLoading(false); }
  }

  function search(e) {
    e && e.preventDefault();
    var a = input.trim();
    setAddr(a); fetchData(a, period, dex);
  }

  function changePeriod(p) { setPeriod(p); if (addr) fetchData(addr, p, dex); }
  function changeDex(d) { setDex(d); if (addr) fetchData(addr, period, d); }

  var C = { bg:"#0a0a0f", card:"#12121c", border:"#1e1e2e", green:"#00d4aa", red:"#ff4757", muted:"#666", accent:"#a0a8ff" };
  function btn(active) { return { background: active ? "linear-gradient(135deg,#00d4aa,#0066ff)" : "#1a1a2e", border: active ? "none" : "1px solid #2a2a3e", borderRadius: 6, color:"#fff", padding:"5px 14px", cursor:"pointer", fontSize:12, fontWeight:600 }; }

  return (
    <>
      <Head><title>TradeXYZ Tracker</title></Head>
      <div style={{minHeight:"100vh", background:C.bg, color:"#e0e0e0", fontFamily:"monospace"}}>
        <div style={{borderBottom:"1px solid "+C.border, padding:"16px 24px", display:"flex", alignItems:"center", gap:12}}>
          <div style={{width:36, height:36, background:"linear-gradient(135deg,#00d4aa,#0066ff)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20}}>&#x1F4CA;</div>
          <div>
            <div style={{fontWeight:700, fontSize:18, color:"#fff"}}>TradeXYZ Tracker</div>
            <div style={{fontSize:11, color:C.muted}}>HIP-3 Leaderboard + Stats</div>
          </div>
        </div>
        <div style={{maxWidth:960, margin:"0 auto", padding:"24px 16px"}}>
          <div style={{background:C.card, border:"1px solid "+C.border, borderRadius:12, padding:20, marginBottom:24}}>
            <form onSubmit={search}>
              <div style={{fontSize:11, color:C.muted, marginBottom:8, letterSpacing:1}}>ENDERECO DA CARTEIRA</div>
              <div style={{display:"flex", gap:10}}>
                <input value={input} onChange={function(e){setInput(e.target.value);}} placeholder="0x1234...abcd"
                  style={{flex:1, background:C.bg, border:"1px solid #2a2a3e", borderRadius:8, color:"#e0e0e0", padding:"10px 14px", fontSize:13, fontFamily:"monospace", outline:"none"}} />
                <button type="submit" disabled={loading} style={{background:loading?"#1a1a2e":"linear-gradient(135deg,#00d4aa,#0066ff)", border:"none", borderRadius:8, color:"#fff", padding:"10px 24px", fontWeight:700, cursor:loading?"not-allowed":"pointer", fontSize:14}}>
                  {loading ? "Buscando..." : "Buscar"}</button>
              </div>
            </form>
            {saved.length > 0 && (
              <div style={{marginTop:12, display:"flex", flexWrap:"wrap", gap:8}}>
                {saved.map(function(a) { return (
                  <button key={a} onClick={function(){setInput(a); setAddr(a); fetchData(a,period,dex);}}
                    style={{background:"#1a1a2e", border:"1px solid #2a2a3e", borderRadius:6, color:C.green, fontSize:11, padding:"4px 10px", cursor:"pointer", fontFamily:"monospace"}}>
                    {shortAddr(a)}</button>
                ); })}
              </div>
            )}
            <div style={{marginTop:14, display:"flex", gap:16, flexWrap:"wrap"}}>
              <div style={{display:"flex", gap:8, alignItems:"center"}}>
                <span style={{fontSize:12, color:C.muted}}>Periodo:</span>
                {PERIODS.map(function(p) { return <button key={p.value} onClick={function(){changePeriod(p.value);}} style={btn(period===p.value)}>{p.label}</button>; })}
              </div>
              <div style={{display:"flex", gap:8, alignItems:"center"}}>
                <span style={{fontSize:12, color:C.muted}}>DEX:</span>
                {DEXES.map(function(d) { return <button key={d.value} onClick={function(){changeDex(d.value);}} style={btn(dex===d.value)}>{d.label}</button>; })}
              </div>
            </div>
          </div>
          {err && <div style={{background:"#1a0a0a", border:"1px solid #ff4757", borderRadius:8, padding:"12px 16px", marginBottom:20, color:"#ff4757", fontSize:13}}>Erro: {err}</div>}
          {data && (
            <div>
              {data.rank && (
                <div style={{background:"linear-gradient(135deg,#0d1f2d,#0d2d1f)", border:"1px solid #1e3a2e", borderRadius:12, padding:"20px 24px", marginBottom:24, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16}}>
                  <div>
                    <div style={{fontSize:11, color:C.muted, marginBottom:4}}>RANKING HIP-3</div>
                    <div style={{fontSize:48, fontWeight:900, color:C.green}}>#{data.rank}</div>
                    <div style={{fontSize:14, color:"#aaa", marginTop:2}}>Top {pct(data.rank, data.total)} de {data.total.toLocaleString()} traders</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:11, color:C.muted, marginBottom:4}}>CARTEIRA</div>
                    <div style={{fontSize:14, color:C.accent}}>{shortAddr(data.address)}</div>
                    <div style={{fontSize:11, color:C.muted, marginTop:4}}>{DEXES.find(function(d){return d.value===dex;}) && DEXES.find(function(d){return d.value===dex;}).label}</div>
                  </div>
                </div>
              )}
              <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:16, marginBottom:24}}>
                {[
                  {label:"Volume", val:fmt(data.vol), color:"#fff"},
                  {label:"PnL Realizado", val:fmt(data.pnl), color:data.pnl>=0?C.green:C.red},
                  {label:"Taxas Pagas", val:"-"+fmt(data.fees), color:"#ff6b6b"},
                  {label:"Total de Trades", val:data.trades.toLocaleString(), color:C.accent},
                ].map(function(c) { return (
                  <div key={c.label} style={{background:C.card, border:"1px solid "+C.border, borderRadius:12, padding:20}}>
                    <div style={{fontSize:12, color:C.muted, marginBottom:6}}>{c.label}</div>
                    <div style={{fontSize:22, fontWeight:700, color:c.color}}>{c.val}</div>
                  </div>
                ); })}
              </div>
              <div style={{background:C.card, border:"1px solid "+C.border, borderRadius:12, padding:20, marginBottom:24}}>
                <div style={{fontSize:12, color:C.muted, marginBottom:8}}>PnL Liquido (apos taxas)</div>
                <div style={{fontSize:28, fontWeight:700, color:(data.pnl-data.fees)>=0?C.green:C.red}}>{fmt(data.pnl-data.fees)}</div>
                <div style={{fontSize:12, color:"#555", marginTop:6}}>PnL {fmt(data.pnl)} - Fees {fmt(data.fees)}</div>
              </div>
              {data.top10.length > 0 && (
                <div style={{background:C.card, border:"1px solid "+C.border, borderRadius:12, padding:20}}>
                  <div style={{fontSize:14, fontWeight:700, color:"#fff", marginBottom:16}}>Top 10 - Leaderboard HIP-3</div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%", borderCollapse:"collapse", fontSize:12}}>
                      <thead><tr style={{color:C.muted, borderBottom:"1px solid "+C.border}}>
                        {["#","Endereco","Volume","PnL","Fees","Trades"].map(function(h){return <th key={h} style={{padding:"8px 10px", textAlign:"left", fontWeight:600}}>{h}</th>;})}
                      </tr></thead>
                      <tbody>
                        {data.top10.map(function(e,i) {
                          var isMe = e.address && e.address.toLowerCase() === data.address.toLowerCase();
                          var rankColor = i===0?"#ffd700":i===1?"#c0c0c0":i===2?"#cd7f32":C.muted;
                          return (
                            <tr key={i} style={{borderBottom:"1px solid #0f0f1a", background:isMe?"#0d1f15":"transparent"}}>
                              <td style={{padding:"8px 10px", color:rankColor, fontWeight:700}}>#{e.rank_by_volume||i+1}</td>
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
            </div>
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
