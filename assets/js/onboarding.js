// Interactive Onboarding System for BUGOUT
class OnboardingSystem {
    constructor() {
        this.currentStep = 0;
        this.totalSteps = 8;
        this.isOnboarding = false;
        this.userProgress = JSON.parse(localStorage.getItem('bugout_onboarding') || '{}');
        this.init();
    }

    init() {
        // Check if user is new or needs onboarding
        if (!this.userProgress.completed) {
            this.showWelcome();
        }
    }

    showWelcome() {
        const overlay = this.createOverlay();
        const modal = this.createModal();
        
        modal.innerHTML = `
            <div class="welcome-screen">
                <div class="welcome-emoji">🐛</div>
                <h2 class="welcome-title">Welcome to BUGOUT!</h2>
                <p class="welcome-subtitle">
                    Let's get you started with a quick tour of the most powerful bug-solving platform. 
                    I'll show you how to post problems, find solutions, and connect with the community!
                </p>
                <div class="onboarding-actions">
                    <button class="onboarding-btn" onclick="onboarding.startTour()">
                        🚀 Start Tour
                    </button>
                    <button class="onboarding-btn onboarding-btn-secondary" onclick="onboarding.skipTour()">
                        ⏭️ Skip Tour
                    </button>
                </div>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        this.isOnboarding = true;
    }

    createOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'onboarding-overlay show';
        overlay.onclick = (e) => {
            if (e.target === overlay) this.closeOnboarding();
        };
        return overlay;
    }

    createModal() {
        const modal = document.createElement('div');
        modal.className = 'onboarding-modal';
        return modal;
    }

    startTour() {
        this.currentStep = 0;
        this.showStep();
    }

    showStep() {
        const overlay = document.querySelector('.onboarding-overlay');
        const modal = document.querySelector('.onboarding-modal');
        
        if (!overlay || !modal) {
            this.showWelcome();
            return;
        }

        const steps = [
            {
                title: "🏠 Home Base",
                content: `
                    <p>This is your home dashboard where you'll see all the latest bugs and problems from the community.</p>
                    <div class="onboarding-features">
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">📊</div>
                            <div class="onboarding-feature-content">
                                <h4>Live Stats</h4>
                                <p>Track bugs posted, solutions provided, and active warriors in real-time</p>
                            </div>
                        </div>
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">🔍</div>
                            <div class="onboarding-feature-content">
                                <h4>Smart Search</h4>
                                <p>Find exactly what you're looking for with our intelligent search system</p>
                            </div>
                        </div>
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">🏷️</div>
                            <div class="onboarding-feature-content">
                                <h4>Smart Filters</h4>
                                <p>Filter by category, status, or sort by various criteria</p>
                            </div>
                        </div>
                    </div>
                    <div class="onboarding-demo">
                        <p><strong>💡 Pro Tip:</strong> Use the search bar to find specific problems or browse through categories!</p>
                    </div>
                `,
                highlight: '.bugs-grid'
            },
            {
                title: "📝 Post Your First Bug",
                content: `
                    <p>Got a problem? Share it with the community!</p>
                    <div class="onboarding-features">
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">🐛</div>
                            <div class="onboarding-feature-content">
                                <h4>Clear Title</h4>
                                <p>Describe your issue clearly in the title</p>
                            </div>
                        </div>
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">📝</div>
                            <div class="onboarding-feature-content">
                                <h4>Detailed Description</h4>
                                <p>Provide context, error messages, and what you've tried</p>
                            </div>
                        </div>
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">🏷️</div>
                            <div class="onboarding-feature-content">
                                <h4>Right Category</h4>
                                <p>Choose the right category to reach the right experts</p>
                            </div>
                        </div>
                    </div>
                    <div class="onboarding-demo">
                        <p><strong>💡 Pro Tip:</strong> Include code snippets, error messages, and screenshots for better solutions!</p>
                    </div>
                `,
                highlight: '#postBtn'
            },
            {
                title: "🧠 AI Mentor - Your Personal Guide",
                content: `
                    <p>Meet your AI mentor - available 24/7 to help with coding, career, and life problems!</p>
                    <div class="onboarding-features">
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">💬</div>
                            <div class="onboarding-feature-content">
                                <h4>Natural Chat</h4>
                                <p>Talk naturally - ask anything, get instant help</p>
                            </div>
                        </div>
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">🎯</div>
                            <div class="onboarding-feature-content">
                                <h4>Context-Aware</h4>
                                <p>Understands your background and provides personalized advice</p>
                            </div>
                        </div>
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">📚</div>
                            <div class="onboarding-feature-content">
                                <h4>Learning Resources</h4>
                                <p>Gets suggestions based on your conversation history</p>
                            </div>
                        </div>
                    </div>
                    <div class="onboarding-demo">
                        <p><strong>💡 Pro Tip:</strong> Try asking about DSA concepts, resume tips, or debugging help!</p>
                    </div>
                `,
                highlight: '#mentorNavBtn'
            },
            {
                title: "🎓 AI Teacher - Structured Learning",
                content: `
                    <p>Your personal AI teacher for comprehensive learning paths and structured education!</p>
                    <div class="onboarding-features">
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">🗺️</div>
                            <div class="onboarding-feature-content">
                                <h4>Personalized Roadmaps</h4>
                                <p>Get custom learning paths based on your goals</p>
                            </div>
                        </div>
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">📝</div>
                            <div class="onboarding-feature-content">
                                <h4>Interactive Lessons</h4>
                                <p>Learn with examples, practice, and quizzes</p>
                            </div>
                        </div>
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">📊</div>
                            <div class="onboarding-feature-content">
                                <h4>Progress Tracking</h4>
                                <p>Monitor your learning journey and achievements</p>
                            </div>
                        </div>
                    </div>
                    <div class="onboarding-demo">
                        <p><strong>💡 Pro Tip:</strong> Start with a placement test to get personalized recommendations!</p>
                    </div>
                `,
                highlight: '#teacherNavBtn'
            },
            {
                title: "⚔️ Arena - Competitive Coding",
                content: `
                    <p>Challenge yourself and compete with other developers in real-time coding battles!</p>
                    <div class="onboarding-features">
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">⚡</div>
                            <div class="onboarding-feature-content">
                                <h4>Real-time Battles</h4>
                                <p>Solve problems head-to-head with other coders</p>
                            </div>
                        </div>
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">🏆</div>
                            <div class="onboarding-feature-content">
                                <h4>Leaderboards</h4>
                                <p>Climb ranks and earn recognition</p>
                            </div>
                        </div>
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">💰</div>
                            <div class="onboarding-feature-content">
                                <h4>Earn Rewards</h4>
                                <p>Win XP, badges, and unlock new features</p>
                            </div>
                        </div>
                    </div>
                    <div class="onboarding-demo">
                        <p><strong>💡 Pro Tip:</strong> Practice in different difficulty levels to improve your skills!</p>
                    </div>
                `,
                highlight: '#arenaNavBtn'
            },
            {
                title: "🔍 AI Code Analyzer",
                content: `
                    <p>Get instant analysis and suggestions for your code with our AI-powered analyzer!</p>
                    <div class="onboarding-features">
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">🔍</div>
                            <div class="onboarding-feature-content">
                                <h4>Code Review</h4>
                                <p>Get detailed analysis of code quality and issues</p>
                            </div>
                        </div>
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">🐛</div>
                            <div class="onboarding-feature-content">
                                <h4>Bug Detection</h4>
                                <p>Identify potential bugs before they cause problems</p>
                            </div>
                        </div>
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">💡</div>
                            <div class="onboarding-feature-content">
                                <h4>Optimization Tips</h4>
                                <p>Get suggestions for better performance</p>
                            </div>
                        </div>
                    </div>
                    <div class="onboarding-demo">
                        <p><strong>💡 Pro Tip:</strong> Paste your code and get instant feedback on improvements!</p>
                    </div>
                `,
                highlight: '#analyzerNavBtn'
            },
            {
                title: "🤝 Collaboration - Team Work",
                content: `
                    <p>Work together with other developers on projects and problems!</p>
                    <div class="onboarding-features">
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">👥</div>
                            <div class="onboarding-feature-content">
                                <h4>Team Projects</h4>
                                <p>Collaborate on coding projects in real-time</p>
                            </div>
                        </div>
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">💬</div>
                            <div class="onboarding-feature-content">
                                <h4>Shared Workspaces</h4>
                                <p>Create dedicated spaces for your teams</p>
                            </div>
                        </div>
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">📋</div>
                            <div class="onboarding-feature-content">
                                <h4>Task Management</h4>
                                <p>Organize work and track progress together</p>
                            </div>
                        </div>
                    </div>
                    <div class="onboarding-demo">
                        <p><strong>💡 Pro Tip:</strong> Invite team members and start collaborating on shared projects!</p>
                    </div>
                `,
                highlight: '#collabNavBtn'
            },
            {
                title: "🎯 You're All Set!",
                content: `
                    <p>Congratulations! You're now ready to make the most of BUGOUT!</p>
                    <div class="onboarding-features">
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">🐛</div>
                            <div class="onboarding-feature-content">
                                <h4>Post Problems</h4>
                                <p>Share your coding and life challenges</p>
                            </div>
                        </div>
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">💡</div>
                            <div class="onboarding-feature-content">
                                <h4>Solve Issues</h4>
                                <p>Help others and build your reputation</p>
                            </div>
                        </div>
                        <div class="onboarding-feature">
                            <div class="onboarding-feature-icon">🏆</div>
                            <div class="onboarding-feature-content">
                                <h4>Earn Rewards</h4>
                                <p>Get XP, badges, and recognition</p>
                            </div>
                        </div>
                    </div>
                    <div class="onboarding-demo">
                        <p><strong>🎉 Welcome to the community!</strong> Start exploring and happy problem-solving!</p>
                    </div>
                `,
                highlight: null
            }
        ];

        const step = steps[this.currentStep];
        
        modal.innerHTML = `
            <div class="onboarding-header">
                <h2 class="onboarding-title">${step.title}</h2>
                <button class="onboarding-close" onclick="onboarding.closeOnboarding()">✕</button>
            </div>
            <div class="onboarding-content">
                <div class="onboarding-step active">
                    <h3><span class="step-number">${this.currentStep + 1}</span> ${step.title}</h3>
                    ${step.content}
                </div>
            </div>
            <div class="onboarding-progress">
                <div class="onboarding-dots">
                    ${Array.from({length: this.totalSteps}, (_, i) => 
                        `<div class="onboarding-dot ${i === this.currentStep ? 'active' : i < this.currentStep ? 'completed' : ''}"></div>`
                    ).join('')}
                </div>
                <span style="color: var(--text2); font-size: 0.85rem;">
                    Step ${this.currentStep + 1} of ${this.totalSteps}
                </span>
            </div>
            <div class="onboarding-actions">
                <button class="onboarding-skip" onclick="onboarding.skipTour()">Skip Tour</button>
                <div>
                    ${this.currentStep > 0 ? 
                        `<button class="onboarding-btn onboarding-btn-secondary" onclick="onboarding.previousStep()">
                            ← Previous
                        </button>` : ''
                    }
                    <button class="onboarding-btn" onclick="onboarding.nextStep()">
                        ${this.currentStep === this.totalSteps - 1 ? '🎉 Get Started' : 'Next →'}
                    </button>
                </div>
            </div>
        `;

        // Highlight element if specified
        if (step.highlight) {
            this.highlightElement(step.highlight);
        }
    }

    highlightElement(selector) {
        // Remove previous highlights
        document.querySelectorAll('.tour-highlight').forEach(el => {
            el.classList.remove('tour-highlight');
        });

        if (selector) {
            const element = document.querySelector(selector);
            if (element) {
                element.classList.add('tour-highlight');
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    nextStep() {
        if (this.currentStep < this.totalSteps - 1) {
            this.currentStep++;
            this.showStep();
        } else {
            this.completeOnboarding();
        }
    }

    previousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.showStep();
        }
    }

    skipTour() {
        if (confirm('Are you sure you want to skip the tour? You can always access it later from the help menu.')) {
            this.completeOnboarding();
        }
    }

    completeOnboarding() {
        this.userProgress.completed = true;
        this.userProgress.completedAt = new Date().toISOString();
        localStorage.setItem('bugout_onboarding', JSON.stringify(this.userProgress));
        this.closeOnboarding();
        
        // Show success message
        setTimeout(() => {
            this.showNotification('🎉 Welcome to BUGOUT! You\'re all set to start solving problems!');
        }, 300);
    }

    closeOnboarding() {
        const overlay = document.querySelector('.onboarding-overlay');
        if (overlay) {
            overlay.remove();
        }
        
        // Remove highlights
        document.querySelectorAll('.tour-highlight').forEach(el => {
            el.classList.remove('tour-highlight');
        });
        
        this.isOnboarding = false;
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'toast ok';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--card);
            border: 1px solid var(--accent);
            border-radius: 10px;
            padding: 12px 20px;
            font-size: 0.9rem;
            z-index: 9999;
            animation: slideUp 0.3s ease;
            max-width: 300px;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // Method to restart onboarding
    restart() {
        this.userProgress = {};
        localStorage.removeItem('bugout_onboarding');
        this.showWelcome();
    }

    // Method to show help
    showHelp() {
        const helpContent = `
            <h3>🐛 BUGOUT Help Center</h3>
            <div class="onboarding-features">
                <div class="onboarding-feature">
                    <div class="onboarding-feature-icon">🔄</div>
                    <div class="onboarding-feature-content">
                        <h4>Restart Tour</h4>
                        <p>Take the interactive tour again</p>
                    </div>
                </div>
                <div class="onboarding-feature">
                    <div class="onboarding-feature-icon">📚</div>
                    <div class="onboarding-feature-content">
                        <h4>Documentation</h4>
                        <p>Read detailed guides and tutorials</p>
                    </div>
                </div>
                <div class="onboarding-feature">
                    <div class="onboarding-feature-icon">💬</div>
                    <div class="onboarding-feature-content">
                        <h4>Community Support</h4>
                        <p>Get help from experienced users</p>
                    </div>
                </div>
            </div>
        `;

        const overlay = this.createOverlay();
        const modal = this.createModal();
        
        modal.innerHTML = `
            <div class="onboarding-header">
                <h2 class="onboarding-title">Help & Support</h2>
                <button class="onboarding-close" onclick="onboarding.closeOnboarding()">✕</button>
            </div>
            <div class="onboarding-content">
                ${helpContent}
            </div>
            <div class="onboarding-actions">
                <button class="onboarding-btn" onclick="onboarding.restart()">
                    🔄 Restart Tour
                </button>
                <button class="onboarding-btn onboarding-btn-secondary" onclick="onboarding.closeOnboarding()">
                    Close
                </button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }
}

// Initialize onboarding system
let onboarding;

document.addEventListener('DOMContentLoaded', () => {
    onboarding = new OnboardingSystem();
    
    // Add help button to navigation if it doesn't exist
    if (!document.querySelector('#helpBtn')) {
        const helpBtn = document.createElement('button');
        helpBtn.id = 'helpBtn';
        helpBtn.className = 'btn btn-sm btn-ghost';
        helpBtn.innerHTML = '❓ Help';
        helpBtn.onclick = () => onboarding.showHelp();
        helpBtn.style.cssText = 'display: inline-flex;';
        
        const navRight = document.querySelector('.nav-right');
        if (navRight) {
            navRight.appendChild(helpBtn);
        }
    }
});

// Global function for manual tour restart
window.restartOnboarding = () => {
    if (onboarding) {
        onboarding.restart();
    }
};
