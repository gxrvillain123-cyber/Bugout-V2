// WebSocket collaboration server for Bugout-V2
// This handles real-time collaboration rooms

const { createServer } = require('http');
const { Server } = require('ws');
const url = require('url');

// In-memory room storage (in production, use Redis or database)
const rooms = new Map();
const users = new Map();

// Generate unique room ID
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Generate unique user ID for session
function generateUserId() {
    return Math.random().toString(36).substring(2, 10);
}

// Room management functions
function createRoom(name, creatorId, creatorName) {
    const roomId = generateRoomId();
    const room = {
        id: roomId,
        name: name,
        createdAt: new Date().toISOString(),
        createdBy: creatorId,
        creatorName: creatorName,
        users: new Map(),
        messages: [],
        codeContent: '',
        whiteboardData: null,
        settings: {
            maxUsers: 10,
            isPublic: true,
            allowAnonymous: false
        }
    };
    
    rooms.set(roomId, room);
    return room;
}

function addUserToRoom(roomId, userId, userData) {
    const room = rooms.get(roomId);
    if (!room) return false;
    
    if (room.users.size >= room.settings.maxUsers) {
        return false;
    }
    
    room.users.set(userId, {
        ...userData,
        joinedAt: new Date().toISOString(),
        isOnline: true,
        cursor: null,
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`
    });
    
    return true;
}

function removeUserFromRoom(roomId, userId) {
    const room = rooms.get(roomId);
    if (!room) return false;
    
    room.users.delete(userId);
    
    // Clean up empty rooms
    if (room.users.size === 0) {
        rooms.delete(roomId);
    }
    
    return true;
}

function broadcastToRoom(roomId, message, excludeUserId = null) {
    const room = rooms.get(roomId);
    if (!room) return;
    
    room.users.forEach((user, userId) => {
        if (userId !== excludeUserId && user.ws && user.ws.readyState === 1) {
            user.ws.send(JSON.stringify(message));
        }
    });
}

// WebSocket message handlers
function handleJoinRoom(ws, data, userId) {
    const { roomId, userName, userAvatar, userXP } = data;
    
    let room = rooms.get(roomId);
    
    // Create room if it doesn't exist and this is a create request
    if (!room && data.createRoom) {
        room = createRoom(data.roomName || `Room ${roomId}`, userId, userName);
    }
    
    if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
        return;
    }
    
    // Add user to room
    const userData = {
        userName: userName || 'Anonymous',
        userAvatar: userAvatar || '👤',
        userXP: userXP || 0,
        ws: ws
    };
    
    if (!addUserToRoom(roomId, userId, userData)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
        return;
    }
    
    // Store user reference
    users.set(userId, { roomId, ws });
    
    // Send room data to user
    ws.send(JSON.stringify({
        type: 'room_joined',
        roomId: roomId,
        room: {
            id: room.id,
            name: room.name,
            users: Array.from(room.users.entries()).map(([uid, user]) => ({
                id: uid,
                userName: user.userName,
                userAvatar: user.userAvatar,
                userXP: user.userXP,
                isOnline: user.isOnline,
                color: user.color,
                joinedAt: user.joinedAt
            })),
            messages: room.messages,
            codeContent: room.codeContent,
            whiteboardData: room.whiteboardData
        }
    }));
    
    // Notify other users
    broadcastToRoom(roomId, {
        type: 'user_joined',
        user: {
            id: userId,
            userName: userData.userName,
            userAvatar: userData.userAvatar,
            userXP: userData.userXP,
            color: userData.color
        }
    }, userId);
}

function handleLeaveRoom(userId) {
    const user = users.get(userId);
    if (!user) return;
    
    const { roomId, ws } = user;
    
    // Remove user from room
    removeUserFromRoom(roomId, userId);
    
    // Notify other users
    broadcastToRoom(roomId, {
        type: 'user_left',
        userId: userId
    });
    
    // Clean up user reference
    users.delete(userId);
}

function handleChatMessage(roomId, userId, data) {
    const room = rooms.get(roomId);
    if (!room) return;
    
    const user = room.users.get(userId);
    if (!user) return;
    
    const message = {
        id: Date.now().toString(),
        userId: userId,
        userName: user.userName,
        userAvatar: user.userAvatar,
        content: data.content,
        timestamp: new Date().toISOString(),
        type: data.type || 'text'
    };
    
    room.messages.push(message);
    
    // Keep only last 100 messages
    if (room.messages.length > 100) {
        room.messages = room.messages.slice(-100);
    }
    
    // Broadcast to all users in room
    broadcastToRoom(roomId, {
        type: 'chat_message',
        message: message
    });
}

function handleCodeUpdate(roomId, userId, data) {
    const room = rooms.get(roomId);
    if (!room) return;
    
    room.codeContent = data.content;
    
    // Broadcast to all other users
    broadcastToRoom(roomId, {
        type: 'code_update',
        content: data.content,
        userId: userId
    }, userId);
}

function handleWhiteboardUpdate(roomId, userId, data) {
    const room = rooms.get(roomId);
    if (!room) return;
    
    room.whiteboardData = data.content;
    
    // Broadcast to all other users
    broadcastToRoom(roomId, {
        type: 'whiteboard_update',
        content: data.content,
        userId: userId
    }, userId);
}

function handleCursorUpdate(roomId, userId, data) {
    const room = rooms.get(roomId);
    if (!room) return;
    
    const user = room.users.get(userId);
    if (!user) return;
    
    user.cursor = data.cursor;
    
    // Broadcast cursor position to other users
    broadcastToRoom(roomId, {
        type: 'cursor_update',
        userId: userId,
        cursor: data.cursor
    }, userId);
}

// Create WebSocket server
const wss = new Server({ noServer: true });

wss.on('connection', (ws, request) => {
    const userId = generateUserId();
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'join_room':
                    handleJoinRoom(ws, message, userId);
                    break;
                    
                case 'chat_message':
                    const user = users.get(userId);
                    if (user) {
                        handleChatMessage(user.roomId, userId, message);
                    }
                    break;
                    
                case 'code_update':
                    const codeUser = users.get(userId);
                    if (codeUser) {
                        handleCodeUpdate(codeUser.roomId, userId, message);
                    }
                    break;
                    
                case 'whiteboard_update':
                    const wbUser = users.get(userId);
                    if (wbUser) {
                        handleWhiteboardUpdate(wbUser.roomId, userId, message);
                    }
                    break;
                    
                case 'cursor_update':
                    const cursorUser = users.get(userId);
                    if (cursorUser) {
                        handleCursorUpdate(cursorUser.roomId, userId, message);
                    }
                    break;
                    
                case 'get_rooms':
                    // Send list of public rooms
                    const publicRooms = Array.from(rooms.values())
                        .filter(room => room.settings.isPublic)
                        .map(room => ({
                            id: room.id,
                            name: room.name,
                            userCount: room.users.size,
                            maxUsers: room.settings.maxUsers,
                            createdAt: room.createdAt
                        }));
                    
                    ws.send(JSON.stringify({
                        type: 'rooms_list',
                        rooms: publicRooms
                    }));
                    break;
                    
                default:
                    ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
            }
        } catch (error) {
            console.error('Error handling message:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
    });
    
    ws.on('close', () => {
        handleLeaveRoom(userId);
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        handleLeaveRoom(userId);
    });
});

// Export for use in main server
module.exports = { wss, generateRoomId };
