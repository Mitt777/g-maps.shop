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
    "出力は日本語で、100文字以内のsummary、短いactionsを3つ、next_noteを1文。JSONだけを返してください。",
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
      next_note: compact(parsed.next_note).slice(0, 120)
    };
  } catch (error) {
    return null;
  }
}

function clampScore(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeStringList(value, max = 5) {
  return Array.isArray(value) ? value.map(compact).filter(Boolean).slice(0, max) : [];
}

function normalizeExplanations(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    maps_presence_score: compact(source.maps_presence_score).slice(0, 180),
    tourist_ready: compact(source.tourist_ready).slice(0, 180),
    ai_readability: compact(source.ai_readability).slice(0, 180),
    geo_readiness: compact(source.geo_readiness).slice(0, 180),
    saveability: compact(source.saveability).slice(0, 180),
    photo_route_score: compact(source.photo_route_score).slice(0, 180)
  };
}

function parseJson(text) {
  const trimmed = compact(text);
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
}

function publicFacts(place, competitors, report) {
  return {
    name: place.name,
    address: place.address,
    category: place.category || place.primary_type_label || place.primary_type,
    types: place.types,
    business_status: place.business_status,
    rating: place.rating,
    review_count: place.review_count || place.user_rating_count,
    photos_count: place.photos_count,
    has_hours: (place.weekday_descriptions || []).length > 0,
    has_current_hours: (place.weekday_descriptions || []).length > 0,
    has_website: Boolean(place.website_url || place.website_uri),
    has_phone: Boolean(place.phone),
    has_international_phone: Boolean(place.international_phone),
    has_parking: Boolean(place.parking_options) && Object.values(place.parking_options || {}).some((value) => value === true),
    has_payment: Boolean(place.payment_options) && Object.values(place.payment_options || {}).some((value) => value === true),
    has_accessibility: Boolean(place.accessibility_options) && Object.values(place.accessibility_options || {}).some((value) => value === true),
    has_service_options: Boolean(place.service_options) && Object.values(place.service_options || {}).some((value) => value === true),
    has_summary: Boolean(place.editorial_summary || place.generative_summary || place.review_summary),
    editorial_summary: place.editorial_summary,
    review_summary: place.review_summary,
    competitors: (competitors || []).slice(0, 4).map((item) => ({
      name: item.name,
      category: item.category,
      rating: item.rating,
      review_count: item.review_count || item.user_rating_count,
      photos_count: item.photos_count
    })),
    baseline_scores: {
      maps_presence_score: report.maps_presence_score,
      tourist_ready: report.tourist_ready,
      ai_readability: report.ai_readability,
      saveability: report.saveability,
      inbound_ready: report.inbound_ready,
      entry_anxiety_relief: report.entry_anxiety_relief
    },
    missing_items: report.missing_items,
    quick_fixes: report.quick_fixes
  };
}

function diagnosisPrompt(place, competitors, report) {
  return `
あなたは g-maps.shop の Google Maps Public Presence Analyzer です。
Google Maps / Places API で取得できる公開情報だけを使い、店舗オーナー向けに「実際に判定した」診断JSONを作ってください。

重要:
- okyakusa-ma.com の世界観診断はしない。ここでは Maps公開情報、観光客、AI検索、GEO、保存、写真/導線を診断する
- 事実と仮説を分ける。未取得情報は「未確認」「可能性」と書く
- MEO順位保証、Google公式診断のような表現は禁止
- 点数は改善目安。baseline_scoresを参考にしつつ、下の基準で再判定する
- 店舗名、カテゴリ、口コミ数、写真数、営業時間、Web導線、電話、駐車場、決済、説明/要約を必ず見る
- 文章は店主がすぐ理解できる短さにする

診断基準:
1. maps_presence_score:
  店舗特定、カテゴリ、住所、営業時間、口コミ、評価、写真、Web導線、電話、営業状態、駐車場/決済など公開情報の整備度。
2. tourist_ready:
  土地勘のない人・訪日客が、営業中か、行き方、支払い、連絡、Web/予約、写真で安心できるか。
3. ai_readability:
  AI検索が「どんな店か」「誰に向くか」「なぜ行く価値があるか」を説明しやすい公開材料があるか。
4. geo_readiness:
  Google Maps、公式サイト、口コミ、写真、SNS/予約導線が矛盾なく、AI推薦時代の判断材料としてつながっているか。
5. saveability:
  評価、口コミ、写真、Web導線、名物/利用シーンの見え方から、保存・比較されやすいか。
6. photo_route_score:
  写真枚数、入口/外観/店内/価格/アクセスを想像できる材料、駐車場・電話・Web導線の見え方。

公開情報:
${JSON.stringify(publicFacts(place, competitors, report), null, 2)}

次のJSONだけを返してください。余計な説明は禁止です。
{
  "generated_by": "gemini",
  "total_score": 0,
  "scores": {
    "maps_presence_score": 0,
    "tourist_ready": 0,
    "ai_readability": 0,
    "geo_readiness": 0,
    "saveability": 0,
    "photo_route_score": 0
  },
  "summary": ["3文以内の状態要約", "string", "string"],
  "metric_explanations": {
    "maps_presence_score": "なぜこの点数か",
    "tourist_ready": "なぜこの点数か",
    "ai_readability": "なぜこの点数か",
    "geo_readiness": "なぜこの点数か",
    "saveability": "なぜこの点数か",
    "photo_route_score": "なぜこの点数か"
  },
  "today_fix": "今すぐ直す1点",
  "customer_view": "初めてのお客様からどう見えるか",
  "tourist_view": "観光客・土地勘のない人からどう見えるか",
  "ai_search_view": "AI検索からどう説明されやすい/されにくいか",
  "quick_fixes": ["すぐ直すこと", "string", "string", "string", "string"],
  "strengths": ["強み", "string", "string"],
  "weaknesses": ["弱点", "string", "string"],
  "next_note": "次に確認するとよいこと"
}`;
}

async function generateMapsPublicDiagnosis(place, competitors, report) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: diagnosisPrompt(place, competitors, report) }]
        }
      ],
      generationConfig: {
        temperature: 0.25,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) return null;
  const parsed = parseJson(pickText(await response.json()));
  if (!parsed) return null;

  return {
    generated_by: parsed.generated_by || "gemini",
    total_score: clampScore(parsed.total_score, report.maps_presence_score),
    scores: {
      maps_presence_score: clampScore(parsed.scores?.maps_presence_score, report.maps_presence_score),
      tourist_ready: clampScore(parsed.scores?.tourist_ready, report.tourist_ready),
      ai_readability: clampScore(parsed.scores?.ai_readability, report.ai_readability),
      geo_readiness: clampScore(parsed.scores?.geo_readiness, report.geo_readiness),
      saveability: clampScore(parsed.scores?.saveability, report.saveability),
      photo_route_score: clampScore(parsed.scores?.photo_route_score, report.photo_route_score || report.saveability)
    },
    summary: normalizeStringList(parsed.summary, 3),
    metric_explanations: normalizeExplanations(parsed.metric_explanations),
    today_fix: compact(parsed.today_fix),
    customer_view: compact(parsed.customer_view),
    tourist_view: compact(parsed.tourist_view),
    ai_search_view: compact(parsed.ai_search_view),
    quick_fixes: normalizeStringList(parsed.quick_fixes, 5),
    strengths: normalizeStringList(parsed.strengths, 4),
    weaknesses: normalizeStringList(parsed.weaknesses, 4),
    next_note: compact(parsed.next_note)
  };
}

module.exports = {
  generateMapsInsight,
  generateMapsPublicDiagnosis
};
