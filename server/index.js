const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Health check - RENDER İÇİN ZORUNLU
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "asfat-remote",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    features: ["screen-sharing", "remote-control", "chat", "webrtc-signaling"]
  });
});

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>🚀 ASFAT Remote v2.0</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #1a237e 0%, #311b92 100%);
          color: white;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 20px;
        }
        .container {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 40px;
          max-width: 800px;
          text-align: center;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        h1 {
          font-size: 2.5rem;
          margin-bottom: 20px;
          background: linear-gradient(90deg, #00bcd4, #4caf50);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .features {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 15px;
          margin: 30px 0;
        }
        .feature {
          background: rgba(255, 255, 255, 0.05);
          padding: 15px;
          border-radius: 10px;
        }
        .status {
          background: rgba(76, 175, 80, 0.2);
          border: 1px solid #4caf50;
          padding: 15px;
          border-radius: 10px;
          display: inline-block;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 ASFAT Remote Server v2.0</h1>
        <p>Real-time screen sharing and remote control backend</p>
        
        <div class="status">
          <strong>Status:</strong> 🟢 Running
          <br>
          <strong>Version:</strong> 2.0.0
          <br>
          <strong>Socket.IO:</strong> Active
        </div>
        
        <div class="features">
          <div class="feature">✅ Screen Sharing</div>
          <div class="feature">✅ Remote Control</div>
          <div class="feature">✅ Chat System</div>
          <div class="feature">✅ WebRTC Signaling</div>
        </div>
        
        <p>
          <a href="/health" style="color: #00bcd4; text-decoration: none;">
            📊 Health Check Endpoint
          </a>
        </p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
          <p>Connect your frontend to this WebSocket endpoint:</p>
          <code style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 5px; display: block; margin: 10px 0;">
            wss://${req.headers.host || 'asfat-remote-backend.onrender.com'}
          </code>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Socket.IO Sunucusu
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true
  }
});

// ========== VERİ YAPILARI ==========
const activeRooms = new Map();      // roomId -> room data
const userToRoom = new Map();       // socket.id -> roomId
const userData = new Map();         // socket.id -> user info

// ========== SOCKET.IO EVENT HANDLERS ==========
io.on("connection", (socket) => {
  const clientIp = socket.handshake.address;
  console.log(`🔗 Yeni bağlantı: ${socket.id} (IP: ${clientIp})`);
  
  // Kullanıcı verisini kaydet
  userData.set(socket.id, {
    id: socket.id,
    username: null,
    joinedAt: Date.now(),
    lastActivity: Date.now(),
    isSharingScreen: false
  });

  // ========== 1. ODAYA KATIL ==========
  socket.on("join-room", (roomId, username) => {
    try {
      if (!roomId || roomId.trim().length < 3) {
        socket.emit("error", { message: "Oda ID en az 3 karakter olmalı" });
        return;
      }

      roomId = roomId.trim();
      const safeUsername = (username || `Kullanıcı_${socket.id.substring(0, 6)}`).substring(0, 50);

      // Eski odadan çık
      const oldRoomId = userToRoom.get(socket.id);
      if (oldRoomId && oldRoomId !== roomId) {
        leaveRoom(socket.id, oldRoomId);
        socket.leave(oldRoomId);
      }

      // Yeni odaya katıl
      socket.join(roomId);
      userToRoom.set(socket.id, roomId);
      
      const user = userData.get(socket.id);
      user.username = safeUsername;
      user.lastActivity = Date.now();

      // Odayı oluştur veya al
      let room = activeRooms.get(roomId);
      if (!room) {
        room = {
          id: roomId,
          peers: new Map(),
          created: Date.now(),
          screenSharer: null,
          messages: []
        };
        activeRooms.set(roomId, room);
        console.log(`📁 Yeni oda oluşturuldu: ${roomId}`);
      }

      // Kullanıcıyı odaya ekle
      room.peers.set(socket.id, {
        id: socket.id,
        username: safeUsername,
        joinedAt: Date.now(),
        isSharingScreen: false
      });

      // Yeni kullanıcıya: Oda bilgilerini gönder
      const otherPeers = Array.from(room.peers.values())
        .filter(peer => peer.id !== socket.id)
        .map(peer => ({
          id: peer.id,
          username: peer.username,
          isSharingScreen: peer.isSharingScreen
        }));

      socket.emit("room-joined", {
        roomId: roomId,
        yourId: socket.id,
        yourUsername: safeUsername,
        peers: otherPeers,
        screenSharer: room.screenSharer,
        roomSize: room.peers.size,
        previousMessages: room.messages.slice(-20) // Son 20 mesaj
      });

      // Diğer kullanıcılara: Yeni kullanıcıyı bildir
      socket.to(roomId).emit("peer-joined", {
        peerId: socket.id,
        username: safeUsername,
        timestamp: Date.now(),
        roomSize: room.peers.size
      });

      console.log(`📦 ${safeUsername} (${socket.id}) "${roomId}" odasına katıldı`);

    } catch (error) {
      console.error("Odaya katılma hatası:", error);
      socket.emit("error", { message: "Sunucu hatası oluştu" });
    }
  });

  // ========== 2. EKRAN PAYLAŞIMI BAŞLAT/DURDUR ==========
  socket.on("start-screen-share", (roomId) => {
    const room = activeRooms.get(roomId);
    if (!room || !room.peers.has(socket.id)) return;

    room.screenSharer = socket.id;
    const peer = room.peers.get(socket.id);
    peer.isSharingScreen = true;
    
    // Tüm odadakilere bildir
    io.to(roomId).emit("screen-sharing-started", {
      peerId: socket.id,
      username: peer.username,
      timestamp: Date.now()
    });

    console.log(`📺 ${peer.username} ekran paylaşımı başlattı (${roomId})`);
  });

  socket.on("stop-screen-share", (roomId) => {
    const room = activeRooms.get(roomId);
    if (!room) return;

    if (room.screenSharer === socket.id) {
      room.screenSharer = null;
    }

    if (room.peers.has(socket.id)) {
      room.peers.get(socket.id).isSharingScreen = false;
    }

    io.to(roomId).emit("screen-sharing-stopped", {
      peerId: socket.id,
      timestamp: Date.now()
    });

    console.log(`⏹️ ${socket.id} ekran paylaşımı durdurdu (${roomId})`);
  });

  // ========== 3. EKRAN VERİSİ GÖNDERME ==========
  socket.on("send-screen-data", ({ roomId, imageData, timestamp }) => {
    const room = activeRooms.get(roomId);
    
    // Sadece ekran paylaşan kişi gönderebilir
    if (room && room.screenSharer === socket.id) {
      // Gönderen hariç odadaki herkese gönder
      socket.to(roomId).emit("receive-screen-data", {
        from: socket.id,
        imageData: imageData,
        timestamp: timestamp || Date.now(),
        size: imageData ? imageData.length : 0
      });
    }
  });

  // ========== 4. KONTROL OLAYLARI (fare/klavye) ==========
  socket.on("send-control-event", ({ roomId, eventType, data }) => {
    const room = activeRooms.get(roomId);
    
    // Kontrol olayını ekran paylaşana gönder
    if (room && room.screenSharer && room.screenSharer !== socket.id) {
      io.to(room.screenSharer).emit("receive-control-event", {
        from: socket.id,
        eventType: eventType,
        data: data,
        timestamp: Date.now()
      });
    }
  });

  // ========== 5. MESAJLAŞMA ==========
  socket.on("send-message", ({ roomId, message }) => {
    if (!message || !roomId || message.trim().length === 0) return;

    const room = activeRooms.get(roomId);
    if (!room || !room.peers.has(socket.id)) return;

    const user = room.peers.get(socket.id);
    const messageText = message.trim().substring(0, 500);
    const messageData = {
      id: Date.now().toString() + "_" + Math.random().toString(36).substr(2, 9),
      from: socket.id,
      username: user.username,
      message: messageText,
      timestamp: Date.now()
    };

    // Mesajı oda geçmişine kaydet (max 100 mesaj)
    room.messages.push(messageData);
    if (room.messages.length > 100) {
      room.messages.shift();
    }

    // Odadaki herkese gönder
    io.to(roomId).emit("new-message", messageData);
  });

  // ========== 6. WEBRTC SİNYALLEME ==========
  socket.on("webrtc-signal", ({ to, signal, type }) => {
    // WebRTC sinyalini hedef kullanıcıya ilet
    io.to(to).emit("webrtc-signal", {
      from: socket.id,
      signal: signal,
      type: type || "signal"
    });
  });

  // ========== 7. PING/PONG (bağlantı kontrolü) ==========
  socket.on("ping", () => {
    socket.emit("pong", { 
      timestamp: Date.now(),
      serverTime: new Date().toISOString()
    });
  });

  // ========== 8. BAĞLANTI KESİLİNCE ==========
  socket.on("disconnect", () => {
    console.log(`❌ Bağlantı kesildi: ${socket.id}`);
    
    const roomId = userToRoom.get(socket.id);
    if (roomId) {
      leaveRoom(socket.id, roomId);
    }
    
    userToRoom.delete(socket.id);
    userData.delete(socket.id);
  });

  // ========== 9. HATA YAKALAMA ==========
  socket.on("error", (error) => {
    console.error(`Socket error from ${socket.id}:`, error);
  });
});

// ========== YARDIMCI FONKSİYONLAR ==========
function leaveRoom(socketId, roomId) {
  const room = activeRooms.get(roomId);
  if (!room) return;

  const peer = room.peers.get(socketId);
  room.peers.delete(socketId);

  // Eğer ekran paylaşıyorsa durdur
  if (room.screenSharer === socketId) {
    room.screenSharer = null;
    io.to(roomId).emit("screen-sharing-stopped", {
      peerId: socketId,
      timestamp: Date.now(),
      reason: "user-left"
    });
  }

  // Odadaki diğerlerine bildir
  if (peer) {
    io.to(roomId).emit("peer-left", {
      peerId: socketId,
      username: peer.username,
      timestamp: Date.now(),
      roomSize: room.peers.size
    });
  }

  // Oda boşsa temizle
  if (room.peers.size === 0) {
    activeRooms.delete(roomId);
    console.log(`🗑️ Oda silindi: ${roomId} (boş)`);
  } else {
    console.log(`👋 ${socketId} odadan ayrıldı: ${roomId} (kalan: ${room.peers.size})`);
  }
}

// ========== PERİYODİK TEMİZLİK ==========
setInterval(() => {
  const now = Date.now();
  const TIMEOUT = 5 * 60 * 1000; // 5 dakika
  
  for (const [roomId, room] of activeRooms.entries()) {
    if (now - room.created > 24 * 60 * 60 * 1000) {
      // 24 saatten eski odaları temizle
      activeRooms.delete(roomId);
      console.log(`🧹 Eski oda temizlendi: ${roomId}`);
    }
  }
}, 60 * 60 * 1000); // Her saat

// ========== SUNUCUYU BAŞLAT ==========
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 ASFAT Remote Server v2.0`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`📡 Socket.IO aktif`);
  console.log(`🖥️  Ekran paylaşımı hazır`);
  console.log(`🛡️  Health: http://localhost:${PORT}/health`);
  console.log(`=========================================`);
});
