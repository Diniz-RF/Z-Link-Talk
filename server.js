const http = require("http");
const WebSocket = require("ws");

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Z-Link Talk Server OK");
});

const wss = new WebSocket.Server({ server });

let clients = [];

wss.on("connection", (ws) => {

  const id = Math.random().toString(36).substr(2, 9);
  ws.id = id;

  clients.push(ws);

  // envia init
  ws.send(JSON.stringify({
    type: "init",
    id,
    clients: clients.map(c => c.id)
  }));

  // avisa outros
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

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT);
});