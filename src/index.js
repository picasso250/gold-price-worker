export default {
  async scheduled(event, env, ctx) {
    const fetchPrices = async () => {
      const url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,tether-gold&vs_currencies=usd,cny";

      try {
        const response = await fetch(url, {
          headers: { "User-Agent": "Cloudflare-Worker-Gold-Bot" }
        });
        const data = await response.json();
        
        const btcUsd = data.bitcoin.usd;
        const xautUsd = data["tether-gold"].usd;
        const xautCny = data["tether-gold"].cny;
        
        const goldPurity = 31.1035;
        const goldRmbPerGram = (xautCny / goldPurity).toFixed(2);

        const result = {
          btc: btcUsd.toLocaleString(),
          xaut: xautUsd.toLocaleString(),
          gold_rmb: goldRmbPerGram,
          updated_at: Date.now()
        };

        await env.PRICE_STORAGE.put("latest_prices", JSON.stringify(result));
        console.log("价格已更新 (含人民币克价):", result);
      } catch (e) {
        console.error("抓取失败:", e);
      }
    };

    ctx.waitUntil(fetchPrices());
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/api/prices") {
      return env.ASSETS.fetch(request);
    }

    const priceData = await env.PRICE_STORAGE.get("latest_prices");
    const data = JSON.parse(priceData || '{"btc":"加载中","xaut":"加载中","gold_rmb":"--","updated_at":null}');

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};
