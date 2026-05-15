// Epic Loading Screen System for BUGOUT
class LoadingScreen {
    constructor() {
        this.isLoading = false;
        this.minLoadTime = 3000; // Minimum 3 seconds for epic experience
        this.startTime = Date.now();
        this.init();
    }

    init() {
        this.createLoadingScreen();
        this.startAnimations();
        this.scheduleHide();
    }

    createLoadingScreen() {
        const screen = document.createElement('div');
        screen.className = 'loading-screen';
        screen.id = 'loadingScreen';
        
        screen.innerHTML = `
            <div class="loading-bg"></div>
            
            <!-- Particle System -->
            <div class="particles" id="particles"></div>
            
            <!-- Floating Elements -->
            <div class="floating-elements">
                <div class="floating-element">⚔️</div>
                <div class="floating-element">🛠️</div>
                <div class="floating-element">🧠</div>
                <div class="floating-element">🎯</div>
                <div class="floating-element">🚀</div>
            </div>
            
            <!-- Matrix Rain Effect -->
            <div class="matrix-rain" id="matrixRain"></div>
            
            <!-- Main Logo -->
            <div class="loading-logo">
                <div class="loading-logo-icon"></div>
            </div>
            
            <!-- Welcome Text -->
            <div class="loading-text">
                <h1 class="loading-title">Welcome to BUGOUT</h1>
                <p class="loading-subtitle">
                    by <span class="highlight">MindForgers</span><br>
                    Where <span class="highlight">Warriors Help Warriors</span><br>
                    and <span class="highlight">Sharpen Their Blades</span>
                </p>
            </div>
            
            <!-- Loading Progress -->
            <div class="loading-progress">
                <div class="loading-progress-bar" id="progressBar"></div>
            </div>
            
            <!-- Glitch Effect -->
            <div class="loading-glitch" id="glitchEffect"></div>
        `;

        document.body.appendChild(screen);
        this.isLoading = true;
        
        // Create particles
        this.createParticles();
        
        // Create matrix rain
        this.createMatrixRain();
    }

    createParticles() {
        const particlesContainer = document.getElementById('particles');
        const particleCount = 50;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 6 + 's';
            particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
            particlesContainer.appendChild(particle);
        }
    }

    createMatrixRain() {
        const matrixContainer = document.getElementById('matrixRain');
        const columnCount = Math.floor(window.innerWidth / 20);
        
        for (let i = 0; i < columnCount; i++) {
            const column = document.createElement('div');
            column.className = 'matrix-column';
            column.style.left = i * 20 + 'px';
            column.style.animationDuration = (Math.random() * 5 + 5) + 's';
            column.style.animationDelay = Math.random() * 5 + 's';
            
            // Random characters
            const characters = '01BUGOUT';
            let text = '';
            for (let j = 0; j < 20; j++) {
                text += characters[Math.floor(Math.random() * characters.length)];
            }
            column.textContent = text;
            
            matrixContainer.appendChild(column);
        }
    }

    startAnimations() {
        // Trigger random glitch effects
        this.glitchInterval = setInterval(() => {
            if (Math.random() > 0.7) {
                this.triggerGlitch();
            }
        }, 2000);

        // Dynamic particle generation
        this.particleInterval = setInterval(() => {
            if (this.isLoading && Math.random() > 0.5) {
                this.addRandomParticle();
            }
        }, 500);
    }

    triggerGlitch() {
        const glitch = document.getElementById('glitchEffect');
        glitch.style.animation = 'none';
        setTimeout(() => {
            glitch.style.animation = 'glitchEffect 0.3s ease-in-out';
        }, 10);
    }

    addRandomParticle() {
        const particlesContainer = document.getElementById('particles');
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
        particlesContainer.appendChild(particle);
        
        // Remove old particles to prevent memory issues
        if (particlesContainer.children.length > 100) {
            particlesContainer.removeChild(particlesContainer.firstChild);
        }
    }

    scheduleHide() {
        const elapsed = Date.now() - this.startTime;
        const remainingTime = Math.max(0, this.minLoadTime - elapsed);
        
        setTimeout(() => {
            this.hide();
        }, remainingTime);
    }

    hide() {
        const screen = document.getElementById('loadingScreen');
        if (screen) {
            screen.classList.add('hide');
            
            // Clean up intervals
            if (this.glitchInterval) {
                clearInterval(this.glitchInterval);
            }
            if (this.particleInterval) {
                clearInterval(this.particleInterval);
            }
            
            // Remove screen after animation
            setTimeout(() => {
                screen.remove();
                this.isLoading = false;
                
                // Trigger onboarding if needed
                if (window.onboarding && !window.onboarding.userProgress.completed) {
                    setTimeout(() => {
                        window.onboarding.showWelcome();
                    }, 500);
                }
            }, 800);
        }
    }

    // Method to show loading screen manually
    show() {
        if (!this.isLoading) {
            this.startTime = Date.now();
            this.init();
        }
    }

    // Method to force hide
    forceHide() {
        this.minLoadTime = 0;
        this.hide();
    }
}

// Initialize loading screen
let loadingScreen;

document.addEventListener('DOMContentLoaded', () => {
    // Show loading screen immediately
    loadingScreen = new LoadingScreen();
    
    // Hide loading screen when page is fully loaded
    window.addEventListener('load', () => {
        // Loading screen will auto-hide after minimum time
    });
    
    // Emergency hide option
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && loadingScreen && loadingScreen.isLoading) {
            loadingScreen.forceHide();
        }
    });
});

// Global function to manually show/hide loading screen
window.showLoadingScreen = () => {
    if (loadingScreen) {
        loadingScreen.show();
    }
};

window.hideLoadingScreen = () => {
    if (loadingScreen) {
        loadingScreen.forceHide();
    }
};
