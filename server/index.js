// 🚀 ASFAT Remote v2.0 - Screen Sharing Backend
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ RENDER HEALTH CHECK (ZORUNLU)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "asfat-remote",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ✅ ANA SAYFA
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>🚀 ASFAT Remote v2.0</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          text-align: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
        }
        .container {
          background: rgba(255,255,255,0.1);
          padding: 40px;
          border-radius: 20px;
          backdrop-filter: blur(10px);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 ASFAT Remote v2.0</h1>
        <p>Real-time screen sharing backend</p>
        <p>✅ Socket.IO events active</p>
        <p>📡 WebSocket: wss://${req.headers.host}</p>
        <p><a href="/health" style="color: yellow;">Health Check</a></p>
      </div>
    </body>
    </html>
  `);
});

// ✅ SOCKET.IO SUNUCUSU
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ✅ SOCKET.IO EVENT HANDLERS
io.on("connection", (socket) => {
  console.log("🔗 Yeni bağlantı:", socket.id);

  // 1️⃣ ODAYA KATIL
  socket.on("join-room", (roomId, username) => {
    socket.join(roomId);
    const user = username || "User_" + socket.id.substring(0, 5);
    
    // Odadaki diğerlerine haber ver
    socket.to(roomId).emit("user-connected", {
      id: socket.id,
      username: user,
      timestamp: Date.now()
    });
    
    console.log(`📦 ${user} (${socket.id}) "${roomId}" odasına katıldı`);
  });

  // 2️⃣ EKRAN PAYLAŞIMI BAŞLAT
  socket.on("start-screen-share", (roomId) => {
    socket.to(roomId).emit("screen-sharing-started", {
      peerId: socket.id,
      timestamp: Date.now()
    });
    console.log(`📺 ${socket.id} ekran paylaşımı başlattı (${roomId})`);
  });

  // 3️⃣ EKRAN VERİSİ GÖNDER
  socket.on("send-screen-data", ({ roomId, imageData }) => {
    // Odadaki herkese gönder (gönderen hariç)
    socket.to(roomId).emit("receive-screen-data", {
      from: socket.id,
      imageData: imageData,
      timestamp: Date.now()
    });
  });

  // 4️⃣ KONTROL OLAYLARI
  socket.on("send-control-event", ({ roomId, eventType, data }) => {
    socket.to(roomId).emit("receive-control-event", {
      from: socket.id,
      eventType: eventType,
      data: data,
      timestamp: Date.now()
    });
  });
  
  // Kontrol komutlarını işle
socket.on('send-control-command', (data) => {
    console.log(`Kontrol komutu: ${data.command}`, data.data);
    
    // Komutu odadaki ekran paylaşana gönder
    socket.to(data.roomId).emit('execute-control', {
        command: data.command,
        data: data.data,
        from: socket.id
    });
});

// Kontrol komutunu çalıştır (ekran paylaşan taraf)
socket.on('execute-control', async (data) => {
    console.log('Kontrol çalıştırılıyor:', data.command);
    
    try {
        let result = { success: false, message: '' };
        
        switch(data.command) {
            case 'click':
                // Fare tıklaması simüle et (basit versiyon)
                result.success = true;
                result.message = `Tıklandı: ${data.data.x}, ${data.data.y}`;
                break;
                
            case 'key_press':
                // Tuş basımı simüle et
                result.success = true;
                result.message = `Tuş: ${data.data.key}`;
                break;
                
            case 'ctrl_alt_del':
                // Ctrl+Alt+Delete (Windows için)
                result.success = true;
                result.message = 'Ctrl+Alt+Delete gönderildi';
                break;
        }
        
        // Sonucu gönderene bildir
        socket.to(data.from).emit('control-result', result);
        
    } catch (error) {
        console.error('Kontrol hatası:', error);
        socket.to(data.from).emit('control-result', {
            success: false,
            message: `Hata: ${error.message}`
        });
    }
});

// Dosya transferi
const receivedFiles = new Map();

socket.on('send-file-start', (data) => {
    // Yeni dosya başlangıcı
    receivedFiles.set(socket.id, {
        filename: data.filename,
        chunks: [],
        totalChunks: data.totalChunks,
        size: data.size,
        type: data.type
    });
});

socket.on('send-file-chunk', (data) => {
    // Dosya parçasını al
    const fileInfo = receivedFiles.get(socket.id);
    if (fileInfo) {
        fileInfo.chunks[data.chunkIndex] = data.chunkData;
        
        // Tüm parçalar geldi mi?
        if (data.isLast && fileInfo.chunks.length === fileInfo.totalChunks) {
            // Parçaları birleştir
            const fullData = fileInfo.chunks.join('');
            
            // Alıcıya gönder
            socket.to(data.roomId).emit('file-received', {
                filename: fileInfo.filename,
                data: fullData,
                size: fileInfo.size,
                type: fileInfo.type
            });
            
            // Temizle
            receivedFiles.delete(socket.id);
        }
    }
});

  // 5️⃣ MESAJ GÖNDER
  socket.on("send-message", ({ roomId, message }) => {
    socket.to(roomId).emit("new-message", {
      from: socket.id,
      message: message.substring(0, 500),
      timestamp: Date.now()
    });
  });

  // 🔌 BAĞLANTI KESİLİNCE
  socket.on("disconnect", () => {
    console.log("❌ Bağlantı kesildi:", socket.id);
  });
});

// ✅ SUNUCUYU BAŞLAT
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log("=======================================");
  console.log("🚀 ASFAT REMOTE v2.0 BACKEND");
  console.log(`📍 Port: ${PORT}`);
  console.log("📡 Socket.IO events:");
  console.log("   1. join-room");
  console.log("   2. start-screen-share");
  console.log("   3. send-screen-data");
  console.log("   4. send-control-event");
  console.log("   5. send-message");
  console.log("=======================================");
});
@'
// 🚀 ASFAT Remote v2.0 - Screen Sharing Backend
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ RENDER HEALTH CHECK (ZORUNLU)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "asfat-remote",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ✅ ANA SAYFA
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>🚀 ASFAT Remote v2.0</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          text-align: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
        }
        .container {
          background: rgba(255,255,255,0.1);
          padding: 40px;
          border-radius: 20px;
          backdrop-filter: blur(10px);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 ASFAT Remote v2.0</h1>
        <p>Real-time screen sharing backend</p>
        <p>✅ Socket.IO events active</p>
        <p>📡 WebSocket: wss://${req.headers.host}</p>
        <p><a href="/health" style="color: yellow;">Health Check</a></p>
      </div>
    </body>
    </html>
  `);
});

// ✅ SOCKET.IO SUNUCUSU
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ✅ SOCKET.IO EVENT HANDLERS
io.on("connection", (socket) => {
  console.log("🔗 Yeni bağlantı:", socket.id);

  // 1️⃣ ODAYA KATIL
  socket.on("join-room", (roomId, username) => {
    socket.join(roomId);
    const user = username || "User_" + socket.id.substring(0, 5);
    
    // Odadaki diğerlerine haber ver
    socket.to(roomId).emit("user-connected", {
      id: socket.id,
      username: user,
      timestamp: Date.now()
    });
    
    console.log(`📦 ${user} (${socket.id}) "${roomId}" odasına katıldı`);
  });

  // 2️⃣ EKRAN PAYLAŞIMI BAŞLAT
  socket.on("start-screen-share", (roomId) => {
    socket.to(roomId).emit("screen-sharing-started", {
      peerId: socket.id,
      timestamp: Date.now()
    });
    console.log(`📺 ${socket.id} ekran paylaşımı başlattı (${roomId})`);
  });

  // 3️⃣ EKRAN VERİSİ GÖNDER
  socket.on("send-screen-data", ({ roomId, imageData }) => {
    // Odadaki herkese gönder (gönderen hariç)
    socket.to(roomId).emit("receive-screen-data", {
      from: socket.id,
      imageData: imageData,
      timestamp: Date.now()
    });
  });

  // 4️⃣ KONTROL OLAYLARI
  socket.on("send-control-event", ({ roomId, eventType, data }) => {
    socket.to(roomId).emit("receive-control-event", {
      from: socket.id,
      eventType: eventType,
      data: data,
      timestamp: Date.now()
    });
  });

  // 5️⃣ MESAJ GÖNDER
  socket.on("send-message", ({ roomId, message }) => {
    socket.to(roomId).emit("new-message", {
      from: socket.id,
      message: message.substring(0, 500),
      timestamp: Date.now()
    });
  });

  // 🔌 BAĞLANTI KESİLİNCE
  socket.on("disconnect", () => {
    console.log("❌ Bağlantı kesildi:", socket.id);
  });
});

// ✅ SUNUCUYU BAŞLAT
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log("=======================================");
  console.log("🚀 ASFAT REMOTE v2.0 BACKEND");
  console.log(`📍 Port: ${PORT}`);
  console.log("📡 Socket.IO events:");
  console.log("   1. join-room");
  console.log("   2. start-screen-share");
  console.log("   3. send-screen-data");
  console.log("   4. send-control-event");
  console.log("   5. send-message");
  console.log("=======================================");
});
'@ | Out-File -FilePath index.js -Encoding UTF8

Write-Host "✅ index.js YENİDEN oluşturuldu!" -ForegroundColor Green
