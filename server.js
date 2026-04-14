const WebSocket = require("ws");

const port = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port });

let talking = false;

wss.on("connection", ws => {

  ws.on("message", msg => {

    try {
      const data = JSON.parse(msg);

      if(data.type === "request") {
        if(!talking) {
          talking = true;
          ws.send(JSON.stringify({type:"granted"}));
        } else {
          ws.send(JSON.stringify({type:"busy"}));
        }
      }

      if(data.type === "release") {
        talking = false;
        broadcast(JSON.stringify({type:"free"}));
      }

    } catch {
      broadcast(msg, ws);
    }

  });

  function broadcast(data, sender=null) {
    wss.clients.forEach(client => {
      if(client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

});

console.log("Z-Link Talk servidor rodando...");