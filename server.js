const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });

let clients = [];

wss.on("connection", ws => {
  clients.push(ws);

  ws.on("message", message => {
    clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message.toString());
      }
    });
  });

  ws.on("close", () => {
    clients = clients.filter(c => c !== ws);
  });
});

console.log("Servidor WebRTC sinalização ativo");