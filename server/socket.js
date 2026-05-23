/**
 * Socket.io for real-time match scoring. Clients join room `match:<matchId>` to receive
 * score updates and match status. Optional: if server is not started with attachSocket(),
 * getIO() returns null and scoring still works via REST.
 */
let io = null;

function setIO(socketIO) {
  io = socketIO;

  io.on('connection', (socket) => {
    socket.on('match:subscribe', (matchId) => {
      if (matchId) socket.join(`match:${matchId}`);
    });
    socket.on('match:unsubscribe', (matchId) => {
      if (matchId) socket.leave(`match:${matchId}`);
    });
  });
}

function getIO() {
  return io;
}

module.exports = { setIO, getIO };
