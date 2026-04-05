/**
 * API Route: /api/hl
 * Proxy para a API do Hyperliquid — evita erros de CORS no browser.
 * Vercel roda isso como uma Serverless Function automaticamente.
 */

const HL_API = "https://api.hyperliquid.xyz/info";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const response = await fetch(HL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    console.error("[HL Proxy Error]", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
}
