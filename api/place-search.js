const { searchPlaces } = require("./_lib/places");
const { createMockPlace } = require("./_lib/scoring");
const { readJsonBody, sendJson } = require("./_lib/response");

function compact(value) {
  return String(value || "").trim();
}

function candidatePayload(place) {
  return {
    place_id: place.place_id || "",
    name: place.name || "",
    address: place.address || "",
    category: place.category || place.primary_type_label || place.primary_type || "",
    rating: place.rating,
    review_count: place.review_count || place.user_rating_count,
    google_maps_url: place.google_maps_url || place.google_maps_uri || ""
  };
}

module.exports = async function handler(request, response) {
  try {
    if (request.method !== "POST") {
      return sendJson(response, 405, { ok: false, message: "POST only." });
    }

    const body = await readJsonBody(request);
    const storeName = compact(body.store_name || body.store_query || body.query);
    const area = compact(body.area);

    if (!storeName && !area) {
      return sendJson(response, 400, {
        ok: false,
        message: "店名と地域を入力してください。"
      });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    const input = {
      store_name: storeName,
      area,
      language: compact(body.language) || "ja",
      region: compact(body.region) || "JP"
    };

    if (!apiKey) {
      return sendJson(response, 200, {
        ok: true,
        configured: false,
        query: [storeName, area].filter(Boolean).join(" "),
        candidates: [candidatePayload(createMockPlace(input))]
      });
    }

    const candidates = await searchPlaces(input, apiKey);
    return sendJson(response, 200, {
      ok: true,
      configured: true,
      query: [storeName, area].filter(Boolean).join(" "),
      candidates: candidates.slice(0, 5).map(candidatePayload)
    });
  } catch (error) {
    return sendJson(response, 500, {
      ok: false,
      message: error.message || "店舗候補を取得できませんでした。"
    });
  }
};
