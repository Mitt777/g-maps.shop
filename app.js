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

const fields = {
  score: document.querySelector("#score-value"),
  tourist: document.querySelector("#tourist-score"),
  ai: document.querySelector("#ai-score"),
  save: document.querySelector("#save-score"),
  summary: document.querySelector("#score-summary"),
  placeName: document.querySelector("#place-name"),
  placeAddress: document.querySelector("#place-address"),
  rating: document.querySelector("#rating-value"),
  reviews: document.querySelector("#reviews-value"),
  photos: document.querySelector("#photos-value"),
  website: document.querySelector("#website-value"),
  fixes: document.querySelector("#quick-fixes")
};

mapsHelpToggle.addEventListener("click", () => {
  const isOpen = !mapsHelp.hidden;
  mapsHelp.hidden = isOpen;
  mapsHelpToggle.setAttribute("aria-expanded", String(!isOpen));
});

["#maps-url", "#store-name", "#area"].forEach((selector) => {
  document.querySelector(selector).addEventListener("input", () => {
    placeIdInput.value = "";
  });
});

placeSearchButton.addEventListener("click", async () => {
  const payload = formPayload();

  if (!payload.store_name && !payload.area) {
    setCandidateStatus("店名と地域を入力してください。");
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
      setCandidateStatus("選択しました。下の診断ボタンで進めます。");
    });
    return button;
  }));
}

function renderResult(data) {
  const place = data.place || {};
  const report = data.report || {};

  fields.score.textContent = formatScore(report.maps_presence_score);
  fields.tourist.textContent = formatScore(report.tourist_ready);
  fields.ai.textContent = formatScore(report.ai_readability);
  fields.save.textContent = formatScore(report.saveability);
  fields.summary.textContent = summaryFor(report.maps_presence_score);

  fields.placeName.textContent = place.name || "Unknown place";
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
