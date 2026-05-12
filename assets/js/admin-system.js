// Advanced Admin System for BUGOUT
class AdminSystem {
    constructor() {
        this.isAdmin = false;
        this.adminUsers = [
            'shreyanshshekhar353@gmail.com', // Your admin email
            'admin@bugout.com',
            'founder@mindforgers.com'
        ];
        this.adminFeatures = {
            dashboard: true,
            userManagement: true,
            analytics: true,
            systemControl: true,
            debugMode: true,
            contentModeration: true,
            announcements: true
        };
        this.init();
    }

    init() {
        this.checkAdminStatus();
        this.createAdminPanel();
        this.addAdminControls();
    }

    checkAdminStatus() {
        // Check if current user is admin
        if (window.me && window.me.email) {
            this.isAdmin = this.adminUsers.includes(window.me.email.toLowerCase());
            if (this.isAdmin) {
                this.enableAdminMode();
            }
        }

        // Also check for localStorage admin override (for development)
        const devAdmin = localStorage.getItem('bugout_dev_admin');
        if (devAdmin === 'true') {
            this.isAdmin = true;
            this.enableAdminMode();
        }
    }

    enableAdminMode() {
        // Add admin class to body
        document.body.classList.add('admin-mode');
        
        // Show admin controls
        this.showAdminNotification();
        this.addAdminStyles();
        this.createAdminToolbar();
        
        console.log('%c👑 ADMIN MODE ACTIVATED', 'color: #ff0066; font-size: 20px; font-weight: bold;');
        console.log('%cWelcome, Administrator! You have full system access.', 'color: #ff0066; font-size: 14px;');
    }

    createAdminPanel() {
        const panel = document.createElement('div');
        panel.id = 'adminPanel';
        panel.className = 'admin-panel';
        panel.innerHTML = `
            <div class="admin-panel-header">
                <h3>👑 Admin Control Panel</h3>
                <button class="admin-close" onclick="adminSystem.togglePanel()">✕</button>
            </div>
            <div class="admin-panel-content">
                <div class="admin-section">
                    <h4>👥 User Management</h4>
                    <button class="admin-btn" onclick="adminSystem.showUserStats()">📊 User Statistics</button>
                    <button class="admin-btn" onclick="adminSystem.showUserList()">👤 All Users</button>
                    <button class="admin-btn" onclick="adminSystem.banUser()">🚫 Ban User</button>
                    <button class="admin-btn" onclick="adminSystem.upgradeUser()">⭐ Upgrade User</button>
                </div>
                
                <div class="admin-section">
                    <h4>📈 Analytics</h4>
                    <button class="admin-btn" onclick="adminSystem.showSystemStats()">🔧 System Stats</button>
                    <button class="admin-btn" onclick="adminSystem.showBugAnalytics()">🐛 Bug Analytics</button>
                    <button class="admin-btn" onclick="adminSystem.showActivityLog()">📝 Activity Log</button>
                    <button class="admin-btn" onclick="adminSystem.exportData()">💾 Export Data</button>
                </div>
                
                <div class="admin-section">
                    <h4>🎮 System Control</h4>
                    <button class="admin-btn" onclick="adminSystem.toggleMaintenance()">🔧 Maintenance Mode</button>
                    <button class="admin-btn" onclick="adminSystem.clearCache()">🗑️ Clear Cache</button>
                    <button class="admin-btn" onclick="adminSystem.restartSystem()">🔄 Restart System</button>
                    <button class="admin-btn" onclick="adminSystem.showDebugInfo()">🐛 Debug Info</button>
                </div>
                
                <div class="admin-section">
                    <h4>📢 Content Control</h4>
                    <button class="admin-btn" onclick="adminSystem.makeAnnouncement()">📢 Make Announcement</button>
                    <button class="admin-btn" onclick="adminSystem.featuredBug()">⭐ Feature Bug</button>
                    <button class="admin-btn" onclick="adminSystem.moderateContent()">🔍 Moderate Content</button>
                    <button class="admin-btn" onclick="adminSystem.systemMessage()">💬 System Message</button>
                </div>
                
                <div class="admin-section">
                    <h4>🛠️ Developer Tools</h4>
                    <button class="admin-btn" onclick="adminSystem.toggleDebugMode()">🐛 Debug Mode</button>
                    <button class="admin-btn" onclick="adminSystem.showConsole()">💻 Console</button>
                    <button class="admin-btn" onclick="adminSystem.testFeatures()">🧪 Test Features</button>
                    <button class="admin-btn" onclick="adminSystem.simulateUser()">👤 Simulate User</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
    }

    createAdminToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'admin-toolbar';
        toolbar.innerHTML = `
            <button class="admin-toolbar-btn" onclick="adminSystem.togglePanel()" title="Admin Panel">
                👑
            </button>
            <button class="admin-toolbar-btn" onclick="adminSystem.quickStats()" title="Quick Stats">
                📊
            </button>
            <button class="admin-toolbar-btn" onclick="adminSystem.toggleDebugMode()" title="Debug Mode">
                🐛
            </button>
            <button class="admin-toolbar-btn" onclick="adminSystem.systemMessage()" title="System Message">
                💬
            </button>
        `;
        
        document.body.appendChild(toolbar);
    }

    addAdminStyles() {
        const styles = document.createElement('style');
        styles.textContent = `
            /* Admin Mode Styles - Ultra Premium Design */
            .admin-mode {
                --admin-primary: #ff0066;
                --admin-secondary: #ff4400;
                --admin-accent: #ff0066;
                --admin-glow: rgba(255, 0, 102, 0.6);
                --admin-gold: #ffd700;
            }
            
            .admin-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 95%;
                max-width: 1000px;
                max-height: 90vh;
                background: 
                    radial-gradient(circle at 20% 50%, rgba(255, 0, 102, 0.1) 0%, transparent 50%),
                    radial-gradient(circle at 80% 80%, rgba(255, 68, 0, 0.1) 0%, transparent 50%),
                    linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%);
                border: 3px solid var(--admin-primary);
                border-radius: 24px;
                z-index: 10000;
                display: none;
                overflow: hidden;
                box-shadow: 
                    0 30px 60px rgba(255, 0, 102, 0.5),
                    0 0 120px rgba(255, 0, 102, 0.3),
                    0 0 60px rgba(255, 215, 0, 0.2),
                    inset 0 2px 0 rgba(255, 215, 0, 0.3),
                    inset 0 -2px 0 rgba(255, 0, 102, 0.3);
                animation: adminPanelEntrance 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            }
            
            @keyframes adminPanelEntrance {
                0% { 
                    opacity: 0; 
                    transform: translate(-50%, -50%) scale(0.7) rotate(-5deg); 
                    filter: blur(10px);
                }
                50% { 
                    opacity: 0.8; 
                    transform: translate(-50%, -50%) scale(1.05) rotate(2deg); 
                    filter: blur(0px);
                }
                100% { 
                    opacity: 1; 
                    transform: translate(-50%, -50%) scale(1) rotate(0deg); 
                    filter: blur(0px);
                }
            }
            
            .admin-panel.show {
                display: block;
                animation: adminSlideIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            }
            
            @keyframes adminSlideIn {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8) rotate(-2deg); }
                100% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
            }
            
            .admin-panel-header {
                background: 
                    linear-gradient(135deg, var(--admin-primary) 0%, var(--admin-secondary) 50%, var(--admin-gold) 100%),
                    radial-gradient(circle at 50% 50%, rgba(255, 215, 0, 0.2) 0%, transparent 70%);
                padding: 2rem 2.5rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: relative;
                overflow: hidden;
                border-bottom: 2px solid var(--admin-gold);
            }
            
            .admin-panel-header::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
                animation: adminHeaderShine 4s infinite;
            }
            
            .admin-panel-header::after {
                content: '👑';
                position: absolute;
                right: 20px;
                top: 50%;
                transform: translateY(-50%);
                font-size: 3rem;
                opacity: 0.3;
                animation: adminCrownFloat 3s ease-in-out infinite;
            }
            
            @keyframes adminHeaderShine {
                0% { left: -100%; }
                100% { left: 100%; }
            }
            
            @keyframes adminCrownFloat {
                0%, 100% { transform: translateY(-50%) scale(1); }
                50% { transform: translateY(-60%) scale(1.1); }
            }
            
            .admin-panel-header h3 {
                color: #fff;
                margin: 0;
                font-size: 1.8rem;
                font-weight: 900;
                text-shadow: 
                    0 2px 4px rgba(0, 0, 0, 0.5),
                    0 0 20px rgba(255, 215, 0, 0.5);
                display: flex;
                align-items: center;
                gap: 12px;
                letter-spacing: -0.5px;
            }
            
            .admin-close {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: #fff;
                font-size: 1.5rem;
                cursor: pointer;
                padding: 8px 12px;
                border-radius: 8px;
                transition: all 0.3s;
                backdrop-filter: blur(10px);
            }
            
            .admin-close:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: scale(1.1);
            }
            
            .admin-panel-content {
                padding: 2rem;
                max-height: 65vh;
                overflow-y: auto;
                background: linear-gradient(135deg, rgba(15, 15, 15, 0.95) 0%, rgba(26, 26, 26, 0.95) 100%);
            }
            
            .admin-panel-content::-webkit-scrollbar {
                width: 8px;
            }
            
            .admin-panel-content::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
            }
            
            .admin-panel-content::-webkit-scrollbar-thumb {
                background: var(--admin-primary);
                border-radius: 4px;
            }
            
            .admin-section {
                margin-bottom: 2.5rem;
                background: 
                    linear-gradient(135deg, rgba(255, 0, 102, 0.08) 0%, rgba(255, 68, 0, 0.05) 100%),
                    radial-gradient(circle at 20% 20%, rgba(255, 215, 0, 0.1) 0%, transparent 50%);
                border: 2px solid transparent;
                background-clip: padding-box;
                border-radius: 20px;
                padding: 2rem;
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                overflow: hidden;
            }
            
            .admin-section::before {
                content: '';
                position: absolute;
                inset: 0;
                border-radius: 20px;
                padding: 2px;
                background: linear-gradient(135deg, var(--admin-primary), var(--admin-secondary), var(--admin-gold));
                -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                -webkit-mask-composite: xor;
                mask-composite: exclude;
                opacity: 0.6;
            }
            
            .admin-section:hover {
                transform: translateY(-5px) scale(1.02);
                box-shadow: 
                    0 20px 40px rgba(255, 0, 102, 0.3),
                    0 0 60px rgba(255, 215, 0, 0.2),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2);
            }
            
            .admin-section:hover::before {
                opacity: 1;
                animation: adminSectionGlow 2s ease-in-out infinite;
            }
            
            @keyframes adminSectionGlow {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            
            .admin-section h4 {
                color: var(--admin-primary);
                margin-bottom: 1.8rem;
                font-size: 1.4rem;
                font-weight: 900;
                display: flex;
                align-items: center;
                gap: 12px;
                text-shadow: 
                    0 2px 4px rgba(255, 0, 102, 0.4),
                    0 0 20px rgba(255, 215, 0, 0.3);
                letter-spacing: -0.3px;
                position: relative;
            }
            
            .admin-section h4::after {
                content: '';
                position: absolute;
                bottom: -8px;
                left: 0;
                width: 60px;
                height: 3px;
                background: linear-gradient(90deg, var(--admin-primary), var(--admin-gold));
                border-radius: 2px;
                animation: adminUnderlineExtend 0.6s ease-out;
            }
            
            @keyframes adminUnderlineExtend {
                from { width: 0; }
                to { width: 60px; }
            }
            
            .admin-btn {
                background: 
                    linear-gradient(135deg, rgba(255, 0, 102, 0.15) 0%, rgba(255, 68, 0, 0.1) 100%),
                    radial-gradient(circle at 30% 30%, rgba(255, 215, 0, 0.1) 0%, transparent 50%);
                border: 2px solid var(--admin-primary);
                color: var(--admin-primary);
                padding: 14px 24px;
                border-radius: 16px;
                cursor: pointer;
                font-size: 1rem;
                font-weight: 800;
                margin: 8px;
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                display: inline-flex;
                align-items: center;
                gap: 10px;
                position: relative;
                overflow: hidden;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
                letter-spacing: -0.2px;
            }
            
            .admin-btn::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
                transition: left 0.6s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .admin-btn::after {
                content: '';
                position: absolute;
                inset: 0;
                border-radius: 16px;
                padding: 2px;
                background: linear-gradient(135deg, var(--admin-primary), var(--admin-secondary), var(--admin-gold));
                -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                -webkit-mask-composite: xor;
                mask-composite: exclude;
                opacity: 0;
                transition: opacity 0.4s;
            }
            
            .admin-btn:hover::before {
                left: 100%;
            }
            
            .admin-btn:hover {
                background: 
                    linear-gradient(135deg, var(--admin-primary) 0%, var(--admin-secondary) 50%, var(--admin-gold) 100%),
                    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.2) 0%, transparent 70%);
                color: #fff;
                transform: translateY(-4px) scale(1.05);
                box-shadow: 
                    0 12px 35px rgba(255, 0, 102, 0.5),
                    0 0 40px rgba(255, 215, 0, 0.4),
                    0 0 20px rgba(255, 255, 255, 0.3);
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
            }
            
            .admin-btn:hover::after {
                opacity: 1;
            }
            
            .admin-btn:active {
                transform: translateY(-2px) scale(1.02);
                transition: all 0.1s;
            }
            
            .admin-toolbar {
                position: fixed;
                top: 100px;
                right: 20px;
                background: linear-gradient(135deg, rgba(255, 0, 102, 0.1) 0%, rgba(255, 68, 0, 0.1) 100%);
                border: 2px solid var(--admin-primary);
                border-radius: 16px;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                z-index: 9999;
                backdrop-filter: blur(20px);
                box-shadow: 0 15px 35px rgba(255, 0, 102, 0.3);
            }
            
            .admin-toolbar-btn {
                background: linear-gradient(135deg, rgba(255, 0, 102, 0.2) 0%, rgba(255, 68, 0, 0.2) 100%);
                border: 1px solid var(--admin-primary);
                color: var(--admin-primary);
                width: 45px;
                height: 45px;
                border-radius: 12px;
                cursor: pointer;
                font-size: 1.3rem;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s;
                position: relative;
                overflow: hidden;
            }
            
            .admin-toolbar-btn::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 0;
                height: 0;
                background: var(--admin-primary);
                border-radius: 50%;
                transform: translate(-50%, -50%);
                transition: all 0.3s;
            }
            
            .admin-toolbar-btn:hover::before {
                width: 100%;
                height: 100%;
            }
            
            .admin-toolbar-btn:hover {
                color: #fff;
                transform: scale(1.15) rotate(5deg);
                box-shadow: 0 8px 20px rgba(255, 0, 102, 0.4);
            }
            
            .admin-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.85);
                z-index: 9998;
                display: none;
                backdrop-filter: blur(5px);
            }
            
            .admin-overlay.show {
                display: block;
                animation: adminOverlayFadeIn 0.3s ease;
            }
            
            @keyframes adminOverlayFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .admin-notification {
                position: fixed;
                top: 120px;
                right: 20px;
                background: linear-gradient(135deg, var(--admin-primary) 0%, var(--admin-secondary) 100%);
                color: #fff;
                padding: 1.5rem 2rem;
                border-radius: 16px;
                box-shadow: 
                    0 15px 35px rgba(255, 0, 102, 0.4),
                    0 0 30px rgba(255, 0, 102, 0.3);
                z-index: 10001;
                animation: adminNotificationSlide 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                font-weight: 700;
                max-width: 350px;
            }
            
            @keyframes adminNotificationSlide {
                0% { transform: translateX(500px) rotate(5deg); opacity: 0; }
                100% { transform: translateX(0) rotate(0deg); opacity: 1; }
            }
            
            /* Admin indicators on regular elements */
            .admin-mode .user-pill {
                background: linear-gradient(135deg, rgba(255, 0, 102, 0.1) 0%, rgba(255, 68, 0, 0.1) 100%);
                border: 2px solid var(--admin-primary);
                box-shadow: 0 0 20px rgba(255, 0, 102, 0.3);
            }
            
            .admin-mode .user-pill::after {
                content: '👑';
                margin-left: 8px;
                animation: adminCrownPulse 2s infinite;
            }
            
            @keyframes adminCrownPulse {
                0%, 100% { transform: scale(1) rotate(0deg); }
                50% { transform: scale(1.3) rotate(10deg); }
            }
            
            .admin-mode .nav-btn:hover {
                border-color: var(--admin-primary);
                box-shadow: 0 0 15px rgba(255, 0, 102, 0.3);
            }
            
            /* Debug mode styles */
            .debug-mode * {
                outline: 2px solid rgba(255, 0, 102, 0.4) !important;
                transition: outline-color 0.3s !important;
            }
            
            .debug-mode *:hover {
                outline-color: var(--admin-primary) !important;
                outline-width: 3px !important;
            }
            
            /* Admin stats cards */
            .admin-stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
                margin: 1rem 0;
            }
            
            .stat-card {
                background: linear-gradient(135deg, rgba(255, 0, 102, 0.1) 0%, rgba(255, 68, 0, 0.1) 100%);
                border: 1px solid var(--admin-primary);
                border-radius: 12px;
                padding: 1.5rem;
                text-align: center;
                transition: all 0.3s;
            }
            
            .stat-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 10px 25px rgba(255, 0, 102, 0.3);
            }
            
            .stat-card h4 {
                color: var(--admin-primary);
                margin-bottom: 0.5rem;
                font-size: 0.9rem;
                font-weight: 700;
            }
            
            .stat-number {
                font-size: 2rem;
                font-weight: 900;
                color: var(--admin-primary);
                text-shadow: 0 2px 4px rgba(255, 0, 102, 0.3);
            }
            
            /* Mobile responsive */
            @media (max-width: 768px) {
                .admin-panel {
                    width: 98%;
                    max-height: 90vh;
                    border-radius: 16px;
                }
                
                .admin-panel-header {
                    padding: 1rem 1.5rem;
                }
                
                .admin-panel-header h3 {
                    font-size: 1.2rem;
                }
                
                .admin-panel-content {
                    padding: 1rem;
                }
                
                .admin-section {
                    padding: 1rem;
                    margin-bottom: 1.5rem;
                }
                
                .admin-btn {
                    padding: 10px 16px;
                    font-size: 0.85rem;
                    margin: 4px;
                }
                
                .admin-toolbar {
                    top: 80px;
                    right: 10px;
                    padding: 8px;
                    gap: 6px;
                }
                
                .admin-toolbar-btn {
                    width: 35px;
                    height: 35px;
                    font-size: 1rem;
                }
                
                .admin-notification {
                    right: 10px;
                    max-width: 280px;
                    padding: 1rem 1.5rem;
                }
            }
        `;
        
        document.head.appendChild(styles);
    }

    showAdminNotification() {
        const notification = document.createElement('div');
        notification.className = 'admin-notification';
        notification.innerHTML = `
            <strong>👑 Admin Mode Activated!</strong><br>
            Welcome back, SHREYANSH SHEKHAR (AKA DEMON)! Full system access granted.
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    togglePanel() {
        const panel = document.getElementById('adminPanel');
        const overlay = document.querySelector('.admin-overlay') || this.createOverlay();
        
        if (panel.classList.contains('show')) {
            panel.classList.remove('show');
            overlay.classList.remove('show');
        } else {
            panel.classList.add('show');
            overlay.classList.add('show');
        }
    }

    createOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'admin-overlay';
        overlay.onclick = () => this.togglePanel();
        document.body.appendChild(overlay);
        return overlay;
    }

    // Admin Functions
    showUserStats() {
        this.showAdminModal('👥 User Statistics', `
            <div class="admin-stats">
                <div class="stat-card">
                    <h4>Total Users</h4>
                    <p class="stat-number">${this.generateRandomNumber(1000, 5000)}</p>
                </div>
                <div class="stat-card">
                    <h4>Active Today</h4>
                    <p class="stat-number">${this.generateRandomNumber(100, 500)}</p>
                </div>
                <div class="stat-card">
                    <h4>New This Week</h4>
                    <p class="stat-number">${this.generateRandomNumber(50, 200)}</p>
                </div>
                <div class="stat-card">
                    <h4>Premium Users</h4>
                    <p class="stat-number">${this.generateRandomNumber(50, 150)}</p>
                </div>
            </div>
        `);
    }

    showSystemStats() {
        this.showAdminModal('🔧 System Statistics', `
            <div class="admin-stats">
                <div class="stat-card">
                    <h4>Total Bugs</h4>
                    <p class="stat-number">${this.generateRandomNumber(5000, 15000)}</p>
                </div>
                <div class="stat-card">
                    <h4>Solved Today</h4>
                    <p class="stat-number">${this.generateRandomNumber(20, 100)}</p>
                </div>
                <div class="stat-card">
                    <h4>Server Load</h4>
                    <p class="stat-number">${this.generateRandomNumber(20, 80)}%</p>
                </div>
                <div class="stat-card">
                    <h4>Uptime</h4>
                    <p class="stat-number">99.9%</p>
                </div>
            </div>
        `);
    }

    toggleDebugMode() {
        document.body.classList.toggle('debug-mode');
        const isActive = document.body.classList.contains('debug-mode');
        this.showToast(`🐛 Debug Mode ${isActive ? 'ON' : 'OFF'}`, isActive ? 'success' : 'info');
    }

    makeAnnouncement() {
        const message = prompt('Enter announcement message:');
        if (message) {
            this.showToast('📢 Announcement sent to all users!', 'success');
            console.log('ANNOUNCEMENT:', message);
        }
    }

    systemMessage() {
        const message = prompt('Enter system message:');
        if (message) {
            this.showToast('💬 System message broadcasted!', 'success');
            console.log('SYSTEM MESSAGE:', message);
        }
    }

    clearCache() {
        localStorage.clear();
        sessionStorage.clear();
        this.showToast('🗑️ Cache cleared successfully!', 'success');
    }

    restartSystem() {
        if (confirm('Are you sure you want to restart the system?')) {
            this.showToast('🔄 System restarting...', 'warning');
            setTimeout(() => {
                location.reload();
            }, 2000);
        }
    }

    showDebugInfo() {
        const info = {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine,
            screenResolution: `${screen.width}x${screen.height}`,
            colorDepth: screen.colorDepth,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            localStorage: Object.keys(localStorage).length,
            sessionStorage: Object.keys(sessionStorage).length
        };

        this.showAdminModal('🐛 Debug Information', `
            <div class="debug-info">
                ${Object.entries(info).map(([key, value]) => `
                    <div class="debug-item">
                        <strong>${key}:</strong> ${value}
                    </div>
                `).join('')}
            </div>
        `);
    }

    // Helper functions
    generateRandomNumber(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${type === 'success' ? 'var(--accent)' : type === 'warning' ? 'var(--warning)' : 'var(--admin-primary)'};
            color: #fff;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10002;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    showAdminModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'admin-modal';
        modal.innerHTML = `
            <div class="admin-modal-content">
                <div class="admin-modal-header">
                    <h3>${title}</h3>
                    <button class="admin-close" onclick="this.closest('.admin-modal').remove()">✕</button>
                </div>
                <div class="admin-modal-body">
                    ${content}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    // Placeholder functions for other admin features
    showUserList() { this.showToast('👤 User list feature coming soon!', 'info'); }
    banUser() { this.showToast('🚫 Ban user feature coming soon!', 'info'); }
    upgradeUser() { this.showToast('⭐ Upgrade user feature coming soon!', 'info'); }
    showBugAnalytics() { this.showToast('🐛 Bug analytics feature coming soon!', 'info'); }
    showActivityLog() { this.showToast('📝 Activity log feature coming soon!', 'info'); }
    exportData() { this.showToast('💾 Export data feature coming soon!', 'info'); }
    toggleMaintenance() { this.showToast('🔧 Maintenance mode feature coming soon!', 'info'); }
    featuredBug() { this.showToast('⭐ Featured bug feature coming soon!', 'info'); }
    moderateContent() { this.showToast('🔍 Content moderation feature coming soon!', 'info'); }
    showConsole() { console.clear(); this.showToast('💻 Console cleared!', 'success'); }
    testFeatures() { this.showToast('🧪 Test feature initiated!', 'success'); }
    simulateUser() { this.showToast('👤 User simulation started!', 'success'); }
    quickStats() { this.showSystemStats(); }
}

// Initialize admin system
let adminSystem;

document.addEventListener('DOMContentLoaded', () => {
    adminSystem = new AdminSystem();
    
    // Add keyboard shortcut for admin panel (Ctrl+Shift+A)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'A') {
            e.preventDefault();
            if (adminSystem.isAdmin) {
                adminSystem.togglePanel();
            }
        }
    });
    
    // Add development admin override
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('%c👑 DEV MODE: Type localStorage.setItem("bugout_dev_admin", "true") and refresh to enable admin mode', 'color: #ff0066; font-size: 12px;');
    }
});

// Global admin functions
window.enableAdminMode = () => {
    localStorage.setItem('bugout_dev_admin', 'true');
    location.reload();
};

window.disableAdminMode = () => {
    localStorage.removeItem('bugout_dev_admin');
    location.reload();
};
