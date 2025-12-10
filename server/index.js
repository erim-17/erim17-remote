const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ASFAT Remote ana sayfa
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>🚀 ASFAT Remote</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #1a237e 0%, #311b92 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          color: white;
        }
        .container {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 40px;
          max-width: 800px;
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.2);
          text-align: center;
        }
        .logo {
          font-size: 3rem;
          margin-bottom: 20px;
        }
        h1 {
          font-size: 2.5rem;
          margin-bottom: 10px;
          background: linear-gradient(90deg, #00bcd4, #4caf50);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .tagline {
          font-size: 1.2rem;
          opacity: 0.8;
          margin-bottom: 30px;
        }
        .status {
          background: rgba(76, 175, 80, 0.2);
          border: 1px solid #4caf50;
          padding: 15px;
          border-radius: 10px;
          margin: 20px 0;
          display: inline-block;
        }
        .endpoints {
          display: grid;
          gap: 10px;
          margin-top: 30px;
          text-align: left;
        }
        .endpoint {
          background: rgba(0, 0, 0, 0.3);
          padding: 15px;
          border-radius: 10px;
        }
        code {
          background: rgba(0, 0, 0, 0.5);
          padding: 5px 10px;
          border-radius: 5px;
          font-family: 'Courier New', monospace;
          display: block;
          margin-top: 5px;
        }
        .features {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-top: 30px;
        }
        .feature {
          background: rgba(255, 255, 255, 0.05);
          padding: 15px;
          border-radius: 10px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">🚀</div>
        <h1>ASFAT Remote</h1>
        <div class="tagline">Açık Kaynak Uzaktan Erişim Çözümü</div>
        
        <div class="status">
          <strong>Durum:</strong> 🟢 Çalışıyor
          <br>
          <strong>Versiyon:</strong> 1.0.0
          <br>
          <strong>Port:</strong> ${process.env.PORT || 3000}
        </div>
        
        <div class="endpoints">
          <div class="endpoint">
            <strong>Health Check:</strong>
            <code>GET /health</code>
          </div>
          <div class="endpoint">
            <strong>WebSocket Endpoint:</strong>
            <code>wss://${req.headers.host || 'your-app.onrender.com'}</code>
          </div>
          <div class="endpoint">
            <strong>GitHub:</strong>
            <code>https://github.com/your-username/asfat-remote</code>
          </div>
        </div>
        
        <div class="features">
          <div class="feature">✅ Ekran Paylaşımı</div>
          <div class="feature">✅ Gerçek Zamanlı Kontrol</div>
          <div class="feature">✅ Güvenli Bağlantı</div>
          <div class="feature">✅ Açık Kaynak</div>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
          <p>ASFAT Remote - Türk yapımı uzaktan erişim uygulaması</p>
          <p style="font-size: 0.9rem; opacity: 0.7;">© 2025 ASFAT Remote Team</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "asfat-remote",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Socket.IO Server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Oda yönetimi
const rooms = new Map();

io.on("connection", (socket) => {
  console.log(`🔗 ASFAT Remote: Yeni bağlantı - ${socket.id}`);
  
  socket.on("join-room", (roomId, username) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add({
      id: socket.id,
      username: username || `Kullanıcı_${socket.id.substring(0, 6)}`,
      joined: Date.now()
    });
    
    socket.to(roomId).emit("user-connected", {
      userId: socket.id,
      username: username,
      timestamp: Date.now()
    });
    
    console.log(`📦 ${username || socket.id} ${roomId} odasına katıldı`);
  });
  
  socket.on("disconnect", () => {
    console.log(`❌ Bağlantı kesildi: ${socket.id}`);
  });
});

// Server'ı başlat
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 ASFAT Remote Server ${PORT} portunda çalışıyor!`);
  console.log(`🌍 Ana sayfa: http://localhost:${PORT}`);
  console.log(`🩺 Health check: http://localhost:${PORT}/health`);
});
