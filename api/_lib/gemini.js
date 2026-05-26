const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

function compact(value) {
  return String(value || "").trim();
}

function pickText(data) {
  return compact(data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n"));
}

async function generateMapsInsight(place, report) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = [
    "あなたはGoogle Maps Public Presence Analyzerです。",
    "MEO順位や広告営業ではなく、Google Maps上の公開情報から、普通の店主が今日直すことを短く説明してください。",
    "okyakusa-ma.comの世界観診断はしません。ここでは公開情報、観光客、AI検索、保存されやすさ、初来店不安だけを冷静に見ます。",
    "出力は日本語で、100文字以内のsummary、短いactionsを3つ、paid_boundaryを1文。JSONだけを返してください。",
    JSON.stringify({
      place: {
        name: place.name,
        category: place.category,
        rating: place.rating,
        review_count: place.review_count,
        photos_count: place.photos_count,
        has_website: Boolean(place.website_url || place.website_uri),
        has_phone: Boolean(place.phone),
        has_hours: (place.weekday_descriptions || []).length > 0,
        has_parking: Boolean(place.parking_options),
        has_payment: Boolean(place.payment_options)
      },
      scores: {
        maps_presence_score: report.maps_presence_score,
        tourist_ready: report.tourist_ready,
        ai_readability: report.ai_readability,
        saveability: report.saveability,
        inbound_ready: report.inbound_ready,
        entry_anxiety_relief: report.entry_anxiety_relief
      },
      missing_items: report.missing_items,
      quick_fixes: report.quick_fixes,
      deep_checks: report.deep_checks
    })
  ].join("\n");

  const response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.35,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) return null;
  const text = pickText(await response.json());
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    return {
      summary: compact(parsed.summary).slice(0, 120),
      actions: Array.isArray(parsed.actions) ? parsed.actions.map(compact).filter(Boolean).slice(0, 3) : [],
      paid_boundary: compact(parsed.paid_boundary).slice(0, 120)
    };
  } catch (error) {
    return null;
  }
}

module.exports = {
  generateMapsInsight
};
