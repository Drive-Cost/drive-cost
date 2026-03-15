const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(
        {
          users: [],
          sessions: [],
          vehicles: [],
          fuelEntries: [],
          maintenanceEntries: [],
        },
        null,
        2,
      ),
    );
  }
}

function readDatabase() {
  ensureDatabase();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDatabase(database) {
  fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

function parseJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function upsertByClientId(collection, prefix, payload) {
  const clientId = payload.clientId || payload.id || createId(`${prefix}_client`);
  const existingIndex = collection.findIndex(
    (item) => item.clientId === clientId || item.id === payload.id,
  );

  const record = {
    ...payload,
    id:
      existingIndex >= 0
        ? collection[existingIndex].id
        : createId(prefix),
    clientId,
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    collection[existingIndex] = {
      ...collection[existingIndex],
      ...record,
    };
    return collection[existingIndex];
  }

  collection.push({
    createdAt: new Date().toISOString(),
    ...record,
  });
  return record;
}

const server = http.createServer(async (request, response) => {
  const { method, url } = request;

  if (!url) {
    sendJson(response, 400, { error: "Missing URL" });
    return;
  }

  if (method === "GET" && url === "/health") {
    sendJson(response, 200, {
      status: "ok",
      service: "drivecost-backend",
      offlineFirst: true,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (method === "POST" && url === "/auth/guest") {
    const database = readDatabase();
    const session = {
      id: createId("session"),
      userId: createId("user"),
      mode: "guest",
      createdAt: new Date().toISOString(),
    };

    database.users.push({
      id: session.userId,
      mode: "guest",
      createdAt: session.createdAt,
    });
    database.sessions.push(session);
    writeDatabase(database);

    sendJson(response, 201, session);
    return;
  }

  if (method === "GET" && url === "/vehicles") {
    const database = readDatabase();
    sendJson(response, 200, { data: database.vehicles });
    return;
  }

  if (method === "POST" && url === "/vehicles") {
    try {
      const payload = await parseJson(request);
      const database = readDatabase();
      const record = upsertByClientId(database.vehicles, "vehicle", payload);
      writeDatabase(database);
      sendJson(response, 201, { data: record });
    } catch (error) {
      sendJson(response, 400, { error: "Invalid vehicle payload" });
    }
    return;
  }

  if (method === "POST" && url === "/fuel-entries") {
    try {
      const payload = await parseJson(request);
      const database = readDatabase();
      const record = upsertByClientId(database.fuelEntries, "fuel", payload);
      writeDatabase(database);
      sendJson(response, 201, { data: record });
    } catch (error) {
      sendJson(response, 400, { error: "Invalid fuel entry payload" });
    }
    return;
  }

  if (method === "POST" && url === "/maintenance-entries") {
    try {
      const payload = await parseJson(request);
      const database = readDatabase();
      const record = upsertByClientId(
        database.maintenanceEntries,
        "maintenance",
        payload,
      );
      writeDatabase(database);
      sendJson(response, 201, { data: record });
    } catch (error) {
      sendJson(response, 400, { error: "Invalid maintenance entry payload" });
    }
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  ensureDatabase();
  console.log(`DriveCost backend listening on http://localhost:${PORT}`);
});
