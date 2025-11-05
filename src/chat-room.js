// Durable Object 类 - 聊天室逻辑
export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // userId -> WebSocket
    this.users = new Map();    // userId -> userInfo
  }

  async fetch(request) {
    // 只处理 WebSocket 升级请求
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    // 创建 WebSocket 对
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // 接受服务器端 WebSocket
    await this.handleSession(server);

    // 返回客户端 WebSocket
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async handleSession(webSocket) {
    webSocket.accept();
    
    let currentUserId = null;
    let currentUsername = null;

    // 消息事件处理
    webSocket.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'auth':
            // 用户认证
            currentUserId = message.userId;
            currentUsername = message.username;
            
            this.sessions.set(currentUserId, webSocket);
            this.users.set(currentUserId, {
              id: currentUserId,
              username: currentUsername,
              connected: true,
              lastSeen: Date.now()
            });
            
            // 广播更新用户列表
            this.broadcastUserList();
            break;
            
          case 'chat':
          case 'file':
          case 'audio':
            // 广播消息
            this.broadcastMessage(message);
            break;
            
          default:
            console.log('未知消息类型:', message.type);
        }
      } catch (error) {
        console.error('消息处理错误:', error);
      }
    });

    // 连接关闭事件
    webSocket.addEventListener('close', () => {
      if (currentUserId) {
        this.sessions.delete(currentUserId);
        const user = this.users.get(currentUserId);
        if (user) {
          user.connected = false;
          user.lastSeen = Date.now();
        }
        
        // 广播更新用户列表
        this.broadcastUserList();
      }
    });
  }

  // 广播用户列表给所有连接的用户
  broadcastUserList() {
    const userList = Array.from(this.users.values())
      .filter(user => user.connected)
      .map(user => ({
        id: user.id,
        username: user.username
      }));
    
    const message = {
      type: 'userlist',
      users: userList,
      timestamp: Date.now()
    };
    
    this.broadcast(message);
  }

  // 广播消息给所有用户
  broadcastMessage(message) {
    const serialized = JSON.stringify(message);
    this.sessions.forEach((webSocket, userId) => {
      if (webSocket.readyState === 1) { // WebSocket.OPEN
        try {
          webSocket.send(serialized);
        } catch (error) {
          console.error('发送消息错误:', error);
        }
      }
    });
  }
}