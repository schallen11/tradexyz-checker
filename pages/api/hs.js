const HS = "https://hypestats.xyz/api";

export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const { path, ...params } = req.query;
  if (!path) return res.status(400).json({ error: "Missing path" });

  const qs = new URLSearchParams(params).toString();
  const url = HS + "/" + path + (qs ? "?" + qs : "");

  try {
    const r = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    const data = await r.json();
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");
    res.status(200).json(data);
  } catch (err) {
    res.status(200).json({ _error: err.message });
  }
}
