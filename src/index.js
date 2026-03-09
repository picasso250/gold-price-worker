export default {
  // 1. 定时任务：每 5 分钟抓取一次价格
  async scheduled(event, env, ctx) {
    const fetchPrices = async () => {
      // 同时请求 USD 和 CNY 价格
      const url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,tether-gold&vs_currencies=usd,cny";
      
      try {
        const response = await fetch(url, {
          headers: { "User-Agent": "Cloudflare-Worker-Gold-Bot" }
        });
        const data = await response.json();
        
        const btcUsd = data.bitcoin.usd;
        const xautUsd = data["tether-gold"].usd;
        const xautCny = data["tether-gold"].cny;
        
        // 计算人民币克价：1 盎司 = 31.1035 克
        const goldPurity = 31.1035;
        const goldRmbPerGram = (xautCny / goldPurity).toFixed(2);

        const result = {
          btc: btcUsd.toLocaleString(),
          xaut: xautUsd.toLocaleString(),
          gold_rmb: goldRmbPerGram,
          updated_at: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
        };

        // 存入 KV 数据库
        await env.PRICE_STORAGE.put("latest_prices", JSON.stringify(result));
        console.log("价格已更新 (含人民币克价):", result);
      } catch (e) {
        console.error("抓取失败:", e);
      }
    };

    ctx.waitUntil(fetchPrices());
  },

  // 2. 访问域名时的逻辑
  async fetch(request, env) {
    const priceData = await env.PRICE_STORAGE.get("latest_prices");
    const data = JSON.parse(priceData || '{"btc":"加载中","xaut":"加载中","gold_rmb":"--","updated_at":"等待第一次更新"}');

    if (request.headers.get("Accept")?.includes("text/html")) {
      return new Response(generateHTML(data), {
        headers: { "Content-Type": "text/html;charset=UTF-8" }
      });
    }

    return new Response(priceData, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};

function generateHTML(data) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>价格追踪 - io99.xyz</title>
    <style>
      body { font-family: -apple-system, sans-serif; background: #0f172a; color: white; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .card { background: #1e293b; padding: 2.5rem; border-radius: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); width: 90%; max-width: 400px; border: 1px solid #334155; }
      h1 { font-size: 1.5rem; color: #94a3b8; margin-bottom: 2rem; text-align: center; }
      .price-item { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
      .label { font-size: 1.1rem; color: #cbd5e1; }
      .value { font-size: 1.8rem; font-weight: bold; font-variant-numeric: tabular-nums; }
      .btc { color: #f59e0b; }
      .xaut { color: #fbbf24; }
      .rmb { color: #10b981; font-size: 1.4rem; }
      .unit { font-size: 0.9rem; margin-left: 4px; color: #64748b; }
      .footer { margin-top: 2rem; font-size: 0.8rem; color: #64748b; text-align: center; border-top: 1px solid #334155; padding-top: 1rem; }
      .status { display: inline-block; width: 8px; height: 8px; background: #22c55e; border-radius: 50%; margin-right: 5px; box-shadow: 0 0 8px #22c55e; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>实时资产行情</h1>
      <div class="price-item">
        <span class="label">Bitcoin</span>
        <span class="value btc">$${data.btc}</span>
      </div>
      <div class="price-item">
        <span class="label">黄金 (盎司)</span>
        <span class="value xaut">$${data.xaut}</span>
      </div>
      <div class="price-item">
        <span class="label">黄金 (RMB)</span>
        <span class="value rmb">¥${data.gold_rmb}<span class="unit">/克</span></span>
      </div>
      <div class="footer">
        <span class="status"></span> 每 5 分钟自动更新<br>
        最后更新: ${data.updated_at}
      </div>
    </div>
  </body>
  </html>
  `;
}
