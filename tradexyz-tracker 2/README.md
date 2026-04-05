# 📊 TradeXYZ Tracker

Monitor pessoal do seu ranking no leaderboard HIP-3 do TradeXYZ, usando a API pública do Hyperliquid.

## ✨ Funcionalidades

- Cole seu endereço de carteira e veja seus dados em segundos
- Rank e percentil entre todos os traders
- Volume, PnL, Fees, ROI e valor da conta
- Leaderboard Top 20 com sua posição destacada
- Filtros por período: All Time, 30 dias, 7 dias, 24h
- Nenhum dado é armazenado — tudo fica no seu navegador

---

## 🚀 Como fazer o deploy (GitHub + Vercel)

### Passo 1 — Subir para o GitHub

1. Crie uma conta em [github.com](https://github.com) se não tiver
2. Clique em **"New repository"** (botão verde no canto superior direito)
3. Dê o nome `tradexyz-tracker` e clique em **Create repository**
4. Na sua máquina, abra o terminal na pasta do projeto e rode:

```bash
git init
git add .
git commit -m "primeiro commit: tradexyz tracker"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/tradexyz-tracker.git
git push -u origin main
```

> Substitua `SEU_USUARIO` pelo seu usuário do GitHub.

---

### Passo 2 — Deploy no Vercel (gratuito)

1. Acesse [vercel.com](https://vercel.com) e faça login com sua conta GitHub
2. Clique em **"Add New Project"**
3. Selecione o repositório `tradexyz-tracker`
4. Clique em **"Deploy"** — o Vercel detecta automaticamente que é Next.js

✅ Em ~2 minutos seu site estará online em um endereço como:
`https://tradexyz-tracker-seu-usuario.vercel.app`

---

### Passo 3 — Atualizar o site no futuro

Toda vez que você alterar um arquivo e rodar:

```bash
git add .
git commit -m "minha atualização"
git push
```

O Vercel faz o redeploy automaticamente!

---

## 🛠️ Rodar localmente (opcional)

```bash
npm install
npm run dev
```

Acesse: http://localhost:3000

---

## 📁 Estrutura do projeto

```
tradexyz-tracker/
├── pages/
│   ├── index.js          ← Página principal (UI do tracker)
│   ├── _app.js           ← Configuração do Next.js
│   └── api/
│       └── hl.js         ← Proxy para a API do Hyperliquid
├── styles/
│   └── globals.css       ← Estilos globais
├── package.json
└── next.config.js
```

## 🔧 Como funciona

```
Seu browser → /api/hl (Vercel) → api.hyperliquid.xyz → dados de volta
```

O proxy (`/api/hl`) existe para evitar erros de CORS — o browser não pode
chamar a API do Hyperliquid diretamente, mas o servidor Vercel pode.

---

## 📄 Licença

MIT — use, modifique e compartilhe à vontade.
