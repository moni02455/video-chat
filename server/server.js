const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// إعدادات CORS آمنة
const io = socketIo(server, {
  cors: {
    origin: "https://video-chat-gprc.onrender.com", // استبدل هذا برابط موقعك
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'], // تفعيل كلا النوعين
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware
app.use(cors({
  origin: "https://video-chat-gprc.onrender.com",
  credentials: true
}));
app.use(express.static(path.join(__dirname, '../public')));

// تحسين إدارة الجلسات
const waitingUsers = [];
const activePairs = new Map();

io.on('connection', (socket) => {
  console.log('مستخدم متصل:', socket.id);

  socket.on('find-partner', () => {
    if (waitingUsers.length > 0) {
      const partner = waitingUsers.pop();
      const roomId = `${socket.id}-${partner.id}`;
      
      socket.join(roomId);
      partner.join(roomId);
      
      activePairs.set(socket.id, partner.id);
      activePairs.set(partner.id, socket.id);
      
      io.to(roomId).emit('partner-found', { roomId });
    } else {
      waitingUsers.push(socket);
    }
  });

  socket.on('signal', (data) => {
    const partnerId = activePairs.get(socket.id);
    if (partnerId) {
      socket.to(partnerId).emit('signal', data);
    }
  });

  socket.on('disconnect', () => {
    const partnerId = activePairs.get(socket.id);
    if (partnerId) {
      socket.to(partnerId).emit('partner-disconnected');
      activePairs.delete(partnerId);
    }
    activePairs.delete(socket.id);
    
    waitingUsers = waitingUsers.filter(user => user.id !== socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`الخادم يعمل على البورت ${PORT}`);
});
