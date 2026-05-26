function compact(value) {
  return String(value || "").trim();
}

function hasAnyTrue(object) {
  if (!object || typeof object !== "object") return false;
  return Object.values(object).some((value) => value === true);
}

function scorePresence(place) {
  const checks = [
    { key: "category", label: "カテゴリ", ok: Boolean(place.category || place.primary_type_label || place.primary_type), weight: 9 },
    { key: "rating", label: "評価平均", ok: Number(place.rating || 0) >= 4, weight: 8 },
    { key: "reviews", label: "口コミ件数", ok: Number(place.review_count || place.user_rating_count || 0) >= 10, weight: 11 },
    { key: "hours", label: "営業時間", ok: (place.weekday_descriptions || []).length > 0, weight: 12 },
    { key: "photos", label: "写真", ok: Number(place.photos_count || 0) >= 3, weight: 11 },
    { key: "website", label: "Web導線", ok: Boolean(place.website_url || place.website_uri), weight: 10 },
    { key: "phone", label: "電話導線", ok: Boolean(place.phone), weight: 7 },
    { key: "location", label: "地図座標", ok: typeof place.lat === "number" && typeof place.lng === "number", weight: 7 },
    { key: "parking", label: "駐車場/アクセス", ok: hasAnyTrue(place.parking_options), weight: 6 },
    { key: "payment", label: "決済情報", ok: hasAnyTrue(place.payment_options), weight: 5 },
    { key: "summary", label: "説明されやすさ", ok: Boolean(place.editorial_summary || place.generative_summary || place.review_summary), weight: 8 },
    { key: "status", label: "営業状態", ok: place.business_status === "OPERATIONAL" || !place.business_status, weight: 6 }
  ];

  const total = checks.reduce((sum, check) => sum + check.weight, 0);
  const earned = checks.filter((check) => check.ok).reduce((sum, check) => sum + check.weight, 0);
  const mapsPresenceScore = Math.round((earned / total) * 100);

  const touristReady = weightedScore([
    { ok: (place.weekday_descriptions || []).length > 0, weight: 24 },
    { ok: Boolean(place.website_url || place.website_uri), weight: 15 },
    { ok: Boolean(place.phone), weight: 12 },
    { ok: Number(place.photos_count || 0) >= 5, weight: 18 },
    { ok: hasAnyTrue(place.parking_options), weight: 12 },
    { ok: hasAnyTrue(place.payment_options), weight: 11 },
    { ok: Boolean(place.international_phone), weight: 8 }
  ]);

  const aiReadability = weightedScore([
    { ok: Boolean(place.name), weight: 13 },
    { ok: Boolean(place.address), weight: 13 },
    { ok: Boolean(place.category || place.primary_type_label || place.primary_type), weight: 15 },
    { ok: Boolean(place.website_url || place.website_uri), weight: 14 },
    { ok: Boolean(place.editorial_summary || place.generative_summary || place.review_summary), weight: 20 },
    { ok: Number(place.review_count || place.user_rating_count || 0) >= 10, weight: 12 },
    { ok: (place.weekday_descriptions || []).length > 0, weight: 13 }
  ]);

  const saveability = weightedScore([
    { ok: Number(place.rating || 0) >= 4.2, weight: 18 },
    { ok: Number(place.review_count || place.user_rating_count || 0) >= 20, weight: 19 },
    { ok: Number(place.photos_count || 0) >= 8, weight: 20 },
    { ok: Boolean(place.website_url || place.website_uri), weight: 10 },
    { ok: (place.weekday_descriptions || []).length > 0, weight: 11 },
    { ok: Boolean(place.category || place.primary_type_label || place.primary_type), weight: 10 },
    { ok: Boolean(place.phone), weight: 6 },
    { ok: hasAnyTrue(place.service_options), weight: 6 }
  ]);

  const missing = checks.filter((check) => !check.ok).map((check) => check.label);
  const strong = checks.filter((check) => check.ok).map((check) => check.label);

  return {
    maps_presence_score: mapsPresenceScore,
    tourist_ready: touristReady,
    ai_readability: aiReadability,
    saveability,
    checked_items: checks.map(({ key, label, ok }) => ({ key, label, ok })),
    strengths: strong.slice(0, 5).map((label) => `${label}は公開情報として確認できます`),
    missing_items: missing,
    quick_fixes: buildQuickFixes(place, missing)
  };
}

function weightedScore(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  const earned = items.filter((item) => item.ok).reduce((sum, item) => sum + item.weight, 0);
  return Math.round((earned / total) * 100);
}

function buildQuickFixes(place, missing) {
  const fixes = [];
  if (!place.website_url && !place.website_uri) fixes.push("Google Mapsから公式サイトや予約ページへ進める導線を追加する");
  if ((place.weekday_descriptions || []).length === 0) fixes.push("営業時間、定休日、祝日の扱いを来店前に分かる形にする");
  if (Number(place.photos_count || 0) < 3) fixes.push("入口、外観、代表商品、席、価格が分かる写真を増やす");
  if (Number(place.review_count || place.user_rating_count || 0) < 10) fixes.push("来店後に口コミを書きやすい自然な導線を用意する");
  if (!hasAnyTrue(place.parking_options)) fixes.push("駐車場、最寄駅、入口など到着前に迷いやすい情報を明確にする");
  if (!hasAnyTrue(place.payment_options)) fixes.push("使える決済方法を公開情報や写真で確認しやすくする");
  if (!place.editorial_summary && !place.generative_summary && !place.review_summary) fixes.push("AI検索が説明しやすい短い店舗紹介文を整える");
  if (fixes.length === 0 && missing.length === 0) fixes.push("季節写真、人気メニュー、予約前の不安を減らす情報を追加する");
  return fixes.slice(0, 5);
}

function createMockPlace(input) {
  const query = compact(input.maps_url) || [input.store_name, input.area].map(compact).filter(Boolean).join(" ");

  return {
    place_id: "mock-place",
    name: compact(input.store_name) || "Sample Coffee Stand",
    address: compact(input.area) || "東京都渋谷区",
    category: "カフェ",
    rating: 4.2,
    review_count: 38,
    weekday_descriptions: ["月曜日: 9:00-18:00", "火曜日: 9:00-18:00", "水曜日: 9:00-18:00"],
    photos_count: 7,
    website_url: "",
    phone: "03-0000-0000",
    google_maps_url: query.startsWith("http") ? query : "",
    lat: 35.6595,
    lng: 139.7005,
    business_status: "OPERATIONAL",
    parking_options: null,
    payment_options: { accepts_credit_cards: true },
    service_options: { takeout: true, dine_in: true },
    editorial_summary: ""
  };
}

module.exports = {
  createMockPlace,
  scorePresence
};
