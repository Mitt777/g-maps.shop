const http = require("http");
const fs = require("fs");
const path = require("path");
const analyzePlace = require("./api/analyze-place");

const publicTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

const server = http.createServer(async (request, response) => {
  if (request.url === "/api/analyze-place" && request.method === "POST") {
    request.body = await readBody(request);
    response.status = (code) => {
      response.statusCode = code;
      return response;
    };
    response.send = (payload) => response.end(payload);
    return analyzePlace(request, response);
  }

  const requestPath = request.url === "/" ? "/index.html" : request.url.split("?")[0];
  const filePath = path.join(__dirname, requestPath);
  const normalized = path.normalize(filePath);

  if (!normalized.startsWith(__dirname)) {
    response.writeHead(403);
    return response.end("Forbidden");
  }

  fs.readFile(normalized, (error, content) => {
    if (error) {
      fs.readFile(path.join(__dirname, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) {
          response.writeHead(404);
          return response.end("Not found");
        }
        response.writeHead(200, { "content-type": publicTypes[".html"] });
        response.end(fallback);
      });
      return;
    }

    response.writeHead(200, {
      "content-type": publicTypes[path.extname(normalized)] || "application/octet-stream"
    });
    response.end(content);
  });
});

server.listen(port, host, () => {
  console.log(`g-maps.shop dev server running at http://${host}:${port}`);
});

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}
