const SB_URL = 'https://ufybyvufusswyswoxjra.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmeWJ5dnVmdXNzd3lzd294anJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MDUyOTMsImV4cCI6MjA5MzM4MTI5M30.A-3RT1B5MjSLaX7SpHpyh1IVuYmHzW8Puy8lI3paVA0';
const db = window.supabase.createClient(SB_URL, SB_KEY);
const GROQ_API_URL = '/api/groq';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

async function callGroq(messages, options = {}) {
    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: options.model || GROQ_MODEL,
            messages,
            max_tokens: options.max_tokens || 1000,
            temperature: typeof options.temperature === 'number' ? options.temperature : 0.7,
            ...(options.response_format ? { response_format: options.response_format } : {})
        })
    });
    if (!response.ok) throw new Error(await readGroqError(response));
    return response.json();
}

let me = null, myName = null, myXP = 0, activeBug = null, activeCategory = 'all', bugToDelete = null;
let editSelectedColor = '#00ff88', editSelectedInterests = [], editingBugId = null, editBugTags = [];
let currentProfileId = null, chatPartnerId = null, chatPartnerProfile = null, msgSubscription = null;
let allFollowersList = [], unreadCheckInterval = null, currentTags = [], searchTimeout = null;
let notifCheckInterval = null, notifPanelOpen = false, myBookmarks = new Set(), activeStatusFilter = null, activeSort = 'newest';
let mentorHistory = [];
let teacherProgress = [], currentTeacherLesson = null;
let arenaProblems = [], arenaSubmissions = new Map(), arenaBatchGeneratedAt = null, arenaTimer = null;

const LEVELS = [
    { min: 0,   max: 24,  name: 'Rookie',   emoji: '🌱' },
    { min: 25,  max: 49,  name: 'Warrior',  emoji: '⚔️' },
    { min: 50,  max: 74,  name: 'Knight',   emoji: '🛡️' },
    { min: 75,  max: 99,  name: 'Champion', emoji: '🏆' },
    { min: 100, max: Infinity, name: 'Legend', emoji: '😈' }
];
const BADGE_DEFS = [
    { name: 'First Blood',    icon: '🩸', desc: 'Pehla bug post kiya!',   check: (b,s,x) => b >= 1 },
    { name: 'Problem Solver', icon: '💡', desc: 'Pehla solution diya!',    check: (b,s,x) => s >= 1 },
    { name: 'Bug Hunter',     icon: '🐛', desc: '5 bugs post kiye!',       check: (b,s,x) => b >= 5 },
    { name: 'Solver Pro',     icon: '⚡', desc: '10 solutions diye!',      check: (b,s,x) => s >= 10 },
    { name: 'Warrior',        icon: '⚔️', desc: '25 XP earn kiya!',       check: (b,s,x) => x >= 25 },
    { name: 'Knight',         icon: '🛡️', desc: '50 XP earn kiya!',       check: (b,s,x) => x >= 50 },
    { name: 'Champion',       icon: '🏆', desc: '75 XP earn kiya!',       check: (b,s,x) => x >= 75 },
    { name: 'Legend',         icon: '😈', desc: '100 XP earn kiya!',      check: (b,s,x) => x >= 100 },
    { name: 'Perfect Batch',  icon: '⚔️', desc: 'Arena batch ke 5/5 problems solve kiye!', check: () => false },
];
const AVATAR_COLORS = ['#00ff88','#0077ff','#ff4444','#ff9900','#aa44ff','#ff44aa','#00ccff','#ffcc00'];
const ALL_INTERESTS = ['💻 Coding','🎮 Gaming','🎵 Music','⚽ Football','🏏 Cricket','📚 Studies','🎨 Art','🍕 Food','✈️ Travel','💰 Finance','🎬 Movies','📱 Tech','🦸 Marvel','🏋️ Fitness','🎤 Rap','📷 Photography'];
const TEACHER_ROADMAPS = {
    'JavaScript': ['variables', 'functions', 'arrays', 'objects', 'DOM basics', 'async await', 'fetch API', 'mini project'],
    'Python': ['variables', 'conditions', 'loops', 'lists', 'dictionaries', 'functions', 'file handling', 'mini project'],
    'C': ['variables', 'if else', 'loops', 'arrays', 'strings', 'functions', 'pointers basics', 'mini project'],
    'C++': ['variables', 'loops', 'functions', 'arrays', 'STL vectors', 'classes', 'recursion', 'mini project'],
    'Java': ['variables', 'conditions', 'loops', 'methods', 'classes', 'inheritance', 'collections', 'mini project'],
    'HTML/CSS': ['semantic HTML', 'forms', 'flexbox', 'grid', 'responsive design', 'animations', 'landing page project'],
    'SQL': ['select queries', 'where filters', 'joins', 'group by', 'subqueries', 'indexes basics', 'schema design']
};

function getLevel(xp) { return LEVELS.find(l => xp >= l.min && xp <= l.max) || LEVELS[0]; }
function getLevelNum(xp) { return LEVELS.findIndex(l => xp >= l.min && xp <= l.max) + 1; }
function getXPProgress(xp) { const l = getLevel(xp); if (l.max === Infinity) return 100; return Math.round(((xp - l.min) / (l.max - l.min + 1)) * 100); }
function getXPToNext(xp) { const l = getLevel(xp); return l.max === Infinity ? 0 : l.max - xp + 1; }
function makeAvatar(initial, color, size=80) { return `<div class="profile-avatar" style="background:${color||'#00ff88'};width:${size}px;height:${size}px;font-size:${size*0.4}px;">${initial}</div>`; }
function parseSupabaseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    const s = String(value);
    const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s);
    const iso = s.includes('T') ? s : s.replace(' ', 'T');
    return new Date(hasTimezone ? iso : iso + 'Z');
}
function setRoute(params = {}) {
    const url = new URL(window.location.href);
    ['bug','profile'].forEach(k => url.searchParams.delete(k));
    Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
    history.pushState({}, '', url);
}
function clearRoute() {
    const url = new URL(window.location.href);
    ['bug','profile'].forEach(k => url.searchParams.delete(k));
    history.pushState({}, '', url);
}
async function copyShareLink(type, id) {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set(type, id);
    try {
        await navigator.clipboard.writeText(url.toString());
        toast('Share link copy ho gaya! 🔗', 'ok');
    } catch(e) {
        prompt('Copy this link:', url.toString());
    }
}
async function openInitialRoute() {
    const params = new URLSearchParams(window.location.search);
    const bugId = params.get('bug'), profileId = params.get('profile');
    if (bugId) { await openBug(bugId, true); return true; }
    if (profileId) { await goProfile(profileId, true); return true; }
    return false;
}
function getStatusBadge(status) {
    const map = { 'open':{ cls:'status-open', label:'🔴 Open' }, 'in_progress':{ cls:'status-in_progress', label:'🟡 In Progress' }, 'solved':{ cls:'status-solved', label:'🟢 Solved' } };
    const s = map[status] || map['open'];
    return `<span class="status-badge ${s.cls}">${s.label}</span>`;
}
async function updateBugStatus(bugId, newStatus) {
    try {
        await db.from('bugs').update({ status: newStatus }).eq('id', bugId);
        activeBug.status = newStatus;
        toast(`Status: ${newStatus==='open'?'🔴 Open':newStatus==='in_progress'?'🟡 In Progress':'🟢 Solved'}`, 'ok');
    } catch(err) { toast('Error: ' + err.message, 'err'); }
}

async function readGroqError(response) {
    try {
        const data = await response.json();
        return data.error?.message || `AI request failed (${response.status})`;
    } catch(e) {
        return `AI request failed (${response.status})`;
    }
}

// ═══════════════════════════════════════════════════════════════
//  🧠 AI MENTOR MODE
// ═══════════════════════════════════════════════════════════════
const MENTOR_SYSTEM = `You are BUGOUT AI Mentor — a friendly, knowledgeable mentor for the BUGOUT community (a platform where warriors help each other solve problems).

You help with:
- 💻 Coding (JavaScript, Python, C++, React, Node, etc.)
- 🗺️ DSA (Data Structures & Algorithms) — explain concepts, solve problems step by step
- 🎓 Career advice for CSE students (resume, projects, internships, placements)
- 📚 Study strategies and roadmaps
- 🌱 Life advice and motivation
- 🐛 Debugging help

Your personality:
- Friendly aur encouraging — "warrior" style 😈
- Mix of Hindi/English (Hinglish) allowed when user uses it
- Give concrete, actionable advice
- For code questions: always provide working code examples
- Keep responses clear and well-structured

Context: User is likely a CSE student from India, possibly 1st-2nd year, using BUGOUT platform.`;

async function goMentor() {
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    showPage('mentorPage');
}

async function sendMentorMessage() {
    const input = document.getElementById('mentorInput');
    const msg = input.value.trim();
    if (!msg) return;
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    input.value = '';
    input.style.height = '44px';
    document.getElementById('mentorSendBtn').disabled = true;

    const welcome = document.querySelector('.mentor-welcome');
    if (welcome) welcome.remove();

    appendMentorMessage(msg, true);
    mentorHistory.push({ role: 'user', content: msg });
    const typingId = showMentorTyping();

    try {
        await db.from('mentor_chats').insert({ user_id: me.id, message: msg, is_user: true });

        const messages = [
            { role: 'system', content: MENTOR_SYSTEM },
            ...mentorHistory.slice(-10)
        ];

        const data = await callGroq(messages, { max_tokens: 1000, temperature: 0.75 });
        const aiReply = data.choices?.[0]?.message?.content || 'Kuch error aa gaya — dobara try karo!';

        removeTyping(typingId);
        appendMentorMessage(aiReply, false);
        mentorHistory.push({ role: 'assistant', content: aiReply });

        await db.from('mentor_chats').insert({ user_id: me.id, message: aiReply, is_user: false });

    } catch(err) {
        removeTyping(typingId);
        appendMentorMessage(`😔 Error: ${err.message}. Dobara try karo!`, false);
    }

    document.getElementById('mentorSendBtn').disabled = false;
    document.getElementById('mentorInput').focus();
}

function appendMentorMessage(text, isUser) {
    const container = document.getElementById('mentorMessages');
    const wrap = document.createElement('div');
    wrap.className = `mentor-bubble-wrap ${isUser ? 'user' : 'ai'}`;
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const avatarHTML = isUser
        ? `<div class="mentor-av user-av">${(myName||'U')[0].toUpperCase()}</div>`
        : `<div class="mentor-av ai">🧠</div>`;
    const formattedText = formatMentorText(text);
    wrap.innerHTML = `${avatarHTML}<div><div class="mentor-bubble">${formattedText}</div><div class="mentor-time">${timeStr}</div></div>`;
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
}

function formatMentorText(text) {
    let t = esc(text);
    t = t.replace(/```([^`]*?)```/gs, '<pre><code>$1</code></pre>');
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\n/g, '<br>');
    return t;
}

function showMentorTyping() {
    const container = document.getElementById('mentorMessages');
    const wrap = document.createElement('div');
    const id = 'typing-' + Date.now();
    wrap.id = id;
    wrap.className = 'mentor-bubble-wrap ai';
    wrap.innerHTML = `<div class="mentor-av ai">🧠</div><div class="mentor-typing"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
    return id;
}

function removeTyping(id) { const el = document.getElementById(id); if (el) el.remove(); }
function sendMentorSuggestion(text) { document.getElementById('mentorInput').value = text; sendMentorMessage(); }
function handleMentorKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMentorMessage(); } }
function autoResizeMentorInput(el) { el.style.height = '44px'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }

async function clearMentorChat() {
    mentorHistory = [];
    document.getElementById('mentorMessages').innerHTML = `
        <div class="mentor-welcome">
            <div class="mentor-welcome-icon">🧠</div>
            <h3>BUGOUT AI Mentor</h3>
            <p>Main tera personal AI mentor hoon! Coding doubts, DSA problems, career advice, life decisions — kuch bhi pucho. Main MindForgers community ke context mein help karunga! 💪</p>
            <div class="mentor-suggestions">
                <button class="mentor-suggest-btn" onclick="sendMentorSuggestion('JavaScript mein async/await kaise kaam karta hai?')">🤔 async/await explain karo</button>
                <button class="mentor-suggest-btn" onclick="sendMentorSuggestion('Resume mein projects kaise likhein?')">📄 Resume tips</button>
                <button class="mentor-suggest-btn" onclick="sendMentorSuggestion('DSA ke liye roadmap batao beginner ke liye')">🗺️ DSA Roadmap</button>
                <button class="mentor-suggest-btn" onclick="sendMentorSuggestion('1st year CSE student ko kya karna chahiye?')">🎓 1st year advice</button>
            </div>
        </div>`;
    toast('Chat clear ho gaya! 🗑️', 'ok');
}

async function goTeacher() {
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    showPage('teacherPage');
    updateTeacherTopicChips();
    await loadTeacherProgress();
}

async function loadTeacherProgress() {
    const history = document.getElementById('teacherHistory');
    if (!history || !me) return;
    history.innerHTML = '<div class="teacher-empty">Progress loading...</div>';
    try {
        const { data, error } = await db.from('teacher_progress').select('*').eq('user_id', me.id).order('updated_at', { ascending: false }).limit(20);
        if (error) throw error;
        teacherProgress = data || [];
        renderTeacherProgress();
    } catch(err) {
        history.innerHTML = `<div class="teacher-empty"><strong>Teacher progress table missing.</strong><br>Run supabase-teacher-schema.sql once in Supabase.</div>`;
    }
}

function renderTeacherProgress() {
    const count = document.getElementById('teacherCompletedCount');
    const history = document.getElementById('teacherHistory');
    if (count) count.textContent = teacherProgress.length;
    renderTeacherMetrics();
    if (!history) return;
    if (!teacherProgress.length) {
        history.innerHTML = '<div class="teacher-empty">Abhi koi lesson complete nahi hua.</div>';
        return;
    }
    history.innerHTML = teacherProgress.map(row => `
        <button class="teacher-history-row" onclick="loadTeacherProgressLesson('${row.id}')">
            <span>${esc(row.language)} · ${esc(row.topic)}</span>
            <strong>${row.score || 0}%</strong>
        </button>
    `).join('');
}

function renderTeacherMetrics() {
    const avgEl = document.getElementById('teacherAvgScore');
    const bestEl = document.getElementById('teacherBestLanguage');
    const lastEl = document.getElementById('teacherLastTopic');
    if (!avgEl || !bestEl || !lastEl) return;
    if (!teacherProgress.length) {
        avgEl.textContent = '0%';
        bestEl.textContent = '-';
        lastEl.textContent = '-';
        return;
    }
    const avg = Math.round(teacherProgress.reduce((sum, row) => sum + (row.score || 0), 0) / teacherProgress.length);
    const byLang = {};
    teacherProgress.forEach(row => {
        const key = row.language || 'Unknown';
        byLang[key] = byLang[key] || { total: 0, count: 0 };
        byLang[key].total += row.score || 0;
        byLang[key].count += 1;
    });
    const best = Object.entries(byLang).sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))[0];
    avgEl.textContent = avg + '%';
    bestEl.textContent = best ? best[0] : '-';
    lastEl.textContent = teacherProgress[0]?.topic || '-';
}

function updateTeacherTopicChips() {
    const lang = document.getElementById('teacherLanguage')?.value || 'JavaScript';
    const wrap = document.getElementById('teacherTopicChips');
    if (!wrap) return;
    const topics = TEACHER_ROADMAPS[lang] || TEACHER_ROADMAPS.JavaScript;
    wrap.innerHTML = topics.map(topic => `<button type="button" class="teacher-chip" onclick="applyTeacherTopic('${esc(topic)}')">${esc(topic)}</button>`).join('');
}

function applyTeacherTopic(topic) {
    const input = document.getElementById('teacherTopic');
    if (input) input.value = topic;
}

function decideTeacherTopic(language) {
    const topics = TEACHER_ROADMAPS[language] || TEACHER_ROADMAPS.JavaScript;
    const done = new Set(teacherProgress.filter(row => row.language === language).map(row => String(row.topic || '').toLowerCase()));
    return topics.find(topic => !done.has(topic.toLowerCase())) || topics[0] || 'fundamentals';
}

function buildTeacherRoadmap() {
    const lang = document.getElementById('teacherLanguage')?.value || 'JavaScript';
    const level = document.getElementById('teacherLevel')?.value || 'Beginner';
    const topics = TEACHER_ROADMAPS[lang] || [];
    const output = document.getElementById('teacherLessonOutput');
    if (!output) return;
    output.innerHTML = `
        <div class="teacher-roadmap">
            <div class="teacher-lesson-head">
                <div><span class="teacher-pill">${esc(lang)}</span><span class="teacher-pill">${esc(level)}</span></div>
            </div>
            <h2>${esc(lang)} Roadmap</h2>
            <p class="teacher-goal">Is order mein topics complete karo. Kisi bhi topic pe click karke direct lesson start kar sakte ho.</p>
            <div class="teacher-roadmap-list">
                ${topics.map((topic, i) => `
                    <button class="teacher-roadmap-item" onclick="applyTeacherTopic('${esc(topic)}');startTeacherLesson();">
                        <strong>${i + 1}</strong>
                        <span>${esc(topic)}</span>
                        <em>${teacherProgress.some(row => row.language === lang && row.topic === topic) ? 'Done' : 'Start'}</em>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

function getTeacherSettings() {
    const language = document.getElementById('teacherLanguage')?.value || 'JavaScript';
    return {
        language,
        level: document.getElementById('teacherLevel')?.value || 'Beginner',
        mode: document.getElementById('teacherMode')?.value || 'Ultimate masterclass',
        goal: document.getElementById('teacherGoal')?.value || 'College replacement full coding foundation',
        dailyTime: document.getElementById('teacherDailyTime')?.value || '45 minutes/day',
        intensity: document.getElementById('teacherIntensity')?.value || 'Normal pace',
        topic: (document.getElementById('teacherTopic')?.value.trim() || decideTeacherTopic(language)).slice(0, 80)
    };
}

function continueTeacherPath() {
    const settings = getTeacherSettings();
    const next = currentTeacherLesson?.lesson?.next_lesson || decideTeacherTopic(settings.language);
    applyTeacherTopic(next);
    startTeacherLesson();
}

async function generateCollegePlan() {
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    const settings = getTeacherSettings();
    const output = document.getElementById('teacherLessonOutput');
    output.innerHTML = '<div class="loading"><div class="spinner"></div><p>Full course plan ban raha hai...</p></div>';
    const prompt = `Create a college-replacement coding course plan in Hinglish.
Language: ${settings.language}
Level: ${settings.level}
Goal: ${settings.goal}
Daily time: ${settings.dailyTime}
Intensity: ${settings.intensity}
Student progress: ${teacherProgress.map(row => `${row.language}/${row.topic}/${row.score}%`).slice(0, 12).join(', ') || 'No saved progress'}

Return ONLY strict JSON:
{
  "title": "course name",
  "promise": "what student can do after this",
  "diagnosis": "what to focus on based on progress",
  "phases": [
    {"name":"phase name","duration":"time","outcome":"outcome","topics":["topic1","topic2"],"project":"project","assessment":"assessment"}
  ],
  "weekly_schedule": ["week/day plan items"],
  "rules": ["study rules"],
  "capstone": "final project",
  "grading_rubric": ["how mastery will be judged"],
  "start_topic": "exact topic to start next"
}
Make it practical enough to replace a weak college coding course.`;
    try {
        const data = await callGroq([{ role: 'user', content: prompt }], {
            max_tokens: 3200,
            temperature: 0.35,
            response_format: { type: 'json_object' }
        });
        const plan = extractJSON(data.choices?.[0]?.message?.content || '', null);
        renderCollegePlan(plan, settings);
    } catch(err) {
        output.innerHTML = `<div class="teacher-empty"><h3>Course plan nahi bana</h3><p>${esc(err.message)}</p><button class="btn btn-ghost btn-sm" onclick="generateCollegePlan()">Retry</button></div>`;
    }
}

function renderCollegePlan(plan, settings) {
    const output = document.getElementById('teacherLessonOutput');
    if (!plan || !Array.isArray(plan.phases)) {
        output.innerHTML = `<div class="teacher-empty"><h3>Plan parse nahi hua</h3><p>Retry karo, ya direct Start Lesson dabao.</p></div>`;
        return;
    }
    output.innerHTML = `
        <div class="teacher-lesson-head"><div><span class="teacher-pill">${esc(settings.language)}</span><span class="teacher-pill">${esc(settings.goal)}</span></div></div>
        <h2>${esc(plan.title || settings.language + ' Full Course')}</h2>
        <div class="teacher-decision">${esc(plan.promise || '')}</div>
        <div class="teacher-section"><h3>Diagnosis</h3><div class="teacher-rich-text">${esc(plan.diagnosis || 'Start from fundamentals and build projects.')}</div></div>
        <div class="teacher-section"><h3>Course phases</h3>
            <div class="teacher-course-phases">
                ${plan.phases.map((phase, i) => `
                    <div class="teacher-phase-card">
                        <div class="teacher-phase-num">${i + 1}</div>
                        <div>
                            <h4>${esc(phase.name || 'Phase')}</h4>
                            <p>${esc(phase.duration || '')} · ${esc(phase.outcome || '')}</p>
                            <div class="teacher-concepts">${(phase.topics || []).map(t => `<span>${esc(t)}</span>`).join('')}</div>
                            <div class="teacher-project">${esc(phase.project || '')}</div>
                            <small>${esc(phase.assessment || '')}</small>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        ${renderTeacherListSection('Weekly schedule', plan.weekly_schedule)}
        ${renderTeacherListSection('Study rules', plan.rules)}
        <div class="teacher-section"><h3>Capstone</h3><div class="teacher-project">${esc(plan.capstone || '')}</div></div>
        ${renderTeacherListSection('Mastery grading rubric', plan.grading_rubric)}
        <div class="teacher-action-row teacher-sticky-actions">
            <button class="btn" onclick="applyTeacherTopic('${esc(plan.start_topic || settings.topic)}');startTeacherLesson()">Start: ${esc(plan.start_topic || settings.topic)}</button>
            <button class="btn btn-ghost" onclick="startPlacementTest()">Take Placement Test</button>
        </div>
    `;
}

function renderTeacherHomework(items) {
    if (!Array.isArray(items) || !items.length) return '';

    return `
        <div class="teacher-section">
            <h3>Homework</h3>
            <div class="teacher-practice">
                ${items.map(task => `
                    <div>
                        <strong>${esc(task.title || 'Homework task')}</strong>
                        ${task.difficulty ? `<br><span>${esc(task.difficulty)}</span>` : ''}
                        <p>${esc(task.requirement || task.task || '')}</p>
                        ${task.hint ? `<em>Hint: ${esc(task.hint)}</em>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

async function startPlacementTest() {
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    const settings = getTeacherSettings();
    const output = document.getElementById('teacherLessonOutput');
    output.innerHTML = '<div class="loading"><div class="spinner"></div><p>Placement test ban raha hai...</p></div>';
    const prompt = `Create a diagnostic placement test for ${settings.language} in Hinglish.
Goal: ${settings.goal}
Level selected by student: ${settings.level}
Return ONLY JSON:
{
  "title":"diagnostic test title",
  "instructions":"short instructions",
  "questions":[
    {"question":"...","options":["A","B","C","D"],"answerIndex":0,"skill":"skill name","explanation":"why"}
  ],
  "score_bands":[
    {"min":0,"max":40,"level":"Beginner","advice":"...","start_topic":"..."},
    {"min":41,"max":75,"level":"Intermediate","advice":"...","start_topic":"..."},
    {"min":76,"max":100,"level":"Advanced","advice":"...","start_topic":"..."}
  ]
}
Make 12 questions covering fundamentals, debugging, dry-run, and problem solving.`;
    try {
        const data = await callGroq([{ role: 'user', content: prompt }], {
            max_tokens: 2800,
            temperature: 0.3,
            response_format: { type: 'json_object' }
        });
        const test = extractJSON(data.choices?.[0]?.message?.content || '', null);
        renderPlacementTest(test, settings);
    } catch(err) {
        output.innerHTML = `<div class="teacher-empty"><h3>Placement test nahi bana</h3><p>${esc(err.message)}</p><button class="btn btn-ghost btn-sm" onclick="startPlacementTest()">Retry</button></div>`;
    }
}

function renderPlacementTest(test, settings) {
    const output = document.getElementById('teacherLessonOutput');
    if (!test || !Array.isArray(test.questions)) {
        output.innerHTML = '<div class="teacher-empty"><h3>Test parse nahi hua</h3><p>Retry karo.</p></div>';
        return;
    }
    window._teacherPlacementTest = test;
    output.innerHTML = `
        <div class="teacher-lesson-head"><div><span class="teacher-pill">${esc(settings.language)}</span><span class="teacher-pill">Placement Test</span></div></div>
        <h2>${esc(test.title || 'Placement Test')}</h2>
        <p class="teacher-goal">${esc(test.instructions || 'Answer honestly. Result ke basis pe AI start topic suggest karega.')}</p>
        <div class="teacher-quiz">
            ${test.questions.map((q, qi) => `
                <div class="teacher-question">
                    <div class="teacher-question-title">${qi + 1}. ${esc(q.question || '')}</div>
                    <div class="teacher-skill-tag">${esc(q.skill || 'Concept')}</div>
                    ${(q.options || []).map((opt, oi) => `
                        <label class="teacher-option">
                            <input type="radio" name="placement-q-${qi}" value="${oi}">
                            <span>${esc(opt)}</span>
                        </label>
                    `).join('')}
                    <div class="teacher-answer-note" id="placement-note-${qi}"></div>
                </div>
            `).join('')}
        </div>
        <button class="btn" onclick="submitPlacementTest()">Submit Placement Test</button>
    `;
}

function submitPlacementTest() {
    const test = window._teacherPlacementTest;
    if (!test) return;
    let correct = 0, answered = 0;
    test.questions.forEach((q, i) => {
        const picked = document.querySelector(`input[name="placement-q-${i}"]:checked`);
        const note = document.getElementById(`placement-note-${i}`);
        const value = picked ? Number(picked.value) : -1;
        const ok = value === normalizeTeacherAnswerIndex(q.answerIndex);
        if (picked) answered += 1;
        if (ok) correct += 1;
        if (note) {
            note.className = `teacher-answer-note show ${ok ? 'ok' : 'bad'}`;
            note.textContent = `${ok ? 'Correct' : 'Wrong'} - ${q.explanation || ''}`;
        }
    });
    if (answered < test.questions.length) { toast('Saare diagnostic questions answer karo.', 'err'); return; }
    const score = Math.round((correct / test.questions.length) * 100);
    const band = (test.score_bands || []).find(b => score >= Number(b.min) && score <= Number(b.max)) || {};
    const output = document.getElementById('teacherLessonOutput');
    output.insertAdjacentHTML('beforeend', `
        <div class="teacher-result-card">
            <h3>Result: ${score}% · ${esc(band.level || 'Level detected')}</h3>
            <p>${esc(band.advice || 'Start with fundamentals and keep practicing.')}</p>
            <button class="btn" onclick="applyTeacherTopic('${esc(band.start_topic || decideTeacherTopic(getTeacherSettings().language))}');startTeacherLesson()">Start Recommended Lesson</button>
        </div>
    `);
}

function loadTeacherProgressLesson(id) {
    const row = teacherProgress.find(item => item.id === id);
    if (!row) return;
    currentTeacherLesson = {
        language: row.language,
        level: row.level,
        mode: row.mode || row.lesson_json?.mode || 'Saved lesson',
        topic: row.topic,
        lesson: row.lesson_json,
        quiz: row.quiz_json || [],
        savedScore: row.score || 0
    };
    renderTeacherLesson(true);
}

async function startTeacherLesson() {
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    const language = document.getElementById('teacherLanguage').value;
    const level = document.getElementById('teacherLevel').value;
    const mode = document.getElementById('teacherMode').value;
    const goal = document.getElementById('teacherGoal').value;
    const dailyTime = document.getElementById('teacherDailyTime').value;
    const intensity = document.getElementById('teacherIntensity').value;
    const rawTopic = document.getElementById('teacherTopic').value.trim();
    const topic = (rawTopic || decideTeacherTopic(language)).slice(0, 80);
    document.getElementById('teacherTopic').value = topic;
    const output = document.getElementById('teacherLessonOutput');
    const btn = document.getElementById('teacherStartBtn');
    btn.textContent = 'Teaching...';
    btn.classList.add('btn-disabled');
    output.innerHTML = '<div class="loading"><div class="spinner"></div><p>AI Teacher lesson bana raha hai...</p></div>';
    const prompt = `Create an ULTIMATE programming masterclass for Indian students in friendly Hinglish.
Language: ${language}
Level: ${level}
Mode: ${mode}
Goal: ${goal}
Daily study time: ${dailyTime}
Intensity: ${intensity}
Topic: ${topic}
Student history summary: ${teacherProgress.slice(0, 5).map(row => `${row.language}/${row.topic}/${row.score}%`).join(', ') || 'No saved lessons yet'}

You are not a short-answer chatbot. Act like a patient senior teacher who decides the best learning path and teaches deeply.
Make the lesson self-contained. Assume the student may be weak in basics. Use Hinglish, examples, analogies, code, dry-runs, and correction of misconceptions.
Do not be vague. Teach enough that a student can actually solve problems after reading.

Return ONLY valid JSON with this shape:
{
  "title": "short title",
  "teacher_decision": "why this topic should be learned now and what comes after it",
  "goal": "clear outcome",
  "prerequisites": ["what student should know first, explain briefly"],
  "concept_map": ["6 to 9 key concepts in order"],
  "big_picture": "deep intuition and real-world analogy",
  "mental_model": "how to think about this topic while coding",
  "lecture_notes": ["detailed college-style notes, Hinglish, each item substantial"],
  "syntax_rules": ["important syntax/rules with short explanation"],
  "deep_dive": [
    {"heading":"subtopic name", "explanation":"deep Hinglish explanation", "code":"small code if useful", "dry_run":["step 1","step 2","step 3"]}
  ],
  "example_code": "complete runnable code example",
  "trace_table": ["line-by-line dry run or state changes"],
  "common_mistakes": ["5 common mistakes with fixes"],
  "debugging_lab": [{"bug":"buggy code or situation", "why_wrong":"reason", "fix":"fixed approach"}],
  "real_world_use": ["where this is used in real projects"],
  "practice_tasks": ["5 practice tasks from easy to hard"],
  "homework_set": [{"title":"task title","difficulty":"Easy/Medium/Hard","requirement":"exact requirement","hint":"hint"}],
  "mini_project": "one small project idea using this topic",
  "starter_code": "starter code student can edit",
  "mastery_rubric": ["what student must be able to do to claim mastery"],
  "revision_plan": ["spaced revision steps"],
  "interview_angle": ["interview/exam traps and questions"],
  "next_lesson": "what student should learn next",
  "quiz": [
    {"question":"...", "options":["A","B","C","D"], "answerIndex":0, "explanation":"short Hinglish explanation"}
  ]
}
Rules:
- Make exactly 8 quiz questions.
- deep_dive must have 4 to 7 sections.
- lecture_notes must teach like a strong college professor, not short bullets.
- homework_set must have 6 tasks, including 2 hard tasks.
- mastery_rubric must be strict and measurable.
- dry_run must be concrete, not generic.
- Use ${language} code examples only.
- If topic is too broad, choose the best beginner-to-advanced slice and say that in teacher_decision.
- Keep JSON valid. No markdown outside JSON.`;
    try {
        const data = await callGroq([{ role: 'user', content: prompt }], {
            max_tokens: 5200,
            temperature: 0.45,
            response_format: { type: 'json_object' }
        });
        const rawText = data.choices?.[0]?.message?.content || '';
        let lesson = extractJSON(rawText, null);
        if (!isValidTeacherLesson(lesson)) {
            output.innerHTML = '<div class="loading"><div class="spinner"></div><p>Lesson JSON repair ho raha hai...</p></div>';
            lesson = await repairTeacherLessonJSON(rawText, { language, level, mode, topic });
        }
        if (!isValidTeacherLesson(lesson)) lesson = buildTeacherFallbackLesson({ language, level, mode, topic });
        lesson.mode = mode;
        currentTeacherLesson = {
            language,
            level,
            mode,
            topic,
            lesson,
            quiz: lesson.quiz.slice(0, 8),
            savedScore: null
        };
        renderTeacherLesson(false);
        toast('AI Teacher lesson ready!', 'ok');
    } catch(err) {
        output.innerHTML = `<div class="teacher-empty"><h3>Lesson generate nahi hua</h3><p>${esc(err.message)}</p><button class="btn btn-ghost btn-sm" onclick="startTeacherLesson()">Retry</button></div>`;
    }
    btn.textContent = 'Start Lesson';
    btn.classList.remove('btn-disabled');
}

function isValidTeacherLesson(lesson) {
    if (!lesson || typeof lesson !== 'object') return false;
    const hasTeaching = Array.isArray(lesson.deep_dive) || Array.isArray(lesson.steps) || lesson.big_picture || lesson.example_code;
    const hasQuiz = Array.isArray(lesson.quiz) && lesson.quiz.length >= 3;
    return !!(lesson.title && hasTeaching && hasQuiz);
}

async function repairTeacherLessonJSON(rawText, ctx) {
    if (!rawText) return null;
    const repairPrompt = `Convert the following AI teacher response into STRICT valid JSON only. No markdown.
Use this schema keys: title, teacher_decision, goal, prerequisites, concept_map, big_picture, mental_model, lecture_notes, syntax_rules, deep_dive, example_code, trace_table, common_mistakes, debugging_lab, real_world_use, practice_tasks, homework_set, mini_project, starter_code, mastery_rubric, revision_plan, interview_angle, next_lesson, quiz.
Context: ${ctx.language}, ${ctx.level}, ${ctx.mode}, topic ${ctx.topic}.
If anything is missing, fill it with useful Hinglish teaching content. quiz must have 5 items minimum.

Response to repair:
${rawText.slice(0, 12000)}`;
    try {
        const repaired = await callGroq([{ role: 'user', content: repairPrompt }], {
            max_tokens: 3600,
            temperature: 0.2,
            response_format: { type: 'json_object' }
        });
        return extractJSON(repaired.choices?.[0]?.message?.content || '', null);
    } catch(e) {
        return null;
    }
}

function buildTeacherFallbackLesson({ language, level, mode, topic }) {
    return {
        title: `${language} ${topic} Masterclass`,
        teacher_decision: `${topic} ${language} ka core topic hai. Isko strong karne ke baad next topic roadmap ke according continue karna easy hoga.`,
        goal: `${level} student ko ${topic} ka intuition, syntax, usage, mistakes, aur practice confidence dena.`,
        prerequisites: ['Basic computer logic samajhna', `${language} file kaise run hoti hai ye idea hona`, 'Variables aur simple input/output ka basic idea helpful hoga'],
        concept_map: ['Why this topic matters', 'Core syntax', 'Mental model', 'Dry run', 'Mistakes', 'Practice'],
        big_picture: `${topic} ko ek tool ki tarah socho. Jab problem mein repeated pattern, data handling, ya decision making dikhe, tab is concept ka use solution ko clean banata hai.`,
        mental_model: `Pehle problem ko chhote steps mein todo, phir dekho ${topic} kis step ko simpler banata hai. Code likhne se pehle 2 sample inputs manually dry-run karo.`,
        lecture_notes: [`${topic} ko master karne ke liye intuition, syntax, dry-run aur repeated practice sab zaroori hain. Sirf code dekhne se learning complete nahi hoti; tumhe khud examples bana ke run karne honge.`],
        syntax_rules: ['Syntax ko exact rakho; small typo bhi runtime/logic bug ban sakta hai', 'Har block ka purpose clear rakho', 'Variable names meaningful rakho'],
        deep_dive: [
            { heading: 'Intuition', explanation: `${topic} ka main kaam code ko predictable aur reusable banana hai. Pehle concept ko plain Hindi/Hinglish mein samjho, phir syntax yaad karo.`, code: '', dry_run: ['Problem read karo', 'Input/output identify karo', 'Concept apply karne wali line mark karo'] },
            { heading: 'Syntax', explanation: `${language} mein syntax exact hona chahiye. Brackets, keywords, and naming carefully check karo.`, code: `// ${language} ${topic} starter\n// Apna example yahan likho`, dry_run: ['Line 1 setup', 'Line 2 logic', 'Line 3 output'] },
            { heading: 'Problem solving', explanation: `Jab bhi question mile, pehle examples banao. Fir algorithm likho, fir code.`, code: '', dry_run: ['Example 1 manually solve', 'Pattern notice karo', 'Code mein convert karo'] },
            { heading: 'Debugging', explanation: `Agar answer wrong aaye, variables ki value har step pe print/check karo.`, code: '', dry_run: ['Expected value', 'Actual value', 'Mismatch line'] }
        ],
        example_code: `// ${language} example for ${topic}\n// AI response repair fallback. Generate again for a richer version.`,
        trace_table: ['Input choose karo', 'Har variable ki value step-wise likho', 'Final output compare karo'],
        common_mistakes: ['Concept yaad karke use karna but dry-run na karna', 'Syntax typo ignore karna', 'Edge cases test na karna', 'Variable naming confusing rakhna', 'Output format mismatch'],
        debugging_lab: [{ bug: 'Code works for one example but fails for edge case', why_wrong: 'Logic general nahi hai', fix: 'At least 3 test cases dry-run karo' }],
        real_world_use: ['Interview coding questions', 'Small web/app features', 'Automation scripts', 'Data handling'],
        practice_tasks: ['Ek tiny example khud likho', '2 test cases dry-run karo', 'Ek edge case add karo', 'Code ko function mein convert karo', 'Friend ko concept explain karo'],
        homework_set: [
            { title: 'Core drill', difficulty: 'Easy', requirement: `${topic} ka ek basic example banao.`, hint: 'Small input se start karo.' },
            { title: 'Edge case drill', difficulty: 'Medium', requirement: '3 edge cases ke saath code test karo.', hint: 'Empty, minimum, maximum input socho.' }
        ],
        mini_project: `${topic} use karke ek mini demo banao aur output clearly show karo.`,
        starter_code: `// Practice ${topic} in ${language}\n`,
        mastery_rubric: ['Concept apne words mein explain kar sakta hai', 'Code bina copy-paste likh sakta hai', 'Dry-run table bana sakta hai', 'Edge cases handle kar sakta hai'],
        revision_plan: ['Aaj same topic ka 1 problem solve karo', 'Kal bina notes ke code likho', '3 din baad ek harder variant solve karo'],
        interview_angle: ['Interviewer dry-run pooch sakta hai', 'Edge cases zaroor discuss karo', 'Complexity simple words mein batao'],
        next_lesson: decideTeacherTopic(language),
        quiz: [
            { question: `${topic} seekhne ka best tareeka kya hai?`, options: ['Sirf syntax ratna', 'Dry-run + examples + practice', 'Only copy paste', 'Skip basics'], answerIndex: 1, explanation: 'Concept strong tab hota hai jab dry-run aur practice dono hote hain.' },
            { question: 'Bug milne par pehla step kya hona chahiye?', options: ['Random changes', 'Code delete', 'Expected vs actual compare', 'Ignore'], answerIndex: 2, explanation: 'Expected aur actual compare karne se bug location narrow hoti hai.' },
            { question: 'Edge case kyun important hai?', options: ['Design ke liye', 'Logic general hai ya nahi check karne ke liye', 'Color ke liye', 'Login ke liye'], answerIndex: 1, explanation: 'Edge cases weak logic expose karte hain.' }
        ]
    };
}

function renderTeacherLesson(readOnly) {
    const output = document.getElementById('teacherLessonOutput');
    const item = currentTeacherLesson;
    if (!output || !item) return;
    const lesson = item.lesson || {};
    const quiz = item.quiz || [];
    output.innerHTML = `
        <div class="teacher-lesson-head">
            <div>
                <span class="teacher-pill">${esc(item.language)}</span>
                <span class="teacher-pill">${esc(item.level)}</span>
            </div>
            ${typeof item.savedScore === 'number' ? `<div class="teacher-saved-score">${item.savedScore}% saved</div>` : ''}
        </div>
        <h2>${esc(lesson.title || item.topic)}</h2>
        ${lesson.teacher_decision ? `<div class="teacher-decision">${esc(lesson.teacher_decision)}</div>` : ''}
        <p class="teacher-goal">${esc(lesson.goal || 'Step by step lesson')}</p>
        ${renderTeacherListSection('Prerequisites', lesson.prerequisites)}
        ${Array.isArray(lesson.concept_map) && lesson.concept_map.length ? `
        <div class="teacher-concepts">
            ${lesson.concept_map.map(concept => `<span>${esc(concept)}</span>`).join('')}
        </div>` : ''}
        ${lesson.big_picture ? `<div class="teacher-section"><h3>Big picture</h3><div class="teacher-rich-text">${esc(lesson.big_picture)}</div></div>` : ''}
        ${lesson.mental_model ? `<div class="teacher-section"><h3>Mental model</h3><div class="teacher-rich-text">${esc(lesson.mental_model)}</div></div>` : ''}
        ${renderTeacherListSection('College-style lecture notes', lesson.lecture_notes)}
        ${renderTeacherListSection('Syntax rules', lesson.syntax_rules)}
        <div class="teacher-section">
            <h3>Deep dive</h3>
            ${renderTeacherDeepDive(lesson)}
        </div>
        <div class="teacher-section">
            <h3>Example code</h3>
            <pre class="teacher-code"><code>${esc(lesson.example_code || '// Example not available')}</code></pre>
        </div>
        ${renderTeacherListSection('Dry run / trace table', lesson.trace_table)}
        ${Array.isArray(lesson.common_mistakes) && lesson.common_mistakes.length ? `
        <div class="teacher-section">
            <h3>Common mistakes</h3>
            <div class="teacher-practice">${lesson.common_mistakes.map(item => `<div>${esc(item)}</div>`).join('')}</div>
        </div>` : ''}
        ${renderTeacherDebuggingLab(lesson.debugging_lab)}
        ${renderTeacherListSection('Real-world use', lesson.real_world_use)}
        <div class="teacher-section">
            <h3>Practice</h3>
            <div class="teacher-practice">${(lesson.practice_tasks || []).map(task => `<div>${esc(task)}</div>`).join('')}</div>
        </div>
        ${renderTeacherHomework(lesson.homework_set)}
        <div class="teacher-section">
            <h3>Mini project</h3>
            <div class="teacher-project">${esc(lesson.mini_project || 'Is topic ka use karke ek chhota example khud build karo.')}</div>
        </div>
        ${renderTeacherListSection('Mastery rubric', lesson.mastery_rubric)}
        ${renderTeacherListSection('Revision plan', lesson.revision_plan)}
        ${renderTeacherListSection('Interview and exam angle', lesson.interview_angle)}
        <div class="teacher-section">
            <h3>Practice checker</h3>
            <textarea class="teacher-code-input" id="teacherPracticeCode" spellcheck="false" placeholder="${esc(lesson.starter_code || 'Yahan apna code likho...')}"></textarea>
            <div class="teacher-action-row">
                <button class="btn btn-ghost" onclick="checkTeacherCode()">Check My Code</button>
            </div>
            <div class="teacher-ai-feedback" id="teacherCodeFeedback"></div>
        </div>
        <div class="teacher-section">
            <h3>Ask doubt</h3>
            <div class="teacher-doubt-row">
                <input type="text" id="teacherDoubtInput" placeholder="Is lesson se related doubt pucho...">
                <button class="btn btn-ghost" onclick="askTeacherDoubt()">Ask</button>
            </div>
            <div class="teacher-ai-feedback" id="teacherDoubtOutput"></div>
        </div>
        <div class="teacher-section">
            <h3>Test</h3>
            <div class="teacher-quiz">
                ${quiz.map((q, qi) => `
                    <div class="teacher-question">
                        <div class="teacher-question-title">${qi + 1}. ${esc(q.question || '')}</div>
                        ${(q.options || []).map((opt, oi) => `
                            <label class="teacher-option">
                                <input type="radio" name="teacher-q-${qi}" value="${oi}" ${readOnly ? 'disabled' : ''}>
                                <span>${esc(opt)}</span>
                            </label>
                        `).join('')}
                        <div class="teacher-answer-note" id="teacher-note-${qi}"></div>
                    </div>
                `).join('')}
            </div>
            ${readOnly ? '<button class="btn btn-ghost" onclick="renderTeacherLesson(false)">Retake Test</button>' : '<button class="btn" onclick="submitTeacherQuiz()">Submit Test</button>'}
        </div>
        ${lesson.next_lesson ? `<div class="teacher-next"><strong>Next lesson:</strong> ${esc(lesson.next_lesson)}</div>` : ''}
    `;
}

function renderTeacherListSection(title, items) {
    if (!Array.isArray(items) || !items.length) return '';
    return `<div class="teacher-section"><h3>${esc(title)}</h3><div class="teacher-practice">${items.map(item => `<div>${esc(item)}</div>`).join('')}</div></div>`;
}

function renderTeacherDeepDive(lesson) {
    if (Array.isArray(lesson.deep_dive) && lesson.deep_dive.length) {
        return lesson.deep_dive.map((part, i) => `
            <div class="teacher-deep-card">
                <h4>${i + 1}. ${esc(part.heading || 'Concept')}</h4>
                <p>${esc(part.explanation || '')}</p>
                ${part.code ? `<pre class="teacher-code"><code>${esc(part.code)}</code></pre>` : ''}
                ${Array.isArray(part.dry_run) && part.dry_run.length ? `<div class="teacher-mini-trace">${part.dry_run.map(step => `<span>${esc(step)}</span>`).join('')}</div>` : ''}
            </div>
        `).join('');
    }
    return (lesson.steps || []).map((step, i) => `<div class="teacher-step"><strong>${i + 1}</strong><span>${esc(step)}</span></div>`).join('');
}

function renderTeacherDebuggingLab(items) {
    if (!Array.isArray(items) || !items.length) return '';
    return `<div class="teacher-section"><h3>Debugging lab</h3>${items.map((item, i) => `
        <div class="teacher-debug-card">
            <h4>Bug ${i + 1}</h4>
            <div><strong>Problem:</strong> ${esc(item.bug || '')}</div>
            <div><strong>Why wrong:</strong> ${esc(item.why_wrong || '')}</div>
            <div><strong>Fix:</strong> ${esc(item.fix || '')}</div>
        </div>
    `).join('')}</div>`;
}

function formatTeacherAI(text) {
    return esc(text || '')
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}

async function askTeacherDoubt() {
    if (!currentTeacherLesson) return;
    const input = document.getElementById('teacherDoubtInput');
    const output = document.getElementById('teacherDoubtOutput');
    const doubt = input?.value.trim();
    if (!doubt) { toast('Doubt likho pehle.', 'err'); return; }
    output.classList.add('show');
    output.innerHTML = '<div class="spinner"></div><p>Teacher answer soch raha hai...</p>';
    const lesson = currentTeacherLesson.lesson || {};
    const prompt = `You are BUGOUT AI Teacher. Answer this student doubt in Hinglish, step by step, with one tiny example.
Language: ${currentTeacherLesson.language}
Level: ${currentTeacherLesson.level}
Topic: ${currentTeacherLesson.topic}
Lesson goal: ${lesson.goal || ''}
Student doubt: ${doubt}
Keep it focused and encouraging.`;
    try {
        const data = await callGroq([{ role: 'user', content: prompt }], { max_tokens: 700, temperature: 0.55 });
        output.innerHTML = formatTeacherAI(data.choices?.[0]?.message?.content || 'Answer empty aaya.');
    } catch(err) {
        output.innerHTML = `<span style="color:var(--error);">Doubt answer failed: ${esc(err.message)}</span>`;
    }
}

async function checkTeacherCode() {
    if (!currentTeacherLesson) return;
    const input = document.getElementById('teacherPracticeCode');
    const output = document.getElementById('teacherCodeFeedback');
    const code = input?.value.trim();
    if (!code) { toast('Code likho ya paste karo.', 'err'); return; }
    if (code.length > 9000) { toast('Code thoda chhota karo.', 'err'); return; }
    output.classList.add('show');
    output.innerHTML = '<div class="spinner"></div><p>Code review ho raha hai...</p>';
    const lesson = currentTeacherLesson.lesson || {};
    const prompt = `You are BUGOUT AI Teacher. Review this student practice code in Hinglish.
Language: ${currentTeacherLesson.language}
Topic: ${currentTeacherLesson.topic}
Practice context: ${(lesson.practice_tasks || []).join(' | ')}

Student code:
\`\`\`
${code}
\`\`\`

Return:
1. Correctness score out of 10
2. Bugs or mistakes
3. Improved code if needed
4. One next challenge
Be direct but friendly.`;
    try {
        const data = await callGroq([{ role: 'user', content: prompt }], { max_tokens: 1000, temperature: 0.45 });
        output.innerHTML = formatTeacherAI(data.choices?.[0]?.message?.content || 'Review empty aaya.');
    } catch(err) {
        output.innerHTML = `<span style="color:var(--error);">Code check failed: ${esc(err.message)}</span>`;
    }
}

function normalizeTeacherAnswerIndex(value) {
    if (typeof value === 'number') return value;
    const text = String(value || '').trim().toUpperCase();
    if (/^[A-D]$/.test(text)) return text.charCodeAt(0) - 65;
    const number = Number(text);
    return Number.isFinite(number) ? number : -1;
}

async function submitTeacherQuiz() {
    if (!currentTeacherLesson || !me) return;
    const quiz = currentTeacherLesson.quiz || [];
    if (!quiz.length) { toast('Quiz missing hai.', 'err'); return; }
    let correct = 0, answered = 0;
    quiz.forEach((q, i) => {
        const picked = document.querySelector(`input[name="teacher-q-${i}"]:checked`);
        const note = document.getElementById(`teacher-note-${i}`);
        if (picked) answered += 1;
        const value = picked ? Number(picked.value) : -1;
        const ok = value === normalizeTeacherAnswerIndex(q.answerIndex);
        if (ok) correct += 1;
        if (note) {
            note.className = `teacher-answer-note show ${ok ? 'ok' : 'bad'}`;
            note.textContent = `${ok ? 'Correct' : 'Wrong'} - ${q.explanation || 'Answer review karo.'}`;
        }
    });
    if (answered < quiz.length) { toast('Saare questions answer karo.', 'err'); return; }
    const score = Math.round((correct / quiz.length) * 100);
    const earnedXP = score >= 80 ? 20 : score >= 60 ? 10 : 5;
    const row = {
        user_id: me.id,
        language: currentTeacherLesson.language,
        level: currentTeacherLesson.level,
        mode: currentTeacherLesson.mode || currentTeacherLesson.lesson?.mode || 'Teach me from zero',
        topic: currentTeacherLesson.topic,
        score,
        lesson_json: currentTeacherLesson.lesson,
        quiz_json: quiz,
        updated_at: new Date().toISOString()
    };
    try {
        const { error } = await db.from('teacher_progress').upsert(row, { onConflict: 'user_id,language,topic' });
        if (error) throw error;
        currentTeacherLesson.savedScore = score;
        await addXP(earnedXP);
        toast(`Test saved! Score ${score}% · +${earnedXP} XP`, 'ok');
        await loadTeacherProgress();
    } catch(err) {
        toast('Progress save failed: ' + err.message, 'err');
    }
}

function goAnalyzer() {
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    showPage('analyzerPage');
}
function clearAnalyzer() {
    document.getElementById('codeAnalyzerInput').value = '';
    document.getElementById('codeAnalyzerOutput').innerHTML = `<div class="empty" style="padding:2rem 1rem;"><h3>AI report yahin aayega</h3><p>Explanation, fixed code, and improvement tips.</p></div>`;
}
function formatAnalyzerReport(text) {
    return esc(text)
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}
async function analyzeCode() {
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    const input = document.getElementById('codeAnalyzerInput'), output = document.getElementById('codeAnalyzerOutput'), btn = document.getElementById('analyzeCodeBtn');
    const code = input.value.trim();
    if (!code) { toast('Code paste karo!', 'err'); input.focus(); return; }
    if (code.length > 12000) { toast('Code thoda chhota karo: max 12000 chars', 'err'); return; }
    btn.textContent = 'Analyzing...';
    btn.classList.add('btn-disabled');
    output.innerHTML = `<div class="ai-loading-wrap"><div class="spinner"></div><div class="ai-loading-text">🧠 Code analyze ho raha hai...</div></div>`;
    const prompt = `You are BUGOUT AI Code Analyzer for beginner CSE students.\nAnalyze this code and reply in Hinglish-friendly but professional style.\n\nReturn exactly these sections:\n**Bug Summary**\n**Root Cause**\n**Fixed Code**\n**Why This Works**\n**Extra Improvements**\n\nCode:\n\`\`\`\n${code}\n\`\`\``;
    try {
        const data = await callGroq([{ role: 'user', content: prompt }], { max_tokens: 1200, temperature: 0.45 });
        const report = data.choices?.[0]?.message?.content || 'AI response empty aaya. Retry karo.';
        output.innerHTML = `<div class="ai-box-header"><span>🧪</span><span class="ai-box-title">Code Report</span><span class="ai-box-subtitle">Groq · LLaMA 3</span></div><div class="ai-suggestion-text">${formatAnalyzerReport(report)}</div>`;
        toast('Code report ready! 🧪', 'ok');
    } catch(err) {
        output.innerHTML = `<div class="ai-error-wrap"><p>AI analyzer error</p><p style="font-size:0.78rem;margin-top:4px;opacity:0.75;">${esc(err.message)}</p><button class="btn btn-ghost btn-sm" style="margin-top:10px;" onclick="analyzeCode()">Retry</button></div>`;
    }
    btn.textContent = 'Analyze Code 🧪';
    btn.classList.remove('btn-disabled');
}

// ═══════════════════════════════════════════════════════════════
//  📊 DASHBOARD  ← BUG FIXED HERE
// ═══════════════════════════════════════════════════════════════
function todayKey() { return new Date().toISOString().split('T')[0]; }
async function getTodayProgress() {
    if (!me) return { bugs_posted: 0, solutions_posted: 0, comments_posted: 0, quest_claimed: false };
    const date = todayKey();
    try {
        const { data, error } = await db.from('daily_quests').select('*').eq('user_id', me.id).eq('quest_date', date).maybeSingle();
        if (error) throw error;
        return data || { bugs_posted: 0, solutions_posted: 0, comments_posted: 0, quest_claimed: false, quest_date: date };
    } catch(e) {
        return { bugs_posted: 0, solutions_posted: 0, comments_posted: 0, quest_claimed: false, quest_date: date, missingTable: true };
    }
}
async function updateDailyProgress(type) {
    if (!me) return;
    const date = todayKey();
    const field = type === 'bug' ? 'bugs_posted' : type === 'solution' ? 'solutions_posted' : 'comments_posted';
    try {
        const current = await getTodayProgress();
        const payload = {
            user_id: me.id,
            quest_date: date,
            bugs_posted: current.bugs_posted || 0,
            solutions_posted: current.solutions_posted || 0,
            comments_posted: current.comments_posted || 0,
            quest_claimed: !!current.quest_claimed
        };
        payload[field] = (payload[field] || 0) + 1;
        await db.from('daily_quests').upsert(payload, { onConflict: 'user_id,quest_date' });
        await updateStreak();
    } catch(e) {}
}
async function updateStreak() {
    if (!me) return;
    const today = todayKey();
    try {
        const { data: profile } = await db.from('profiles').select('streak,last_active_date').eq('user_id', me.id).single();
        const last = profile?.last_active_date;
        let nextStreak = profile?.streak || 0;
        if (last !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yKey = yesterday.toISOString().split('T')[0];
            nextStreak = last === yKey ? nextStreak + 1 : 1;
            await db.from('profiles').update({ streak: nextStreak, last_active_date: today }).eq('user_id', me.id);
        }
    } catch(e) {}
}
function renderDailyQuests(progress, streak = 0) {
    const quests = [
        { key: 'bugs_posted', title: 'Post 1 Bug', desc: 'Aaj ek real problem share karo.', target: 1, icon: '🐛' },
        { key: 'solutions_posted', title: 'Give 1 Solution', desc: 'Kisi warrior ki help karo.', target: 1, icon: '💡' },
        { key: 'comments_posted', title: 'Comment Once', desc: 'Discussion ko alive rakho.', target: 1, icon: '💬' }
    ];
    const done = quests.every(q => (progress[q.key] || 0) >= q.target);
    return `<div class="dash-section">
        <div class="dash-section-title">🔥 Daily Quest <span class="streak-pill">🔥 ${streak || 0} day streak</span></div>
        ${progress.missingTable ? `<div class="empty" style="padding:1rem;"><h3>daily_quests table missing</h3><p>Supabase SQL run karne ke baad quests live ho jayenge.</p></div>` : ''}
        <div class="quest-grid">
            ${quests.map(q => {
                const val = Math.min(progress[q.key] || 0, q.target);
                const pct = Math.round((val / q.target) * 100);
                return `<div class="quest-card ${pct >= 100 ? 'done' : ''}">
                    <div class="quest-top"><div class="quest-title">${q.icon} ${q.title}</div><div class="quest-progress">${val}/${q.target}</div></div>
                    <div class="quest-desc">${q.desc}</div>
                    <div class="quest-bar"><div class="quest-fill" style="width:${pct}%"></div></div>
                </div>`;
            }).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:1rem;">
            <span style="color:var(--text2);font-size:0.85rem;">All 3 complete karo aur +15 XP bonus claim karo.</span>
            <button class="btn btn-sm ${done && !progress.quest_claimed && !progress.missingTable ? '' : 'btn-disabled'}" onclick="claimDailyQuest()">Claim +15 XP</button>
        </div>
    </div>`;
}
async function claimDailyQuest() {
    if (!me) return;
    const progress = await getTodayProgress();
    const done = (progress.bugs_posted || 0) >= 1 && (progress.solutions_posted || 0) >= 1 && (progress.comments_posted || 0) >= 1;
    if (!done) { toast('Pehle saare daily quests complete karo!', 'err'); return; }
    if (progress.quest_claimed) { toast('Aaj ka bonus already claimed!', 'err'); return; }
    try {
        await db.from('daily_quests').update({ quest_claimed: true }).eq('user_id', me.id).eq('quest_date', todayKey());
        await addXP(15);
        toast('Daily quest complete! +15 XP 🔥', 'ok');
        loadDashboard();
    } catch(e) { toast('Quest claim failed: ' + e.message, 'err'); }
}
async function goDashboard() {
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    showPage('dashboardPage');
    loadDashboard();
}

async function loadDashboard() {
    const content = document.getElementById('dashboardContent');
    content.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading dashboard...</p></div>';
    try {
        // ✅ FIX 1: loadUserBadges already returns array, isliye { data: badges } nahi — sirf badges
        // ✅ FIX 2: getFollowCounts already returns {followers, following} object — sirf counts
        const [
            { data: profile, error: profileErr },
            { data: bugs },
            { data: solutions },
            badges,
            counts
        ] = await Promise.all([
            db.from('profiles').select('*').eq('user_id', me.id).single(),
            db.from('bugs').select('id,title,created_at,solutions_count,status,category').eq('user_id', me.id).order('created_at', { ascending: true }),
            db.from('solutions').select('id,created_at,is_best_solution,upvotes,bug_id').eq('user_id', me.id).order('created_at', { ascending: true }),
            loadUserBadges(me.id),   // returns [] directly
            getFollowCounts(me.id)   // returns {followers, following} directly
        ]);

        if (profileErr) throw profileErr;

        const xp = profile?.xp || 0;
        const lvl = getLevel(xp);
        const lvlNum = getLevelNum(xp);
        const progress = getXPProgress(xp);
        const toNext = getXPToNext(xp);
        const color = profile?.avatar_color || '#00ff88';

        const bugsArr = bugs || [];
        const solsArr = solutions || [];
        // ✅ FIX 3: badges is already an array — safe to use .length directly
        const badgesArr = Array.isArray(badges) ? badges : [];
        const bestSols = solsArr.filter(s => s.is_best_solution).length;
        const totalUpvotes = solsArr.reduce((sum, s) => sum + (s.upvotes || 0), 0);
        const winRate = solsArr.length > 0 ? Math.round((bestSols / solsArr.length) * 100) : 0;

        const calData = buildCalendarData(bugsArr, solsArr);
        const xpTimeline = buildXPTimeline(bugsArr, solsArr);
        const recentActivity = buildRecentActivity(bugsArr, solsArr);
        const dailyProgress = await getTodayProgress();
        const streak = profile?.streak || 0;

        // ✅ FIX 4: LEVELS[lvlNum] can be undefined at Legend level — safe check with optional chaining
        const nextLevelLabel = lvl.max === Infinity
            ? '😈 MAX LEVEL!'
            : `${toNext} XP to ${LEVELS[lvlNum]?.emoji || ''} ${LEVELS[lvlNum]?.name || 'next level'}`;

        content.innerHTML = `
            <div class="dash-stats-row">
                <div class="dash-stat-card"><div class="dash-stat-icon">🐛</div><div class="dash-stat-num">${bugsArr.length}</div><div class="dash-stat-label">Bugs Posted</div></div>
                <div class="dash-stat-card"><div class="dash-stat-icon">💡</div><div class="dash-stat-num">${solsArr.length}</div><div class="dash-stat-label">Solutions</div></div>
                <div class="dash-stat-card"><div class="dash-stat-icon">✅</div><div class="dash-stat-num">${bestSols}</div><div class="dash-stat-label">Best Solutions</div></div>
                <div class="dash-stat-card"><div class="dash-stat-icon">👍</div><div class="dash-stat-num">${totalUpvotes}</div><div class="dash-stat-label">Total Upvotes</div></div>
            </div>

            ${renderDailyQuests(dailyProgress, streak)}

            <div class="dash-section">
                <div class="dash-section-title">⚡ XP & Level Journey</div>
                <div class="level-journey">
                    ${LEVELS.map((l, i) => {
                        const achieved = xp > l.max;
                        const current = !achieved && xp >= l.min;
                        const connector = i < LEVELS.length - 1
                            ? `<div class="level-connector ${achieved ? 'achieved' : ''}"></div>`
                            : '';
                        return `<div class="level-step">
                            <div class="level-step-dot ${achieved ? 'achieved' : ''} ${current ? 'current' : ''}">${l.emoji}</div>
                            <div class="level-step-name">${l.name}</div>
                            <div class="level-step-xp">${l.min}+ XP</div>
                        </div>${connector}`;
                    }).join('')}
                </div>
                <div class="big-xp-bar">
                    <div class="big-xp-bar-fill" style="width:${progress}%;background:linear-gradient(90deg,${color},#0077ff);"></div>
                </div>
                <div class="big-xp-labels">
                    <span>${xp} XP — ${lvl.emoji} ${lvl.name}</span>
                    <span>${nextLevelLabel}</span>
                </div>
            </div>

            <div class="dash-section">
                <div class="dash-section-title">📈 XP Progress (Last 8 Weeks)</div>
                ${renderXPChart(xpTimeline, color)}
            </div>

            <div class="dash-section">
                <div class="dash-section-title">🗓️ Activity Calendar (Last Year)</div>
                <div class="calendar-grid">${calData.map(d => `<div class="cal-day level-${d.level}" title="${d.date}: ${d.count} activity"></div>`).join('')}</div>
                <div class="cal-legend">Less <div class="cal-legend-squares">${[0,1,2,3,4].map(l => `<div class="cal-legend-sq cal-day level-${l}"></div>`).join('')}</div> More</div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;">
                <div class="dash-section" style="margin-bottom:0;">
                    <div class="dash-section-title">🎯 Solution Win Rate</div>
                    <div class="win-ring-wrap">
                        <div class="win-ring">
                            <svg viewBox="0 0 90 90" width="90" height="90">
                                <circle class="win-ring-bg" cx="45" cy="45" r="36"/>
                                <circle class="win-ring-fill" cx="45" cy="45" r="36" stroke="${color}" stroke-dasharray="${winRate * 2.26} 226"/>
                            </svg>
                            <div class="win-ring-text">
                                <div class="win-ring-pct">${winRate}%</div>
                                <div class="win-ring-label">Win Rate</div>
                            </div>
                        </div>
                        <div class="win-stats-list">
                            <div class="win-stat-row"><span class="win-stat-label">Solutions</span><span class="win-stat-val">${solsArr.length}</span></div>
                            <div class="win-stat-row"><span class="win-stat-label">Best Picks</span><span class="win-stat-val">${bestSols}</span></div>
                            <div class="win-stat-row"><span class="win-stat-label">Upvotes</span><span class="win-stat-val">${totalUpvotes}</span></div>
                        </div>
                    </div>
                </div>
                <div class="dash-section" style="margin-bottom:0;">
                    <div class="dash-section-title">👥 Community</div>
                    <div class="win-stats-list">
                        <div class="win-stat-row"><span class="win-stat-label">👥 Followers</span><span class="win-stat-val">${counts.followers}</span></div>
                        <div class="win-stat-row"><span class="win-stat-label">👣 Following</span><span class="win-stat-val">${counts.following}</span></div>
                        <div class="win-stat-row"><span class="win-stat-label">🏅 Badges</span><span class="win-stat-val">${badgesArr.length}</span></div>
                        <div class="win-stat-row"><span class="win-stat-label">⚡ Total XP</span><span class="win-stat-val">${xp}</span></div>
                    </div>
                </div>
            </div>

            <div class="dash-section">
                <div class="dash-section-title">🏅 Badges Earned (${badgesArr.length})</div>
                ${renderBadges(badgesArr)}
            </div>

            <div class="dash-section">
                <div class="dash-section-title">⚡ Recent Activity</div>
                ${recentActivity.length
                    ? `<div class="activity-list">${recentActivity.slice(0,8).map(a =>
                        `<div class="activity-item" onclick="${a.bugId ? `openBug('${a.bugId}')` : ''}">
                            <div class="activity-icon">${a.icon}</div>
                            <div class="activity-text">${a.text}</div>
                            <div class="activity-time">${timeAgo(a.date)}</div>
                        </div>`).join('')}</div>`
                    : '<p style="color:var(--text2);font-size:0.88rem;">Abhi tak koi activity nahi — kuch karo! 💪</p>'
                }
            </div>`;

    } catch(err) {
        content.innerHTML = `<div class="empty"><h3>Error 😔</h3><p>${esc(err.message)}</p><button class="btn btn-sm" style="margin-top:1rem;" onclick="loadDashboard()">Retry</button></div>`;
    }
}

function buildCalendarData(bugs, solutions) {
    const activityMap = {};
    [...bugs, ...solutions].forEach(item => {
        const key = parseSupabaseDate(item.created_at).toISOString().split('T')[0];
        activityMap[key] = (activityMap[key] || 0) + 1;
    });
    const days = [], now = new Date();
    for (let i = 363; i >= 0; i--) {
        const date = new Date(now); date.setDate(date.getDate() - i);
        const key = date.toISOString().split('T')[0], count = activityMap[key] || 0;
        let level = 0;
        if (count === 1) level = 1; else if (count === 2) level = 2; else if (count <= 4) level = 3; else if (count >= 5) level = 4;
        days.push({ date: key, count, level });
    }
    return days;
}

function buildXPTimeline(bugs, solutions) {
    const weeks = [], now = new Date();
    for (let w = 7; w >= 0; w--) {
        const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - w * 7 - 6);
        const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() - w * 7);
        const label = weekStart.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        const b = bugs.filter(x => parseSupabaseDate(x.created_at) >= weekStart && parseSupabaseDate(x.created_at) <= weekEnd).length;
        const s = solutions.filter(x => parseSupabaseDate(x.created_at) >= weekStart && parseSupabaseDate(x.created_at) <= weekEnd).length;
        weeks.push({ label, xp: b * 10 + s * 5, bugs: b, sols: s });
    }
    return weeks;
}

function renderXPChart(weeks, color) {
    const maxXP = Math.max(...weeks.map(w => w.xp), 10);
    if (weeks.every(w => w.xp === 0)) return '<div class="chart-empty">Abhi tak koi XP activity nahi — bugs post karo! 🐛</div>';
    const W = 800, H = 130, PAD = 30, chartW = W - PAD * 2, chartH = H - PAD;
    const pts = weeks.map((w, i) => ({
        x: PAD + (i / (weeks.length - 1)) * chartW,
        y: PAD + chartH - (w.xp / maxXP) * chartH,
        xp: w.xp, label: w.label
    }));
    const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaD = `M ${pts[0].x} ${H} L ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') + ` L ${pts[pts.length-1].x} ${H} Z`;
    return `<div class="xp-chart-wrap"><svg class="xp-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.3"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
        <path fill="url(#cg)" d="${areaD}"/>
        <path fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" d="${pathD}"/>
        ${pts.map(p => p.xp > 0 ? `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${color}" stroke="var(--bg2)" stroke-width="2"><title>${p.label}: +${p.xp} XP</title></circle>` : '').join('')}
    </svg></div>
    <div style="display:flex;justify-content:space-between;margin-top:4px;">${weeks.map(w => `<span style="font-size:0.6rem;color:var(--text2);text-align:center;flex:1;">${w.label.split(' ')[0]}</span>`).join('')}</div>`;
}

function buildRecentActivity(bugs, solutions) {
    const items = [];
    bugs.forEach(b => items.push({ icon: '🐛', text: `Bug post kiya: <strong>${esc(b.title)}</strong>`, date: b.created_at, bugId: b.id }));
    solutions.forEach(s => items.push({ icon: s.is_best_solution ? '✅' : '💡', text: s.is_best_solution ? 'Best Solution mila! 🎉' : 'Solution diya', date: s.created_at, bugId: s.bug_id }));
    return items.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ═══════════════════════════════════════════════════════════════
//  🤖 AI BUG SOLVER
// ═══════════════════════════════════════════════════════════════
async function getAISolutions() {
    const title = document.getElementById('bugTitle').value.trim();
    const desc  = document.getElementById('bugDesc').value.trim();
    const cat   = document.getElementById('bugCat').value;
    if (!title && !desc) { toast('Pehle title ya description likho!', 'err'); return; }
    const btn = document.getElementById('aiSolveBtn'), box = document.getElementById('aiBox'), content = document.getElementById('aiSuggestionsContent');
    btn.disabled = true; btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;margin:0;border-width:2px;"></div> AI soch raha hai...';
    box.classList.add('show');
    content.innerHTML = `<div class="ai-loading-wrap"><div class="spinner"></div><div class="ai-loading-text">🧠 Analyzing your problem...</div></div>`;
    const problemText = `${title ? 'Problem: ' + title : ''}${desc ? '\n\nDetails: ' + desc : ''}${cat ? '\n\nCategory: ' + cat : ''}`.trim();
    const prompt = `You are an expert problem solver on BUGOUT.\n\nProblem:\n${problemText}\n\nGive exactly 3 practical solutions:\n\nSOLUTION_1:\n[solution]\n\nSOLUTION_2:\n[solution]\n\nSOLUTION_3:\n[solution]\n\nKeep each 2-4 sentences. Be direct.`;
    try {
        const data = await callGroq([{ role: 'user', content: prompt }], { max_tokens: 600, temperature: 0.7 });
        const rawText = data.choices?.[0]?.message?.content || '';
        const solutions = [], parts = rawText.split(/SOLUTION_[123]:/);
        for (let i = 1; i <= 3; i++) { if (parts[i]) solutions.push(parts[i].trim()); }
        if (!solutions.length) rawText.split('\n\n').filter(p => p.trim().length > 20).slice(0, 3).forEach(p => solutions.push(p.trim()));
        if (!solutions.length) throw new Error('Response parse nahi hua');
        const labels = ['💡 Solution 1', '🔥 Solution 2', '⚡ Solution 3'];
        content.innerHTML = solutions.map((sol, i) => `<div class="ai-suggestion-card"><div class="ai-suggestion-label"><span class="ai-sol-badge">🤖 AI</span>${labels[i] || '💡 Solution ' + (i+1)}</div><div class="ai-suggestion-text">${esc(sol)}</div><button class="ai-use-sol-btn" onclick="useAISolution(${i})">↗ Use as my solution</button></div>`).join('');
        window._aiSolutions = solutions; toast('🤖 AI solutions ready!', 'ok');
    } catch(err) {
        content.innerHTML = `<div class="ai-error-wrap"><p>😔 AI solution nahi mila</p><p style="font-size:0.78rem;margin-top:4px;opacity:0.7;">${esc(err.message)}</p><button class="btn btn-ghost btn-sm" style="margin-top:10px;" onclick="getAISolutions()">Retry</button></div>`;
        toast('AI error: ' + err.message, 'err');
    }
    btn.disabled = false; btn.innerHTML = '🤖 Get AI Solutions Again';
}

function useAISolution(index) {
    const sol = (window._aiSolutions || [])[index]; if (!sol) return;
    const el = document.getElementById('solText');
    if (el) { el.value = sol; el.focus(); toast('✅ Solution fill ho gaya!', 'ok'); }
    else navigator.clipboard.writeText(sol).then(() => toast('📋 Copied!', 'ok')).catch(() => toast('Manually copy karo!', 'err'));
}

// ─── INIT ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('authModal').addEventListener('click', e => { if (e.target.id === 'authModal') closeModal(); });
    document.getElementById('confirmDialog').addEventListener('click', e => { if (e.target.id === 'confirmDialog') closeConfirm(); });
    document.getElementById('editModal').addEventListener('click', e => { if (e.target.id === 'editModal') closeEditModal(); });
    document.getElementById('editBugModal').addEventListener('click', e => { if (e.target.id === 'editBugModal') closeEditBugModal(); });
    document.getElementById('newMsgModal').addEventListener('click', e => { if (e.target.id === 'newMsgModal') closeNewMsgModal(); });
    document.addEventListener('click', e => { if (notifPanelOpen && !document.getElementById('notifBellWrap').contains(e.target)) closeNotifPanel(); });
    document.getElementById('colorPicker').innerHTML = AVATAR_COLORS.map(c => `<div class="color-dot ${c === editSelectedColor ? 'selected' : ''}" style="background:${c};" onclick="selectColor('${c}')"></div>`).join('');
    document.getElementById('interestSelector').innerHTML = ALL_INTERESTS.map(i => `<div class="interest-opt" onclick="toggleInterest(this,'${i}')">${i}</div>`).join('');
    try { const { data: { session } } = await db.auth.getSession(); if (session) await setUser(session.user); } catch(e) {}
    db.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) await setUser(session.user);
        if (event === 'SIGNED_OUT') clearUser();
    });
    const routed = await openInitialRoute();
    if (!routed) { showSkeletonBugs(); loadBugs(); }
    loadStats();
    loadTrending();
    if (me) loadDailyChallenge();
});

async function loadStats() {
    try {
        const [{ count: b }, { count: s }, { count: u }] = await Promise.all([
            db.from('bugs').select('*', { count: 'exact', head: true }),
            db.from('solutions').select('*', { count: 'exact', head: true }),
            db.from('profiles').select('*', { count: 'exact', head: true })
        ]);
        animateCounter(document.getElementById('statBugs'), b || 0);
        animateCounter(document.getElementById('statSolutions'), s || 0);
        animateCounter(document.getElementById('statWarriors'), u || 0);
    } catch(e) {}
}

async function loadLeaderboard() {
    const list = document.getElementById('lbList');
    list.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading warriors...</p></div>';
    try {
        const { data, error } = await db.from('profiles').select('username,display_name,xp,user_id,avatar_color').order('xp', { ascending: false }).limit(20);
        if (error) throw error;
        if (!data || !data.length) { list.innerHTML = '<div class="empty"><h3>Koi warrior nahi abhi!</h3></div>'; return; }
        const medals = ['🥇', '🥈', '🥉'];
        list.innerHTML = data.map((u, i) => {
            const medal = medals[i] || `#${i+1}`, topClass = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
            const isMe = me && u.user_id === me.id, lvl = getLevel(u.xp || 0), displayName = u.display_name || u.username || 'Anonymous';
            return `<div class="lb-row ${topClass} ${isMe ? 'lb-me' : ''}" onclick="goProfile('${u.user_id}')"><div class="lb-rank">${medal}</div><div class="lb-name">${esc(displayName)}<span>${lvl.emoji} ${lvl.name}${isMe ? ' · You! 😈' : ''}</span></div><div class="lb-xp">${u.xp || 0} XP</div></div>`;
        }).join('');
    } catch(err) { list.innerHTML = `<div class="empty"><h3>Error 😔</h3><p>${esc(err.message)}</p></div>`; }
}

async function loadMyBookmarks() {
    if (!me) return;
    try { const { data } = await db.from('bookmarks').select('bug_id').eq('user_id', me.id); myBookmarks = new Set((data || []).map(b => b.bug_id)); } catch(e) {}
}

async function toggleBookmark(bugId, e) {
    e.stopPropagation();
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    const btn = document.querySelector(`[data-bookmark="${bugId}"]`), isSaved = myBookmarks.has(bugId);
    try {
        if (isSaved) {
            await db.from('bookmarks').delete().eq('user_id', me.id).eq('bug_id', bugId);
            myBookmarks.delete(bugId);
            if (btn) { btn.textContent = '🔖'; btn.classList.remove('saved'); btn.title = 'Bookmark'; }
            toast('Bookmark hata diya!', 'ok');
        } else {
            await db.from('bookmarks').insert({ user_id: me.id, bug_id: bugId });
            myBookmarks.add(bugId);
            if (btn) { btn.textContent = '🔖'; btn.classList.add('saved'); btn.title = 'Bookmarked!'; }
            toast('Bookmarked! 🔖', 'ok');
            await checkAndAwardBadges();
        }
    } catch(err) { toast('Error: ' + err.message, 'err'); }
}

async function goBookmarks() { if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; } showPage('bookmarksPage'); loadBookmarksPage(); }

async function loadBookmarksPage() {
    const grid = document.getElementById('bookmarksGrid');
    grid.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading...</p></div>';
    try {
        const { data: bookmarks, error } = await db.from('bookmarks').select('bug_id').eq('user_id', me.id).order('created_at', { ascending: false });
        if (error) throw error;
        if (!bookmarks || !bookmarks.length) { grid.innerHTML = '<div class="empty"><h3>Koi bookmark nahi abhi 🔖</h3></div>'; return; }
        const { data: bugs } = await db.from('bugs').select('*').in('id', bookmarks.map(b => b.bug_id));
        if (!bugs || !bugs.length) { grid.innerHTML = '<div class="empty"><h3>Bugs nahi mile 😔</h3></div>'; return; }
        grid.innerHTML = bugs.map(b => renderBugCard(b, null)).join('');
    } catch(err) { grid.innerHTML = `<div class="empty"><h3>Error 😔</h3><p>${esc(err.message)}</p></div>`; }
}

async function checkAndAwardBadges() {
    if (!me) return;
    try {
        const [{ count: bc }, { count: sc }, { data: profile }, { data: eb }] = await Promise.all([
            db.from('bugs').select('*', { count: 'exact', head: true }).eq('user_id', me.id),
            db.from('solutions').select('*', { count: 'exact', head: true }).eq('user_id', me.id),
            db.from('profiles').select('xp').eq('user_id', me.id).single(),
            db.from('user_badges').select('badge_name').eq('user_id', me.id)
        ]);
        const xp = profile?.xp || 0, earned = new Set((eb || []).map(b => b.badge_name));
        for (const badge of BADGE_DEFS) {
            if (!earned.has(badge.name) && badge.check(bc || 0, sc || 0, xp)) {
                await db.from('user_badges').insert({ user_id: me.id, badge_name: badge.name, badge_icon: badge.icon });
                toast(`🏅 Badge mila: ${badge.icon} ${badge.name}!`, 'ok');
                await new Promise(r => setTimeout(r, 500));
            }
        }
    } catch(e) {}
}

async function awardBadgeOnce(name, icon) {
    if (!me) return;
    try {
        const { data: existing } = await db.from('user_badges').select('badge_name').eq('user_id', me.id).eq('badge_name', name).maybeSingle();
        if (existing) return;
        await db.from('user_badges').insert({ user_id: me.id, badge_name: name, badge_icon: icon });
        toast(`Badge mila: ${icon} ${name}!`, 'ok');
    } catch(e) {}
}

async function loadUserBadges(userId) {
    try {
        const { data } = await db.from('user_badges').select('*').eq('user_id', userId).order('earned_at', { ascending: true });
        return data || [];
    } catch(e) { return []; }
}

function renderBadges(badges) {
    const arr = Array.isArray(badges) ? badges : [];
    if (!arr.length) return '<p style="color:var(--text2);font-size:0.85rem;">Koi badge nahi abhi — bugs post karo aur solutions do! 💪</p>';
    return `<div class="badges-wrap">${arr.map(b => {
        const def = BADGE_DEFS.find(d => d.name === b.badge_name) || {};
        return `<div class="badge-item" title="${def.desc || ''}"><span class="badge-icon">${b.badge_icon}</span><div><div class="badge-name">${esc(b.badge_name)}</div>${def.desc ? `<div class="badge-desc">${esc(def.desc)}</div>` : ''}</div></div>`;
    }).join('')}</div>`;
}

async function getFollowCounts(userId) {
    try {
        const [{ count: f1 }, { count: f2 }] = await Promise.all([
            db.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
            db.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId)
        ]);
        return { followers: f1 || 0, following: f2 || 0 };
    } catch(e) { return { followers: 0, following: 0 }; }
}

async function isFollowing(userId) {
    if (!me) return false;
    try { const { data } = await db.from('follows').select('id').eq('follower_id', me.id).eq('following_id', userId).maybeSingle(); return !!data; } catch(e) { return false; }
}

async function toggleFollow(userId, btn) {
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    if (userId === me.id) return;
    btn.classList.add('btn-disabled');
    const following = await isFollowing(userId);
    try {
        if (following) {
            await db.from('follows').delete().eq('follower_id', me.id).eq('following_id', userId);
            btn.textContent = '+ Follow'; btn.classList.add('btn-ghost');
            toast('Unfollow ho gaya!', 'ok');
        } else {
            await db.from('follows').insert({ follower_id: me.id, following_id: userId });
            btn.textContent = '✓ Following'; btn.classList.remove('btn-ghost');
            await createNotification(userId, 'followed', `${myName} ne tumhe follow kiya! 👥`, me.id);
            toast('Follow ho gaya! 👥', 'ok');
        }
        const counts = await getFollowCounts(userId);
        const el = document.getElementById('profile-followers-count'); if (el) el.textContent = counts.followers;
    } catch(err) { toast('Error: ' + err.message, 'err'); }
    btn.classList.remove('btn-disabled');
}

async function showFollowList(userId, type) {
    showPage('followListPage');
    document.getElementById('followListTitle').textContent = type === 'followers' ? '👥 Followers' : '👣 Following';
    const content = document.getElementById('followListContent');
    content.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading...</p></div>';
    try {
        let query = type === 'followers'
            ? db.from('follows').select('follower_id').eq('following_id', userId)
            : db.from('follows').select('following_id').eq('follower_id', userId);
        const { data: follows, error } = await query; if (error) throw error;
        if (!follows || !follows.length) { content.innerHTML = `<div class="empty"><h3>${type === 'followers' ? 'Koi follower nahi!' : 'Koi following nahi!'}</h3></div>`; return; }
        const userIds = follows.map(f => type === 'followers' ? f.follower_id : f.following_id);
        const { data: profiles } = await db.from('profiles').select('user_id,username,display_name,avatar_color,xp').in('user_id', userIds);
        if (!profiles || !profiles.length) { content.innerHTML = '<div class="empty"><h3>Profiles nahi mile 😔</h3></div>'; return; }
        content.innerHTML = profiles.map(p => {
            const displayName = p.display_name || p.username || 'Anonymous', lvl = getLevel(p.xp || 0);
            return `<div class="follow-user-row" onclick="goProfile('${p.user_id}')"><div class="follow-user-avatar" style="background:${p.avatar_color || '#00ff88'};">${displayName[0].toUpperCase()}</div><div class="follow-user-info"><div class="follow-user-name">${esc(displayName)}</div><div class="follow-user-level">${lvl.emoji} ${lvl.name} · ${p.xp || 0} XP</div></div></div>`;
        }).join('');
    } catch(err) { content.innerHTML = `<div class="empty"><h3>Error 😔</h3><p>${esc(err.message)}</p></div>`; }
}

async function goProfile(userId, fromRoute = false) {
    if (!fromRoute) setRoute({ profile: userId });
    currentProfileId = userId; showPage('profilePage');
    const wrap = document.getElementById('profileWrap');
    wrap.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading profile...</p></div>';
    try {
        const [{ data: profile }, { data: bugs }, { data: solutions }, counts, following, badges] = await Promise.all([
            db.from('profiles').select('*').eq('user_id', userId).single(),
            db.from('bugs').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
            db.from('solutions').select('*').eq('user_id', userId),
            getFollowCounts(userId), isFollowing(userId), loadUserBadges(userId)
        ]);
        if (!profile) throw new Error('Profile not found');
        const xp = profile.xp || 0, lvl = getLevel(xp), lvlNum = getLevelNum(xp), progress = getXPProgress(xp), toNext = getXPToNext(xp);
        const bugsPosted = bugs ? bugs.length : 0, solsPosted = solutions ? solutions.length : 0;
        const bestSols = solutions ? solutions.filter(s => s.is_best_solution).length : 0;
        const isMe = me && me.id === userId, displayName = profile.display_name || profile.username || 'Anonymous';
        const color = profile.avatar_color || '#00ff88', interests = profile.interests || [], canMsg = me && !isMe;
        const badgesArr = Array.isArray(badges) ? badges : [];
        wrap.innerHTML = `
            <button class="back-btn" onclick="goHome()">← Back</button>
            <div class="profile-card">
                <div class="profile-top">
                    ${makeAvatar(displayName[0].toUpperCase(), color, 80)}
                    <div class="profile-info">
                        <h2>${esc(displayName)} ${isMe ? '😈' : ''}</h2>
                        <div class="username-tag">@${esc(profile.username || 'anonymous')}</div>
                        ${profile.bio ? `<div class="bio-text">${esc(profile.bio)}</div>` : ''}
                        <div class="level-badge">${lvl.emoji} Level ${lvlNum} — ${lvl.name}</div>
                        <div style="margin-top:8px;"><span class="streak-pill">🔥 ${profile.streak || 0} day streak</span></div>
                        ${interests.length > 0 ? `<div class="interests-wrap">${interests.map(i => `<span class="interest-tag">${esc(i)}</span>`).join('')}</div>` : ''}
                    </div>
                </div>
                <div class="follow-stats">
                    <div class="follow-stat" onclick="showFollowList('${userId}','followers')"><div class="follow-count" id="profile-followers-count">${counts.followers}</div><div class="follow-label">Followers</div></div>
                    <div class="follow-stat" onclick="showFollowList('${userId}','following')"><div class="follow-count">${counts.following}</div><div class="follow-label">Following</div></div>
                </div>
                <div style="display:flex;gap:10px;margin-top:1rem;flex-wrap:wrap;">
                    ${isMe
                        ? `<button class="btn btn-ghost btn-sm" onclick="openEditModal()">✏️ Edit Profile</button><button class="btn btn-ghost btn-sm" onclick="goDashboard()">📊 Dashboard</button><button class="btn btn-ghost btn-sm" onclick="goMentor()">🧠 AI Mentor</button><button class="btn btn-ghost btn-sm" onclick="goTeacher()">AI Teacher</button><button class="btn btn-ghost btn-sm" onclick="goAnalyzer()">🧪 Code Analyzer</button><button class="share-btn" onclick="copyShareLink('profile','${userId}')">🔗 Share</button>`
                        : me
                            ? `<button class="btn ${following ? '' : 'btn-ghost'} btn-sm" id="followBtn" onclick="toggleFollow('${userId}',this)">${following ? '✓ Following' : '+ Follow'}</button>${canMsg ? `<button class="btn btn-ghost btn-sm" onclick="openChat('${userId}')">💬 Message</button>` : ''}`
                            : `<button class="btn btn-ghost btn-sm" onclick="openModal()">Sign In to Follow</button>`
                    }
                </div>
                <div class="xp-bar-wrap">
                    <div class="xp-bar-label"><span>${xp} XP</span><span>${lvl.max === Infinity ? '😈 MAX LEVEL!' : toNext + ' XP to Level ' + (lvlNum + 1)}</span></div>
                    <div class="xp-bar"><div class="xp-bar-fill" style="width:${progress}%;background:linear-gradient(90deg,${color},#0077ff);"></div></div>
                </div>
                <div class="profile-stats">
                    <div class="profile-stat"><div class="profile-stat-num">${bugsPosted}</div><div class="profile-stat-label">🐛 Bugs</div></div>
                    <div class="profile-stat"><div class="profile-stat-num">${solsPosted}</div><div class="profile-stat-label">💡 Solutions</div></div>
                    <div class="profile-stat"><div class="profile-stat-num">${bestSols}</div><div class="profile-stat-label">✅ Best</div></div>
                </div>
                <div style="margin-top:1.5rem;"><h3 style="font-size:0.9rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.75rem;">🏅 Badges</h3>${renderBadges(badgesArr)}</div>
            </div>
            ${bugsPosted > 0 ? `<div class="profile-bugs"><h3>Recent Bugs</h3><div style="display:flex;flex-direction:column;gap:0.75rem;">${bugs.slice(0, 5).map(b => `<div class="bug-card" onclick="openBug('${b.id}')"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span class="bug-tag">${esc(b.category)}</span>${getStatusBadge(b.status || 'open')}</div><h3 style="font-size:1rem;">${esc(b.title)}</h3><div class="bug-footer" style="margin-top:0.5rem;"><span>${timeAgo(b.created_at)}</span><span>💡 ${b.solutions_count || 0} solutions</span></div></div>`).join('')}</div></div>` : ''}`;
    } catch(err) { wrap.innerHTML = `<button class="back-btn" onclick="goHome()">← Back</button><div class="empty"><h3>Profile nahi mila 😔</h3><p>${esc(err.message)}</p></div>`; }
}

function goMyProfile() { if (!me) { openModal(); return; } goProfile(me.id); }

async function openEditModal() {
    try {
        const { data } = await db.from('profiles').select('*').eq('user_id', me.id).single();
        if (data) {
            document.getElementById('editDisplayName').value = data.display_name || '';
            document.getElementById('editBio').value = data.bio || '';
            editSelectedColor = data.avatar_color || '#00ff88';
            editSelectedInterests = data.interests || [];
            document.querySelectorAll('.color-dot').forEach(dot => dot.classList.toggle('selected', dot.getAttribute('onclick').includes(editSelectedColor)));
            document.querySelectorAll('.interest-opt').forEach(opt => opt.classList.toggle('selected', editSelectedInterests.includes(opt.textContent.trim())));
        }
    } catch(e) {}
    document.getElementById('editModal').classList.add('show');
}
function closeEditModal() { document.getElementById('editModal').classList.remove('show'); }
function selectColor(color) { editSelectedColor = color; document.querySelectorAll('.color-dot').forEach(dot => dot.classList.toggle('selected', dot.getAttribute('onclick').includes(color))); }
function toggleInterest(el, interest) {
    const clean = interest.trim();
    if (editSelectedInterests.includes(clean)) { editSelectedInterests = editSelectedInterests.filter(i => i !== clean); el.classList.remove('selected'); }
    else { if (editSelectedInterests.length >= 8) { toast('Max 8 interests!', 'err'); return; } editSelectedInterests.push(clean); el.classList.add('selected'); }
}
async function saveProfile() {
    const displayName = document.getElementById('editDisplayName').value.trim(), bio = document.getElementById('editBio').value.trim();
    const btn = document.getElementById('saveProfileBtn'); btn.textContent = 'Saving...'; btn.classList.add('btn-disabled');
    try {
        const { error } = await db.from('profiles').update({ display_name: displayName || null, bio: bio || null, avatar_color: editSelectedColor, interests: editSelectedInterests }).eq('user_id', me.id);
        if (error) throw error;
        if (displayName) myName = displayName;
        document.getElementById('userName').textContent = getLevel(myXP).emoji + ' ' + (displayName || myName);
        closeEditModal(); toast('Profile update ho gaya! 🎉', 'ok'); goProfile(me.id);
    } catch(err) { toast('Error: ' + err.message, 'err'); }
    btn.textContent = 'Save Profile 💾'; btn.classList.remove('btn-disabled');
}

async function setUser(user) {
    me = user;
    try {
        const { data } = await db.from('profiles').select('username,display_name,xp').eq('user_id', user.id).maybeSingle();
        if (data) { myName = data.display_name || data.username || user.email.split('@')[0]; myXP = data.xp || 0; }
        else { myName = user.email.split('@')[0]; myXP = 0; }
    } catch(e) { myName = user.email.split('@')[0]; myXP = 0; }
    renderUserUI(); startUnreadCheck(); startNotifCheck(); await loadMyBookmarks();
    loadDailyChallenge();
}

function clearUser() {
    me = null; myName = null; myXP = 0; myBookmarks = new Set(); mentorHistory = []; teacherProgress = []; currentTeacherLesson = null;
    if (unreadCheckInterval) { clearInterval(unreadCheckInterval); unreadCheckInterval = null; }
    if (notifCheckInterval) { clearInterval(notifCheckInterval); notifCheckInterval = null; }
    if (msgSubscription) { msgSubscription.unsubscribe(); msgSubscription = null; }
    renderUserUI();
}

function renderUserUI() {
    const on = !!me;
    document.getElementById('authBtn').textContent = on ? 'Sign Out' : 'Sign In';
    document.getElementById('userPill').style.display = on ? 'flex' : 'none';
    document.getElementById('postBtn').style.display = on ? 'inline-flex' : 'none';
    document.getElementById('msgBell').style.display = on ? 'flex' : 'none';
    document.getElementById('bookmarkNavBtn').style.display = on ? 'inline-flex' : 'none';
    document.getElementById('dashboardNavBtn').style.display = on ? 'inline-flex' : 'none';
    document.getElementById('arenaNavBtn').style.display = on ? 'inline-flex' : 'none';
    document.getElementById('mentorNavBtn').style.display = on ? 'inline-flex' : 'none';
    document.getElementById('teacherNavBtn').style.display = on ? 'inline-flex' : 'none';
    document.getElementById('analyzerNavBtn').style.display = on ? 'inline-flex' : 'none';
    document.getElementById('notifBellWrap').classList.toggle('show', on);
    if (on) { const lvl = getLevel(myXP); document.getElementById('userName').textContent = lvl.emoji + ' ' + myName; document.getElementById('userXP').textContent = myXP + ' XP'; }
}

async function addXP(amount) {
    if (!me) return;
    try {
        const oldLvl = getLevelNum(myXP); myXP += amount;
        await db.from('profiles').update({ xp: myXP }).eq('user_id', me.id);
        const newLvl = getLevelNum(myXP), lvl = getLevel(myXP);
        document.getElementById('userXP').textContent = myXP + ' XP';
        document.getElementById('userName').textContent = lvl.emoji + ' ' + myName;
        if (newLvl > oldLvl) showAchievement(lvl.emoji, 'Level Up!', `Tu ab ${lvl.name} hai! Keep going warrior! 😈`);
        await checkAndAwardBadges();
    } catch(e) {}
}

function handleAuth() { if (me) doSignOut(); else openModal(); }
function openModal() { document.getElementById('authModal').classList.add('show'); }
function closeModal() { document.getElementById('authModal').classList.remove('show'); ['loginEmail','loginPass','signupUser','signupEmail','signupPass'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); }
function switchTab(t) { document.getElementById('loginTab').classList.toggle('active', t === 'login'); document.getElementById('signupTab').classList.toggle('active', t === 'signup'); document.getElementById('loginPane').classList.toggle('active', t === 'login'); document.getElementById('signupPane').classList.toggle('active', t === 'signup'); }

async function doLogin() {
    const email = document.getElementById('loginEmail').value.trim(), pass = document.getElementById('loginPass').value;
    if (!email || !pass) { toast('Email aur password bharo!', 'err'); return; }
    const btn = document.getElementById('loginBtn'); btn.textContent = 'Logging in...'; btn.classList.add('btn-disabled');
    try {
        const { data, error } = await db.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        await setUser(data.user); closeModal(); toast('Login ho gaya! 🎉', 'ok'); loadBugs(); loadStats();
    } catch(err) { toast(err.message, 'err'); }
    btn.textContent = 'Login'; btn.classList.remove('btn-disabled');
}

async function doSignup() {
    const username = document.getElementById('signupUser').value.trim(), email = document.getElementById('signupEmail').value.trim(), pass = document.getElementById('signupPass').value;
    if (!username || !email || !pass) { toast('Sab fields bharo!', 'err'); return; }
    if (pass.length < 6) { toast('Password 6+ characters!', 'err'); return; }
    const btn = document.getElementById('signupBtn'); btn.textContent = 'Creating...'; btn.classList.add('btn-disabled');
    try {
        const { data, error } = await db.auth.signUp({ email, password: pass });
        if (error) throw error;
        if (data.user) { await db.from('profiles').insert({ user_id: data.user.id, username, xp: 0, streak: 0, avatar_color: '#00ff88' }); await setUser(data.user); }
        closeModal(); toast('Account ban gaya! 🎉', 'ok'); loadBugs(); loadStats();
    } catch(err) { toast(err.message, 'err'); }
    btn.textContent = 'Create Account'; btn.classList.remove('btn-disabled');
}

async function doSignOut() { await db.auth.signOut(); clearUser(); toast('Sign out ho gaya 👋', 'ok'); goHome(); }

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);
    if (id !== 'chatPage' && msgSubscription) { msgSubscription.unsubscribe(); msgSubscription = null; }
    closeNotifPanel();
}
function goHome() { clearRoute(); showPage('homePage'); clearSearch(); activeStatusFilter = null; loadBugs(); loadStats(); }
function goPost() {
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    resetTagInput();
    document.getElementById('aiBox').classList.remove('show');
    document.getElementById('aiSolveBtn').disabled = false;
    document.getElementById('aiSolveBtn').innerHTML = '🤖 Get AI Solutions First (Optional)';
    window._aiSolutions = [];
    showPage('postPage');
}
async function goArena() {
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    showPage('arenaPage');
    await loadArena();
}
function extractJSON(text, fallback) {
    if (!text) return fallback;
    try { return JSON.parse(text); } catch(e) {}
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) { try { return JSON.parse(fenced[1]); } catch(e) {} }
    const start = text.indexOf(Array.isArray(fallback) ? '[' : '{');
    const end = text.lastIndexOf(Array.isArray(fallback) ? ']' : '}');
    if (start >= 0 && end > start) { try { return JSON.parse(text.slice(start, end + 1)); } catch(e) {} }
    return fallback;
}
async function loadArena() {
    const list = document.getElementById('arenaList');
    list.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading arena...</p></div>';
    try {
        const { data: latest, error } = await db.from('coding_problems').select('*').order('generated_at', { ascending: false }).limit(1);
        if (error) throw error;
        const latestRow = latest && latest[0];
        const latestDate = latestRow ? parseSupabaseDate(latestRow.generated_at) : null;
        if (!latestRow || !latestDate || Date.now() - latestDate.getTime() >= 3600000) {
            await generateArenaBatch();
        } else {
            await loadArenaBatch(latestRow.batch_id);
        }
        await loadArenaLeaderboard();
    } catch(err) {
        list.innerHTML = `<div class="arena-empty"><h3>Arena load nahi hua</h3><p>${esc(err.message)}<br>Check karo coding_problems aur problem_submissions tables Supabase mein ready hain.</p></div>`;
    }
}

function getArenaXP(problem) {
    const difficulty = String(problem?.difficulty || '').toLowerCase();
    if (difficulty.includes('hard')) return 40;
    if (difficulty.includes('medium')) return 25;
    return 15;
}
async function generateArenaBatch() {
    const list = document.getElementById('arenaList');
    list.innerHTML = '<div class="loading"><div class="spinner"></div><p>AI naya 5-problem batch bana raha hai...</p></div>';
    const prompt = `Create exactly 5 fresh coding challenge problems for a student coding arena. Return ONLY valid JSON array. Each item must have: problem, difficulty, example_input, example_output. Mix Easy, Medium, Hard. Problems must be self-contained, concise, and solvable in any language. Do not include solutions.`;
    const data = await callGroq([{ role: 'user', content: prompt }], { max_tokens: 1600, temperature: 0.85 });
    const problems = extractJSON(data.choices?.[0]?.message?.content || '', []);
    if (!Array.isArray(problems) || problems.length < 5) throw new Error('AI se valid 5 problems nahi mile.');
    const batchId = 'arena-' + Date.now();
    const rows = problems.slice(0, 5).map((p, index) => {
        const problemText = String(p.problem || p.description || '').trim();
        const title = String(p.title || problemText.split('\n')[0] || `Arena Problem ${index + 1}`).trim();
        return {
            batch_id: batchId,
            problem_number: index + 1,
            title: title.slice(0, 140),
            description: problemText,
            difficulty: String(p.difficulty || 'Easy').trim(),
            example_input: String(p.example_input || '').trim(),
            example_output: String(p.example_output || '').trim(),
            generated_at: new Date().toISOString()
        };
    }).filter(p => p.description);
    if (rows.length !== 5) throw new Error('AI problems incomplete aaye.');
    const { error } = await db.from('coding_problems').insert(rows);
    if (error) throw error;
    await loadArenaBatch(batchId);
}
async function loadArenaBatch(batchId) {
    const { data, error } = await db.from('coding_problems').select('*').eq('batch_id', batchId).order('generated_at', { ascending: true }).limit(5);
    if (error) throw error;
    arenaProblems = data || [];
    arenaBatchGeneratedAt = arenaProblems[0] ? parseSupabaseDate(arenaProblems[0].generated_at) : null;
    await loadArenaSubmissions();
    renderArena();
    startArenaCountdown();
}
async function loadArenaSubmissions() {
    arenaSubmissions = new Map();
    if (!me || !arenaProblems.length) return;
    const ids = arenaProblems.map(p => p.id);
    const { data } = await db.from('problem_submissions').select('problem_id,is_correct,xp_awarded,created_at').eq('user_id', me.id).in('problem_id', ids).eq('is_correct', true);
    (data || []).forEach(s => arenaSubmissions.set(s.problem_id, s));
}
function renderArena() {
    const list = document.getElementById('arenaList');
    const solved = arenaProblems.filter(p => arenaSubmissions.has(p.id)).length;
    const earnedXP = arenaProblems.reduce((sum, p) => sum + (arenaSubmissions.has(p.id) ? (arenaSubmissions.get(p.id)?.xp_awarded || getArenaXP(p)) : 0), 0);
    const availableXP = arenaProblems.reduce((sum, p) => sum + (arenaSubmissions.has(p.id) ? 0 : getArenaXP(p)), 0);
    const progress = arenaProblems.length ? Math.round((solved / arenaProblems.length) * 100) : 0;
    document.getElementById('arenaProblemCount').textContent = arenaProblems.length;
    document.getElementById('arenaSolvedCount').textContent = solved;
    document.getElementById('arenaPossibleXP').textContent = availableXP;
    document.getElementById('arenaProgressText').textContent = `${solved}/${arenaProblems.length || 5} solved`;
    document.getElementById('arenaProgressXP').textContent = `${earnedXP} XP earned`;
    document.getElementById('arenaProgressFill').style.width = progress + '%';
    if (!arenaProblems.length) { list.innerHTML = '<div class="arena-empty"><h3>Koi problem nahi mila</h3><p>Refresh karke try karo.</p></div>'; return; }
    list.innerHTML = arenaProblems.map((p, index) => {
        const done = arenaSubmissions.has(p.id);
        const xp = getArenaXP(p);
        return `<div class="arena-card ${done ? 'solved' : ''}" id="arena-card-${p.id}">
            <div class="arena-card-top">
                <div class="arena-title">${p.problem_number || index + 1}. ${esc(p.title || 'Arena Problem')}</div>
                <div class="arena-badges">
                    <span class="arena-badge">${esc(p.difficulty || 'Easy')}</span>
                    <span class="arena-badge">+${xp} XP</span>
                    ${done ? '<span class="arena-badge done">Solved</span>' : ''}
                </div>
            </div>
            <p style="color:var(--text2);font-size:0.9rem;line-height:1.6;margin-top:0.6rem;">${esc(p.description || '')}</p>
            <div class="arena-example">
                <div class="arena-example-box"><label>Example Input</label><pre>${esc(p.example_input || 'No input')}</pre></div>
                <div class="arena-example-box"><label>Example Output</label><pre>${esc(p.example_output || 'No output')}</pre></div>
            </div>
            <textarea class="arena-code" id="arenaCode-${p.id}" spellcheck="false" ${done ? 'disabled' : ''} placeholder="Apna solution code yahan paste karo..."></textarea>
            <div class="arena-actions">
                <button class="btn btn-sm" id="arenaBtn-${p.id}" onclick="submitArenaSolution('${p.id}')" ${done ? 'disabled' : ''}>${done ? 'Solved' : 'Submit Solution'}</button>
                <button class="btn btn-sm btn-ghost" onclick="getArenaHint('${p.id}')" ${done ? 'disabled' : ''}>Hint</button>
                <button class="btn btn-sm btn-ghost" onclick="document.getElementById('arenaCode-${p.id}').value=''">Clear</button>
            </div>
            <div class="arena-feedback" id="arenaFeedback-${p.id}"></div>
        </div>`;
    }).join('');
}
function startArenaCountdown() {
    if (arenaTimer) clearInterval(arenaTimer);
    const tick = () => {
        const el = document.getElementById('arenaCountdown');
        if (!el || !arenaBatchGeneratedAt) return;
        const remaining = Math.max(0, 3600000 - (Date.now() - arenaBatchGeneratedAt.getTime()));
        if (remaining <= 0) { el.textContent = 'Ready on refresh'; return; }
        const m = Math.floor(remaining / 60000), s = Math.floor((remaining % 60000) / 1000);
        el.textContent = `${m}m ${String(s).padStart(2, '0')}s`;
    };
    tick();
    arenaTimer = setInterval(tick, 1000);
}

async function getArenaHint(problemId) {
    const problem = arenaProblems.find(p => String(p.id) === String(problemId));
    const feedback = document.getElementById(`arenaFeedback-${problemId}`);
    if (!problem || !feedback) return;
    feedback.classList.add('show');
    feedback.textContent = 'Hint generate ho raha hai...';
    try {
        const prompt = `Give one short helpful hint for this coding problem. Do not reveal the full solution or code.\n\nTitle: ${problem.title || ''}\nProblem: ${problem.description || ''}\nExample input: ${problem.example_input || 'None'}\nExample output: ${problem.example_output || 'None'}`;
        const data = await callGroq([{ role: 'user', content: prompt }], { max_tokens: 180, temperature: 0.45 });
        const hint = data.choices?.[0]?.message?.content || 'Think about edge cases and the simplest data structure.';
        feedback.innerHTML = `<span style="color:var(--accent);font-weight:800;">Hint:</span> ${esc(hint)}`;
    } catch(err) {
        feedback.innerHTML = `<span style="color:var(--error);font-weight:800;">Hint error:</span> ${esc(err.message)}`;
    }
}

async function loadArenaLeaderboard() {
    const box = document.getElementById('arenaLeaderboard');
    if (!box) return;
    box.innerHTML = '<div class="arena-empty">Leaderboard loading...</div>';
    try {
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const { data: submissions, error } = await db.from('problem_submissions').select('user_id,xp_awarded,created_at').eq('is_correct', true).gte('created_at', weekAgo).order('created_at', { ascending: false }).limit(250);
        if (error) throw error;
        if (!submissions || !submissions.length) { box.innerHTML = '<div class="arena-empty">Abhi koi Arena solve nahi hua.</div>'; return; }
        const totals = new Map();
        submissions.forEach(s => {
            if (!s.user_id) return;
            const row = totals.get(s.user_id) || { xp: 0, solves: 0, last: s.created_at };
            row.xp += s.xp_awarded || 0;
            row.solves += 1;
            if (parseSupabaseDate(s.created_at) > parseSupabaseDate(row.last)) row.last = s.created_at;
            totals.set(s.user_id, row);
        });
        const ranked = [...totals.entries()].sort((a,b) => b[1].xp - a[1].xp || parseSupabaseDate(b[1].last) - parseSupabaseDate(a[1].last)).slice(0, 10);
        const ids = ranked.map(([id]) => id);
        const { data: profiles } = await db.from('profiles').select('user_id,username,display_name,xp').in('user_id', ids);
        const profileMap = {}; (profiles || []).forEach(p => profileMap[p.user_id] = p);
        box.innerHTML = ranked.map(([userId, row], index) => {
            const p = profileMap[userId] || {};
            const name = p.display_name || p.username || 'Arena Warrior';
            const lvl = getLevel(p.xp || 0);
            return `<div class="arena-board-row" onclick="goProfile('${userId}')">
                <div class="arena-board-rank">#${index + 1}</div>
                <div>
                    <div class="arena-board-name">${esc(name)}</div>
                    <div class="arena-board-meta">${lvl.emoji} ${lvl.name} · ${row.solves} solves · ${timeAgo(row.last)}</div>
                </div>
                <div class="arena-board-xp">${row.xp} XP</div>
            </div>`;
        }).join('');
    } catch(err) {
        box.innerHTML = `<div class="arena-empty">Leaderboard load nahi hua: ${esc(err.message)}</div>`;
    }
}

async function submitArenaSolution(problemId) {
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    if (arenaSubmissions.has(problemId)) { toast('Is problem ka XP already mil chuka hai!', 'ok'); return; }
    const problem = arenaProblems.find(p => String(p.id) === String(problemId));
    const input = document.getElementById(`arenaCode-${problemId}`);
    const btn = document.getElementById(`arenaBtn-${problemId}`);
    const feedback = document.getElementById(`arenaFeedback-${problemId}`);
    const solution = input.value.trim();
    if (!solution) { toast('Solution code paste karo pehle!', 'err'); return; }
    btn.textContent = 'Judging...'; btn.classList.add('btn-disabled');
    feedback.classList.add('show'); feedback.textContent = 'AI judge solution check kar raha hai...';
    try {
        const { data: existing } = await db.from('problem_submissions').select('id,xp_awarded').eq('user_id', me.id).eq('problem_id', problemId).eq('is_correct', true).maybeSingle();
        if (existing) {
            arenaSubmissions.set(problemId, { problem_id: problemId, is_correct: true, xp_awarded: existing.xp_awarded || getArenaXP(problem) });
            toast('Is problem ka XP already mil chuka hai!', 'ok');
            renderArena();
            return;
        }
        const prompt = `You are a strict coding judge. Decide if the submitted solution correctly solves the problem for all reasonable edge cases. Return ONLY JSON like {"is_correct":true,"feedback":"short feedback"}.\n\nProblem:\n${problem.title || ''}\n${problem.description || ''}\n\nExample input:\n${problem.example_input || 'None'}\n\nExample output:\n${problem.example_output || 'None'}\n\nSubmitted solution:\n${solution}`;
        const data = await callGroq([{ role: 'user', content: prompt }], { max_tokens: 500, temperature: 0.15 });
        const verdict = extractJSON(data.choices?.[0]?.message?.content || '', {});
        const isCorrect = verdict.is_correct === true || verdict.correct === true;
        const xp = isCorrect ? getArenaXP(problem) : 0;
        await db.from('problem_submissions').insert({ user_id: me.id, problem_id: problemId, solution_code: solution, is_correct: isCorrect, xp_awarded: xp });
        if (isCorrect) {
            arenaSubmissions.set(problemId, { problem_id: problemId, is_correct: true, xp_awarded: xp });
            await addXP(xp);
            feedback.innerHTML = `<span style="color:var(--accent);font-weight:800;">Correct!</span> ${esc(verdict.feedback || `Great solve. +${xp} XP awarded.`)}`;
            toast(`Arena problem solved! +${xp} XP`, 'ok');
            const solvedCount = arenaProblems.filter(p => arenaSubmissions.has(p.id)).length;
            if (solvedCount === arenaProblems.length) await awardBadgeOnce('Perfect Batch', '⚔️');
            renderArena();
            loadArenaLeaderboard();
        } else {
            feedback.innerHTML = `<span style="color:var(--error);font-weight:800;">Not accepted.</span> ${esc(verdict.feedback || 'Logic incomplete lag raha hai. Edge cases check karo.')}`;
            toast('AI judge ne reject kiya. Improve karke retry karo.', 'err');
        }
    } catch(err) {
        feedback.innerHTML = `<span style="color:var(--error);font-weight:800;">Error:</span> ${esc(err.message)}`;
        toast('Arena submit fail hua', 'err');
    }
    btn.textContent = arenaSubmissions.has(problemId) ? 'Solved' : 'Submit Solution';
    btn.classList.remove('btn-disabled');
    if (arenaSubmissions.has(problemId)) btn.disabled = true;
}
function goLeaderboard() { showPage('leaderboardPage'); loadLeaderboard(); }
function goInbox() { if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; } showPage('inboxPage'); loadInbox(); }

function filter(cat, btn) { activeCategory = cat; activeStatusFilter = null; document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active')); if (btn) btn.classList.add('active'); const sv = document.getElementById('searchInput').value.trim(); if (sv) searchBugs(sv); else loadBugs(); }
function filterByStatus(status, btn) { if (activeStatusFilter === status) { activeStatusFilter = null; document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active')); loadBugs(); return; } activeStatusFilter = status; document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active')); if (btn) btn.classList.add('active'); loadBugs(); }
function changeSort(value) { activeSort = value || 'newest'; const sv = document.getElementById('searchInput').value.trim(); if (sv) searchBugs(sv); else loadBugs(); }
function sortBugs(list) {
    const rank = { open: 0, in_progress: 1, solved: 2 };
    const arr = [...(list || [])];
    if (activeSort === 'oldest') return arr.sort((a,b) => parseSupabaseDate(a.created_at) - parseSupabaseDate(b.created_at));
    if (activeSort === 'most_solutions') return arr.sort((a,b) => (b.solutions_count || 0) - (a.solutions_count || 0) || parseSupabaseDate(b.created_at) - parseSupabaseDate(a.created_at));
    if (activeSort === 'open_first') return arr.sort((a,b) => (rank[a.status || 'open'] ?? 9) - (rank[b.status || 'open'] ?? 9) || parseSupabaseDate(b.created_at) - parseSupabaseDate(a.created_at));
    if (activeSort === 'solved_first') return arr.sort((a,b) => (rank[b.status || 'open'] ?? 9) - (rank[a.status || 'open'] ?? 9) || parseSupabaseDate(b.created_at) - parseSupabaseDate(a.created_at));
    return arr.sort((a,b) => parseSupabaseDate(b.created_at) - parseSupabaseDate(a.created_at));
}
function handleSearch(val) { document.getElementById('searchClear').style.display = val ? 'block' : 'none'; clearTimeout(searchTimeout); if (!val.trim()) { document.getElementById('searchResultsLabel').style.display = 'none'; loadBugs(); return; } searchTimeout = setTimeout(() => searchBugs(val.trim()), 350); }
function clearSearch() { document.getElementById('searchInput').value = ''; document.getElementById('searchClear').style.display = 'none'; document.getElementById('searchResultsLabel').style.display = 'none'; loadBugs(); }

async function searchBugs(query) {
    const grid = document.getElementById('bugsGrid'); grid.innerHTML = '<div class="loading"><div class="spinner"></div><p>Searching...</p></div>';
    try {
        let q = db.from('bugs').select('*').order('created_at', { ascending: false });
        if (activeCategory !== 'all') q = q.eq('category', activeCategory);
        if (activeStatusFilter) q = q.eq('status', activeStatusFilter);
        const { data, error } = await q; if (error) throw error;
        const lq = query.toLowerCase(), filtered = sortBugs((data || []).filter(b => (b.title && b.title.toLowerCase().includes(lq)) || (b.description && b.description.toLowerCase().includes(lq)) || (b.tags && b.tags.some(t => t.toLowerCase().includes(lq)))));
        const label = document.getElementById('searchResultsLabel'); label.style.display = 'block'; label.textContent = `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${query}"`;
        if (!filtered.length) { grid.innerHTML = `<div class="empty"><h3>Koi bug nahi mila 🔍</h3></div>`; return; }
        grid.innerHTML = filtered.map(b => renderBugCard(b, lq)).join('');
    } catch(err) { grid.innerHTML = `<div class="empty"><h3>Error 😔</h3><p>${esc(err.message)}</p></div>`; }
}

function highlightMatch(text, query) {
    if (!query || !text) return esc(text || '');
    const escaped = esc(text), lq = query.toLowerCase(), idx = escaped.toLowerCase().indexOf(lq);
    if (idx === -1) return escaped;
    return escaped.slice(0, idx) + `<mark style="background:rgba(0,255,136,0.25);color:var(--accent);border-radius:3px;">${escaped.slice(idx, idx + query.length)}</mark>` + escaped.slice(idx + query.length);
}

function renderBugCard(b, searchQuery) {
    const tags = b.tags && b.tags.length ? b.tags : [];
    const tagsHTML = tags.length ? `<div class="bug-tags-wrap">${tags.map(t => `<span class="bug-tag-pill" onclick="event.stopPropagation();filterByTag('${esc(t)}')">#${esc(t)}</span>`).join('')}</div>` : '';
    const isSaved = myBookmarks.has(b.id);
    const bookmarkBtn = me ? `<button class="bookmark-btn-card ${isSaved ? 'saved' : ''}" data-bookmark="${b.id}" onclick="toggleBookmark('${b.id}',event)" title="${isSaved ? 'Bookmarked!' : 'Bookmark'}">🔖</button>` : '';
    return `<div class="bug-card" onclick="openBug('${b.id}')">
        ${bookmarkBtn}
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;"><span class="bug-tag" style="margin-bottom:0;">${esc(b.category)}</span>${getStatusBadge(b.status || 'open')}</div>
        ${tagsHTML}
        <h3>${searchQuery ? highlightMatch(b.title, searchQuery) : esc(b.title)}</h3>
        <p>${searchQuery ? highlightMatch(b.description, searchQuery) : esc(b.description)}</p>
        <div class="bug-footer"><span>by ${esc(b.username || 'Anonymous')}</span><span>💡 ${b.solutions_count || 0} solutions · ${timeAgo(b.created_at)}</span></div>
    </div>`;
}

function filterByTag(tag) { document.getElementById('searchInput').value = tag; document.getElementById('searchClear').style.display = 'block'; searchBugs(tag); }

async function loadBugs() {
    const grid = document.getElementById('bugsGrid'); grid.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading...</p></div>';
    try {
        let q = db.from('bugs').select('*').order('created_at', { ascending: false });
        if (activeCategory !== 'all') q = q.eq('category', activeCategory);
        if (activeStatusFilter) q = q.eq('status', activeStatusFilter);
        const { data, error } = await q; if (error) throw error;
        if (!data || !data.length) { grid.innerHTML = `<div class="empty"><h3>Koi bug nahi abhi! 🐛</h3><p style="margin-bottom:1rem;">${activeCategory === 'all' ? 'Pehla bug post karo!' : activeCategory + ' mein koi bug nahi.'}</p><button class="btn btn-sm" onclick="${me ? 'goPost()' : 'openModal()'}">${me ? '+ Post a Bug' : 'Sign In to Post'}</button></div>`; return; }
        grid.innerHTML = sortBugs(data).map(b => renderBugCard(b, null)).join('');
    } catch(err) { grid.innerHTML = `<div class="empty"><h3>Error 😔</h3><p>${esc(err.message)}</p><button class="btn btn-sm" onclick="loadBugs()">Retry</button></div>`; }
}

function resetTagInput() { currentTags = []; renderTagPills(); document.getElementById('tagRawInput').value = ''; }
function renderTagPills() {
    const wrap = document.getElementById('tagInputWrap'), input = document.getElementById('tagRawInput');
    wrap.querySelectorAll('.tag-pill').forEach(p => p.remove());
    currentTags.forEach((tag, i) => { const pill = document.createElement('span'); pill.className = 'tag-pill'; pill.innerHTML = `#${esc(tag)} <button class="tag-pill-remove" onclick="removeTag(${i})">×</button>`; wrap.insertBefore(pill, input); });
    input.placeholder = currentTags.length >= 5 ? 'Max 5 tags!' : (currentTags.length ? '' : 'e.g. javascript, react, css');
}
function addTag(raw) { const tag = raw.trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '').slice(0, 20); if (!tag) return; if (currentTags.length >= 5) { toast('Max 5 tags!', 'err'); return; } if (currentTags.includes(tag)) return; currentTags.push(tag); renderTagPills(); document.getElementById('tagRawInput').value = ''; }
function removeTag(index) { currentTags.splice(index, 1); renderTagPills(); }
function handleTagKey(e) { const val = e.target.value; if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(val.replace(',', '')); } else if (e.key === 'Backspace' && !val && currentTags.length) removeTag(currentTags.length - 1); }
function handleTagInput(val) { if (val.endsWith(',')) addTag(val.slice(0, -1)); }

async function submitBug() {
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    const title = document.getElementById('bugTitle').value.trim(), cat = document.getElementById('bugCat').value, desc = document.getElementById('bugDesc').value.trim();
    const rawInput = document.getElementById('tagRawInput').value.trim(); if (rawInput) addTag(rawInput);
    if (!title) { toast('Title bharo!', 'err'); return; } if (!cat) { toast('Category choose karo!', 'err'); return; } if (!desc) { toast('Description bharo!', 'err'); return; }
    const btn = document.getElementById('submitBugBtn'); btn.textContent = 'Posting...'; btn.classList.add('btn-disabled');
    try {
        const { error } = await db.from('bugs').insert({ title, category: cat, description: desc, user_id: me.id, username: myName || me.email.split('@')[0], solutions_count: 0, tags: currentTags, status: 'open' });
        if (error) throw error;
        await addXP(10); await updateDailyProgress('bug'); toast('Bug post ho gaya! +10 XP 🎉', 'ok');
        document.getElementById('bugTitle').value = ''; document.getElementById('bugCat').value = ''; document.getElementById('bugDesc').value = '';
        resetTagInput(); goHome();
    } catch(err) { toast(err.message, 'err'); }
    btn.textContent = 'Post Bug 🚀'; btn.classList.remove('btn-disabled');
}

function openEditBugModal() {
    if (!me || !activeBug || activeBug.user_id !== me.id) { toast('Sirf owner edit kar sakta hai!', 'err'); return; }
    editingBugId = activeBug.id;
    editBugTags = Array.isArray(activeBug.tags) ? [...activeBug.tags] : [];
    document.getElementById('editBugTitle').value = activeBug.title || '';
    document.getElementById('editBugCat').value = activeBug.category || '';
    document.getElementById('editBugDesc').value = activeBug.description || '';
    document.getElementById('editTagRawInput').value = '';
    renderEditBugTags();
    document.getElementById('editBugModal').classList.add('show');
}
function closeEditBugModal() {
    document.getElementById('editBugModal').classList.remove('show');
    editingBugId = null;
    editBugTags = [];
}
function renderEditBugTags() {
    const wrap = document.getElementById('editTagInputWrap'), input = document.getElementById('editTagRawInput');
    if (!wrap || !input) return;
    wrap.querySelectorAll('.tag-pill').forEach(p => p.remove());
    editBugTags.forEach((tag, i) => {
        const pill = document.createElement('span');
        pill.className = 'tag-pill';
        pill.innerHTML = `#${esc(tag)} <button class="tag-pill-remove" onclick="removeEditBugTag(${i})">×</button>`;
        wrap.insertBefore(pill, input);
    });
    input.placeholder = editBugTags.length >= 5 ? 'Max 5 tags!' : (editBugTags.length ? '' : 'e.g. javascript, react, css');
}
function addEditBugTag(raw) {
    const tag = raw.trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '').slice(0, 20);
    if (!tag) return;
    if (editBugTags.length >= 5) { toast('Max 5 tags!', 'err'); return; }
    if (editBugTags.includes(tag)) return;
    editBugTags.push(tag);
    document.getElementById('editTagRawInput').value = '';
    renderEditBugTags();
}
function removeEditBugTag(index) { editBugTags.splice(index, 1); renderEditBugTags(); }
function handleEditTagKey(e) {
    const val = e.target.value;
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEditBugTag(val.replace(',', '')); }
    else if (e.key === 'Backspace' && !val && editBugTags.length) removeEditBugTag(editBugTags.length - 1);
}
function handleEditTagInput(val) { if (val.endsWith(',')) addEditBugTag(val.slice(0, -1)); }
async function saveBugEdit() {
    if (!me || !activeBug || !editingBugId) return;
    const title = document.getElementById('editBugTitle').value.trim();
    const category = document.getElementById('editBugCat').value;
    const description = document.getElementById('editBugDesc').value.trim();
    const rawInput = document.getElementById('editTagRawInput').value.trim();
    if (rawInput) addEditBugTag(rawInput);
    if (!title) { toast('Title bharo!', 'err'); return; }
    if (!category) { toast('Category choose karo!', 'err'); return; }
    if (!description) { toast('Description bharo!', 'err'); return; }
    const btn = document.getElementById('saveBugBtn');
    btn.textContent = 'Saving...';
    btn.classList.add('btn-disabled');
    try {
        const { error } = await db.from('bugs').update({ title, category, description, tags: editBugTags }).eq('id', editingBugId).eq('user_id', me.id);
        if (error) throw error;
        const id = editingBugId;
        closeEditBugModal();
        toast('Bug update ho gaya! ✏️', 'ok');
        openBug(id);
    } catch(err) { toast('Update failed: ' + err.message, 'err'); }
    btn.textContent = 'Save Changes 💾';
    btn.classList.remove('btn-disabled');
}

function askDelete(bugId, e) { e.stopPropagation(); bugToDelete = bugId; document.getElementById('confirmDialog').classList.add('show'); }
function closeConfirm() { document.getElementById('confirmDialog').classList.remove('show'); bugToDelete = null; }
async function confirmDelete() {
    if (!bugToDelete) return; closeConfirm();
    try {
        await db.from('solutions').delete().eq('bug_id', bugToDelete);
        await db.from('bookmarks').delete().eq('bug_id', bugToDelete);
        await db.from('bugs').delete().eq('id', bugToDelete);
        myBookmarks.delete(bugToDelete); toast('Bug delete ho gaya! 🗑️', 'ok'); goHome();
    } catch(err) { toast('Delete failed: ' + err.message, 'err'); }
}

async function openBug(id, fromRoute = false) {
    if (!fromRoute) setRoute({ bug: id });
    showPage('detailPage');
    const wrap = document.getElementById('detailWrap');
    wrap.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading...</p></div>';
    try {
        const [{ data: bug, error: e1 }, { data: sols }] = await Promise.all([
            db.from('bugs').select('*').eq('id', id).single(),
            db.from('solutions').select('*').eq('bug_id', id).order('upvotes', { ascending: false })
        ]);
        if (e1) throw e1;
        activeBug = bug; const solutions = sols || [], isOwner = me && bug.user_id === me.id;
        const tags = bug.tags && bug.tags.length ? bug.tags : [];
        const tagsHTML = tags.length ? `<div class="bug-tags-wrap" style="margin-top:8px;">${tags.map(t => `<span class="bug-tag-pill" onclick="filterByTagFromDetail('${esc(t)}')">#${esc(t)}</span>`).join('')}</div>` : '';
        const currentStatus = bug.status || 'open';
        const statusHTML = isOwner ? `<div class="status-select-wrap"><label>📊 Status:</label><select class="status-select" onchange="updateBugStatus('${bug.id}',this.value)"><option value="open" ${currentStatus === 'open' ? 'selected' : ''}>🔴 Open</option><option value="in_progress" ${currentStatus === 'in_progress' ? 'selected' : ''}>🟡 In Progress</option><option value="solved" ${currentStatus === 'solved' ? 'selected' : ''}>🟢 Solved</option></select></div>` : '';
        wrap.innerHTML = `
            <button class="back-btn" onclick="goHome()">← Back to bugs</button>
            <div class="detail-card">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span class="bug-tag">${esc(bug.category)}</span>${getStatusBadge(currentStatus)}</div>
                <h2>${esc(bug.title)}</h2>${tagsHTML}
                <p class="desc" style="margin-top:12px;">${esc(bug.description)}</p>
                ${statusHTML}
                <div class="detail-meta">
                    <span>by <strong style="cursor:pointer;color:var(--accent);" onclick="goProfile('${bug.user_id}')">${esc(bug.username || 'Anonymous')}</strong></span>
                    <span>${timeAgo(bug.created_at)}</span><span>💡 ${solutions.length} solutions</span>
                    <span style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;"><button class="share-btn" onclick="copyShareLink('bug','${bug.id}')">🔗 Share</button>${isOwner ? `<button class="btn btn-ghost btn-sm" onclick="openEditBugModal()">✏️ Edit</button><button class="btn btn-danger btn-sm" onclick="askDelete('${bug.id}',event)">🗑️ Delete</button>` : ''}</span>
                </div>
            </div>
            <div class="solutions-header">Solutions (${solutions.length})</div>
            ${me ? `<div class="solution-input-box"><h4>Post your solution 💡</h4><div class="field"><textarea id="solText" placeholder="Share your solution..." rows="4"></textarea></div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn btn-sm" id="solBtn" onclick="submitSolution()">Post Solution</button>
                    <button class="ai-solver-btn" style="width:auto;padding:6px 14px;font-size:0.82rem;" onclick="getAISolutionsForDetail('${bug.id}')">🤖 Ask AI</button>
                </div>
                <div class="ai-box" id="aiBoxDetail" style="margin-top:0.75rem;">
                    <div class="ai-box-header"><span>🤖</span><span class="ai-box-title">AI Suggestions</span><span class="ai-box-subtitle">Groq · LLaMA 3</span></div>
                    <div id="aiDetailContent"></div>
                    <div class="ai-footer-note">⚡ "↗ Use as my solution" click karo!</div>
                </div>
            </div>` : `<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1.5rem;margin-bottom:1.5rem;text-align:center;"><p style="color:var(--text2);margin-bottom:1rem;">Solution post karne ke liye Sign In karo</p><button class="btn btn-sm" onclick="openModal()">Sign In</button></div>`}
            <div class="solutions-list">${solutions.length === 0 ? '<div class="empty" style="grid-column:unset;"><p>Koi solution nahi abhi 💪<br>Pehle warrior bano!</p></div>' : solutions.map(s => renderSolutionCard(s, isOwner, bug.id)).join('')}</div>`;
    } catch(err) { wrap.innerHTML = `<button class="back-btn" onclick="goHome()">← Back</button><div class="empty"><h3>Error 😔</h3><p>${esc(err.message)}</p></div>`; }
}

async function getAISolutionsForDetail(bugId) {
    if (!activeBug) return;
    const box = document.getElementById('aiBoxDetail'), content = document.getElementById('aiDetailContent');
    if (!box || !content) return;
    box.classList.add('show');
    content.innerHTML = `<div class="ai-loading-wrap"><div class="spinner"></div><div class="ai-loading-text">🧠 Analyzing bug...</div></div>`;
    const prompt = `You are an expert problem solver on BUGOUT.\n\nProblem: ${activeBug.title}\nDetails: ${activeBug.description}\nCategory: ${activeBug.category}\n\nGive exactly 3 practical solutions:\n\nSOLUTION_1:\n[solution]\n\nSOLUTION_2:\n[solution]\n\nSOLUTION_3:\n[solution]\n\nKeep each 2-4 sentences. Direct and practical.`;
    try {
        const data = await callGroq([{ role: 'user', content: prompt }], { max_tokens: 600, temperature: 0.7 });
        const rawText = data.choices?.[0]?.message?.content || '';
        const solutions = [], parts = rawText.split(/SOLUTION_[123]:/);
        for (let i = 1; i <= 3; i++) { if (parts[i]) solutions.push(parts[i].trim()); }
        if (!solutions.length) rawText.split('\n\n').filter(p => p.trim().length > 20).slice(0, 3).forEach(p => solutions.push(p.trim()));
        if (!solutions.length) throw new Error('Response parse nahi hua');
        const labels = ['💡 Solution 1', '🔥 Solution 2', '⚡ Solution 3'];
        content.innerHTML = solutions.map((sol, i) => `<div class="ai-suggestion-card"><div class="ai-suggestion-label"><span class="ai-sol-badge">🤖 AI</span>${labels[i] || '💡 Solution ' + (i+1)}</div><div class="ai-suggestion-text">${esc(sol)}</div><button class="ai-use-sol-btn" onclick="fillSolText(${i})">↗ Use as my solution</button></div>`).join('');
        window._aiDetailSolutions = solutions; toast('🤖 AI ready!', 'ok');
    } catch(err) { content.innerHTML = `<div class="ai-error-wrap"><p>😔 AI error: ${esc(err.message)}</p><button class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="getAISolutionsForDetail('${bugId}')">Retry</button></div>`; }
}

function fillSolText(index) { const sol = (window._aiDetailSolutions || [])[index]; if (!sol) return; const el = document.getElementById('solText'); if (el) { el.value = sol; el.focus(); toast('✅ Solution fill ho gaya!', 'ok'); } }

function renderSolutionCard(s, isOwner, bugId) {
    return `<div class="sol-card ${s.is_best_solution ? 'best' : ''}" id="sol-${s.id}">
        ${s.is_best_solution ? '<div class="best-badge">✅ Best</div>' : ''}
        <p>${esc(s.content)}</p>
        <div class="sol-actions">
            <button class="upvote" onclick="upvote('${s.id}')">👍 ${s.upvotes || 0}</button>
            <span class="sol-author" style="cursor:pointer;" onclick="goProfile('${s.user_id}')">by ${esc(s.username || 'Anonymous')}</span>
            ${isOwner && !s.is_best_solution ? `<button class="btn btn-sm btn-ghost" onclick="markBest('${s.id}')">Mark Best ✅</button>` : ''}
        </div>
        <div class="comments-section">
            <button class="comments-toggle" onclick="toggleComments('${s.id}')">💬 <span id="comment-count-${s.id}">Comments</span></button>
            <div id="comments-${s.id}" style="display:none;">
                <div class="comments-list" id="comments-list-${s.id}"><div style="color:var(--text2);font-size:0.82rem;padding:0.5rem 0;">Loading...</div></div>
                ${me ? `<div class="comment-input-wrap"><input type="text" class="comment-input" id="comment-input-${s.id}" placeholder="Comment likho..." maxlength="300" onkeydown="handleCommentKey(event,'${s.id}')"><button class="comment-send" onclick="postComment('${s.id}')">Send</button></div>` : `<p style="color:var(--text2);font-size:0.82rem;margin-top:0.5rem;">Comment karne ke liye <span style="color:var(--accent);cursor:pointer;" onclick="openModal()">Sign In</span> karo</p>`}
            </div>
        </div>
    </div>`;
}

function filterByTagFromDetail(tag) { goHome(); setTimeout(() => { document.getElementById('searchInput').value = tag; document.getElementById('searchClear').style.display = 'block'; searchBugs(tag); }, 100); }

async function submitSolution() {
    if (!me || !activeBug) return;
    const content = document.getElementById('solText').value.trim(); if (!content) { toast('Solution likho pehle!', 'err'); return; }
    const btn = document.getElementById('solBtn'); btn.textContent = 'Posting...'; btn.classList.add('btn-disabled');
    try {
        const { error } = await db.from('solutions').insert({ bug_id: activeBug.id, content, user_id: me.id, username: myName || me.email.split('@')[0], upvotes: 0, is_best_solution: false });
        if (error) throw error;
        await db.from('bugs').update({ solutions_count: (activeBug.solutions_count || 0) + 1 }).eq('id', activeBug.id);
        if ((activeBug.status || 'open') === 'open') { await db.from('bugs').update({ status: 'in_progress' }).eq('id', activeBug.id); activeBug.status = 'in_progress'; }
        await addXP(5); await updateDailyProgress('solution');
        if (activeBug.user_id !== me.id) await createNotification(activeBug.user_id, 'solution_posted', `${myName} ne tumhare bug "${activeBug.title.slice(0, 40)}" ka solution diya! 💡`, activeBug.id);
        toast('Solution post ho gaya! +5 XP 🎉', 'ok'); openBug(activeBug.id);
    } catch(err) { toast(err.message, 'err'); btn.textContent = 'Post Solution'; btn.classList.remove('btn-disabled'); }
}

async function upvote(solId) {
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    try { const { data } = await db.from('solutions').select('upvotes').eq('id', solId).single(); await db.from('solutions').update({ upvotes: (data.upvotes || 0) + 1 }).eq('id', solId); openBug(activeBug.id); } catch(e) { toast('Error!', 'err'); }
}

async function markBest(solId) {
    if (!me || !activeBug) return;
    try {
        const { data: sol } = await db.from('solutions').select('user_id,username').eq('id', solId).single();
        await db.from('solutions').update({ is_best_solution: false }).eq('bug_id', activeBug.id);
        await db.from('solutions').update({ is_best_solution: true }).eq('id', solId);
        await db.from('bugs').update({ status: 'solved' }).eq('id', activeBug.id); activeBug.status = 'solved';
        if (sol && sol.user_id !== me.id) await createNotification(sol.user_id, 'best_solution', `Tumhara solution "${activeBug.title.slice(0, 40)}" ke liye Best Solution mark hua! ✅`, activeBug.id);
        toast('Best solution marked! ✅ Bug solved ho gaya! 🟢', 'ok'); openBug(activeBug.id);
    } catch(e) { toast('Error!', 'err'); }
}

async function toggleComments(solId) { const section = document.getElementById(`comments-${solId}`); const isHidden = section.style.display === 'none'; section.style.display = isHidden ? 'block' : 'none'; if (isHidden) await loadComments(solId); }
async function loadComments(solId) {
    const list = document.getElementById(`comments-list-${solId}`), countEl = document.getElementById(`comment-count-${solId}`);
    list.innerHTML = '<div style="color:var(--text2);font-size:0.82rem;padding:0.5rem 0;">Loading...</div>';
    try {
        const { data, error } = await db.from('comments').select('*').eq('solution_id', solId).order('created_at', { ascending: true });
        if (error) throw error;
        if (countEl) countEl.textContent = `Comments (${data ? data.length : 0})`;
        if (!data || !data.length) { list.innerHTML = '<div style="color:var(--text2);font-size:0.82rem;padding:0.5rem 0;">Koi comment nahi abhi — pehle comment karo! 💬</div>'; return; }
        list.innerHTML = data.map(c => `<div class="comment-item"><div class="comment-header"><span class="comment-author" onclick="goProfile('${c.user_id}')">${esc(c.username || 'Anonymous')}</span><span class="comment-time">${timeAgo(c.created_at)}</span></div><div class="comment-text">${esc(c.content)}</div></div>`).join('');
    } catch(err) { list.innerHTML = `<div style="color:var(--error);font-size:0.82rem;">Error: ${esc(err.message)}</div>`; }
}
async function postComment(solId) {
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    const input = document.getElementById(`comment-input-${solId}`), content = input.value.trim();
    if (!content) { toast('Comment likho!', 'err'); return; } if (content.length > 300) { toast('Max 300 characters!', 'err'); return; }
    input.value = '';
    try {
        const { error } = await db.from('comments').insert({ solution_id: solId, user_id: me.id, username: myName || me.email.split('@')[0], content });
        if (error) throw error; await updateDailyProgress('comment'); await loadComments(solId); toast('Comment post ho gaya! 💬', 'ok');
    } catch(err) { toast('Error: ' + err.message, 'err'); input.value = content; }
}
function handleCommentKey(e, solId) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(solId); } }

async function createNotification(userId, type, message, relatedId) { try { await db.from('notifications').insert({ user_id: userId, type, message, related_id: relatedId, is_read: false }); } catch(e) {} }
async function checkNotifs() {
    if (!me) return;
    try {
        const { count } = await db.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', me.id).eq('is_read', false);
        const badge = document.getElementById('notifBadge');
        if (count && count > 0) { badge.textContent = count > 9 ? '9+' : count; badge.style.display = 'flex'; } else badge.style.display = 'none';
    } catch(e) {}
}
function startNotifCheck() { checkNotifs(); if (notifCheckInterval) clearInterval(notifCheckInterval); notifCheckInterval = setInterval(checkNotifs, 20000); }
function toggleNotifPanel() { if (notifPanelOpen) closeNotifPanel(); else openNotifPanel(); }
function openNotifPanel() { document.getElementById('notifPanel').classList.add('show'); notifPanelOpen = true; loadNotifPanel(); }
function closeNotifPanel() { document.getElementById('notifPanel').classList.remove('show'); notifPanelOpen = false; }
async function loadNotifPanel() {
    const list = document.getElementById('notifPanelList'); list.innerHTML = '<div class="notif-empty">Loading...</div>';
    try {
        const { data, error } = await db.from('notifications').select('*').eq('user_id', me.id).order('created_at', { ascending: false }).limit(15);
        if (error) throw error;
        if (!data || !data.length) { list.innerHTML = '<div class="notif-empty">Koi notification nahi abhi 🔔</div>'; return; }
        list.innerHTML = data.map(n => {
            const icon = n.type === 'solution_posted' ? '💡' : n.type === 'followed' ? '👥' : n.type === 'best_solution' ? '✅' : '🔔';
            return `<div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="handleNotifClick('${n.id}','${n.type}','${n.related_id}')"><div class="notif-icon">${icon}</div><div><div class="notif-text">${esc(n.message)}</div><div class="notif-time">${timeAgo(n.created_at)}</div></div></div>`;
        }).join('');
    } catch(e) { list.innerHTML = '<div class="notif-empty">Error loading 😔</div>'; }
}
async function loadNotifsPage() {
    const list = document.getElementById('notifsList'); list.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading...</p></div>';
    try {
        const { data, error } = await db.from('notifications').select('*').eq('user_id', me.id).order('created_at', { ascending: false }); if (error) throw error;
        await db.from('notifications').update({ is_read: true }).eq('user_id', me.id).eq('is_read', false); checkNotifs();
        if (!data || !data.length) { list.innerHTML = '<div class="empty"><h3>Koi notification nahi abhi 🔔</h3></div>'; return; }
        list.innerHTML = data.map(n => {
            const icon = n.type === 'solution_posted' ? '💡' : n.type === 'followed' ? '👥' : n.type === 'best_solution' ? '✅' : '🔔';
            return `<div class="notif-row ${n.is_read ? '' : 'unread'}" onclick="handleNotifClick('${n.id}','${n.type}','${n.related_id}')"><div class="notif-row-icon">${icon}</div><div class="notif-row-body"><div class="notif-row-text">${esc(n.message)}</div><div class="notif-row-time">${timeAgo(n.created_at)}</div></div></div>`;
        }).join('');
    } catch(err) { list.innerHTML = `<div class="empty"><h3>Error 😔</h3><p>${esc(err.message)}</p></div>`; }
}
async function handleNotifClick(notifId, type, relatedId) {
    closeNotifPanel();
    try { await db.from('notifications').update({ is_read: true }).eq('id', notifId); checkNotifs(); } catch(e) {}
    if (type === 'solution_posted' || type === 'best_solution') { if (relatedId && relatedId !== 'null') openBug(relatedId); }
    else if (type === 'followed') { if (relatedId && relatedId !== 'null') goProfile(relatedId); }
}
async function markAllNotifsRead() {
    if (!me) return;
    try { await db.from('notifications').update({ is_read: true }).eq('user_id', me.id).eq('is_read', false); checkNotifs(); loadNotifPanel(); toast('Sab read mark ho gayi!', 'ok'); } catch(e) {}
}

async function checkUnread() {
    if (!me) return;
    try {
        const { count } = await db.from('messages').select('*', { count: 'exact', head: true }).eq('receiver_id', me.id).eq('is_read', false);
        const badge = document.getElementById('msgBadge');
        if (count && count > 0) { badge.textContent = count > 9 ? '9+' : count; badge.style.display = 'flex'; } else badge.style.display = 'none';
    } catch(e) {}
}
function startUnreadCheck() { checkUnread(); if (unreadCheckInterval) clearInterval(unreadCheckInterval); unreadCheckInterval = setInterval(checkUnread, 15000); }

async function loadInbox() {
    const list = document.getElementById('inboxList'); list.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading...</p></div>';
    try {
        const { data: sent } = await db.from('messages').select('*').eq('sender_id', me.id).order('created_at', { ascending: false });
        const { data: received } = await db.from('messages').select('*').eq('receiver_id', me.id).order('created_at', { ascending: false });
        const allMsgs = [...(sent || []), ...(received || [])];
        if (!allMsgs.length) { list.innerHTML = `<div class="empty"><h3>Koi message nahi abhi 💬</h3><button class="btn btn-sm" style="margin-top:1rem;" onclick="openNewMsgModal()">+ New Message</button></div>`; return; }
        const convMap = new Map();
        allMsgs.forEach(msg => { const partnerId = msg.sender_id === me.id ? msg.receiver_id : msg.sender_id; if (!convMap.has(partnerId) || parseSupabaseDate(msg.created_at) > parseSupabaseDate(convMap.get(partnerId).created_at)) convMap.set(partnerId, msg); });
        const conversations = [...convMap.entries()].sort((a, b) => parseSupabaseDate(b[1].created_at) - parseSupabaseDate(a[1].created_at));
        const { data: unreadData } = await db.from('messages').select('sender_id').eq('receiver_id', me.id).eq('is_read', false);
        const unreadMap = {}; (unreadData || []).forEach(m => { unreadMap[m.sender_id] = (unreadMap[m.sender_id] || 0) + 1; });
        const partnerIds = conversations.map(([id]) => id);
        const { data: profiles } = await db.from('profiles').select('user_id,username,display_name,avatar_color,xp').in('user_id', partnerIds);
        const profileMap = {}; (profiles || []).forEach(p => profileMap[p.user_id] = p);
        list.innerHTML = conversations.map(([partnerId, lastMsg]) => {
            const p = profileMap[partnerId] || {}, displayName = p.display_name || p.username || 'Unknown Warrior';
            const color = p.avatar_color || '#00ff88', lvl = getLevel(p.xp || 0), unreadCount = unreadMap[partnerId] || 0, isMine = lastMsg.sender_id === me.id;
            const preview = (isMine ? 'Tu: ' : '') + esc(lastMsg.content).substring(0, 50) + (lastMsg.content.length > 50 ? '...' : '');
            return `<div class="inbox-row ${unreadCount ? 'unread' : ''}" onclick="openChat('${partnerId}')"><div class="inbox-avatar" style="background:${color};">${displayName[0].toUpperCase()}</div><div class="inbox-info"><div class="inbox-name">${esc(displayName)}<span style="font-size:0.75rem;color:var(--text2);font-weight:400;">${lvl.emoji} ${lvl.name}</span></div><div class="inbox-preview">${preview}</div></div><div class="inbox-meta"><div class="inbox-time">${timeAgo(lastMsg.created_at)}</div>${unreadCount ? `<div class="unread-dot">${unreadCount}</div>` : ''}</div></div>`;
        }).join('');
    } catch(err) { list.innerHTML = `<div class="empty"><h3>Error 😔</h3><p>${esc(err.message)}</p></div>`; }
}

async function openChat(partnerId) {
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    chatPartnerId = partnerId; showPage('chatPage');
    document.getElementById('chatPartnerName').textContent = '...';
    document.getElementById('chatMessages').innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading...</p></div>';
    try {
        const { data: profile } = await db.from('profiles').select('*').eq('user_id', partnerId).single();
        chatPartnerProfile = profile;
        const displayName = profile.display_name || profile.username || 'Unknown', lvl = getLevel(profile.xp || 0), color = profile.avatar_color || '#00ff88';
        document.getElementById('chatPartnerName').textContent = displayName;
        document.getElementById('chatPartnerLevel').textContent = `${lvl.emoji} ${lvl.name} · ${profile.xp || 0} XP`;
        const avatarEl = document.getElementById('chatPartnerAvatar'); avatarEl.textContent = displayName[0].toUpperCase(); avatarEl.style.background = color;
        await loadChatMessages();
        await db.from('messages').update({ is_read: true }).eq('sender_id', partnerId).eq('receiver_id', me.id).eq('is_read', false);
        checkUnread(); subscribeToChat();
    } catch(err) { toast('Error: ' + err.message, 'err'); }
}

async function loadChatMessages() {
    const container = document.getElementById('chatMessages');
    try {
        const { data: messages, error } = await db.from('messages').select('*').or(`and(sender_id.eq.${me.id},receiver_id.eq.${chatPartnerId}),and(sender_id.eq.${chatPartnerId},receiver_id.eq.${me.id})`).order('created_at', { ascending: true });
        if (error) throw error;
        if (!messages || !messages.length) { container.innerHTML = `<div style="text-align:center;color:var(--text2);margin-top:3rem;"><p style="font-size:2rem;">👋</p><p>Conversation start karo!</p></div>`; return; }
        let lastDate = '';
        container.innerHTML = messages.map(msg => {
            const isMine = msg.sender_id === me.id, msgDate = parseSupabaseDate(msg.created_at).toLocaleDateString('en-IN');
            let divider = ''; if (msgDate !== lastDate) { lastDate = msgDate; divider = `<div class="chat-day-divider">${msgDate}</div>`; }
            const timeStr = parseSupabaseDate(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), readStatus = isMine ? (msg.is_read ? '✓✓' : '✓') : '';
            return `${divider}<div class="msg-bubble-wrap ${isMine ? 'mine' : 'theirs'}"><div class="msg-bubble">${esc(msg.content)}</div><div class="msg-time">${timeStr} ${readStatus ? `<span class="msg-read-status" style="color:${msg.is_read ? 'var(--accent)' : 'var(--text2)'}">${readStatus}</span>` : ''}</div></div>`;
        }).join('');
        scrollToBottom();
    } catch(err) { container.innerHTML = `<div class="empty"><h3>Error 😔</h3></div>`; }
}

function scrollToBottom() { const c = document.getElementById('chatMessages'); if (c) setTimeout(() => { c.scrollTop = c.scrollHeight; }, 50); }
function subscribeToChat() {
    if (msgSubscription) msgSubscription.unsubscribe();
    msgSubscription = db.channel('chat-' + me.id + '-' + chatPartnerId).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${me.id}` }, async (payload) => {
        const msg = payload.new; if (msg.sender_id !== chatPartnerId) { checkUnread(); return; }
        appendMessage(msg, false); await db.from('messages').update({ is_read: true }).eq('id', msg.id); checkUnread();
    }).subscribe();
}
function appendMessage(msg, isMine) {
    const container = document.getElementById('chatMessages'), timeStr = parseSupabaseDate(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const div = document.createElement('div'); div.className = `msg-bubble-wrap ${isMine ? 'mine' : 'theirs'}`;
    div.innerHTML = `<div class="msg-bubble">${esc(msg.content)}</div><div class="msg-time">${timeStr}</div>`;
    const emptyEl = container.querySelector('div[style*="text-align:center"]'); if (emptyEl) emptyEl.remove();
    container.appendChild(div); scrollToBottom();
}
async function sendMessage() {
    if (!me || !chatPartnerId) return;
    const input = document.getElementById('chatInput'), content = input.value.trim(); if (!content) return;
    const btn = document.getElementById('chatSendBtn'); btn.disabled = true; input.value = ''; input.style.height = '44px';
    try {
        const { data, error } = await db.from('messages').insert({ sender_id: me.id, receiver_id: chatPartnerId, content, is_read: false }).select().single();
        if (error) throw error; appendMessage(data, true);
    } catch(err) { toast('Message send nahi hua!', 'err'); input.value = content; }
    btn.disabled = false; input.focus();
}
function handleChatKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }
function autoResizeInput(el) { el.style.height = '44px'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }

async function openNewMsgModal() {
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    document.getElementById('newMsgModal').classList.add('show'); document.getElementById('followerSearch').value = '';
    const list = document.getElementById('followersList'); list.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading...</p></div>';
    try {
        const { data: profiles } = await db.from('profiles').select('user_id,username,display_name,avatar_color,xp').neq('user_id', me.id).order('xp', { ascending: false }).limit(50);
        allFollowersList = profiles || []; renderFollowersList(allFollowersList);
    } catch(err) { list.innerHTML = `<div class="empty"><h3>Error 😔</h3></div>`; }
}
function renderFollowersList(profiles) {
    const list = document.getElementById('followersList');
    if (!profiles.length) { list.innerHTML = '<div style="text-align:center;color:var(--text2);padding:1rem;">Koi nahi mila 🔍</div>'; return; }
    list.innerHTML = profiles.map(p => {
        const displayName = p.display_name || p.username || 'Anonymous', lvl = getLevel(p.xp || 0);
        return `<div class="follower-select-row" onclick="startNewChat('${p.user_id}')"><div style="width:40px;height:40px;border-radius:50%;background:${p.avatar_color || '#00ff88'};display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;flex-shrink:0;">${displayName[0].toUpperCase()}</div><div><div style="font-weight:700;font-size:0.95rem;">${esc(displayName)}</div><div style="font-size:0.78rem;color:var(--text2);">${lvl.emoji} ${lvl.name} · ${p.xp || 0} XP</div></div></div>`;
    }).join('');
}
function filterFollowersList() { const query = document.getElementById('followerSearch').value.toLowerCase(); renderFollowersList(allFollowersList.filter(p => (p.display_name || p.username || '').toLowerCase().includes(query))); }
function startNewChat(partnerId) { closeNewMsgModal(); openChat(partnerId); }
function closeNewMsgModal() { document.getElementById('newMsgModal').classList.remove('show'); }

function esc(s) { if (s == null) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function timeAgo(d) {
    if (!d) return '';
    const parsed = parseSupabaseDate(d);
    if (!parsed || Number.isNaN(parsed.getTime())) return '';
    const diffMs = Math.max(0, Date.now() - parsed.getTime());
    const m = Math.floor(diffMs / 60000), h = Math.floor(diffMs / 3600000), day = Math.floor(diffMs / 86400000);
    if (m < 1) return 'just now'; if (m < 60) return m + 'm ago'; if (h < 24) return h + 'h ago'; if (day === 1) return 'yesterday'; if (day < 7) return day + 'd ago';
    return parsed.toLocaleDateString('en-IN');
}
function toast(msg, type = 'ok') {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

// ═══════════════════════════════════════════════════════════════
//  🔥 TRENDING BUGS
// ═══════════════════════════════════════════════════════════════
async function loadTrending() {
    try {
        const { data: bugs } = await db.from('bugs').select('id,title,category,solutions_count,created_at,status')
            .order('solutions_count', { ascending: false })
            .limit(8);
        if (!bugs || bugs.length < 2) return;
        const section = document.getElementById('trendingSection');
        const scroll = document.getElementById('trendingScroll');
        if (!section || !scroll) return;
        scroll.innerHTML = bugs.map(b => `
            <div class="trending-card" onclick="openBug('${b.id}')">
                <span class="trending-fire">🔥</span>
                <span class="bug-tag">${esc(b.category || 'General')}</span>
                <h4>${esc(b.title)}</h4>
                <div class="trending-stats">
                    <span>💡 ${b.solutions_count || 0} solutions</span>
                    <span>${getStatusBadge(b.status || 'open')}</span>
                    <span>🕐 ${timeAgo(b.created_at)}</span>
                </div>
            </div>
        `).join('');
        section.style.display = 'block';
    } catch(e) { /* silent */ }
}

// ═══════════════════════════════════════════════════════════════
//  🎯 DAILY CHALLENGE
// ═══════════════════════════════════════════════════════════════
let dailyChallengeData = null;
let dailyTimerInterval = null;

function getDailyKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function loadDailyChallenge() {
    if (!me) return;
    const wrap = document.getElementById('dailyChallengeWrap');
    if (!wrap) return;
    const todayKey = getDailyKey();
    const stored = localStorage.getItem('bugout_daily_' + me.id);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (parsed.date === todayKey) {
                if (parsed.solved) { wrap.style.display = 'none'; return; }
                dailyChallengeData = parsed;
                renderDailyChallenge(parsed);
                wrap.style.display = 'block';
                startDailyTimer();
                return;
            }
        } catch(e) {}
    }
    try {
        const data = await callGroq([{ role: 'user', content: `Generate a daily coding challenge for BUGOUT community. Return ONLY JSON: {"title":"short title","description":"2-3 line problem description in Hinglish","difficulty":"Easy/Medium/Hard","xp":20,"hint":"optional hint","category":"Coding"}. Make it interesting and unique for date ${todayKey}.` }], {
            max_tokens: 400, temperature: 0.6, response_format: { type: 'json_object' }
        });
        const challenge = extractJSON(data.choices?.[0]?.message?.content || '', null);
        if (!challenge || !challenge.title) return;
        challenge.date = todayKey;
        challenge.solved = false;
        challenge.xp = challenge.xp || 30;
        dailyChallengeData = challenge;
        localStorage.setItem('bugout_daily_' + me.id, JSON.stringify(challenge));
        renderDailyChallenge(challenge);
        wrap.style.display = 'block';
        startDailyTimer();
    } catch(e) { /* silent */ }
}

function renderDailyChallenge(ch) {
    document.getElementById('dailyChallengeTitle').textContent = ch.title || 'Daily Challenge';
    document.getElementById('dailyChallengeDesc').textContent = ch.description || 'Solve this challenge to earn bonus XP!';
    document.getElementById('dailyChallengeXP').textContent = `+${ch.xp || 30} XP`;
    document.getElementById('dailyChallengeDiff').textContent = ch.difficulty || 'Medium';
    const streak = parseInt(localStorage.getItem('bugout_daily_streak_' + me.id) || '0');
    document.getElementById('dailyStreakBadge').textContent = `🔥 ${streak} day streak`;
}

function startDailyTimer() {
    if (dailyTimerInterval) clearInterval(dailyTimerInterval);
    const el = document.getElementById('dailyTimer');
    if (!el) return;
    function update() {
        const now = new Date();
        const tomorrow = new Date(now); tomorrow.setHours(24, 0, 0, 0);
        const diff = tomorrow - now;
        const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
        el.textContent = `⏰ Resets in ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
    update();
    dailyTimerInterval = setInterval(update, 1000);
}

function solveDailyChallenge() {
    if (!me || !dailyChallengeData) return;
    dailyChallengeData.solved = true;
    localStorage.setItem('bugout_daily_' + me.id, JSON.stringify(dailyChallengeData));
    const streakKey = 'bugout_daily_streak_' + me.id;
    const lastKey = 'bugout_daily_last_' + me.id;
    const last = localStorage.getItem(lastKey);
    const todayKey = getDailyKey();
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
    let streak = parseInt(localStorage.getItem(streakKey) || '0');
    if (last === yKey) { streak += 1; } else if (last !== todayKey) { streak = 1; }
    localStorage.setItem(streakKey, streak);
    localStorage.setItem(lastKey, todayKey);
    const xp = dailyChallengeData.xp || 30;
    addXP(xp);
    document.getElementById('dailyChallengeWrap').style.display = 'none';
    showAchievement('🎯', 'Daily Challenge Complete!', `+${xp} XP earned! Streak: ${streak} days 🔥`);
}

function skipDailyChallenge() {
    document.getElementById('dailyChallengeWrap').style.display = 'none';
    toast('Challenge skipped. Kal try karna! 💪', 'ok');
}

// ═══════════════════════════════════════════════════════════════
//  📊 ANIMATED COUNTERS
// ═══════════════════════════════════════════════════════════════
function animateCounter(el, target, duration = 1200) {
    if (!el) return;
    const start = 0;
    const startTime = performance.now();
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(start + (target - start) * eased);
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// ═══════════════════════════════════════════════════════════════
//  🏅 ACHIEVEMENT POPUP
// ═══════════════════════════════════════════════════════════════
function showAchievement(icon, title, desc) {
    document.getElementById('achIcon').textContent = icon;
    document.getElementById('achTitle').textContent = title;
    document.getElementById('achDesc').textContent = desc;
    document.getElementById('achOverlay').classList.add('show');
    document.getElementById('achPopup').classList.add('show');
    setTimeout(() => closeAchievement(), 4000);
}

function closeAchievement() {
    document.getElementById('achOverlay').classList.remove('show');
    document.getElementById('achPopup').classList.remove('show');
}

// ═══════════════════════════════════════════════════════════════
//  💀 SKELETON LOADERS
// ═══════════════════════════════════════════════════════════════
function showSkeletonBugs() {
    const grid = document.getElementById('bugsGrid');
    if (!grid) return;
    grid.innerHTML = Array(6).fill('').map(() => `
        <div class="bug-card" style="pointer-events:none;">
            <div class="skeleton skeleton-text short" style="height:20px;width:80px;margin-bottom:12px;"></div>
            <div class="skeleton skeleton-text" style="height:18px;margin-bottom:10px;"></div>
            <div class="skeleton skeleton-text medium" style="height:14px;margin-bottom:6px;"></div>
            <div class="skeleton skeleton-text short" style="height:14px;margin-bottom:16px;"></div>
            <div style="display:flex;justify-content:space-between;">
                <div class="skeleton skeleton-text" style="width:60px;height:12px;"></div>
                <div class="skeleton skeleton-text" style="width:80px;height:12px;"></div>
            </div>
        </div>
    `).join('');
}
