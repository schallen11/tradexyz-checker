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

    // Sempre retorna 200 para o frontend — inclui o erro no payload
    // assim o frontend decide o que fazer com cada resposta
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { _error: text, _status: response.status };
    }

    if (!response.ok) {
      return res.status(200).json({ _error: text, _status: response.status });
    }

    res.status(200).json(data);
  } catch (err) {
    console.error("[HL Proxy Error]", err);
    res.status(200).json({ _error: err.message || "Internal server error" });
  }
}
