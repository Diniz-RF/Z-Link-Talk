const http = require("http");
const WebSocket = require("ws");

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Z-Link Talk Server OK");
});

const wss = new WebSocket.Server({ server });

// 🔥 controle real por userId
let clients = new Map(); // userId -> ws
let activeTransmitters = new Set();

wss.on("connection", (ws) => {

  ws.userId = null;
  ws.name = "Anônimo";
  ws.isAlive = true;

  console.log("Nova conexão recebida");

  // 🔥 heartbeat pong
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (msg) => {
    let data;

    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    // 🔥 IDENTIFICAÇÃO
    if (data.type === "identify") {

      const { userId, name } = data;
      if (!userId) return;

      // 🔥 encerra conexão antiga + REMOVE IMEDIATO (CORREÇÃO FINAL)
      if (clients.has(userId)) {
        const oldClient = clients.get(userId);

        try {
          oldClient.terminate(); // 💥 imediato
        } catch {}

        clients.delete(userId); // 💥 remove do estado na hora
      }

      ws.userId = userId;
      ws.name = name || "Anônimo";

      clients.set(userId, ws);

      console.log(`Usuário ativo: ${userId} → ${ws.name}`);

      // 🔥 envia estado inicial (FILTRADO)
      ws.send(JSON.stringify({
        type: "init",
        id: userId,
        clients: Array.from(clients.values())
          .filter(c => c.readyState === WebSocket.OPEN)
          .map(c => ({
            id: c.userId,
            name: c.name
          })),
        activeTransmitters: Array.from(activeTransmitters)
      }));

      broadcast({
        type: "user_update",
        id: userId,
        name: ws.name
      });

      return;
    }

    if (!ws.userId) return;

    data.from = ws.userId;
    data.name = ws.name;

    // 🔥 controle de transmissão
    if (data.type === "start_tx") {
      activeTransmitters.add(ws.userId);
    }

    if (data.type === "stop_tx") {
      activeTransmitters.delete(ws.userId);
    }

    if (data.to) {
      const target = clients.get(data.to);

      if (target && target.readyState === WebSocket.OPEN) {
        target.send(JSON.stringify(data));
      }
    } else {
      broadcast(data, ws);
    }
  });

  ws.on("close", () => {
    if (ws.userId) {
      console.log(`Desconectado: ${ws.userId}`);

      // 🔥 proteção contra race condition
      if (clients.get(ws.userId) === ws) {
        clients.delete(ws.userId);
      }

      activeTransmitters.delete(ws.userId);

      broadcast({
        type: "peer_left",
        id: ws.userId,
        name: ws.name
      });
    }
  });

  function broadcast(data, sender = null) {
    clients.forEach(client => {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }

});

// 🔥 HEARTBEAT GLOBAL
setInterval(() => {
  clients.forEach((ws, userId) => {

    if (ws.isAlive === false) {
      console.log(`Removendo cliente inativo: ${userId}`);

      ws.terminate();
      clients.delete(userId);
      activeTransmitters.delete(userId);
      return;
    }

    ws.isAlive = false;

    try {
      ws.ping();
    } catch {}
  });
}, 30000);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT);
});