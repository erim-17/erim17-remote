const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "asfat-remote",
    version: "2.0.0",
    timestamp: new Date().toISOString()
  });
});

app.get("/", (req, res) => {
  res.send("<h1>🚀 ASFAT Remote v2.0</h1><p>Screen sharing ready</p>");
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Socket.IO Events
io.on("connection", (socket) => {
  console.log("🔗 New connection:", socket.id);

  // 1. JOIN ROOM
  socket.on("join-room", (roomId, username) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-connected", {
      id: socket.id,
      username: username || "Anonymous"
    });
    console.log(socket.id, "joined room:", roomId);
  });

  // 2. START SCREEN SHARE
  socket.on("start-screen-share", (roomId) => {
    socket.to(roomId).emit("screen-sharing-started", {
      peerId: socket.id,
      timestamp: Date.now()
    });
  });

  // 3. SEND SCREEN DATA
  socket.on("send-screen-data", ({ roomId, imageData }) => {
    socket.to(roomId).emit("receive-screen-data", {
      from: socket.id,
      imageData: imageData,
      timestamp: Date.now()
    });
  });

  // 4. SEND CONTROL EVENT
  socket.on("send-control-event", ({ roomId, eventType, data }) => {
    socket.to(roomId).emit("receive-control-event", {
      from: socket.id,
      eventType: eventType,
      data: data
    });
  });

  // 5. SEND MESSAGE
  socket.on("send-message", ({ roomId, message }) => {
    socket.to(roomId).emit("new-message", {
      from: socket.id,
      message: message,
      timestamp: Date.now()
    });
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
