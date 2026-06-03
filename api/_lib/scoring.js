function compact(value) {
  return String(value || "").trim();
}

function hasAnyTrue(object) {
  if (!object || typeof object !== "object") return false;
  return Object.values(object).some((value) => value === true);
}

function scorePresence(place, competitors = []) {
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

  const geoReadiness = weightedScore([
    { ok: Boolean(place.name), weight: 10 },
    { ok: Boolean(place.address), weight: 10 },
    { ok: Boolean(place.category || place.primary_type_label || place.primary_type), weight: 11 },
    { ok: (place.weekday_descriptions || []).length > 0, weight: 12 },
    { ok: Boolean(place.website_url || place.website_uri), weight: 12 },
    { ok: Boolean(place.editorial_summary || place.generative_summary || place.review_summary), weight: 17 },
    { ok: Number(place.review_count || place.user_rating_count || 0) >= 10, weight: 10 },
    { ok: Number(place.photos_count || 0) >= 8, weight: 10 },
    { ok: hasAnyTrue(place.parking_options) || hasAnyTrue(place.service_options), weight: 8 }
  ]);

  const inboundReady = weightedScore([
    { ok: Boolean(place.name), weight: 10 },
    { ok: Boolean(place.address), weight: 10 },
    { ok: (place.weekday_descriptions || []).length > 0, weight: 14 },
    { ok: Boolean(place.international_phone || place.phone), weight: 9 },
    { ok: Boolean(place.website_url || place.website_uri), weight: 15 },
    { ok: hasAnyTrue(place.payment_options), weight: 12 },
    { ok: hasAnyTrue(place.parking_options), weight: 9 },
    { ok: Number(place.photos_count || 0) >= 8, weight: 12 },
    { ok: Boolean(place.editorial_summary || place.generative_summary || place.review_summary), weight: 9 }
  ]);

  const rawEntryAnxiety = weightedScore([
    { ok: Number(place.photos_count || 0) >= 5, weight: 22 },
    { ok: (place.weekday_descriptions || []).length > 0, weight: 18 },
    { ok: Boolean(place.phone), weight: 10 },
    { ok: Boolean(place.website_url || place.website_uri), weight: 14 },
    { ok: hasAnyTrue(place.parking_options), weight: 13 },
    { ok: hasAnyTrue(place.service_options), weight: 8 },
    { ok: Number(place.review_count || place.user_rating_count || 0) >= 10, weight: 15 }
  ]);
  const anxietyCap = anxietyReliefCap(place);
  const entryAnxiety = Math.min(rawEntryAnxiety, anxietyCap);

  const missing = checks.filter((check) => !check.ok).map((check) => check.label);
  const strong = checks.filter((check) => check.ok).map((check) => check.label);

  return {
    maps_presence_score: mapsPresenceScore,
    tourist_ready: touristReady,
    ai_readability: aiReadability,
    geo_readiness: geoReadiness,
    saveability,
    inbound_ready: inboundReady,
    entry_anxiety_relief: entryAnxiety,
    checked_items: checks.map(({ key, label, ok }) => ({ key, label, ok })),
    strengths: strong.slice(0, 5).map((label) => `${label}は公開情報として確認できます`),
    missing_items: missing,
    free_insight: buildFreeInsight(place, mapsPresenceScore, touristReady, aiReadability, geoReadiness, saveability),
    quick_fixes: buildQuickFixes(place, missing),
    public_layers: buildPublicLayers(place),
    deep_checks: buildDeepChecks(place, { inboundReady, entryAnxiety }),
    maps_focus: buildMapsFocus(place)
  };
}

function weightedScore(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  const earned = items.filter((item) => item.ok).reduce((sum, item) => sum + item.weight, 0);
  return Math.round((earned / total) * 100);
}

function anxietyReliefCap(place) {
  const photos = Number(place.photos_count || 0);
  const hasWebsite = Boolean(place.website_url || place.website_uri);
  const hasHours = (place.weekday_descriptions || []).length > 0;
  const hasParking = hasAnyTrue(place.parking_options);
  const hasPayment = hasAnyTrue(place.payment_options);
  const hasSummary = Boolean(place.editorial_summary || place.generative_summary || place.review_summary);

  if (photos >= 15 && hasWebsite && hasHours && hasParking && hasPayment && hasSummary) return 86;
  if (photos >= 10 && hasWebsite && hasHours && (hasParking || hasSummary)) return 78;
  if (photos >= 5 && hasHours) return 68;
  return 56;
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

function buildFreeInsight(place, mapsScore, touristReady, aiReadability, geoReadiness, saveability) {
  const reviews = Number(place.review_count || place.user_rating_count || 0);
  const photos = Number(place.photos_count || 0);
  const hasWebsite = Boolean(place.website_url || place.website_uri);
  const hasHours = (place.weekday_descriptions || []).length > 0;
  const hasParking = hasAnyTrue(place.parking_options);
  const hasPayment = hasAnyTrue(place.payment_options);
  const hasSummary = Boolean(place.editorial_summary || place.generative_summary || place.review_summary);

  const state = mapsScore >= 82 ? "Google Maps上で見つかる土台はかなり強い状態です。" : mapsScore >= 62 ? "Google Maps上で見つかる基本情報はそろい始めています。" : "Google Maps上で来店前に判断する材料がまだ薄い状態です。";
  const friction = buildFrictionLine({ hasWebsite, hasHours, hasParking, hasPayment, photos });
  const aiLine = hasSummary
    ? "AI検索にも説明材料はありますが、誰に・どんな時に向く店かをもう少し固定すると強くなります。"
    : "AI検索には、名物・利用シーン・初めての人向け説明がまだ伝わりにくい可能性があります。";

  return {
    summary: [state, friction, aiLine],
    today_fix: chooseTodayFix({ hasWebsite, hasHours, hasParking, hasPayment, photos, reviews, hasSummary }),
    customer_view: buildCustomerView({ hasWebsite, hasHours, hasParking, photos, reviews }),
    tourist_view: buildTouristView({ hasWebsite, hasHours, hasParking, hasPayment, photos }),
    ai_search_view: buildAiSearchView({ hasSummary, hasWebsite, reviews, aiReadability }),
    score_note: `Maps ${mapsScore} / Tourist ${touristReady} / AI ${aiReadability} / GEO ${geoReadiness} / Save ${saveability}`
  };
}

function buildFrictionLine({ hasWebsite, hasHours, hasParking, hasPayment, photos }) {
  if (!hasHours) return "特に営業時間が見えにくく、行く前の不安につながります。";
  if (!hasWebsite) return "公式サイトや予約導線が弱く、比較中のお客様が次に進みにくい状態です。";
  if (photos < 5) return "写真が少なく、入口・席・商品・価格を来店前に想像しにくい状態です。";
  if (!hasParking) return "到着前に迷いやすい駐車場・入口・アクセス情報を補う余地があります。";
  if (!hasPayment) return "決済方法が見えにくいと、観光客や初来店客の小さな不安になります。";
  return "基本情報は整っています。次は写真や説明文で、選ばれる理由を強くできます。";
}

function chooseTodayFix({ hasWebsite, hasHours, hasParking, hasPayment, photos, reviews, hasSummary }) {
  if (!hasHours) return "営業時間と祝日の扱いを、まず最新状態にする";
  if (!hasWebsite) return "Google Mapsから公式サイト・予約・メニューへ進む導線を足す";
  if (photos < 5) return "入口、外観、代表商品、席が分かる写真を3枚追加する";
  if (!hasParking) return "駐車場、最寄駅、入口の案内を写真か説明で補う";
  if (!hasPayment) return "使える決済方法を公開情報で分かるようにする";
  if (reviews < 10) return "来店後に口コミを書きやすい自然な声かけを用意する";
  if (!hasSummary) return "AIが説明しやすい短い店舗紹介文を1つ用意する";
  return "季節写真と人気メニューを更新し、保存したくなる理由を増やす";
}

function buildCustomerView({ hasWebsite, hasHours, hasParking, photos, reviews }) {
  if (!hasHours) return "初めてのお客様は、開いているかどうかで迷いやすい状態です。";
  if (photos < 5) return "初めてのお客様は、店内や入口を想像しにくいかもしれません。";
  if (!hasWebsite) return "比較中のお客様は、メニューや予約へ進む導線で止まりやすい状態です。";
  if (!hasParking) return "車や徒歩で向かう人には、到着直前の安心材料がもう少し欲しい状態です。";
  if (reviews >= 50) return "口コミの土台があり、初来店前の信頼は作りやすい状態です。";
  return "基本情報は見えています。写真と口コミの積み上げで安心感が増します。";
}

function buildTouristView({ hasWebsite, hasHours, hasParking, hasPayment, photos }) {
  if (!hasHours) return "観光客には、営業中かどうかが分かりにくい可能性があります。";
  if (!hasPayment) return "観光客には、カードやタッチ決済が使えるかが不安になりやすいです。";
  if (!hasParking) return "土地勘のない人には、駅・入口・駐車場の情報があると安心です。";
  if (photos < 8) return "観光客には、外観・名物・価格感の写真があるほど保存されやすくなります。";
  if (!hasWebsite) return "多言語で確認できる公式導線があると、旅程に入れやすくなります。";
  return "観光客が来店前に確認したい材料は比較的そろっています。";
}

function buildAiSearchView({ hasSummary, hasWebsite, reviews, aiReadability }) {
  if (!hasSummary) return "AIには、何が名物で誰に向く店かがまだ説明されにくい状態です。";
  if (!hasWebsite) return "AIは説明材料を拾えても、公式情報へ案内しにくい状態です。";
  if (reviews < 10) return "AIが信頼材料として扱える口コミの厚みは、まだ育てる余地があります。";
  if (aiReadability >= 80) return "AIが店舗を説明するための材料はかなりそろっています。";
  return "AIに説明される土台はあります。利用シーンの言語化でさらに強くなります。";
}

function buildPublicLayers(place) {
  return [
    {
      label: "Find",
      title: "検索で見つかる土台",
      ok: Boolean(place.name && place.address && (place.category || place.primary_type_label)),
      note: place.category ? `${place.category}として認識されています。` : "カテゴリの見え方を確認したい状態です。"
    },
    {
      label: "Trust",
      title: "初来店前の信頼",
      ok: Number(place.review_count || place.user_rating_count || 0) >= 10 && Number(place.rating || 0) >= 4,
      note: `評価${place.rating || "n/a"}、口コミ${place.review_count || place.user_rating_count || 0}件が見えています。`
    },
    {
      label: "Plan",
      title: "行く前の不安解消",
      ok: (place.weekday_descriptions || []).length > 0 && Boolean(place.phone) && hasAnyTrue(place.parking_options),
      note: hasAnyTrue(place.parking_options) ? "営業時間・連絡先・アクセス情報を確認できます。" : "駐車場や到着前情報を補う余地があります。"
    },
    {
      label: "Save",
      title: "保存されやすさ",
      ok: Number(place.photos_count || 0) >= 8 && Boolean(place.website_url || place.website_uri),
      note: `写真${place.photos_count || 0}件、Web導線${place.website_url || place.website_uri ? "あり" : "未確認"}です。`
    },
    {
      label: "AI",
      title: "AIに説明されやすい状態",
      ok: Boolean(place.editorial_summary || place.generative_summary || place.review_summary),
      note: place.editorial_summary || place.review_summary ? "説明や口コミ要約の材料があります。" : "AIが引用しやすい短い説明文を足したい状態です。"
    }
  ];
}

function buildDeepChecks(place, scores) {
  const hasWebsite = Boolean(place.website_url || place.website_uri);
  const hasHours = (place.weekday_descriptions || []).length > 0;
  const photos = Number(place.photos_count || 0);
  const reviews = Number(place.review_count || place.user_rating_count || 0);
  const hasParking = hasAnyTrue(place.parking_options);
  const hasPayment = hasAnyTrue(place.payment_options);
  const hasSummary = Boolean(place.editorial_summary || place.generative_summary || place.review_summary);
  const hasService = hasAnyTrue(place.service_options);

  return [
    {
      label: "Inbound",
      title: "インバウンド対応の見え方",
      score: scores.inboundReady,
      note: hasWebsite && hasPayment
        ? "外国人や土地勘のない人が確認したい導線は見え始めています。"
        : "Web導線、決済、営業時間、入口写真を足すと旅程に入れやすくなります。"
    },
    {
      label: "Anxiety",
      title: "初来店の不安軽減",
      score: scores.entryAnxiety,
      note: scores.entryAnxiety >= 78
        ? "公開情報の土台は強めです。実際の入口・席・価格写真は深掘りで確認します。"
        : photos >= 5 && hasHours
          ? "写真と営業時間はありますが、入口・席・価格・駐車場の安心材料はまだ増やせます。"
          : "外観、入口、席、価格、駐車場が分かる情報を足すと安心されます。"
    },
    {
      label: "Photo",
      title: "写真の診断材料",
      score: weightedScore([
        { ok: photos >= 3, weight: 30 },
        { ok: photos >= 8, weight: 30 },
        { ok: photos >= 15, weight: 20 },
        { ok: reviews >= 10, weight: 20 }
      ]),
      note: photos >= 8
        ? "写真量はあります。次は入口・席・価格感・名物の質を整える段階です。"
        : "無料診断では枚数だけを確認します。質の診断は次の深掘り候補です。"
    },
    {
      label: "Link",
      title: "次に進める導線",
      score: weightedScore([
        { ok: hasWebsite, weight: 35 },
        { ok: Boolean(place.phone), weight: 20 },
        { ok: hasHours, weight: 20 },
        { ok: hasService, weight: 10 },
        { ok: hasSummary, weight: 15 }
      ]),
      note: hasWebsite
        ? "公式サイトや予約・メニューへ進む導線があります。"
        : "比較中のお客様が次に進むための公式導線を足したい状態です。"
    },
    {
      label: "AI",
      title: "AI検索の説明材料",
      score: weightedScore([
        { ok: Boolean(place.category || place.primary_type_label || place.primary_type), weight: 20 },
        { ok: hasSummary, weight: 30 },
        { ok: hasWebsite, weight: 20 },
        { ok: reviews >= 10, weight: 15 },
        { ok: photos >= 8, weight: 15 }
      ]),
      note: hasSummary
        ? "AIが短く説明するための材料があります。利用シーンの言語化でさらに強くできます。"
        : "名物、利用シーン、初めての人向けの短い説明文が不足しやすい状態です。"
    }
  ];
}

function buildMapsFocus(place) {
  const items = [];
  if (Number(place.photos_count || 0) < 8) items.push({ title: "写真", note: "外観、入口、代表商品、席、価格が分かる写真を増やす" });
  if (!hasAnyTrue(place.parking_options)) items.push({ title: "アクセス", note: "駐車場、最寄駅、入口の迷いやすさを減らす" });
  if (!hasAnyTrue(place.payment_options)) items.push({ title: "決済", note: "使える支払い方法をGoogle Mapsや公式情報で見える化する" });
  if (!place.website_url && !place.website_uri) items.push({ title: "導線", note: "公式サイト、予約、メニューへの導線を追加する" });
  if (!place.editorial_summary && !place.review_summary) items.push({ title: "説明", note: "AI検索が説明しやすい短い店舗紹介文を整える" });
  if (items.length === 0) items.push({ title: "季節更新", note: "季節写真、人気メニュー、初めての人向け情報を更新する" });
  return items.slice(0, 4);
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
