const form = document.querySelector("#analyze-form");
const statusMessage = document.querySelector("#status-message");
const submitButton = document.querySelector("#analyze-button");
const placeSearchButton = document.querySelector("#place-search-button");
const mapsHelpToggle = document.querySelector("#maps-help-toggle");
const mapsHelp = document.querySelector("#maps-url-help");
const candidatePanel = document.querySelector("#candidate-panel");
const candidateStatus = document.querySelector("#candidate-status");
const candidateList = document.querySelector("#candidate-list");
const placeIdInput = document.querySelector("#place-id");
const quickQueryInput = document.querySelector("#quick-query");
const mapsUrlInput = document.querySelector("#maps-url");
const storeNameInput = document.querySelector("#store-name");
const areaInput = document.querySelector("#area");

const fields = {
  score: document.querySelector("#score-value"),
  reportPlaceName: document.querySelector("#report-place-name"),
  reportSummary: document.querySelector("#report-summary"),
  ringScore: document.querySelector("#ring-score"),
  scoreRing: document.querySelector("#score-ring"),
  metricMaps: document.querySelector("#metric-maps"),
  metricTourist: document.querySelector("#metric-tourist"),
  metricAi: document.querySelector("#metric-ai"),
  metricGeo: document.querySelector("#metric-geo"),
  metricSave: document.querySelector("#metric-save"),
  metricPhoto: document.querySelector("#metric-photo"),
  radarPolygon: document.querySelector("#radar-polygon"),
  radarPoints: document.querySelector("#radar-points"),
  priorityFix: document.querySelector("#priority-fix"),
  tourist: document.querySelector("#tourist-score"),
  touristNote: document.querySelector("#tourist-score-note"),
  ai: document.querySelector("#ai-score"),
  aiNote: document.querySelector("#ai-score-note"),
  save: document.querySelector("#save-score"),
  saveNote: document.querySelector("#save-score-note"),
  summary: document.querySelector("#score-summary"),
  placeName: document.querySelector("#place-name"),
  placeAddress: document.querySelector("#place-address"),
  rating: document.querySelector("#rating-value"),
  reviews: document.querySelector("#reviews-value"),
  photos: document.querySelector("#photos-value"),
  website: document.querySelector("#website-value"),
  fixes: document.querySelector("#quick-fixes"),
  freeSummary: document.querySelector("#free-summary"),
  todayFix: document.querySelector("#today-fix"),
  customerView: document.querySelector("#customer-view"),
  touristView: document.querySelector("#tourist-view"),
  aiSearchView: document.querySelector("#ai-search-view"),
  aiInsightSummary: document.querySelector("#ai-insight-summary"),
  aiInsightActions: document.querySelector("#ai-insight-actions"),
  publicLayers: document.querySelector("#public-layers"),
  deepChecks: document.querySelector("#deep-checks"),
  comparisonReviews: document.querySelector("#comparison-reviews"),
  comparisonRating: document.querySelector("#comparison-rating"),
  comparisonPhotos: document.querySelector("#comparison-photos"),
  comparisonNote: document.querySelector("#comparison-note"),
  paidHandoff: document.querySelector("#paid-handoff"),
  paidPreview: document.querySelector("#paid-preview")
};

mapsHelpToggle.addEventListener("click", () => {
  const isOpen = !mapsHelp.hidden;
  mapsHelp.hidden = isOpen;
  mapsHelpToggle.setAttribute("aria-expanded", String(!isOpen));
});

["#quick-query", "#maps-url", "#store-name", "#area"].forEach((selector) => {
  document.querySelector(selector)?.addEventListener("input", () => {
    placeIdInput.value = "";
  });
});

placeSearchButton.addEventListener("click", async () => {
  syncQuickQuery();
  const payload = formPayload();

  if (!payload.maps_url && !payload.store_name && !payload.area) {
    setCandidateStatus("店名、地域、またはGoogle Maps URLを入力してください。");
    return;
  }

  placeSearchButton.disabled = true;
  candidatePanel.hidden = false;
  candidateList.replaceChildren();
  setCandidateStatus("店舗候補を探しています...");

  try {
    const response = await fetch("/api/place-search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || "候補を取得できませんでした。");
    }

    renderCandidates(data.candidates || []);
    setCandidateStatus(
      data.configured
        ? "このお店で良ければ候補をクリックしてください。"
        : "サンプル候補です。良ければクリックしてください。"
    );
  } catch (error) {
    setCandidateStatus(error.message || "候補を取得できませんでした。");
  } finally {
    placeSearchButton.disabled = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  syncQuickQuery();
  const payload = formPayload();

  if (!payload.maps_url && !payload.place_id && !payload.store_name && !payload.area) {
    setStatus("Google Maps URL、または 店名 + 地域 を入力してください。", "error");
    return;
  }

  submitButton.disabled = true;
  setStatus("公開情報を確認しています...", "loading");

  try {
    const response = await fetch("/api/analyze-place", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || "診断できませんでした。");
    }

    renderResult(data);
    setStatus(
      data.configured
        ? "Places APIの公開情報から診断しました。"
        : "Places APIキー未設定のため、同じ構造のモック診断を表示しています。",
      data.configured ? "success" : "mock"
    );
  } catch (error) {
    setStatus(error.message || "診断中にエラーが発生しました。", "error");
  } finally {
    submitButton.disabled = false;
  }
});

function formPayload() {
  const formData = new FormData(form);
  return {
    maps_url: String(formData.get("maps_url") || "").trim(),
    place_id: String(formData.get("place_id") || "").trim(),
    store_name: String(formData.get("store_name") || "").trim(),
    area: String(formData.get("area") || "").trim()
  };
}

function syncQuickQuery() {
  const query = String(quickQueryInput?.value || "").trim();

  if (!query) return;

  if (/^https?:\/\//i.test(query)) {
    mapsUrlInput.value = query;
    storeNameInput.value = "";
    areaInput.value = "";
    return;
  }

  const parts = query.split(/\s+/).filter(Boolean);
  const lastPart = parts.at(-1) || "";
  const likelyArea = parts.length >= 2 && /[都道府県市区町村駅那須黒磯塩原渋谷京都鎌倉箱根軽井沢日光]/.test(lastPart);

  mapsUrlInput.value = "";
  storeNameInput.value = likelyArea ? parts.slice(0, -1).join(" ") : query;
  areaInput.value = likelyArea ? lastPart : "";
}

function renderCandidates(candidates) {
  if (candidates.length === 0) {
    candidateList.replaceChildren();
    setCandidateStatus("候補が見つかりませんでした。店名や地域を少し変えてください。");
    return;
  }

  candidateList.replaceChildren(...candidates.map((candidate) => {
    const button = document.createElement("button");
    button.className = "candidate-card";
    button.type = "button";
    button.dataset.placeId = candidate.place_id || "";
    button.innerHTML = `
      <strong>${escapeHtml(candidate.name || "Unknown place")}</strong>
      <span>${escapeHtml([candidate.address, candidate.category].filter(Boolean).join(" / ") || "住所・カテゴリ未取得")}</span>
      <span>${escapeHtml(candidate.rating ? `Rating ${candidate.rating} / Reviews ${candidate.review_count || "n/a"}` : "Google Maps candidate")}</span>
    `;
    button.addEventListener("click", () => {
      document.querySelectorAll(".candidate-card").forEach((item) => item.classList.remove("is-selected"));
      button.classList.add("is-selected");
      placeIdInput.value = candidate.place_id || "";
      document.querySelector("#maps-url").value = candidate.google_maps_url || "";
      storeNameInput.value = candidate.name || storeNameInput.value;
      quickQueryInput.value = [candidate.name, candidate.address].filter(Boolean).join(" / ");
      setCandidateStatus("選択しました。下の診断ボタンで進めます。");
    });
    return button;
  }));
}

function renderResult(data) {
  document.querySelector(".result-shell")?.classList.add("has-result");
  const place = data.place || {};
  const report = data.report || {};
  const diagnosis = report.maps_public_diagnosis || {};
  const explanations = report.metric_explanations || diagnosis.metric_explanations || {};
  const placeName = place.name || report.place_name || report.store_name || "診断店舗";
  const reportSummaryLines = report.free_insight?.summary?.length
    ? report.free_insight.summary
    : diagnosis.summary?.length
      ? diagnosis.summary
      : ["Google Maps上の公開情報をもとに、初来店客・観光客・AI検索からの見え方を整理します。"];
  const overallScore = typeof report.overall_score === "number"
    ? report.overall_score
    : report.maps_presence_score;
  const photoRouteScore = typeof report.photo_route_score === "number"
    ? report.photo_route_score
    : photoRouteValue(place, report);
  const geoReadiness = typeof report.geo_readiness === "number"
    ? report.geo_readiness
    : geoReadinessValue(place, report);

  statusMessage.scrollIntoView({ behavior: "smooth", block: "start" });
  fields.score.textContent = formatScore(report.maps_presence_score);
  fields.reportPlaceName.textContent = placeName;
  fields.ringScore.textContent = formatScore(overallScore);
  fields.scoreRing.style.setProperty("--score", Number(overallScore || 0));
  fields.metricMaps.textContent = formatScore(report.maps_presence_score);
  fields.metricTourist.textContent = formatScore(report.tourist_ready);
  fields.metricAi.textContent = formatScore(report.ai_readability);
  fields.metricGeo.textContent = formatScore(geoReadiness);
  fields.metricSave.textContent = formatScore(report.saveability);
  fields.metricPhoto.textContent = formatScore(photoRouteScore);
  fields.priorityFix.textContent = report.free_insight?.today_fix || report.quick_fixes?.[0] || "公開情報を確認する";
  renderReportSummary(reportSummaryLines);
  renderRadar([
    Number(report.maps_presence_score || 0),
    Number(report.tourist_ready || 0),
    Number(report.ai_readability || 0),
    geoReadiness,
    Number(report.saveability || 0),
    photoRouteScore
  ]);
  fields.tourist.textContent = formatScore(report.tourist_ready);
  fields.ai.textContent = formatScore(report.ai_readability);
  fields.save.textContent = formatScore(report.saveability);
  fields.summary.textContent = explanations.maps_presence_score || summaryFor(report.maps_presence_score);
  fields.touristNote.textContent = explanations.tourist_ready || "営業時間、写真、決済、アクセスの見え方。";
  fields.aiNote.textContent = explanations.ai_readability || "AI検索が説明しやすい店舗情報の整い方。";
  fields.saveNote.textContent = explanations.saveability || "行きたい・保存したいと思われる情報量。";

  fields.placeName.textContent = placeName;
  fields.placeAddress.textContent = [place.address, place.category].filter(Boolean).join(" / ") || "公開住所・カテゴリ未取得";
  fields.rating.textContent = place.rating ?? "n/a";
  fields.reviews.textContent = place.review_count ?? place.user_rating_count ?? "n/a";
  fields.photos.textContent = place.photos_count ?? "n/a";
  fields.website.textContent = place.website_url || place.website_uri ? "Found" : "Missing";

  fields.fixes.replaceChildren(...(report.quick_fixes || []).map((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }));

  renderFreeInsight(report.free_insight || {});
  renderInsight(report);
  renderPublicLayers(report.public_layers || []);
  renderDeepChecks(report.deep_checks || []);
  renderComparison(report.comparison || {});
  renderPaidPreview(report.paid_preview || {});
}

function renderReportSummary(summary) {
  const lines = summary?.length ? summary : ["Google Maps上の公開情報をもとに、初来店客・観光客・AI検索からの見え方を整理します。"];
  fields.reportSummary.replaceChildren(...lines.map((text) => {
    const item = document.createElement("p");
    item.textContent = text;
    return item;
  }));
}

function renderRadar(values) {
  const center = { x: 120, y: 120 };
  const maxRadius = 96;
  const angles = [-90, -30, 30, 90, 150, 210];
  const points = values.map((value, index) => {
    const radius = Math.max(0, Math.min(100, value)) / 100 * maxRadius;
    const rad = angles[index] * Math.PI / 180;
    return {
      x: center.x + Math.cos(rad) * radius,
      y: center.y + Math.sin(rad) * radius
    };
  });
  fields.radarPolygon.setAttribute("points", points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" "));
  fields.radarPoints.replaceChildren(...points.map((point) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", point.x.toFixed(1));
    circle.setAttribute("cy", point.y.toFixed(1));
    circle.setAttribute("r", "7");
    return circle;
  }));
}

function geoReadinessValue(place, report) {
  const hasSummary = Boolean(place.editorial_summary || place.generative_summary || place.review_summary);
  const hasWebsite = Boolean(place.website_url || place.website_uri);
  const hasHours = (place.weekday_descriptions || []).length > 0;
  const photos = Number(place.photos_count || 0);
  const reviews = Number(place.review_count || place.user_rating_count || 0);
  const base = Number(report.ai_readability || 0) * 0.45 + Number(report.maps_presence_score || 0) * 0.35;
  const context = (hasSummary ? 8 : 0) + (hasWebsite ? 6 : 0) + (hasHours ? 4 : 0) + (photos >= 8 ? 4 : 0) + (reviews >= 10 ? 4 : 0);
  return Math.min(100, Math.round(base + context));
}

function photoRouteValue(place, report) {
  const photos = Math.min(Number(place.photos_count || 0), 10) * 6;
  const parking = report.checked_items?.find((item) => item.key === "parking")?.ok ? 20 : 0;
  const website = report.checked_items?.find((item) => item.key === "website")?.ok ? 10 : 0;
  const phone = report.checked_items?.find((item) => item.key === "phone")?.ok ? 10 : 0;
  return Math.min(100, Math.round(photos + parking + website + phone));
}

function renderFreeInsight(insight) {
  const summary = insight.summary?.length ? insight.summary : ["Google Maps上の公開情報をもとに、初来店客・観光客・AI検索からの見え方を整理します。"];
  fields.freeSummary.replaceChildren(...summary.map((text) => {
    const item = document.createElement("p");
    item.textContent = text;
    return item;
  }));
  fields.todayFix.textContent = insight.today_fix || "写真、営業時間、Web導線を確認する";
  fields.customerView.textContent = insight.customer_view || "初めてのお客様が来店前に見る不安を整理します。";
  fields.touristView.textContent = insight.tourist_view || "観光客や土地勘のない人に必要な情報を見ます。";
  fields.aiSearchView.textContent = insight.ai_search_view || "AI検索に説明されやすい公開情報かを見ます。";
}

function renderInsight(report) {
  const insight = report.ai_insight;
  fields.aiInsightSummary.textContent = insight?.summary || "公開情報だけをもとに、来店前の不安と見つかりやすさを整理しています。";
  const actions = insight?.actions?.length ? insight.actions : (report.maps_focus || []).map((item) => item.note).slice(0, 3);
  fields.aiInsightActions.replaceChildren(...actions.map((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }));
  if (insight?.paid_boundary) {
    const boundary = document.createElement("li");
    boundary.textContent = insight.paid_boundary;
    fields.aiInsightActions.append(boundary);
  }
}

function renderPublicLayers(layers) {
  fields.publicLayers.replaceChildren(...layers.map((layer) => {
    const item = document.createElement("div");
    item.className = "layer-item";
    item.innerHTML = `
      <span>${escapeHtml(layer.label || "")}</span>
      <strong>${escapeHtml(layer.title || "")}</strong>
      <p>${escapeHtml(layer.note || "")}</p>
    `;
    return item;
  }));
}

function renderDeepChecks(checks) {
  fields.deepChecks.replaceChildren(...checks.map((check) => {
    const item = document.createElement("div");
    item.className = "layer-item";
    item.innerHTML = `
      <span>${escapeHtml(check.label || "")}</span>
      <strong>${escapeHtml(check.title || "")}</strong>
      <b class="layer-score">${escapeHtml(formatScore(check.score))}</b>
      <p>${escapeHtml(check.note || "")}</p>
    `;
    return item;
  }));
}

function renderComparison(comparison) {
  fields.comparisonReviews.textContent = comparison.review_position || "未判定";
  fields.comparisonRating.textContent = comparison.rating_position || "未判定";
  fields.comparisonPhotos.textContent = comparison.photo_position || "未判定";
  fields.comparisonNote.textContent = comparison.note || "店名 + 地域で診断すると、同じ検索で見つかった候補と比べられます。";
}

function renderPaidPreview(preview) {
  fields.paidHandoff.textContent = preview.handoff || "無料診断の次に、Maps公開情報だけを深掘りします。";
  const items = preview.items || [];
  fields.paidPreview.replaceChildren(...items.map((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }));
}

function formatScore(value) {
  return typeof value === "number" ? String(value) : "--";
}

function summaryFor(score) {
  if (typeof score !== "number") {
    return "公開情報の取得結果をもとに、来店前の見え方を整理します。";
  }
  if (score >= 82) {
    return "公開情報はかなり整っています。次は写真、説明文、多言語で比較時の安心感を高める段階です。";
  }
  if (score >= 62) {
    return "基本情報は見えています。Web導線、到着前情報、AIが説明しやすい要約を整えると保存されやすくなります。";
  }
  return "来店前に判断するための情報がまだ薄めです。営業時間、写真、公式導線から優先して整えると効果が出やすいです。";
}

function setStatus(message, state) {
  statusMessage.textContent = message;
  statusMessage.dataset.state = state;
}

function setCandidateStatus(message) {
  candidatePanel.hidden = false;
  candidateStatus.textContent = message;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}


function hydrateInitialQuery() {
  const params = new URLSearchParams(window.location.search);
  const query = String(params.get("q") || "").trim();

  if (!query) return;

  const isUrl = /^https?:\/\//i.test(query);

  quickQueryInput.value = query;

  if (isUrl) {
    mapsUrlInput.value = query;
  } else {
    storeNameInput.value = query;
  }

  setStatus("入力内容を受け取りました。診断を開始しています...", "loading");
  window.setTimeout(() => {
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
    } else {
      submitButton.click();
    }
  }, 120);
}

hydrateInitialQuery();
