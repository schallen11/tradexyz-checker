# XYZ Checker (Next.js)

DApp simples para rastrear:
- Volume da sua carteira na XYZ
- Seu ranking geral no leaderboard HIP-3 da XYZ
- Seu percentil no ranking
- Seu percentual de participação no volume total da XYZ

## Fonte de dados escolhida

Este projeto usa a **API da Hypestats** (via backend `/api/xyz`) porque ela já expõe o leaderboard HIP-3 por DEX (`dex=xyz`) e os dados por carteira (`wallet-hip3-stats`).

Motivo prático:
- mais direto para calcular ranking e percentil da XYZ;
- menor complexidade do que reconstruir tudo via endpoints brutos da Hyperliquid;
- evita depender de endpoints não documentados do `app.trade.xyz`.

## Rodar localmente

```bash
npm install
npm run dev
```

Abrir: `http://localhost:3000`

## Build

```bash
npm run build
```

## Endpoint principal

`GET /api/xyz?address=<wallet>&period=all_time|30d|7d|1d`

Resposta inclui:
- `rank`
- `percentile`
- `walletShare`
- `totalDexVolume`
- `totalTraders`
- `top10`
