+const HS = "https://hypestats.xyz/api";
+const MAX_PAGES = 30;
+const PAGE_SIZE = 500;
+
+function normalizeAddress(value) {
+  return (value || "").trim().toLowerCase();
+}
+
+async function getJson(url) {
+  const response = await fetch(url, {
+    headers: {
+      Accept: "application/json",
+      Referer: "https://hypestats.xyz/",
+      Origin: "https://hypestats.xyz",
+      "User-Agent":
+        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
+    },
+  });
+
+  if (!response.ok) {
+    const text = await response.text();
+    throw new Error(`Hypestats ${response.status}: ${text}`);
+  }
+
+  return response.json();
+}
+
+function extractWalletDexStats(walletPayload, originalAddress) {
+  const walletData =
+    walletPayload?.wallets?.[originalAddress]?.data ||
+    walletPayload?.wallets?.[normalizeAddress(originalAddress)]?.data ||
+    {};
+  const xyz = walletData?.byDex?.xyz || {};
+
+  return {
+    volume: Number(xyz.volume ?? walletData.totalVolume ?? 0),
+    pnl: Number(xyz.pnl ?? walletData.totalPnl ?? 0),
+    fees: Number(xyz.fees ?? walletData.totalFees ?? 0),
+    trades: Number(xyz.tradeCount ?? walletData.totalTrades ?? 0),
+  };
+}
+
+function toNumber(value) {
+  const n = Number(value);
+  return Number.isFinite(n) ? n : 0;
+}
+
+async function findRankAndGlobalVolume(address, period) {
+  const normalized = normalizeAddress(address);
+
+  let totalTraders = 0;
+  let totalVolume = 0;
+  let rank = null;
+  let top = [];
+
+  for (let page = 0; page < MAX_PAGES; page += 1) {
+    const offset = page * PAGE_SIZE;
+    const url = `${HS}/leaderboard?limit=${PAGE_SIZE}&offset=${offset}&period=${period}&sortBy=volume&dex=xyz`;
+    const payload = await getJson(url);
+    const entries = payload?.data?.entries || [];
+
+    if (!Array.isArray(entries) || entries.length === 0) {
+      break;
+    }
+
+    if (page === 0) {
+      top = entries.slice(0, 10).map((entry) => ({
+        address: entry.address,
+        rank: toNumber(entry.rank_by_volume),
+        volume: toNumber(entry.volume),
+      }));
+    }
+
+    totalTraders += entries.length;
+
+    for (const entry of entries) {
+      totalVolume += toNumber(entry.volume);
+      if (!rank && normalizeAddress(entry.address) === normalized) {
+        rank = toNumber(entry.rank_by_volume) || offset + entries.indexOf(entry) + 1;
+      }
+    }
+
+    if (entries.length < PAGE_SIZE) {
+      break;
+    }
+  }
+
+  return { rank, totalTraders, totalVolume, top };
+}
+
+export default async function handler(req, res) {
+  if (req.method !== "GET") {
+    return res.status(405).json({ error: "Method not allowed" });
+  }
+
+  const address = String(req.query.address || "").trim();
+  const period = String(req.query.period || "all_time");
+
+  if (!address || address.length < 10) {
+    return res.status(400).json({ error: "Endereco de carteira invalido." });
+  }
+
+  try {
+    const walletUrl = `${HS}/wallet-hip3-stats/batch?addresses=${encodeURIComponent(address)}`;
+    const [walletPayload, leaderboard] = await Promise.all([
+      getJson(walletUrl),
+      findRankAndGlobalVolume(address, period),
+    ]);
+
+    const wallet = extractWalletDexStats(walletPayload, address);
+    const walletShare = leaderboard.totalVolume > 0 ? (wallet.volume / leaderboard.totalVolume) * 100 : 0;
+    const percentile =
+      leaderboard.rank && leaderboard.totalTraders > 0
+        ? (1 - (leaderboard.rank - 1) / leaderboard.totalTraders) * 100
+        : null;
+
+    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
+    return res.status(200).json({
+      address,
+      period,
+      dex: "xyz",
+      wallet,
+      rank: leaderboard.rank,
+      percentile,
+      totalTraders: leaderboard.totalTraders,
+      totalDexVolume: leaderboard.totalVolume,
+      walletShare,
+      top10: leaderboard.top,
+    });
+  } catch (error) {
+    return res.status(200).json({
+      _error: error?.message || "Falha ao consultar APIs externas.",
+    });
+  }
+}
