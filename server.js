const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// rota básica (IMPORTANTE para Render)
app.get("/", (req, res) => {
  res.send("Servidor Z-Link Talk ativo");
});

let clients = [];

wss.on("connection", (ws) => {

  const id = Math.random().toString(36).substr(2, 9);
  ws.id = id;

  clients.push(ws);

  // init
  ws.send(JSON.stringify({
    type: "init",
    id,
    clients: clients.map(c => c.id)
  }));

  // novo peer
  broadcast({
    type: "new_peer",
    id
  }, ws);

  ws.on("message", (msg) => {
    let data;

    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    data.from = ws.id;

    if (data.to) {
      const target = clients.find(c => c.id === data.to);
      if (target) {
        target.send(JSON.stringify(data));
      }
    } else {
      broadcast(data, ws);
    }
  });

  ws.on("close", () => {
    clients = clients.filter(c => c !== ws);

    broadcast({
      type: "peer_left",
      id
    });
  });

  function broadcast(data, sender = null) {
    clients.forEach(client => {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }

});

server.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT);
});