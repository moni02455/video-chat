const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const connectBtn = document.getElementById('connectBtn');

let localStream;
let peerConnection;
let currentRoom = null;

// إعداد اتصال Socket.io مع تحسينات
const socket = io("https://video-chat-gprc.onrender.com", {
  transports: ['websocket'],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000
});

// تحسين إدارة الأخطاء
socket.on('connect_error', (err) => {
  console.error('خطأ في الاتصال:', err.message);
  alert('تعذر الاتصال بالخادم. يرجى المحاولة لاحقاً');
});

// الحصول على وسائط المستخدم
async function getMedia() {
  try {
    return await navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: true 
    });
  } catch (err) {
    console.error('خطأ في الوصول إلى الوسائط:', err);
    throw err;
  }
}

// إنشاء اتصال WebRTC
function createPeerConnection() {
  const config = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };
  
  peerConnection = new RTCPeerConnection(config);
  
  // إضافة تيار الوسائط المحلي
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // معالجة المرشحات ICE
  peerConnection.onicecandidate = ({ candidate }) => {
    if (candidate) {
      socket.emit('signal', {
        type: 'candidate',
        candidate,
        roomId: currentRoom
      });
    }
  };

  // استقبال تيار الوسائط البعيد
  peerConnection.ontrack = (event) => {
    if (!remoteVideo.srcObject) {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  // معالجة تغيير حالة الاتصال
  peerConnection.onconnectionstatechange = () => {
    console.log('حالة الاتصال:', peerConnection.connectionState);
  };
}

// تهيئة التطبيق
async function init() {
  try {
    localStream = await getMedia();
    localVideo.srcObject = localStream;
    
    connectBtn.addEventListener('click', startChat);
  } catch (err) {
    console.error('خطأ في التهيئة:', err);
    alert('تعذر الوصول إلى الكاميرا/الميكروفون');
  }
}

// بدء الدردشة
async function startChat() {
  connectBtn.disabled = true;
  createPeerConnection();
  socket.emit('find-partner');
}

// معالجة إشارات Socket.io
socket.on('partner-found', async ({ roomId }) => {
  currentRoom = roomId;
  
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    socket.emit('signal', {
      type: 'offer',
      description: peerConnection.localDescription,
      roomId
    });
  } catch (err) {
    console.error('خطأ في إنشاء العرض:', err);
  }
});

socket.on('signal', async ({ type, description, candidate }) => {
  try {
    if (type === 'offer') {
      await peerConnection.setRemoteDescription(description);
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      socket.emit('signal', {
        type: 'answer',
        description: peerConnection.localDescription,
        roomId: currentRoom
      });
    } else if (type === 'answer') {
      await peerConnection.setRemoteDescription(description);
    } else if (type === 'candidate') {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  } catch (err) {
    console.error('خطأ في معالجة الإشارة:', err);
  }
});

socket.on('partner-disconnected', () => {
  alert('الشريك انقطع عن الاتصال');
  resetConnection();
});

// إعادة تعيين الاتصال
function resetConnection() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  if (remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach(track => track.stop());
    remoteVideo.srcObject = null;
  }
  
  currentRoom = null;
  connectBtn.disabled = false;
}

// بدء التطبيق
init();
