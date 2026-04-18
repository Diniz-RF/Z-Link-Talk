const http = require("http");
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Z-Link Talk Server OK");
});

const wss = new WebSocket.Server({ server });

// Lista de clientes conectados
let clients = [];

wss.on("connection", (ws) => {

  // 🔥 ID profissional (sem colisão)
  const id = uuidv4();

  ws.id = id;
  ws.name = "Anônimo";

  clients.push(ws);

  console.log(`Cliente conectado: ${id}`);

  // 📡 Envia lista inicial com nomes
  ws.send(JSON.stringify({
    type: "init",
    id,
    clients: clients.map(c => ({
      id: c.id,
      name: c.name
    }))
  }));

  // 📢 Notifica outros usuários
  broadcast({
    type: "new_peer",
    id,
    name: ws.name
  }, ws);

  ws.on("message", (msg) => {
    let data;

    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    data.from = ws.id;

    // 🧠 IDENTIFICAÇÃO DO USUÁRIO
    if (data.type === "identify") {
      ws.name = data.name || "Anônimo";

      console.log(`Usuário identificado: ${ws.id} → ${ws.name}`);

      return;
    }

    // 🔥 Adiciona nome em TODAS mensagens
    data.name = ws.name;

    if (data.to) {
      const target = clients.find(c => c.id === data.to);

      if (target && target.readyState === WebSocket.OPEN) {
        target.send(JSON.stringify(data));
      }
    } else {
      broadcast(data, ws);
    }
  });

  ws.on("close", () => {
    console.log(`Cliente desconectado: ${ws.id}`);

    clients = clients.filter(c => c !== ws);

    broadcast({
      type: "peer_left",
      id: ws.id,
      name: ws.name
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