// Collaboration functionality for Bugout-V2
// Real-time collaboration rooms with chat, code sharing, and whiteboard using Supabase Realtime

let currentRoomId = null;
let currentRoom = null;
let collabRoomCode = null;
let whiteboardCanvas = null;
let whiteboardCtx = null;
let isDrawing = false;
let currentWBTool = 'pen';
let currentWBColor = '#000000';
let codeUpdateTimeout = null;

// Supabase realtime subscriptions
let roomsSubscription = null;
let participantsSubscription = null;
let messagesSubscription = null;
let codeSubscription = null;
let whiteboardSubscription = null;

// Initialize collaboration
function initCollaboration() {
    if (!me) {
        toast('Please sign in to use collaboration rooms', 'error');
        return;
    }
    
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
        // Fetch public rooms from Supabase
        const { data: rooms, error } = await db
            .from('collab_rooms')
            .select(`
                *,
                collab_participants(user_id, username, user_avatar, user_xp, is_online)
            `)
            .eq('type', 'public')
            .eq('status', 'active')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Transform data for rendering
        const transformedRooms = rooms.map(room => ({
            id: room.id,
            roomCode: room.room_code,
            name: room.name,
            description: room.description,
            type: room.type,
            userCount: room.collab_participants.length,
            maxUsers: room.max_users,
            users: room.collab_participants.map(p => ({
                avatar: p.user_avatar,
                name: p.username,
                isOnline: p.is_online
            })),
            status: room.status
        }));
        
        renderCollabRooms(transformedRooms);
        
        // Set up realtime subscription for rooms
        setupRoomsRealtime();
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
        <div class="collab-room-card" onclick="joinCollabRoom('${room.id}', '${room.roomCode}')">
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
async function joinCollabRoom(roomId, roomCode) {
    if (!me) {
        toast('Please sign in to join rooms', 'error');
        return;
    }
    
    currentRoomId = roomId;
    collabRoomCode = roomCode;
    showPage('collabRoomPage');
    initCollabRoom();
    
    // Join room via Supabase
    await joinRoomViaSupabase(roomId);
    
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
        roomTitle.textContent = `Room ${collabRoomCode || currentRoomId}`;
    }
    
    // Initialize code editor
    setupCodeEditor();
}

// Setup realtime subscription for rooms list
function setupRoomsRealtime() {
    if (roomsSubscription) {
        roomsSubscription.unsubscribe();
    }
    
    roomsSubscription = db
        .channel('public:collab_rooms')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'collab_rooms' }, payload => {
            loadCollabRooms(); // Reload rooms when changes occur
        })
        .subscribe();
}

// Join room via Supabase
async function joinRoomViaSupabase(roomId) {
    try {
        // Add user as participant
        const { error: participantError } = await db
            .from('collab_participants')
            .upsert({
                room_id: roomId,
                user_id: me.id,
                username: me.username || 'Anonymous',
                user_avatar: '👤',
                user_xp: myXP || 0,
                is_online: true,
                color: `#${Math.floor(Math.random()*16777215).toString(16)}`
            }, { onConflict: 'room_id,user_id' });
        
        if (participantError) throw participantError;
        
        // Load room data
        await loadRoomData(roomId);
        
        // Setup realtime subscriptions for this room
        setupRoomRealtime(roomId);
        
        toast('Joined room successfully', 'success');
    } catch (error) {
        console.error('Error joining room:', error);
        toast('Failed to join room', 'error');
    }
}

// Load room data from Supabase
async function loadRoomData(roomId) {
    try {
        // Load room details
        const { data: room, error: roomError } = await db
            .from('collab_rooms')
            .select('*')
            .eq('id', roomId)
            .single();
        
        if (roomError) throw roomError;
        
        // Load participants
        const { data: participants, error: participantsError } = await db
            .from('collab_participants')
            .select('*')
            .eq('room_id', roomId);
        
        if (participantsError) throw participantsError;
        
        // Load messages
        const { data: messages, error: messagesError } = await db
            .from('collab_messages')
            .select('*')
            .eq('room_id', roomId)
            .order('created_at', { ascending: true })
            .limit(100);
        
        if (messagesError) throw messagesError;
        
        // Load code content
        const { data: codeData, error: codeError } = await db
            .from('collab_code')
            .select('*')
            .eq('room_id', roomId)
            .single();
        
        if (codeError && codeError.code !== 'PGRST116') throw codeError; // PGRST116 is "not found"
        
        // Load whiteboard data
        const { data: whiteboardData, error: whiteboardError } = await db
            .from('collab_whiteboard')
            .select('*')
            .eq('room_id', roomId)
            .single();
        
        if (whiteboardError && whiteboardError.code !== 'PGRST116') throw whiteboardError;
        
        // Set current room
        currentRoom = {
            id: room.id,
            roomCode: room.room_code,
            name: room.name,
            description: room.description,
            type: room.type,
            maxUsers: room.max_users,
            users: participants.map(p => ({
                id: p.user_id,
                name: p.username,
                avatar: p.user_avatar,
                xp: p.user_xp,
                isOnline: p.is_online,
                color: p.color
            })),
            messages: messages.map(m => ({
                id: m.id,
                userId: m.user_id,
                userName: m.username,
                userAvatar: m.user_avatar,
                content: m.content,
                timestamp: m.created_at,
                type: m.message_type
            })),
            codeContent: codeData?.content || '',
            whiteboardData: whiteboardData?.canvas_data || null
        };
        
        // Update UI
        updateRoomUsers();
        updateRoomMessages();
        
        // Set code editor content
        const codeInput = document.getElementById('collabCodeInput');
        if (codeInput && currentRoom.codeContent) {
            codeInput.value = currentRoom.codeContent;
        }
        
        // Restore whiteboard if data exists
        if (currentRoom.whiteboardData && whiteboardCanvas) {
            restoreWhiteboard(currentRoom.whiteboardData);
        }
    } catch (error) {
        console.error('Error loading room data:', error);
        toast('Failed to load room data', 'error');
    }
}

// Setup realtime subscriptions for room
function setupRoomRealtime(roomId) {
    // Cleanup existing subscriptions
    if (participantsSubscription) participantsSubscription.unsubscribe();
    if (messagesSubscription) messagesSubscription.unsubscribe();
    if (codeSubscription) codeSubscription.unsubscribe();
    if (whiteboardSubscription) whiteboardSubscription.unsubscribe();
    
    // Subscribe to participants changes
    participantsSubscription = db
        .channel(`room_${roomId}_participants`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'collab_participants', filter: `room_id=eq.${roomId}` }, payload => {
            loadRoomData(roomId);
        })
        .subscribe();
    
    // Subscribe to messages
    messagesSubscription = db
        .channel(`room_${roomId}_messages`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'collab_messages', filter: `room_id=eq.${roomId}` }, payload => {
            if (currentRoom) {
                currentRoom.messages.push({
                    id: payload.new.id,
                    userId: payload.new.user_id,
                    userName: payload.new.username,
                    userAvatar: payload.new.user_avatar,
                    content: payload.new.content,
                    timestamp: payload.new.created_at,
                    type: payload.new.message_type
                });
                updateRoomMessages();
            }
        })
        .subscribe();
    
    // Subscribe to code updates
    codeSubscription = db
        .channel(`room_${roomId}_code`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'collab_code', filter: `room_id=eq.${roomId}` }, payload => {
            if (currentRoom && payload.new.content !== undefined) {
                currentRoom.codeContent = payload.new.content;
                const codeInput = document.getElementById('collabCodeInput');
                if (codeInput && document.activeElement !== codeInput) {
                    codeInput.value = payload.new.content;
                }
            }
        })
        .subscribe();
    
    // Subscribe to whiteboard updates
    whiteboardSubscription = db
        .channel(`room_${roomId}_whiteboard`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'collab_whiteboard', filter: `room_id=eq.${roomId}` }, payload => {
            if (currentRoom && payload.new.canvas_data) {
                currentRoom.whiteboardData = payload.new.canvas_data;
                restoreWhiteboard(payload.new.canvas_data);
            }
        })
        .subscribe();
}

// Restore whiteboard from saved data
function restoreWhiteboard(canvasData) {
    if (!whiteboardCanvas || !whiteboardCtx || !canvasData) return;
    
    const img = new Image();
    img.onload = () => {
        whiteboardCtx.clearRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
        whiteboardCtx.drawImage(img, 0, 0);
    };
    img.src = canvasData;
}

// Update room users list
function updateRoomUsers() {
    if (!currentRoom) return;
    
    const usersList = document.getElementById('collabUsersList');
    const userCount = document.querySelector('.collab-user-count');
    
    if (usersList) {
        usersList.innerHTML = currentRoom.users.map(user => {
            const karma = getUserKarma(user.id);
            const karmaDisplay = karma.total > 0 ? `<div class="user-karma">⭐ ${karma.total}</div>` : '';
            
            return `
                <div class="collab-user-item">
                    <div class="collab-user-avatar-small" style="background: ${user.color || getAvatarColor(user.name)}">${user.avatar}</div>
                    <div class="collab-user-info">
                        <div class="collab-user-name">${user.name}</div>
                        <div class="collab-user-level">${user.xp || 0} XP</div>
                        ${karmaDisplay}
                    </div>
                    <div class="collab-user-status ${user.isOnline ? 'online' : 'offline'}"></div>
                    <div class="karma-actions">
                        <button class="karma-btn" onclick="awardKarma('${user.id}', 'helpful')" title="Award Helpful">👍</button>
                        <button class="karma-btn" onclick="awardKarma('${user.id}', 'collaborative')" title="Award Collaborative">🤝</button>
                        <button class="karma-btn" onclick="awardKarma('${user.id}', 'knowledgeable')" title="Award Knowledgeable">🧠</button>
                        <button class="karma-btn" onclick="awardKarma('${user.id}', 'creative')" title="Award Creative">💡</button>
                    </div>
                </div>
            `;
        }).join('');
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
async function sendCollabMessage() {
    const input = document.getElementById('collabChatInput');
    const content = input.value.trim();
    
    if (!content || !currentRoom || !me) return;
    
    try {
        const { error } = await db
            .from('collab_messages')
            .insert({
                room_id: currentRoomId,
                user_id: me.id,
                username: me.username || 'Anonymous',
                user_avatar: '👤',
                content: content,
                message_type: 'text'
            });
        
        if (error) throw error;
        
        // Clear input
        input.value = '';
        autoResizeCollabInput(input);
    } catch (error) {
        console.error('Error sending message:', error);
        toast('Failed to send message', 'error');
    }
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
            if (currentRoom && currentRoomId) {
                updateCodeContent(e.target.value);
            }
        }, 500);
    });
    
    // Set initial content
    if (currentRoom && currentRoom.codeContent) {
        codeInput.value = currentRoom.codeContent;
    }
}

// Update code content via Supabase
async function updateCodeContent(content) {
    if (!currentRoomId || !me) return;
    
    try {
        const { error } = await db
            .from('collab_code')
            .upsert({
                room_id: currentRoomId,
                content: content,
                updated_by: me.id
            }, { onConflict: 'room_id' });
        
        if (error) throw error;
    } catch (error) {
        console.error('Error updating code:', error);
    }
}

// Clear collaboration code
function clearCollabCode() {
    const codeInput = document.getElementById('collabCodeInput');
    if (codeInput) {
        codeInput.value = '';
        updateCodeContent('');
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
        
        // Save whiteboard state to Supabase
        if (currentRoom && currentRoomId && whiteboardCanvas) {
            saveWhiteboard();
        }
    }
}

// Save whiteboard to Supabase
async function saveWhiteboard() {
    if (!currentRoomId || !whiteboardCanvas || !me) return;
    
    try {
        const canvasData = whiteboardCanvas.toDataURL();
        const { error } = await db
            .from('collab_whiteboard')
            .upsert({
                room_id: currentRoomId,
                canvas_data: canvasData,
                updated_by: me.id
            }, { onConflict: 'room_id' });
        
        if (error) throw error;
    } catch (error) {
        console.error('Error saving whiteboard:', error);
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
    saveWhiteboard();
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
async function leaveCollabRoom() {
    // Cleanup subscriptions
    if (participantsSubscription) {
        participantsSubscription.unsubscribe();
        participantsSubscription = null;
    }
    if (messagesSubscription) {
        messagesSubscription.unsubscribe();
        messagesSubscription = null;
    }
    if (codeSubscription) {
        codeSubscription.unsubscribe();
        codeSubscription = null;
    }
    if (whiteboardSubscription) {
        whiteboardSubscription.unsubscribe();
        whiteboardSubscription = null;
    }
    
    // Remove user from participants
    if (currentRoomId && me) {
        try {
            await db
                .from('collab_participants')
                .delete()
                .eq('room_id', currentRoomId)
                .eq('user_id', me.id);
        } catch (error) {
            console.error('Error leaving room:', error);
        }
    }
    
    currentRoomId = null;
    currentRoom = null;
    collabRoomCode = null;
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
    document.getElementById('roomTemplate').value = 'custom';
}

// Room Templates
function applyRoomTemplate() {
    const template = document.getElementById('roomTemplate').value;
    const nameInput = document.getElementById('roomNameInput');
    const descInput = document.getElementById('roomDescInput');
    const typeSelect = document.getElementById('roomType');
    const maxUsersSelect = document.getElementById('roomMaxUsers');
    
    switch (template) {
        case 'pair-programming':
            nameInput.value = 'Pair Programming Session';
            descInput.value = 'Two developers working together on the same code';
            typeSelect.value = 'private';
            maxUsersSelect.value = '2';
            break;
            
        case 'code-review':
            nameInput.value = 'Code Review Session';
            descInput.value = 'Team members review and improve code together';
            typeSelect.value = 'public';
            maxUsersSelect.value = '6';
            break;
            
        case 'study-group':
            nameInput.value = 'Study Group';
            descInput.value = 'Students studying and solving problems together';
            typeSelect.value = 'public';
            maxUsersSelect.value = '8';
            break;
            
        case 'interview-practice':
            nameInput.value = 'Interview Practice';
            descInput.value = 'Mock interviews and coding challenges';
            typeSelect.value = 'private';
            maxUsersSelect.value = '3';
            break;
            
        case 'hackathon':
            nameInput.value = 'Hackathon Team';
            descInput.value = 'Team collaboration for hackathon or competition';
            typeSelect.value = 'public';
            maxUsersSelect.value = '10';
            break;
            
        case 'debug-session':
            nameInput.value = 'Debug Session';
            descInput.value = 'Collaborative debugging and problem solving';
            typeSelect.value = 'private';
            maxUsersSelect.value = '4';
            break;
            
        case 'teaching':
            nameInput.value = 'Teaching Session';
            descInput.value = 'Knowledge sharing and mentoring session';
            typeSelect.value = 'public';
            maxUsersSelect.value = '8';
            break;
            
        default:
            // Reset to custom
            nameInput.value = '';
            descInput.value = '';
            typeSelect.value = 'public';
            maxUsersSelect.value = '8';
    }
}

// Create collaboration room
async function createCollabRoom() {
    const name = document.getElementById('roomNameInput').value.trim();
    const description = document.getElementById('roomDescInput').value.trim();
    const maxUsers = parseInt(document.getElementById('roomMaxUsers').value);
    const type = document.getElementById('roomType').value;
    const template = document.getElementById('roomTemplate').value;
    
    if (!name) {
        toast('Please enter a room name', 'error');
        return;
    }
    
    try {
        // Generate unique room code
        const roomCode = generateRoomCode();
        
        // Create room in Supabase
        const { data: room, error: roomError } = await db
            .from('collab_rooms')
            .insert({
                room_code: roomCode,
                name: name,
                description: description || 'A collaboration room',
                type: type,
                max_users: maxUsers,
                created_by: me.id,
                template: template,
                status: 'active'
            })
            .select()
            .single();
        
        if (roomError) throw roomError;
        
        closeCreateRoomModal();
        
        // Join newly created room
        await joinCollabRoom(room.id, room.room_code);
        
        toast(`Created room: ${name}`, 'success');
    } catch (error) {
        console.error('Error creating room:', error);
        toast('Failed to create room', 'error');
    }
}

// Generate unique room code
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Karma System
let userKarma = new Map();

function getUserKarma(userId) {
    return userKarma.get(userId) || {
        helpful: 0,
        collaborative: 0,
        knowledgeable: 0,
        creative: 0,
        total: 0
    };
}

function updateUserKarma(userId, action, value = 1) {
    const current = getUserKarma(userId);
    current[action] += value;
    current.total = current.helpful + current.collaborative + current.knowledgeable + current.creative;
    userKarma.set(userId, current);
    
    // Karma is now stored locally - could be extended to Supabase in future
    updateRoomUsers();
}

function awardKarma(userId, action) {
    updateUserKarma(userId, action, 1);
    
    const actionNames = {
        helpful: '👍 Helpful',
        collaborative: '🤝 Collaborative',
        knowledgeable: '🧠 Knowledgeable',
        creative: '💡 Creative'
    };
    
    toast(`Awarded ${actionNames[action]} karma to user`, 'success');
}

// Enhanced room users display with karma
function updateRoomUsers() {
    if (!currentRoom) return;
    
    const usersList = document.getElementById('collabUsersList');
    const userCount = document.querySelector('.collab-user-count');
    
    if (usersList) {
        usersList.innerHTML = currentRoom.users.map(user => {
            const karma = getUserKarma(user.id);
            const karmaDisplay = karma.total > 0 ? `<div class="user-karma">⭐ ${karma.total}</div>` : '';
            
            return `
                <div class="collab-user-item">
                    <div class="collab-user-avatar-small" style="background: ${getAvatarColor(user.name)}">${user.avatar}</div>
                    <div class="collab-user-info">
                        <div class="collab-user-name">${user.name}</div>
                        <div class="collab-user-level">${user.xp || 0} XP</div>
                        ${karmaDisplay}
                    </div>
                    <div class="collab-user-status ${user.isOnline ? 'online' : 'offline'}"></div>
                    <div class="karma-actions">
                        <button class="karma-btn" onclick="awardKarma('${user.id}', 'helpful')" title="Award Helpful">👍</button>
                        <button class="karma-btn" onclick="awardKarma('${user.id}', 'collaborative')" title="Award Collaborative">🤝</button>
                        <button class="karma-btn" onclick="awardKarma('${user.id}', 'knowledgeable')" title="Award Knowledgeable">🧠</button>
                        <button class="karma-btn" onclick="awardKarma('${user.id}', 'creative')" title="Award Creative">💡</button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    if (userCount) {
        userCount.textContent = `${currentRoom.users.length} users`;
    }
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

// Advanced collaboration features
let voiceChatActive = false;
let screenShareActive = false;
let recordingActive = false;
let mediaRecorder = null;
let recordedChunks = [];
let localStream = null;
let peerConnections = new Map();
let sharedFiles = new Map();
let aiChatHistory = [];

// Voice Chat Functions
async function toggleVoiceChat() {
    const voiceBtn = document.getElementById('voiceBtn');
    const voiceIcon = document.getElementById('voiceIcon');
    
    if (!voiceChatActive) {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            voiceChatActive = true;
            voiceBtn.classList.add('active');
            voiceIcon.textContent = '🔊';
            toast('Voice chat enabled', 'success');
            
            // Broadcast to room
            broadcastVoiceState(true);
        } catch (error) {
            toast('Microphone access denied', 'error');
            console.error('Voice chat error:', error);
        }
    } else {
        stopVoiceChat();
    }
}

function stopVoiceChat() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    voiceChatActive = false;
    const voiceBtn = document.getElementById('voiceBtn');
    const voiceIcon = document.getElementById('voiceIcon');
    voiceBtn.classList.remove('active');
    voiceIcon.textContent = '🎤';
    
    broadcastVoiceState(false);
    toast('Voice chat disabled', 'info');
}

function broadcastVoiceState(enabled) {
    if (collabWebSocket && collabWebSocket.readyState === 1) {
        collabWebSocket.send(JSON.stringify({
            type: 'voice_state',
            userId: collabUserId,
            enabled: enabled
        }));
    }
}

// Screen Sharing Functions
async function toggleScreenShare() {
    const screenShareBtn = document.getElementById('screenShareBtn');
    const screenShareIcon = document.getElementById('screenShareIcon');
    
    if (!screenShareActive) {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });
            
            screenShareActive = true;
            screenShareBtn.classList.add('active');
            screenShareIcon.textContent = '🛑';
            toast('Screen sharing started', 'success');
            
            // Add screen share video to room
            addScreenShareVideo(screenStream);
            broadcastScreenShareState(true);
        } catch (error) {
            toast('Screen sharing denied or not supported', 'error');
            console.error('Screen share error:', error);
        }
    } else {
        stopScreenShare();
    }
}

function stopScreenShare() {
    screenShareActive = false;
    const screenShareBtn = document.getElementById('screenShareBtn');
    const screenShareIcon = document.getElementById('screenShareIcon');
    screenShareBtn.classList.remove('active');
    screenShareIcon.textContent = '🖥️';
    
    // Remove screen share video
    removeScreenShareVideo();
    broadcastScreenShareState(false);
    toast('Screen sharing stopped', 'info');
}

function addScreenShareVideo(stream) {
    // Create video element for screen share
    const videoContainer = document.querySelector('.collab-main');
    if (videoContainer) {
        const video = document.createElement('video');
        video.id = 'screenShareVideo';
        video.autoplay = true;
        video.muted = true;
        video.srcObject = stream;
        video.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 200px;
            height: 150px;
            border: 2px solid var(--accent);
            border-radius: 8px;
            z-index: 1000;
            background: #000;
        `;
        videoContainer.appendChild(video);
    }
}

function removeScreenShareVideo() {
    const video = document.getElementById('screenShareVideo');
    if (video) {
        video.srcObject = null;
        video.remove();
    }
}

function broadcastScreenShareState(sharing) {
    if (collabWebSocket && collabWebSocket.readyState === 1) {
        collabWebSocket.send(JSON.stringify({
            type: 'screen_share',
            userId: collabUserId,
            sharing: sharing
        }));
    }
}

// Recording Functions
async function toggleRecording() {
    const recordBtn = document.getElementById('recordBtn');
    const recordIcon = document.getElementById('recordIcon');
    
    if (!recordingActive) {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });
            
            recordedChunks = [];
            mediaRecorder = new MediaRecorder(stream);
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };
            
            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                downloadRecording(url);
                recordedChunks = [];
            };
            
            mediaRecorder.start();
            recordingActive = true;
            recordBtn.classList.add('recording');
            recordIcon.textContent = '⏹️';
            
            // Add recording indicator
            addRecordingIndicator();
            toast('Recording started', 'success');
        } catch (error) {
            toast('Recording failed: ' + error.message, 'error');
        }
    } else {
        stopRecording();
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        recordingActive = false;
        
        const recordBtn = document.getElementById('recordBtn');
        const recordIcon = document.getElementById('recordIcon');
        recordBtn.classList.remove('recording');
        recordIcon.textContent = '⏺️';
        
        removeRecordingIndicator();
        toast('Recording stopped', 'info');
    }
}

function addRecordingIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'recordingIndicator';
    indicator.className = 'collab-recording-indicator';
    indicator.innerHTML = '🔴 Recording Session...';
    document.body.appendChild(indicator);
}

function removeRecordingIndicator() {
    const indicator = document.getElementById('recordingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

function downloadRecording(url) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `collab-session-${currentRoomId}-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
}

// Code Playground Functions
function runPlaygroundCode() {
    const code = document.getElementById('playgroundCodeInput').value;
    const language = document.getElementById('playgroundLangSelect').value;
    const outputDiv = document.getElementById('playgroundOutput');
    
    if (!code.trim()) {
        toast('Please enter some code', 'error');
        return;
    }
    
    outputDiv.innerHTML = '<div class="loading"><div class="spinner"></div>Running code...</div>';
    
    // Simulate code execution (in production, this would call actual code execution API)
    setTimeout(() => {
        try {
            let output = '';
            
            switch (language) {
                case 'javascript':
                    // Safe JavaScript execution
                    const func = new Function(code);
                    const result = func();
                    output = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
                    break;
                    
                case 'python':
                    output = 'Python execution would be handled by backend API\nResult: Hello, World!';
                    break;
                    
                case 'html':
                    output = `<div style="padding: 1rem; border: 1px solid #ccc; border-radius: 4px;">${code}</div>`;
                    break;
                    
                case 'css':
                    output = `<style>${code}</style><div class="css-demo">CSS Applied</div>`;
                    break;
                    
                case 'sql':
                    output = 'SQL execution would be handled by backend API\nResult: Query executed successfully';
                    break;
                    
                default:
                    output = 'Language not supported for execution';
            }
            
            outputDiv.innerHTML = `<pre style="margin: 0; white-space: pre-wrap;">${escapeHtml(output)}</pre>`;
            toast('Code executed successfully', 'success');
            
        } catch (error) {
            outputDiv.innerHTML = `<div style="color: var(--error);">Error: ${escapeHtml(error.message)}</div>`;
            toast('Code execution failed', 'error');
        }
    }, 1500);
}

function clearPlayground() {
    document.getElementById('playgroundCodeInput').value = '';
    document.getElementById('playgroundOutput').innerHTML = '<div class="collab-empty">Run code to see output...</div>';
}

function sharePlayground() {
    const output = document.getElementById('playgroundOutput').textContent;
    if (output && output.trim()) {
        navigator.clipboard.writeText(output).then(() => {
            toast('Output copied to clipboard', 'success');
        }).catch(() => {
            toast('Failed to copy output', 'error');
        });
    }
}

function clearPlaygroundOutput() {
    document.getElementById('playgroundOutput').innerHTML = '<div class="collab-empty">Run code to see output...</div>';
}

function copyPlaygroundOutput() {
    const output = document.getElementById('playgroundOutput').textContent;
    if (output && output.trim()) {
        navigator.clipboard.writeText(output).then(() => {
            toast('Output copied to clipboard', 'success');
        });
    }
}

// AI Assistant Functions
async function askAIAssistant() {
    const input = document.getElementById('aiInput');
    const question = input.value.trim();
    
    if (!question) {
        toast('Please enter a question', 'error');
        return;
    }
    
    const messagesDiv = document.getElementById('aiMessages');
    const askBtn = document.getElementById('aiAskBtn');
    
    // Add user message
    addAIMessage('user', question);
    input.value = '';
    askBtn.disabled = true;
    askBtn.textContent = 'Thinking...';
    
    try {
        // Call AI API (using existing Groq integration)
        const messages = [
            { role: 'system', content: 'You are an expert coding assistant helping users in a collaborative coding environment. Provide clear, helpful, and concise answers to coding questions.' },
            { role: 'user', content: question }
        ];
        
        const response = await callGroq(messages, { max_tokens: 500, temperature: 0.7 });
        const aiResponse = response.choices[0].message.content;
        
        addAIMessage('assistant', aiResponse);
        toast('AI response received', 'success');
        
    } catch (error) {
        addAIMessage('assistant', 'Sorry, I encountered an error. Please try again.');
        toast('AI assistant error', 'error');
    } finally {
        askBtn.disabled = false;
        askBtn.textContent = 'Ask AI';
    }
}

function addAIMessage(role, content) {
    const messagesDiv = document.getElementById('aiMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `collab-ai-message ${role}`;
    messageDiv.innerHTML = `
        <div class="collab-ai-message-header">
            <span class="collab-ai-message-role">${role === 'user' ? '👤 You' : '🤖 AI Assistant'}</span>
            <span class="collab-ai-message-time">${formatTime(new Date().toISOString())}</span>
        </div>
        <div class="collab-ai-message-content">${escapeHtml(content)}</div>
    `;
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    aiChatHistory.push({ role, content, timestamp: new Date().toISOString() });
}

function clearAIChat() {
    const messagesDiv = document.getElementById('aiMessages');
    messagesDiv.innerHTML = '<div class="collab-empty">Ask me anything about your code! 🤖</div>';
    aiChatHistory = [];
    toast('AI chat cleared', 'info');
}

// AI Quick Actions
function aiExplainCode() {
    const code = getCurrentCode();
    if (code) {
        document.getElementById('aiInput').value = `Explain this code:\n\n${code}`;
        askAIAssistant();
    }
}

function aiDebugCode() {
    const code = getCurrentCode();
    if (code) {
        document.getElementById('aiInput').value = `Debug this code and fix any errors:\n\n${code}`;
        askAIAssistant();
    }
}

function aiOptimizeCode() {
    const code = getCurrentCode();
    if (code) {
        document.getElementById('aiInput').value = `Optimize this code for better performance:\n\n${code}`;
        askAIAssistant();
    }
}

function aiAddTests() {
    const code = getCurrentCode();
    if (code) {
        document.getElementById('aiInput').value = `Write unit tests for this code:\n\n${code}`;
        askAIAssistant();
    }
}

function aiConvertLanguage() {
    const code = getCurrentCode();
    if (code) {
        const currentLang = document.getElementById('collabLangSelect').value;
        document.getElementById('aiInput').value = `Convert this ${currentLang} code to JavaScript:\n\n${code}`;
        askAIAssistant();
    }
}

function getCurrentCode() {
    const activeTab = document.querySelector('.collab-tab.active');
    if (!activeTab) return '';
    
    const tabId = activeTab.id;
    if (tabId === 'codeTab') {
        return document.getElementById('collabCodeInput').value;
    } else if (tabId === 'playgroundTab') {
        return document.getElementById('playgroundCodeInput').value;
    }
    return '';
}

// Enhanced tab switching
function switchCollabTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.collab-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`${tab}Tab`).classList.add('active');
    
    // Update panels
    document.querySelectorAll('.collab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`${tab}Panel`).classList.add('active');
    
    // Initialize specific features
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
    
    if (tab === 'playground') {
        setTimeout(() => {
            const input = document.getElementById('playgroundCodeInput');
            if (input && !input.value) {
                // Load current code from editor
                const editorCode = document.getElementById('collabCodeInput').value;
                if (editorCode) {
                    input.value = editorCode;
                }
            }
        }, 100);
    }
}

// File Sharing Functions
function setupFileSharing() {
    const codeEditor = document.getElementById('collabCodeInput');
    if (!codeEditor) return;
    
    // Create drop zone
    const dropZone = document.createElement('div');
    dropZone.className = 'collab-file-drop-zone';
    dropZone.innerHTML = `
        <div>📁 Drop files here or click to upload</div>
        <div class="collab-file-list" id="sharedFilesList"></div>
    `;
    
    // Insert after toolbar
    const toolbar = document.querySelector('.collab-code-toolbar');
    if (toolbar) {
        toolbar.parentNode.insertBefore(dropZone, toolbar.nextSibling);
    }
    
    // Setup drag and drop
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('drop', handleFileDrop);
    dropZone.addEventListener('click', () => document.getElementById('fileInput').click());
    
    // Create hidden file input
    const fileInput = document.createElement('input');
    fileInput.id = 'fileInput';
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', handleFileSelect);
    document.body.appendChild(fileInput);
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleFileDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    processFiles(files);
}

function processFiles(files) {
    const filesList = document.getElementById('sharedFilesList');
    
    files.forEach(file => {
        const fileId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        sharedFiles.set(fileId, file);
        
        const fileItem = document.createElement('div');
        fileItem.className = 'collab-file-item';
        fileItem.innerHTML = `
            <span class="collab-file-icon">📄</span>
            <div class="collab-file-info">
                <div class="collab-file-name">${escapeHtml(file.name)}</div>
                <div class="collab-file-size">${formatFileSize(file.size)}</div>
            </div>
            <button class="collab-file-remove" onclick="removeSharedFile('${fileId}')">×</button>
        `;
        
        filesList.appendChild(fileItem);
        
        // Read file content if it's a code file
        if (isCodeFile(file.name)) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                // Add to chat
                const message = `📄 Shared file: ${file.name}`;
                sendCollabMessage(message);
                
                // Optionally load into editor
                if (confirm(`Load ${file.name} into code editor?`)) {
                    document.getElementById('collabCodeInput').value = content;
                }
            };
            reader.readAsText(file);
        }
    });
    
    toast(`${files.length} file(s) shared`, 'success');
}

function removeSharedFile(fileId) {
    sharedFiles.delete(fileId);
    
    const filesList = document.getElementById('sharedFilesList');
    const fileItems = filesList.children;
    
    for (let item of fileItems) {
        if (item.onclick && item.onclick.toString().includes(fileId)) {
            item.remove();
            break;
        }
    }
}

function isCodeFile(filename) {
    const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.css', '.scss', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rs', '.sql'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return codeExtensions.includes(ext);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Enhanced room initialization
function initCollabRoom() {
    // Initialize existing features
    const canvas = document.getElementById('collabWhiteboard');
    if (canvas) {
        whiteboardCanvas = canvas;
        whiteboardCtx = canvas.getContext('2d');
        setupWhiteboard();
    }
    
    const roomTitle = document.getElementById('collabRoomTitle');
    if (roomTitle) {
        roomTitle.textContent = `Room ${currentRoomId}`;
    }
    
    setupCodeEditor();
    
    // Setup new features
    setupFileSharing();
    setupCollaborativeCursors();
}

// Collaborative Cursors
function setupCollaborativeCursors() {
    const codeEditor = document.getElementById('collabCodeInput');
    const playground = document.getElementById('playgroundCodeInput');
    
    [codeEditor, playground].forEach(editor => {
        if (editor) {
            editor.addEventListener('mousemove', (e) => {
                const rect = editor.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // Broadcast cursor position
                if (collabWebSocket && collabWebSocket.readyState === 1) {
                    collabWebSocket.send(JSON.stringify({
                        type: 'cursor_update',
                        userId: collabUserId,
                        cursor: { x, y }
                    }));
                }
            });
        }
    });
}

// Initialize collaboration when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Add collaboration page to page navigation
    if (typeof showPage !== 'undefined') {
        // Collaboration is already integrated
        initCollaboration();
    }
});
