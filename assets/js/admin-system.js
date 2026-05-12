// Advanced Admin System for BUGOUT
class AdminSystem {
    constructor() {
        this.isAdmin = false;
        this.adminUsers = [
            'shash@mindforgers.com', // Your admin email
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
        
        console.log('%c👑 ADMIN MODE ACTIVATED', 'color: #00ff88; font-size: 20px; font-weight: bold;');
        console.log('%cWelcome, Administrator! You have full system access.', 'color: #00ff88; font-size: 14px;');
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
            /* Admin Mode Styles */
            .admin-mode {
                --admin-primary: #ff0066;
                --admin-secondary: #ffaa00;
                --admin-accent: #ff0066;
            }
            
            .admin-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 90%;
                max-width: 800px;
                max-height: 80vh;
                background: #1a1a1a;
                border: 2px solid var(--admin-primary);
                border-radius: 16px;
                z-index: 10000;
                display: none;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(255, 0, 102, 0.3);
            }
            
            .admin-panel.show {
                display: block;
                animation: adminSlideIn 0.3s ease;
            }
            
            @keyframes adminSlideIn {
                from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
                to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }
            
            .admin-panel-header {
                background: linear-gradient(135deg, var(--admin-primary), var(--admin-secondary));
                padding: 1rem 1.5rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .admin-panel-header h3 {
                color: #fff;
                margin: 0;
                font-size: 1.3rem;
                font-weight: 900;
            }
            
            .admin-close {
                background: none;
                border: none;
                color: #fff;
                font-size: 1.5rem;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: background 0.2s;
            }
            
            .admin-close:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            .admin-panel-content {
                padding: 1.5rem;
                max-height: 60vh;
                overflow-y: auto;
            }
            
            .admin-section {
                margin-bottom: 2rem;
            }
            
            .admin-section h4 {
                color: var(--admin-primary);
                margin-bottom: 1rem;
                font-size: 1.1rem;
                font-weight: 700;
            }
            
            .admin-btn {
                background: rgba(255, 0, 102, 0.1);
                border: 1px solid var(--admin-primary);
                color: var(--admin-primary);
                padding: 10px 16px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 0.9rem;
                font-weight: 600;
                margin: 4px;
                transition: all 0.2s;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }
            
            .admin-btn:hover {
                background: var(--admin-primary);
                color: #fff;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(255, 0, 102, 0.3);
            }
            
            .admin-toolbar {
                position: fixed;
                top: 80px;
                right: 20px;
                background: rgba(255, 0, 102, 0.1);
                border: 1px solid var(--admin-primary);
                border-radius: 12px;
                padding: 8px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                z-index: 9999;
                backdrop-filter: blur(10px);
            }
            
            .admin-toolbar-btn {
                background: rgba(255, 0, 102, 0.2);
                border: 1px solid var(--admin-primary);
                color: var(--admin-primary);
                width: 40px;
                height: 40px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 1.2rem;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }
            
            .admin-toolbar-btn:hover {
                background: var(--admin-primary);
                color: #fff;
                transform: scale(1.1);
            }
            
            .admin-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.8);
                z-index: 9998;
                display: none;
            }
            
            .admin-overlay.show {
                display: block;
            }
            
            .admin-notification {
                position: fixed;
                top: 100px;
                right: 20px;
                background: linear-gradient(135deg, var(--admin-primary), var(--admin-secondary));
                color: #fff;
                padding: 1rem 1.5rem;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(255, 0, 102, 0.3);
                z-index: 10001;
                animation: adminNotificationSlide 0.4s ease;
            }
            
            @keyframes adminNotificationSlide {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            /* Admin indicators on regular elements */
            .admin-mode .user-pill::after {
                content: '👑';
                margin-left: 4px;
            }
            
            .admin-mode .nav-btn:hover {
                border-color: var(--admin-primary);
            }
            
            /* Debug mode styles */
            .debug-mode * {
                outline: 1px solid rgba(255, 0, 102, 0.3) !important;
            }
            
            .debug-mode:hover * {
                outline-color: var(--admin-primary) !important;
            }
        `;
        
        document.head.appendChild(styles);
    }

    showAdminNotification() {
        const notification = document.createElement('div');
        notification.className = 'admin-notification';
        notification.innerHTML = `
            <strong>👑 Admin Mode Activated!</strong><br>
            Welcome back, Administrator. Full system access granted.
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
