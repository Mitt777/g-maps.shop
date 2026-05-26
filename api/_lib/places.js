const { scorePresence } = require("./scoring");

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
  const placeId = extractPlaceId(input.maps_url);
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

  const place = placeId ? await fetchPlaceById(placeId, apiKey) : (await searchPlaces(input, apiKey))[0] || null;

  return {
    configured: true,
    mode: placeId ? "place-details" : "text-search",
    query,
    candidates: place ? [place] : [],
    place,
    report: place ? scorePresence(place) : null
  };
}

module.exports = {
  analyzePublicPresence
};
