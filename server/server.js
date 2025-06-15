const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// تخزين المستخدمين المنتظرين
let waitingUsers = [];

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Socket.io logic
io.on('connection', (socket) => {
    console.log('مستخدم جديد متصل:', socket.id);

    // البحث عن شريك
    socket.on('find-partner', () => {
        if (waitingUsers.length > 0) {
            const partner = waitingUsers.pop();
            socket.emit('partner-found', partner.id);
            partner.emit('partner-found', socket.id);
        } else {
            waitingUsers.push(socket);
        }
    });

    // إرسال إشارة WebRTC
    socket.on('signal', (data) => {
        io.to(data.target).emit('signal', data);
    });

    // عند الانفصال
    socket.on('disconnect', () => {
        waitingUsers = waitingUsers.filter(user => user.id !== socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`الخادم يعمل على http://localhost:${PORT}`);
});
