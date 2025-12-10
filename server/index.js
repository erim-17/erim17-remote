// ... mevcut kodun üst kısmı aynı ...

io.on('connection', (socket) => {
  console.log(`🔗 Yeni bağlantı: ${socket.id}`);
  
  socket.on('join-room', (roomId, username) => {
    socket.join(roomId);
    userConnections.set(socket.id, roomId);
    
    const room = activeRooms.get(roomId) || {
      id: roomId,
      peers: new Map(),
      created: Date.now()
    };
    
    room.peers.set(socket.id, {
      id: socket.id,
      username: username || `User_${socket.id.substring(0, 6)}`,
      joined: Date.now()
    });
    
    activeRooms.set(roomId, room);
    
    // Yeni kullanıcıya odadaki diğerlerini gönder
    const otherPeers = Array.from(room.peers.values())
      .filter(p => p.id !== socket.id);
    
    socket.emit('room-info', {
      roomId,
      peers: otherPeers,
      roomSize: room.peers.size
    });
    
    // Diğerlerine yeni kullanıcıyı bildir
    socket.to(roomId).emit('peer-joined', {
      peerId: socket.id,
      username: room.peers.get(socket.id).username,
      timestamp: Date.now()
    });
    
    console.log(`📦 ${socket.id} ${roomId} odasına katıldı`);
  });
  
  // ========== YENİ: EKRAN VERİSİ GÖNDERME ==========
  socket.on('send-screen-data', ({ roomId, imageData, timestamp }) => {
    // Aynı odadaki diğer kullanıcılara gönder
    socket.to(roomId).emit('receive-screen-data', {
      from: socket.id,
      imageData,
      timestamp
    });
  });
  
  // ========== YENİ: KONTROL OLAYLARI ==========
  socket.on('send-control-event', ({ roomId, eventType, data }) => {
    socket.to(roomId).emit('receive-control-event', {
      from: socket.id,
      eventType,
      data,
      timestamp: Date.now()
    });
  });
  
  socket.on('disconnect', () => {
    console.log(`❌ Bağlantı kesildi: ${socket.id}`);
    
    const roomId = userConnections.get(socket.id);
    if (roomId) {
      const room = activeRooms.get(roomId);
      if (room) {
        room.peers.delete(socket.id);
        
        if (room.peers.size === 0) {
          activeRooms.delete(roomId);
        }
        
        socket.to(roomId).emit('peer-left', socket.id);
      }
      userConnections.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 ASFAT Remote Server ${PORT} portunda çalışıyor!`);
  console.log(`📡 Socket.IO aktif`);
  console.log(`🖥️  Ekran paylaşımı hazır`);
});
