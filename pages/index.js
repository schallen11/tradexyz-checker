import { useMemo, useState } from "react";
import Head from "next/head";

const PERIODS = [
  { label: "All Time", value: "all_time" },
  { label: "30d", value: "30d" },
  { label: "7d", value: "7d" },
  { label: "24h", value: "1d" },
];

function money(value) {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function shortAddress(address) {
  if (!address) return "-";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Home() {
  const [address, setAddress] = useState("");
  const [period, setPeriod] = useState("all_time");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const canSearch = useMemo(() => address.trim().length >= 10, [address]);

  async function onSubmit(event) {
    event.preventDefault();
    if (!canSearch) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/xyz?address=${encodeURIComponent(address.trim())}&period=${encodeURIComponent(period)}`,
      );
      const payload = await response.json();

      if (payload?._error) {
        setData(null);
        setError(payload._error);
        return;
      }

      setData(payload);
    } catch (err) {
      setError(err.message || "Erro inesperado");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>XYZ Volume & Ranking Checker</title>
      </Head>
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px 40px" }}>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>XYZ Checker</h1>
        <p style={{ color: "#8b949e", marginBottom: 24 }}>
          Rastreador exclusivo da XYZ: volume total da DEX, seu ranking geral e percentual da sua carteira no total.
        </p>

        <form
          onSubmit={onSubmit}
          style={{
            display: "grid",
            gap: 12,
            padding: 16,
            border: "1px solid #30363d",
            borderRadius: 10,
            background: "#0d1117",
          }}
        >
          <label style={{ fontWeight: 600 }}>Endereço da carteira</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x..."
            style={{
              height: 42,
              border: "1px solid #30363d",
              borderRadius: 8,
              background: "#161b22",
              color: "#c9d1d9",
              padding: "0 12px",
            }}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PERIODS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setPeriod(item.value)}
                style={{
                  borderRadius: 999,
                  border: item.value === period ? "none" : "1px solid #30363d",
                  background: item.value === period ? "#1f6feb" : "#161b22",
                  color: "white",
                  padding: "6px 14px",
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={!canSearch || loading}
            style={{
              height: 42,
              border: "none",
              borderRadius: 8,
              background: !canSearch || loading ? "#30363d" : "#238636",
              color: "white",
              fontWeight: 700,
            }}
          >
            {loading ? "Buscando..." : "Consultar ranking XYZ"}
          </button>
        </form>

        {error && (
          <p style={{ marginTop: 16, color: "#ff7b72" }}>
            Erro: {error}
          </p>
        )}

        {data && (
          <section style={{ marginTop: 24, display: "grid", gap: 12 }}>
            <div style={{ border: "1px solid #30363d", borderRadius: 10, padding: 16, background: "#0d1117" }}>
              <h2 style={{ marginBottom: 10 }}>Seu posicionamento (XYZ)</h2>
              <p>Carteira: <b>{shortAddress(data.address)}</b></p>
              <p>Ranking geral: <b>{data.rank ? `#${data.rank}` : "fora das páginas consultadas"}</b></p>
              <p>Percentil: <b>{data.percentile ? `${data.percentile.toFixed(2)}%` : "-"}</b></p>
              <p>Participação no volume total da XYZ: <b>{(data.walletShare || 0).toFixed(5)}%</b></p>
            </div>

            <div style={{ border: "1px solid #30363d", borderRadius: 10, padding: 16, background: "#0d1117" }}>
              <h2 style={{ marginBottom: 10 }}>Volumes</h2>
              <p>Seu volume: <b>{money(data.wallet?.volume)}</b></p>
              <p>Volume total XYZ (amostra do leaderboard): <b>{money(data.totalDexVolume)}</b></p>
              <p>Total de traders considerados: <b>{Number(data.totalTraders || 0).toLocaleString()}</b></p>
            </div>

            <div style={{ border: "1px solid #30363d", borderRadius: 10, padding: 16, background: "#0d1117" }}>
              <h2 style={{ marginBottom: 10 }}>Top 10 XYZ</h2>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "#8b949e", borderBottom: "1px solid #30363d" }}>
                    <th style={{ textAlign: "left", padding: "6px 4px" }}>Rank</th>
                    <th style={{ textAlign: "left", padding: "6px 4px" }}>Carteira</th>
                    <th style={{ textAlign: "left", padding: "6px 4px" }}>Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.top10 || []).map((item) => (
                    <tr key={`${item.address}-${item.rank}`} style={{ borderBottom: "1px solid #21262d" }}>
                      <td style={{ padding: "6px 4px" }}>#{item.rank}</td>
                      <td style={{ padding: "6px 4px" }}>{shortAddress(item.address)}</td>
                      <td style={{ padding: "6px 4px" }}>{money(item.volume)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
