const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const connectBtn = document.getElementById('connectBtn');

let localStream;
let peerConnection;
const socket = io(); // الاتصال بخادم Socket.io

// 1. الحصول على كاميرا المستخدم
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = stream;
    })
    .catch(err => {
        console.error('خطأ في الوصول إلى الكاميرا:', err);
    });

// 2. إنشاء اتصال WebRTC
function createPeerConnection() {
    peerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' } // STUN مجاني من جوجل
        ]
    });

    // إضافة تيار الفيديو/الصوت
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // استقبال الفيديو من الشريك
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    // تبادل إشارات ICE
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signal', {
                target: partnerId,
                candidate: event.candidate
            });
        }
    };
}

// 3. الضغط على زر الاتصال
connectBtn.addEventListener('click', () => {
    socket.emit('find-partner');
});

// 4. التعامل مع إشارات Socket.io
let partnerId;

socket.on('partner-found', (id) => {
    partnerId = id;
    createPeerConnection();

    // إنشاء عرض (Offer) وإرساله
    peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
            socket.emit('signal', {
                target: partnerId,
                description: peerConnection.localDescription
            });
        });
});

socket.on('signal', (data) => {
    if (data.description) {
        peerConnection.setRemoteDescription(data.description)
            .then(() => {
                if (data.description.type === 'offer') {
                    return peerConnection.createAnswer();
                }
            })
            .then(answer => {
                if (answer) {
                    return peerConnection.setLocalDescription(answer);
                }
            })
            .then(() => {
                socket.emit('signal', {
                    target: partnerId,
                    description: peerConnection.localDescription
                });
            });
    } else if (data.candidate) {
        peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
});
