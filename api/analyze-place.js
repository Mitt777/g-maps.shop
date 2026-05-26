const { analyzePublicPresence } = require("./_lib/places");
const { createMockPlace, scorePresence } = require("./_lib/scoring");
const { readJsonBody, sendJson } = require("./_lib/response");

function compact(value) {
  return String(value || "").trim();
}

module.exports = async function handler(request, response) {
  try {
    if (request.method !== "POST") {
      return sendJson(response, 405, { ok: false, message: "POST only." });
    }

    const body = await readJsonBody(request);
    const mapsUrl = compact(body.maps_url || body.google_maps_url || body.url);
    const placeId = compact(body.place_id);
    const storeName = compact(body.store_name || body.store_query || body.query);
    const area = compact(body.area);

    if (!mapsUrl && !placeId && !storeName && !area) {
      return sendJson(response, 400, {
        ok: false,
        message: "Google Maps URL、または 店名 + 地域 を入力してください。"
      });
    }

    const input = {
      maps_url: mapsUrl,
      place_id: placeId,
      store_name: storeName,
      area,
      language: compact(body.language) || "ja",
      region: compact(body.region) || "JP"
    };

    const analysis = await analyzePublicPresence(input);
    const place = analysis.place || createMockPlace(input);
    const report = analysis.report || scorePresence(place);

    return sendJson(response, 200, {
      ok: true,
      configured: analysis.configured,
      mode: analysis.mode,
      query: analysis.query,
      place,
      report,
      next_actions: [
        {
          label: "より深い店舗理解へ",
          href: "https://okyakusa-ma.com",
          service: "okyakusa-ma.com"
        },
        {
          label: "公開MAP/ショップページ化",
          href: "https://map-s.site",
          service: "map-s.site"
        },
        {
          label: "場所の記憶と回復UIへ",
          href: "https://air-s.jp",
          service: "air-s.jp"
        }
      ]
    });
  } catch (error) {
    return sendJson(response, 500, {
      ok: false,
      message: error.message || "Public presence analysis failed."
    });
  }
};
