export default {
  async scheduled(event, env, ctx) {
    const fetchPrices = async () => {
      const url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,tether-gold&vs_currencies=usd,cny";
      const priceData = await env.PRICE_STORAGE.get("latest_prices");
      const previousData = JSON.parse(priceData || '{"btc":"加载中","xaut":"加载中","gold_rmb":"--","last_attempt_at":null,"last_success_at":null}');
      const attemptedAt = Date.now();

      try {
        if (!env.COINGECKO_DEMO_API_KEY) {
          throw new Error("缺少 COINGECKO_DEMO_API_KEY");
        }

        const response = await fetch(url, {
          headers: {
            "User-Agent": "Cloudflare-Worker-Gold-Bot",
            "x-cg-demo-api-key": env.COINGECKO_DEMO_API_KEY
          }
        });
        if (!response.ok) {
          throw new Error("上游返回异常状态: " + response.status);
        }

        const data = await response.json();

        const btcUsd = data.bitcoin.usd;
        const xautUsd = data["tether-gold"].usd;
        const xautCny = data["tether-gold"].cny;

        if (![btcUsd, xautUsd, xautCny].every(Number.isFinite)) {
          throw new Error("上游返回的数据格式异常");
        }

        const goldPurity = 31.1035;
        const goldRmbPerGram = (xautCny / goldPurity).toFixed(2);
        const succeededAt = Date.now();

        const result = {
          btc: btcUsd.toLocaleString(),
          xaut: xautUsd.toLocaleString(),
          gold_rmb: goldRmbPerGram,
          last_attempt_at: attemptedAt,
          last_success_at: succeededAt
        };

        await env.PRICE_STORAGE.put("latest_prices", JSON.stringify(result));

      } catch (e) {
        const staleResult = {
          btc: previousData.btc ?? "加载中",
          xaut: previousData.xaut ?? "加载中",
          gold_rmb: previousData.gold_rmb ?? "--",
          last_attempt_at: attemptedAt,
          last_success_at: previousData.last_success_at ?? null
        };

        await env.PRICE_STORAGE.put("latest_prices", JSON.stringify(staleResult));
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
    const data = JSON.parse(priceData || '{"btc":"加载中","xaut":"加载中","gold_rmb":"--","last_attempt_at":null,"last_success_at":null}');

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};
