function sendJson(response, statusCode, payload) {
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.status(statusCode).send(JSON.stringify(payload));
}

async function readJsonBody(request) {
  if (!request.body) return {};
  if (typeof request.body === "string") return JSON.parse(request.body);
  return request.body;
}

module.exports = {
  readJsonBody,
  sendJson
};
