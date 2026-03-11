export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // 1. API 接口：实时抓取价格
    if (url.pathname === "/api/prices") {
      try {
        const prices = await fetchPrices();
        return new Response(JSON.stringify(prices), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "抓取失败" }), { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // 2. 访问首页：返回 HTML
    return new Response(generateHTML(), {
      headers: { "Content-Type": "text/html;charset=UTF-8" }
    });
  }
};

async function fetchPrices() {
  const url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,tether-gold&vs_currencies=usd,cny";
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

  return {
    btc: btcUsd.toLocaleString(),
    xaut: xautUsd.toLocaleString(),
    gold_rmb: goldRmbPerGram,
    updated_at: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  };
}

function generateHTML() {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>价格追踪 - io99.xyz</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: white; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .card { background: #1e293b; padding: 2.5rem; border-radius: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); width: 90%; max-width: 400px; border: 1px solid #334155; position: relative; }
      h1 { font-size: 1.5rem; color: #94a3b8; margin-bottom: 2rem; text-align: center; margin-top: 0; }
      .price-item { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
      .label { font-size: 1.1rem; color: #cbd5e1; }
      .value { font-size: 1.8rem; font-weight: bold; font-variant-numeric: tabular-nums; }
      .btc { color: #f59e0b; }
      .xaut { color: #fbbf24; }
      .rmb { color: #10b981; font-size: 1.8rem; }
      .unit { font-size: 0.9rem; margin-left: 4px; color: #64748b; }
      .footer { margin-top: 1.5rem; font-size: 0.8rem; color: #64748b; text-align: center; border-top: 1px solid #334155; padding-top: 1.5rem; }
      .status { display: inline-block; width: 8px; height: 8px; background: #22c55e; border-radius: 50%; margin-right: 5px; box-shadow: 0 0 8px #22c55e; }
      
      button { 
        background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 12px; font-weight: bold; cursor: pointer; width: 100%; transition: all 0.2s; 
        display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 1rem; margin-top: 1rem;
      }
      button:hover { background: #2563eb; transform: translateY(-1px); }
      button:active { transform: translateY(0); }
      button:disabled { background: #334155; color: #64748b; cursor: not-allowed; }
      
      .loading-spinner {
        width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; display: none;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      .is-loading .loading-spinner { display: inline-block; }
      .is-loading .btn-text { display: none; }
      
      .update-time { font-weight: 500; color: #94a3b8; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>实时资产行情</h1>
      <div class="price-item">
        <span class="label">Bitcoin</span>
        <span class="value btc" id="btc-price">---</span>
      </div>
      <div class="price-item">
        <span class="label">黄金 (盎司)</span>
        <span class="value xaut" id="xaut-price">---</span>
      </div>
      <div class="price-item">
        <span class="label">黄金 (RMB)</span>
        <span class="value rmb">¥<span id="rmb-price">---</span><span class="unit">/克</span></span>
      </div>
      
      <button id="refresh-btn">
        <span class="loading-spinner"></span>
        <span class="btn-text">刷新价格</span>
      </button>

      <div class="footer">
        <span class="status"></span> 按需更新<br>
        最后更新: <span id="updated-at" class="update-time">等待抓取...</span>
      </div>
    </div>

    <script>
      const btcEl = document.getElementById('btc-price');
      const xautEl = document.getElementById('xaut-price');
      const rmbEl = document.getElementById('rmb-price');
      const timeEl = document.getElementById('updated-at');
      const btn = document.getElementById('refresh-btn');

      async function updatePrices() {
        btn.disabled = true;
        btn.classList.add('is-loading');
        
        try {
          const response = await fetch('/api/prices');
          const data = await response.json();
          
          if (data.error) throw new Error(data.error);
          
          btcEl.innerText = '$' + data.btc;
          xautEl.innerText = '$' + data.xaut;
          rmbEl.innerText = data.gold_rmb;
          timeEl.innerText = data.updated_at;
        } catch (e) {
          alert('获取价格失败，请重试');
        } finally {
          btn.disabled = false;
          btn.classList.remove('is-loading');
        }
      }

      btn.addEventListener('click', updatePrices);
      
      // 页面加载时自动获取一次
      updatePrices();
    </script>
  </body>
  </html>
  `;
}
