// Collaboration functionality for Bugout-V2
// Real-time collaboration rooms with chat, code sharing, and whiteboard

let collabWebSocket = null;
let currentRoomId = null;
let currentRoom = null;
let collabUserId = null;
let whiteboardCanvas = null;
let whiteboardCtx = null;
let isDrawing = false;
let currentWBTool = 'pen';
let currentWBColor = '#000000';
let codeUpdateTimeout = null;

// Initialize collaboration
function initCollaboration() {
    if (!me) {
        toast('Please sign in to use collaboration rooms', 'error');
        return;
    }
    
    collabUserId = `user_${me.id}_${Date.now()}`;
    
    // Add collaboration navigation button visibility
    updateCollabNavigation();
}

// Update collaboration navigation visibility
function updateCollabNavigation() {
    const collabNavBtn = document.getElementById('collabNavBtn');
    if (collabNavBtn) {
        collabNavBtn.style.display = me ? 'inline-flex' : 'none';
    }
}

// Navigate to collaboration page
function goCollaboration() {
    if (!me) {
        toast('Please sign in to access collaboration rooms', 'error');
        return;
    }
    
    showPage('collabPage');
    loadCollabRooms();
    setRoute({ collab: 'list' });
}

// Load collaboration rooms
async function loadCollabRooms() {
    const roomsGrid = document.getElementById('collabRoomsGrid');
    roomsGrid.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading rooms...</p></div>';
    
    try {
        // For now, create mock rooms - in production, this would fetch from server
        const mockRooms = [
            {
                id: 'ROOM001',
                name: 'JavaScript Discussion',
                description: 'Discuss JavaScript concepts and solve problems together',
                type: 'public',
                userCount: 3,
                maxUsers: 8,
                users: [
                    { avatar: '👨‍💻', name: 'Alex' },
                    { avatar: '👩‍💻', name: 'Sarah' },
                    { avatar: '🧑‍💻', name: 'Mike' }
                ],
                status: 'active'
            },
            {
                id: 'ROOM002', 
                name: 'Python Practice',
                description: 'Practice Python coding problems together',
                type: 'public',
                userCount: 5,
                maxUsers: 8,
                users: [
                    { avatar: '🐍', name: 'PythonPro' },
                    { avatar: '👨‍🎓', name: 'Student1' },
                    { avatar: '👩‍🎓', name: 'Student2' }
                ],
                status: 'active'
            }
        ];
        
        renderCollabRooms(mockRooms);
    } catch (error) {
        console.error('Error loading rooms:', error);
        roomsGrid.innerHTML = '<div class="collab-empty">Failed to load rooms</div>';
    }
}

// Render collaboration rooms
function renderCollabRooms(rooms) {
    const roomsGrid = document.getElementById('collabRoomsGrid');
    
    if (rooms.length === 0) {
        roomsGrid.innerHTML = '<div class="collab-empty">No active rooms. Create one!</div>';
        return;
    }
    
    roomsGrid.innerHTML = rooms.map(room => `
        <div class="collab-room-card" onclick="joinCollabRoom('${room.id}')">
            <div class="collab-room-header">
                <div class="collab-room-name">${room.name}</div>
                <div class="collab-room-type">${room.type === 'public' ? '🌍 Public' : '🔒 Private'}</div>
            </div>
            <div class="collab-room-desc">${room.description}</div>
            <div class="collab-room-meta">
                <div class="collab-room-users">
                    <div class="collab-user-avatars">
                        ${room.users.slice(0, 3).map(user => `
                            <div class="collab-user-avatar" style="background: ${getAvatarColor(user.name)}">${user.avatar}</div>
                        `).join('')}
                        ${room.userCount > 3 ? `<div class="collab-user-avatar">+${room.userCount - 3}</div>` : ''}
                    </div>
                    <span>${room.userCount}/${room.maxUsers} users</span>
                </div>
                <div class="collab-room-status">
                    <div class="collab-status-dot"></div>
                    <span>Active</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Join collaboration room
function joinCollabRoom(roomId) {
    if (!me) {
        toast('Please sign in to join rooms', 'error');
        return;
    }
    
    currentRoomId = roomId;
    showPage('collabRoomPage');
    initCollabRoom();
    
    // Connect WebSocket
    connectCollabWebSocket(roomId);
    
    setRoute({ collab: roomId });
}

// Initialize collaboration room
function initCollabRoom() {
    // Initialize whiteboard
    const canvas = document.getElementById('collabWhiteboard');
    if (canvas) {
        whiteboardCanvas = canvas;
        whiteboardCtx = canvas.getContext('2d');
        setupWhiteboard();
    }
    
    // Set room title
    const roomTitle = document.getElementById('collabRoomTitle');
    if (roomTitle) {
        roomTitle.textContent = `Room ${currentRoomId}`;
    }
    
    // Initialize code editor
    setupCodeEditor();
}

// Connect collaboration WebSocket
function connectCollabWebSocket(roomId) {
    // For now, simulate WebSocket connection
    // In production, this would connect to actual WebSocket server
    console.log('Connecting to collaboration room:', roomId);
    
    // Simulate successful connection
    setTimeout(() => {
        onCollabRoomJoined({
            roomId: roomId,
            room: {
                id: roomId,
                name: `Room ${roomId}`,
                users: [
                    { id: collabUserId, name: me.username || 'You', avatar: '👤', isOnline: true }
                ],
                messages: [],
                codeContent: '',
                whiteboardData: null
            }
        });
    }, 1000);
}

// Handle room joined
function onCollabRoomJoined(data) {
    currentRoom = data.room;
    updateRoomUsers();
    updateRoomMessages();
    
    toast(`Joined ${data.room.name}`, 'success');
}

// Update room users list
function updateRoomUsers() {
    if (!currentRoom) return;
    
    const usersList = document.getElementById('collabUsersList');
    const userCount = document.querySelector('.collab-user-count');
    
    if (usersList) {
        usersList.innerHTML = currentRoom.users.map(user => `
            <div class="collab-user-item">
                <div class="collab-user-avatar-small" style="background: ${getAvatarColor(user.name)}">${user.avatar}</div>
                <div class="collab-user-info">
                    <div class="collab-user-name">${user.name}</div>
                    <div class="collab-user-level">${user.xp || 0} XP</div>
                </div>
                <div class="collab-user-status ${user.isOnline ? 'online' : 'offline'}"></div>
            </div>
        `).join('');
    }
    
    if (userCount) {
        userCount.textContent = `${currentRoom.users.length} users`;
    }
}

// Update room messages
function updateRoomMessages() {
    if (!currentRoom) return;
    
    const messagesContainer = document.getElementById('collabChatMessages');
    if (!messagesContainer) return;
    
    if (currentRoom.messages.length === 0) {
        messagesContainer.innerHTML = '<div class="collab-empty">Start a conversation...</div>';
        return;
    }
    
    messagesContainer.innerHTML = currentRoom.messages.map(msg => `
        <div class="collab-chat-message">
            <div class="collab-chat-message-header">
                <div class="collab-chat-message-avatar" style="background: ${getAvatarColor(msg.userName)}">${msg.userAvatar}</div>
                <div class="collab-chat-message-name">${msg.userName}</div>
                <div class="collab-chat-message-time">${formatTime(msg.timestamp)}</div>
            </div>
            <div class="collab-chat-message-content">${msg.content}</div>
        </div>
    `).join('');
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send collaboration message
function sendCollabMessage() {
    const input = document.getElementById('collabChatInput');
    const content = input.value.trim();
    
    if (!content || !currentRoom) return;
    
    const message = {
        id: Date.now().toString(),
        userId: collabUserId,
        userName: me.username || 'You',
        userAvatar: '👤',
        content: content,
        timestamp: new Date().toISOString(),
        type: 'text'
    };
    
    // Add to local room
    currentRoom.messages.push(message);
    updateRoomMessages();
    
    // Clear input
    input.value = '';
    autoResizeCollabInput(input);
    
    // Send to WebSocket (simulated)
    console.log('Sending message:', message);
}

// Handle chat input keydown
function handleCollabChatKey(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendCollabMessage();
    }
}

// Auto-resize chat input
function autoResizeCollabInput(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
}

// Switch collaboration tab
function switchCollabTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.collab-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`${tab}Tab`).classList.add('active');
    
    // Update panels
    document.querySelectorAll('.collab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`${tab}Panel`).classList.add('active');
    
    // Initialize whiteboard if switching to it
    if (tab === 'whiteboard' && !whiteboardCanvas) {
        setTimeout(() => {
            const canvas = document.getElementById('collabWhiteboard');
            if (canvas) {
                whiteboardCanvas = canvas;
                whiteboardCtx = canvas.getContext('2d');
                setupWhiteboard();
            }
        }, 100);
    }
}

// Setup code editor
function setupCodeEditor() {
    const codeInput = document.getElementById('collabCodeInput');
    if (!codeInput) return;
    
    codeInput.addEventListener('input', (e) => {
        // Debounce code updates
        clearTimeout(codeUpdateTimeout);
        codeUpdateTimeout = setTimeout(() => {
            if (currentRoom) {
                currentRoom.codeContent = e.target.value;
                // Send to WebSocket (simulated)
                console.log('Code updated:', e.target.value);
            }
        }, 500);
    });
    
    // Set initial content
    if (currentRoom && currentRoom.codeContent) {
        codeInput.value = currentRoom.codeContent;
    }
}

// Clear collaboration code
function clearCollabCode() {
    const codeInput = document.getElementById('collabCodeInput');
    if (codeInput) {
        codeInput.value = '';
        if (currentRoom) {
            currentRoom.codeContent = '';
            console.log('Code cleared');
        }
    }
}

// Copy collaboration code
function copyCollabCode() {
    const codeInput = document.getElementById('collabCodeInput');
    if (codeInput) {
        navigator.clipboard.writeText(codeInput.value).then(() => {
            toast('Code copied to clipboard', 'success');
        }).catch(() => {
            toast('Failed to copy code', 'error');
        });
    }
}

// Setup whiteboard
function setupWhiteboard() {
    if (!whiteboardCanvas || !whiteboardCtx) return;
    
    // Set canvas size
    const container = whiteboardCanvas.parentElement;
    whiteboardCanvas.width = container.clientWidth;
    whiteboardCanvas.height = container.clientHeight;
    
    // Set default styles
    whiteboardCtx.lineCap = 'round';
    whiteboardCtx.lineJoin = 'round';
    whiteboardCtx.lineWidth = 2;
    whiteboardCtx.strokeStyle = currentWBColor;
    
    // Mouse events
    whiteboardCanvas.addEventListener('mousedown', startDrawing);
    whiteboardCanvas.addEventListener('mousemove', draw);
    whiteboardCanvas.addEventListener('mouseup', stopDrawing);
    whiteboardCanvas.addEventListener('mouseout', stopDrawing);
    
    // Touch events
    whiteboardCanvas.addEventListener('touchstart', handleTouch);
    whiteboardCanvas.addEventListener('touchmove', handleTouch);
    whiteboardCanvas.addEventListener('touchend', stopDrawing);
}

// Start drawing
function startDrawing(e) {
    isDrawing = true;
    const rect = whiteboardCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    whiteboardCtx.beginPath();
    whiteboardCtx.moveTo(x, y);
}

// Draw
function draw(e) {
    if (!isDrawing) return;
    
    const rect = whiteboardCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (currentWBTool === 'pen') {
        whiteboardCtx.globalCompositeOperation = 'source-over';
        whiteboardCtx.strokeStyle = currentWBColor;
        whiteboardCtx.lineTo(x, y);
        whiteboardCtx.stroke();
    } else if (currentWBTool === 'eraser') {
        whiteboardCtx.globalCompositeOperation = 'destination-out';
        whiteboardCtx.lineWidth = 10;
        whiteboardCtx.lineTo(x, y);
        whiteboardCtx.stroke();
    }
}

// Stop drawing
function stopDrawing() {
    if (isDrawing) {
        isDrawing = false;
        whiteboardCtx.beginPath();
        
        // Save whiteboard state (simulated)
        if (currentRoom) {
            currentRoom.whiteboardData = whiteboardCanvas.toDataURL();
            console.log('Whiteboard updated');
        }
    }
}

// Handle touch events
function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 'mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    whiteboardCanvas.dispatchEvent(mouseEvent);
}

// Select whiteboard tool
function selectWBTool(tool) {
    currentWBTool = tool;
    document.querySelectorAll('.collab-wb-tool').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
    
    // Update cursor
    if (whiteboardCanvas) {
        whiteboardCanvas.style.cursor = tool === 'eraser' ? 'grab' : 'crosshair';
    }
}

// Select whiteboard color
function selectWBColor(color) {
    currentWBColor = color;
    document.querySelectorAll('.collab-wb-color').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-color="${color}"]`).classList.add('active');
    
    if (whiteboardCtx) {
        whiteboardCtx.strokeStyle = color;
    }
}

// Clear whiteboard
function clearWhiteboard() {
    if (!whiteboardCanvas || !whiteboardCtx) return;
    
    whiteboardCtx.clearRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
    
    if (currentRoom) {
        currentRoom.whiteboardData = null;
        console.log('Whiteboard cleared');
    }
}

// Download whiteboard
function downloadWhiteboard() {
    if (!whiteboardCanvas) return;
    
    const link = document.createElement('a');
    link.download = `whiteboard_${currentRoomId}_${Date.now()}.png`;
    link.href = whiteboardCanvas.toDataURL();
    link.click();
}

// Leave collaboration room
function leaveCollabRoom() {
    if (collabWebSocket) {
        collabWebSocket.close();
        collabWebSocket = null;
    }
    
    currentRoomId = null;
    currentRoom = null;
    whiteboardCanvas = null;
    whiteboardCtx = null;
    
    goCollaboration();
    toast('Left collaboration room', 'info');
}

// Open create room modal
function openCreateRoomModal() {
    if (!me) {
        toast('Please sign in to create rooms', 'error');
        return;
    }
    
    document.getElementById('createRoomModal').style.display = 'flex';
    document.getElementById('roomNameInput').focus();
}

// Close create room modal
function closeCreateRoomModal() {
    document.getElementById('createRoomModal').style.display = 'none';
    
    // Clear form
    document.getElementById('roomNameInput').value = '';
    document.getElementById('roomDescInput').value = '';
    document.getElementById('roomMaxUsers').value = '8';
    document.getElementById('roomType').value = 'public';
}

// Create collaboration room
function createCollabRoom() {
    const name = document.getElementById('roomNameInput').value.trim();
    const description = document.getElementById('roomDescInput').value.trim();
    const maxUsers = parseInt(document.getElementById('roomMaxUsers').value);
    const type = document.getElementById('roomType').value;
    
    if (!name) {
        toast('Please enter a room name', 'error');
        return;
    }
    
    // Create room (simulated)
    const newRoom = {
        id: `ROOM${Date.now().toString().slice(-6)}`,
        name: name,
        description: description || 'A collaboration room',
        type: type,
        maxUsers: maxUsers,
        userCount: 1,
        users: [
            { avatar: '👤', name: me.username || 'You' }
        ],
        status: 'active',
        createdBy: me.id
    };
    
    closeCreateRoomModal();
    
    // Join the newly created room
    joinCollabRoom(newRoom.id);
    
    toast(`Created room: ${name}`, 'success');
}

// Utility functions
function getAvatarColor(name) {
    const colors = ['#00ff88', '#0077ff', '#ff4444', '#ff9900', '#aa44ff', '#ff44aa', '#00ccff', '#ffcc00'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// Initialize collaboration when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Add collaboration page to page navigation
    if (typeof showPage !== 'undefined') {
        // Collaboration is already integrated
        initCollaboration();
    }
});
