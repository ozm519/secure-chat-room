// Worker 主入口文件
import { ChatRoom } from './chat-room.js';

// HTML 页面内容
const HTML_PAGE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>安全聊天室</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: #2c3e50; color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center; }
        .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s; }
        .btn-primary { background: #3498db; color: white; }
        .btn-success { background: #27ae60; color: white; }
        .main-content { display: flex; min-height: 600px; }
        .sidebar { width: 300px; background: #34495e; color: white; padding: 20px; }
        .chat-area { flex: 1; display: flex; flex-direction: column; }
        .init-screen, .chat-screen { padding: 40px; text-align: center; }
        .chat-screen { display: none; flex-direction: column; height: 100%; }
        .messages { flex: 1; border: 1px solid #ecf0f1; border-radius: 8px; padding: 15px; margin: 10px 0; overflow-y: auto; max-height: 400px; background: #fafafa; }
        .message { margin-bottom: 15px; padding: 10px; border-radius: 8px; max-width: 70%; }
        .message.own { background: #3498db; color: white; margin-left: auto; text-align: right; }
        .input-area { display: flex; gap: 10px; padding: 10px; background: #ecf0f1; border-top: 1px solid #bdc3c7; }
        .hidden { display: none !important; }
        .contact { display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #2c3e50; margin: 5px 0; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 安全聊天室</h1>
            <div>
                <button class="btn btn-primary" onclick="exportIdentity()">导出身份</button>
            </div>
        </div>

        <div class="main-content">
            <div class="init-screen" id="init-screen">
                <div style="max-width: 400px; margin: 0 auto;">
                    <h2 style="margin-bottom: 30px; color: #2c3e50;">欢迎使用安全聊天室</h2>
                    <div style="margin-bottom: 30px;">
                        <label style="display: block; text-align: left; margin-bottom: 8px; color: #34495e; font-weight: 500;">你的昵称</label>
                        <input type="text" id="username-input" placeholder="输入昵称" style="width: 100%; padding: 12px; border: 2px solid #bdc3c7; border-radius: 8px; font-size: 16px;">
                    </div>
                    <button class="btn btn-success" onclick="initializeUser()" style="width: 100%; padding: 12px; font-size: 16px;">开始聊天</button>
                    <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                        <p style="color: #7f8c8d; margin-bottom: 10px;">导入已有身份文件</p>
                        <input type="file" id="import-file" accept=".chatid" style="display: none;">
                        <button class="btn btn-primary" onclick="document.getElementById('import-file').click()" style="width: 100%; padding: 10px;">选择身份文件</button>
                    </div>
                </div>
            </div>

            <div class="chat-screen" id="chat-screen">
                <div class="sidebar">
                    <div style="margin-bottom: 30px;">
                        <button class="btn btn-primary" onclick="showUserInfo()" style="width: 100%; margin-bottom: 10px;">我的ID信息</button>
                    </div>
                    <div class="contacts-section">
                        <h3 style="margin-bottom: 15px;">👥 联系人</h3>
                        <div class="contact-input">
                            <input type="text" id="contact-id-input" placeholder="输入对方用户ID">
                            <button class="btn btn-success" onclick="addContact()">添加</button>
                        </div>
                        <div class="contacts-list" id="contacts-list"></div>
                    </div>
                    <div style="margin-top: 20px;">
                        <h3 style="margin-bottom: 10px;">💬 在线用户</h3>
                        <div id="online-users"></div>
                    </div>
                </div>

                <div class="chat-area">
                    <div class="messages" id="messages"></div>
                    <div class="input-area">
                        <input type="text" id="message-input" placeholder="输入消息..." onkeypress="handleKeyPress(event)">
                        <button class="btn btn-primary" onclick="sendMessage()">发送</button>
                    </div>
                    <div style="display: flex; gap: 10px; padding: 10px; background: #f8f9fa; border-top: 1px solid #e9ecef;">
                        <input type="file" id="file-input">
                        <button class="btn btn-primary" onclick="sendFile()">发送文件</button>
                        <button class="btn btn-danger" id="record-btn" onclick="toggleRecording()">🎤 开始录音</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let currentUser = { id: null, username: null, privateKey: null, contacts: new Set(), onlineUsers: new Map() };
        let websocket = null;
        let mediaRecorder = null;
        let audioChunks = [];
        let isRecording = false;

        function initializeUser() {
            const username = document.getElementById('username-input').value.trim();
            if (!username) { alert('请输入昵称'); return; }
            loadOrCreateUser(username);
            document.getElementById('init-screen').style.display = 'none';
            document.getElementById('chat-screen').style.display = 'flex';
            connectWebSocket();
        }

        function loadOrCreateUser(username) {
            const stored = localStorage.getItem('chatUser');
            if (stored) {
                try {
                    const userData = JSON.parse(stored);
                    currentUser = { ...currentUser, ...userData };
                    if (userData.contacts) currentUser.contacts = new Set(userData.contacts);
                    if (userData.onlineUsers) currentUser.onlineUsers = new Map(Object.entries(userData.onlineUsers));
                } catch (e) { createNewUser(username); }
            } else { createNewUser(username); }
            updateUserDisplay(); renderContacts(); renderOnlineUsers();
        }

        function createNewUser(username) {
            currentUser.id = 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
            currentUser.username = username;
            currentUser.privateKey = CryptoJS.lib.WordArray.random(32).toString();
            saveUserToStorage();
        }

        function saveUserToStorage() {
            const storageData = { ...currentUser, contacts: Array.from(currentUser.contacts), onlineUsers: Object.fromEntries(currentUser.onlineUsers) };
            localStorage.setItem('chatUser', JSON.stringify(storageData));
        }

        function showUserInfo() {
            alert('你的用户ID: ' + currentUser.id + '\n昵称: ' + currentUser.username);
        }

        function exportIdentity() {
            const password = prompt('请设置导出密码:');
            if (!password) return;
            const exportData = { id: currentUser.id, username: currentUser.username, privateKey: currentUser.privateKey, contacts: Array.from(currentUser.contacts), timestamp: Date.now() };
            try {
                const encrypted = CryptoJS.AES.encrypt(JSON.stringify(exportData), password).toString();
                const blob = new Blob([encrypted], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'chat_identity.chatid';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                alert('身份文件已导出！');
            } catch (error) { alert('导出失败: ' + error.message); }
        }

        document.getElementById('import-file').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                const encryptedData = e.target.result;
                const password = prompt('请输入密码:');
                if (!password) return;
                try {
                    const bytes = CryptoJS.AES.decrypt(encryptedData, password);
                    const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
                    if (!decryptedText) throw new Error('解密失败');
                    const decryptedData = JSON.parse(decryptedText);
                    if (!decryptedData.id || !decryptedData.privateKey) throw new Error('无效文件');
                    currentUser = { id: decryptedData.id, username: decryptedData.username, privateKey: decryptedData.privateKey, contacts: new Set(decryptedData.contacts || []), onlineUsers: new Map() };
                    saveUserToStorage();
                    alert('导入成功！');
                    location.reload();
                } catch (error) { alert('导入失败: ' + error.message); }
            };
            reader.readAsText(file);
        });

        function addContact() {
            const contactId = document.getElementById('contact-id-input').value.trim();
            if (!contactId) { alert('请输入用户ID'); return; }
            if (currentUser.contacts.has(contactId)) { alert('已存在'); return; }
            currentUser.contacts.add(contactId);
            saveUserToStorage();
            renderContacts();
            document.getElementById('contact-id-input').value = '';
        }

        function renderContacts() {
            const contactsList = document.getElementById('contacts-list');
            contactsList.innerHTML = '';
            currentUser.contacts.forEach(contactId => {
                const contactDiv = document.createElement('div');
                contactDiv.className = 'contact';
                contactDiv.innerHTML = '<span>' + contactId + '</span><button class="btn btn-danger" onclick="removeContact(\'' + contactId + '\')">删除</button>';
                contactsList.appendChild(contactDiv);
            });
        }

        function removeContact(contactId) {
            if (confirm('确定删除?')) {
                currentUser.contacts.delete(contactId);
                saveUserToStorage();
                renderContacts();
            }
        }

        function renderOnlineUsers() {
            const onlineUsersDiv = document.getElementById('online-users');
            onlineUsersDiv.innerHTML = '';
            currentUser.onlineUsers.forEach((username, userId) => {
                if (userId !== currentUser.id) {
                    const userDiv = document.createElement('div');
                    userDiv.className = 'contact';
                    userDiv.innerHTML = '<span>' + username + '</span>';
                    onlineUsersDiv.appendChild(userDiv);
                }
            });
        }

        function updateUserDisplay() {
            // 更新显示逻辑
        }

        function connectWebSocket() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = protocol + '//' + window.location.host + '/chat';
            websocket = new WebSocket(wsUrl);
            websocket.onopen = () => {
                websocket.send(JSON.stringify({ type: 'auth', userId: currentUser.id, username: currentUser.username, timestamp: Date.now() }));
            };
            websocket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    handleServerMessage(message);
                } catch (error) { console.error('消息解析错误:', error); }
            };
            websocket.onclose = () => { setTimeout(connectWebSocket, 3000); };
        }

        function handleServerMessage(message) {
            switch (message.type) {
                case 'userlist': updateOnlineUsers(message.users); break;
                case 'chat': case 'file': case 'audio': displayMessage(message); break;
            }
        }

        function updateOnlineUsers(users) {
            currentUser.onlineUsers.clear();
            users.forEach(user => { currentUser.onlineUsers.set(user.id, user.username); });
            saveUserToStorage();
            renderOnlineUsers();
        }

        function sendMessage() {
            const input = document.getElementById('message-input');
            const content = input.value.trim();
            if (!content || !websocket) return;
            const message = { type: 'chat', from: currentUser.id, fromUsername: currentUser.username, content: content, timestamp: Date.now() };
            websocket.send(JSON.stringify(message));
            displayMessage(message);
            input.value = '';
        }

        function handleKeyPress(event) {
            if (event.key === 'Enter') sendMessage();
        }

        function displayMessage(message) {
            const messagesDiv = document.getElementById('messages');
            const messageDiv = document.createElement('div');
            const isOwnMessage = message.from === currentUser.id;
            messageDiv.className = 'message ' + (isOwnMessage ? 'own' : 'other');
            const time = new Date(message.timestamp).toLocaleTimeString();
            messageDiv.innerHTML = '<div style="font-size: 12px; opacity: 0.8; margin-bottom: 5px;">' + (isOwnMessage ? '你' : message.fromUsername) + ' • ' + time + '</div><div>' + message.content + '</div>';
            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        function sendFile() {
            const fileInput = document.getElementById('file-input');
            const file = fileInput.files[0];
            if (!file) { alert('请选择文件'); return; }
            alert('文件功能: ' + file.name);
            fileInput.value = '';
        }

        async function toggleRecording() {
            if (!isRecording) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];
                    mediaRecorder.ondataavailable = (event) => { audioChunks.push(event.data); };
                    mediaRecorder.onstop = () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                        alert('录音完成');
                    };
                    mediaRecorder.start();
                    isRecording = true;
                    document.getElementById('record-btn').textContent = '⏹️ 停止录音';
                } catch (error) { alert('无法访问麦克风'); }
            } else {
                mediaRecorder.stop();
                isRecording = false;
                document.getElementById('record-btn').textContent = '🎤 开始录音';
                mediaRecorder.stream.getTracks().forEach(track => track.stop());
            }
        }

        window.onload = function() {
            const stored = localStorage.getItem('chatUser');
            if (stored) {
                try { document.getElementById('username-input').value = JSON.parse(stored).username || ''; } catch (e) {}
            }
        };
    </script>
</body>
</html>`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 处理根路径请求，返回 HTML 页面
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(HTML_PAGE, {
        headers: { 
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache'
        },
      });
    }
    
    // 处理 WebSocket 升级请求
    if (url.pathname === '/chat') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }
      
      // 获取或创建 Durable Object
      const id = env.CHAT_ROOM.idFromName('main-room');
      const stub = env.CHAT_ROOM.get(id);
      
      return stub.fetch(request);
    }
    
    return new Response('Not found', { status: 404 });
  }
};