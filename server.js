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

function getClientList() {
return Array.from(clients.values())
.filter(c => c.readyState === WebSocket.OPEN)
.map(c => ({
id: c.userId,
name: c.name
}));
}

function broadcast(data) {
clients.forEach(client => {
if (client.readyState === WebSocket.OPEN) {
client.send(JSON.stringify(data));
}
});
}

wss.on("connection", (ws) => {

ws.userId = null;
ws.name = "Anônimo";
ws.isAlive = true;

console.log("Nova conexão recebida");

ws.on("pong", () => {
ws.isAlive = true;
});

ws.on("message", (msg) => {
let data;


try {
  // 🔥 CORREÇÃO CRÍTICA PARA NODE 22
  data = JSON.parse(msg.toString());
} catch {
  return;
}

// 🔥 IDENTIFICAÇÃO
if (data.type === "identify") {

  const { userId, name } = data;
  if (!userId) return;

  // 🔥 remove conexão antiga
  if (clients.has(userId)) {
    const oldClient = clients.get(userId);

    try {
      oldClient.terminate();
    } catch {}

    clients.delete(userId);
  }

  ws.userId = userId;
  ws.name = name || "Anônimo";

  clients.set(userId, ws);

  console.log(`Usuário ativo: ${userId} → ${ws.name}`);

  // 🔥 INIT
  ws.send(JSON.stringify({
    type: "init",
    id: userId,
    clients: getClientList(),
    activeTransmitters: Array.from(activeTransmitters)
  }));

  // 🔥 sincroniza TODOS
  broadcast({
    type: "user_list",
    clients: getClientList()
  });

  return;
}

// 🔥 bloqueia mensagens antes de identificar
if (!ws.userId) return;

// 🔥 ATUALIZAÇÃO DE NOME (SEM RECONEXÃO)
if (data.type === "update_name") {
  ws.name = data.name || "Anônimo";

  console.log(`Nome atualizado: ${ws.userId} → ${ws.name}`);

  broadcast({
    type: "user_update",
    id: ws.userId,
    name: ws.name
  });

  return;
}

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
  broadcast(data);
}


});

ws.on("close", () => {
if (ws.userId) {
console.log(`Desconectado: ${ws.userId}`);


  if (clients.get(ws.userId) === ws) {
    clients.delete(ws.userId);
  }

  activeTransmitters.delete(ws.userId);

  // 🔥 sincroniza TODOS ao sair
  broadcast({
    type: "user_list",
    clients: getClientList()
  });
}


});

});

// 🔥 HEARTBEAT GLOBAL
setInterval(() => {
clients.forEach((ws, userId) => {


if (ws.isAlive === false) {
  console.log(`Removendo cliente inativo: ${userId}`);

  ws.terminate();
  clients.delete(userId);
  activeTransmitters.delete(userId);

  // 🔥 sincroniza após remover morto
  broadcast({
    type: "user_list",
    clients: getClientList()
  });

  return;
}

ws.isAlive = false;

try {
  ws.ping();
} catch {}


});
}, 30000);

const PORT = process.env.PORT || 3000;

// 🔥 CORREÇÃO FINAL PARA RENDER
server.listen(PORT, "0.0.0.0", () => {
console.log("Servidor rodando na porta", PORT);
});
