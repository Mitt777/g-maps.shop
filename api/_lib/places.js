const { scorePresence } = require("./scoring");
const { generateMapsInsight, generateMapsPublicDiagnosis } = require("./gemini");

const SEARCH_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const DETAILS_ENDPOINT = "https://places.googleapis.com/v1/places";

const FIELD_MASKS = [
  "places.id",
  "places.name",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.types",
  "places.location",
  "places.businessStatus",
  "places.rating",
  "places.userRatingCount",
  "places.regularOpeningHours",
  "places.currentOpeningHours",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.googleMapsUri",
  "places.photos",
  "places.parkingOptions",
  "places.paymentOptions",
  "places.accessibilityOptions",
  "places.editorialSummary",
  "places.generativeSummary",
  "places.reviewSummary",
  "places.allowsDogs",
  "places.curbsidePickup",
  "places.delivery",
  "places.dineIn",
  "places.goodForChildren",
  "places.goodForGroups",
  "places.outdoorSeating",
  "places.reservable",
  "places.restroom",
  "places.takeout"
];

const DETAIL_FIELD_MASKS = FIELD_MASKS.map((field) => field.replace(/^places\./, "")).join(",");

function compact(value) {
  return String(value || "").trim();
}

function toText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.text || "";
}

function extractPlaceId(value) {
  const text = compact(value);
  if (!text) return "";
  const direct = text.match(/places\/([A-Za-z0-9_-]+)/);
  if (direct) return direct[1];
  const queryParam = text.match(/[?&]q=place_id:([^&]+)/);
  if (queryParam) return decodeURIComponent(queryParam[1]);
  const cidParam = text.match(/[?&]cid=([^&]+)/);
  if (cidParam) return "";
  return "";
}

function normalizePlace(place) {
  const serviceOptions = {
    allows_dogs: place.allowsDogs,
    curbside_pickup: place.curbsidePickup,
    delivery: place.delivery,
    dine_in: place.dineIn,
    good_for_children: place.goodForChildren,
    good_for_groups: place.goodForGroups,
    outdoor_seating: place.outdoorSeating,
    reservable: place.reservable,
    restroom: place.restroom,
    takeout: place.takeout
  };

  return {
    place_id: place.id || "",
    resource_name: place.name || "",
    name: toText(place.displayName),
    address: place.formattedAddress || place.shortFormattedAddress || "",
    category: toText(place.primaryTypeDisplayName) || place.primaryType || "",
    primary_type: place.primaryType || "",
    primary_type_label: toText(place.primaryTypeDisplayName),
    types: Array.isArray(place.types) ? place.types : [],
    business_status: place.businessStatus || "",
    rating: typeof place.rating === "number" ? place.rating : null,
    review_count: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
    user_rating_count: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
    website_url: place.websiteUri || "",
    website_uri: place.websiteUri || "",
    phone: place.nationalPhoneNumber || "",
    international_phone: place.internationalPhoneNumber || "",
    google_maps_url: place.googleMapsUri || "",
    google_maps_uri: place.googleMapsUri || "",
    lat: typeof place.location?.latitude === "number" ? place.location.latitude : null,
    lng: typeof place.location?.longitude === "number" ? place.location.longitude : null,
    photos_count: Array.isArray(place.photos) ? place.photos.length : 0,
    weekday_descriptions: place.currentOpeningHours?.weekdayDescriptions || place.regularOpeningHours?.weekdayDescriptions || [],
    parking_options: place.parkingOptions || null,
    payment_options: place.paymentOptions || null,
    accessibility_options: place.accessibilityOptions || null,
    editorial_summary: toText(place.editorialSummary),
    generative_summary: toText(place.generativeSummary?.overview),
    review_summary: toText(place.reviewSummary?.text),
    service_options: serviceOptions
  };
}

function applyMapsDiagnosis(report, diagnosis) {
  if (!report || !diagnosis) return report;

  const scores = diagnosis.scores || {};
  report.maps_presence_score = scores.maps_presence_score;
  report.tourist_ready = scores.tourist_ready;
  report.ai_readability = scores.ai_readability;
  report.saveability = scores.saveability;
  report.photo_route_score = scores.photo_route_score;
  report.overall_score = diagnosis.total_score;
  report.maps_public_diagnosis = diagnosis;
  report.metric_explanations = diagnosis.metric_explanations || {};

  if (diagnosis.summary?.length) {
    report.free_insight.summary = diagnosis.summary;
  }
  if (diagnosis.today_fix) {
    report.free_insight.today_fix = diagnosis.today_fix;
  }
  if (diagnosis.customer_view) {
    report.free_insight.customer_view = diagnosis.customer_view;
  }
  if (diagnosis.tourist_view) {
    report.free_insight.tourist_view = diagnosis.tourist_view;
  }
  if (diagnosis.ai_search_view) {
    report.free_insight.ai_search_view = diagnosis.ai_search_view;
  }
  if (diagnosis.quick_fixes?.length) {
    report.quick_fixes = diagnosis.quick_fixes;
  }
  if (diagnosis.strengths?.length) {
    report.strengths = diagnosis.strengths;
  }
  if (diagnosis.weaknesses?.length) {
    report.weaknesses = diagnosis.weaknesses;
    report.missing_items = diagnosis.weaknesses;
  }
  if (diagnosis.paid_boundary) {
    report.paid_preview.handoff = diagnosis.paid_boundary;
  }
  report.ai_insight = {
    summary: (diagnosis.summary || []).join(" ").slice(0, 120),
    actions: (diagnosis.quick_fixes || []).slice(0, 3),
    paid_boundary: diagnosis.paid_boundary
  };

  report.free_insight.score_note = `Maps ${report.maps_presence_score} / Tourist ${report.tourist_ready} / AI ${report.ai_readability} / Save ${report.saveability}`;
  return report;
}

async function fetchPlaceById(placeId, apiKey) {
  const response = await fetch(`${DETAILS_ENDPOINT}/${placeId}`, {
    headers: {
      "x-goog-api-key": apiKey,
      "x-goog-fieldmask": DETAIL_FIELD_MASKS
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Places Details API error ${response.status}: ${detail}`);
  }

  return normalizePlace(await response.json());
}

async function searchPlaces(input, apiKey) {
  const query = [input.store_name || input.query, input.area].map(compact).filter(Boolean).join(" ") || compact(input.maps_url);
  const response = await fetch(SEARCH_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
      "x-goog-fieldmask": FIELD_MASKS.join(",")
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: input.language || "ja",
      regionCode: input.region || "JP",
      maxResultCount: 5
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Places Text Search API error ${response.status}: ${detail}`);
  }

  const data = await response.json();
  return (data.places || []).map(normalizePlace);
}

async function analyzePublicPresence(input) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  const placeId = compact(input.place_id) || extractPlaceId(input.maps_url);
  const query = [input.store_name || input.query, input.area].map(compact).filter(Boolean).join(" ") || compact(input.maps_url);

  if (!apiKey) {
    return {
      configured: false,
      mode: "mock",
      query,
      candidates: [],
      place: null,
      report: null
    };
  }

  let candidates = [];
  let place = null;

  if (placeId) {
    place = await fetchPlaceById(placeId, apiKey);
    if (query) {
      candidates = await searchPlaces(input, apiKey).catch(() => []);
    }
  } else {
    candidates = await searchPlaces(input, apiKey);
    place = candidates[0] || null;
  }

  const competitors = candidates.filter((candidate) => candidate.place_id !== place?.place_id).slice(0, 4);
  const report = place ? scorePresence(place, competitors) : null;
  if (place && report) {
    const diagnosis = await generateMapsPublicDiagnosis(place, competitors, report).catch(() => null);
    applyMapsDiagnosis(report, diagnosis);
    if (!diagnosis) {
      report.ai_insight = await generateMapsInsight(place, report).catch(() => null);
    }
  }

  return {
    configured: true,
    mode: placeId ? "place-details" : "text-search",
    query,
    candidates: place ? [place].concat(competitors) : candidates,
    competitors,
    place,
    report
  };
}

module.exports = {
  analyzePublicPresence,
  searchPlaces
};
