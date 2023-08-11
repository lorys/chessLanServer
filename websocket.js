const {createServer} = require('http');
var fs = require('fs');
var path = require('path');
const {WebSocketServer} = require('ws');

const modes = ["REGULAR", "ONE_AGAINST_EVERYONE"];

const chessLANMode = 0;

function onSocketError(err) {
  console.error(err);
}

const server = createServer(function (request, response) {
  console.log('request starting...');

  var filePath = '.' + request.url;
  if (filePath == './')
      filePath = './index.html';

  var extname = path.extname(filePath);
  var contentType = 'text/html';
  switch (extname) {
      case '.js':
          contentType = 'text/javascript';
          break;
      case '.css':
          contentType = 'text/css';
          break;
      case '.json':
          contentType = 'application/json';
          break;
      case '.png':
          contentType = 'image/png';
          break;      
      case '.jpg':
          contentType = 'image/jpg';
          break;
      case '.wav':
          contentType = 'audio/wav';
        break;
      case '.mp3':
          contentType = 'audio/mpeg';
        break;
  }

  fs.readFile(filePath, function(error, content) {
      if (error) {
          if(error.code == 'ENOENT'){
                  response.writeHead(404);
                  response.end();
          }
          else {
              response.writeHead(500);
              response.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
              response.end(); 
          }
      }
      else {
          response.writeHead(200, { 'Content-Type': contentType });
          response.end(content, 'utf-8');
      }
  });
});

const wss = new WebSocketServer({ noServer: true });

let users = {};
let games = [];
const findPairing = (client) => {
    const pairing = Object.keys(users).filter(key => parseInt(key, 10) !== parseInt(client, 10)).find(key => !users[key].opponent);
    return pairing && users[pairing];
};

wss.on('connection', function connection(ws, request, client) {
  ws.on('error', console.error);

  ws.on('message', function message(rawdata) {
    const data = JSON.parse(rawdata);
    if (!users[client] && data?.pseudo && modes[chessLANMode] == modes[0]) { // store user info + find pairing IF REGULAR GAMEMODE
        users[client] = {pseudo: data.pseudo, ws, opponent: null};
        ws.send(JSON.stringify({ gameMode: modes[chessLANMode] }));
        const pairing = findPairing(client);
        if (pairing) {
          users[client].opponent = pairing;
          pairing.opponent = users[client];
          pairing.ws.send(JSON.stringify({ foundGame: true, opponent: users[client].pseudo, color: 'white' }));
          ws.send(JSON.stringify({ foundGame: true, opponent: pairing.pseudo, color: 'black' }));
        } else {
          ws.send(JSON.stringify({ foundGame: false }));
        }
        console.log("users", Object.keys(users).map(key => users[key].pseudo), Object.keys(users).length);
    } else if (!users[client]) {
        return;
    }
    if (data?.move) {
      console.log(`${users[client].pseudo}: (${data?.move?.piece}) ${data?.move?.from} -> ${data?.move?.to}`);
      users[client].opponent.ws.send(JSON.stringify(data));
    }
  });

  ws.on('close', function close() {
    if (users[client]?.opponent) {
      users[client].opponent.ws.send(JSON.stringify({opponent: "disconnected"}));
      users[client].opponent = null;
    }
    delete users[client];
  })
});

server.on('upgrade', function upgrade(request, socket, head) {
  socket.on('error', onSocketError);

  socket.removeListener('error', onSocketError);
  wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit('connection', ws, request, Math.round(Math.random() * 10000000));
    });
});

server.listen(8000);
