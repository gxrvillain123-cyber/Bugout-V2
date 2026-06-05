const SB_URL = 'https://ufybyvufusswyswoxjra.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmeWJ5dnVmdXNzd3lzd294anJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MDUyOTMsImV4cCI6MjA5MzM4MTI5M30.A-3RT1B5MjSLaX7SpHpyh1IVuYmHzW8Puy8lI3paVA0';
const db = window.supabase?.createClient ? window.supabase.createClient(SB_URL, SB_KEY) : createOfflineSupabaseStub();
const GROQ_API_URL = '/api/groq';
const IMAGE_API_URL = '/api/image';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

function createOfflineSupabaseStub() {
    const empty = { data: [], error: null, count: 0 };
    const single = { data: null, error: null, count: 0 };
    const resolved = Promise.resolve(empty);
    const chain = new Proxy(function noop() {}, {
        get(_target, prop) {
            if (prop === 'then') return resolved.then.bind(resolved);
            if (prop === 'catch') return resolved.catch.bind(resolved);
            if (prop === 'single' || prop === 'maybeSingle') return () => Promise.resolve(single);
            if (prop === 'select' || prop === 'insert' || prop === 'update' || prop === 'upsert' || prop === 'delete' ||
                prop === 'eq' || prop === 'neq' || prop === 'or' || prop === 'in' || prop === 'order' || prop === 'limit' ||
                prop === 'contains' || prop === 'gte' || prop === 'lte' || prop === 'match') return () => chain;
            return chain;
        },
        apply() { return chain; }
    });
    return {
        auth: {
            getSession: async () => ({ data: { session: null }, error: null }),
            getUser: async () => ({ data: { user: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
            signInWithPassword: async () => single,
            signUp: async () => single,
            signOut: async () => ({ error: null })
        },
        from: () => chain,
        channel: () => ({ on() { return this; }, subscribe() { return this; }, unsubscribe() {} })
    };
}

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

async function callGroqStream(messages, options = {}, onToken = () => {}) {
    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: options.signal,
        body: JSON.stringify({
            model: options.model || GROQ_MODEL,
            messages,
            max_tokens: options.max_tokens || 2200,
            temperature: typeof options.temperature === 'number' ? options.temperature : 0.55,
            stream: true
        })
    });
    if (!response.ok) throw new Error(await readGroqError(response));
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '';
        onToken(text, text);
        return text;
    }
    if (!response.body) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '';
        onToken(text, text);
        return text;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', fullText = '';
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') continue;
            try {
                const parsed = JSON.parse(payload);
                const token = parsed.choices?.[0]?.delta?.content || '';
                if (token) {
                    fullText += token;
                    onToken(token, fullText);
                }
            } catch(e) {}
        }
    }
    const tail = buffer.trim();
    if (tail.startsWith('data:')) {
        const payload = tail.slice(5).trim();
        if (payload && payload !== '[DONE]') {
            try {
                const parsed = JSON.parse(payload);
                const token = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || '';
                if (token) {
                    fullText += token;
                    onToken(token, fullText);
                }
            } catch(e) {}
        }
    }
    return fullText;
}

async function callImageGenerator(prompt, options = {}) {
    const response = await fetch(IMAGE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt,
            ...(options.model ? { model: options.model } : {}),
            ...(options.size ? { size: options.size } : {}),
            ...(options.quality ? { quality: options.quality } : {}),
            ...(options.background ? { background: options.background } : {})
        })
    });
    if (!response.ok) throw new Error(await readGroqError(response));
    return response.json();
}

let me = null, myName = null, myXP = 0, myRole = 'user', activeBug = null, activeCategory = 'all', bugToDelete = null;
let editSelectedColor = '#00ff88', editSelectedInterests = [], editingBugId = null, editBugTags = [];
let currentProfileId = null, chatPartnerId = null, chatPartnerProfile = null, msgSubscription = null;
let allFollowersList = [], unreadCheckInterval = null, currentTags = [], searchTimeout = null;
let notifCheckInterval = null, notifPanelOpen = false, myBookmarks = new Set(), activeStatusFilter = null, activeSort = 'newest';
let mentorHistory = [];
let mentorPendingImages = [], mentorPasteReady = false;
let teacherProgress = [], currentTeacherLesson = null;
let teacherAbortController = null, teacherLastPrompt = null, teacherStreamRenderTimer = null;
let teacherVisualFrame = null, teacherBossTimer = null;
let teacherMaterials = [], teacherMaterialChunks = [], teacherPendingImages = [];
let teacherMemory = {
    weakTopics: [],
    strongTopics: [],
    misconceptions: [],
    repeatedMistakes: [],
    skippedConcepts: [],
    preferredStyle: 'visual + direct',
    learningSpeed: 'normal',
    streak: 0,
    confidenceTrend: [],
    attentionPattern: { dropAfterMinutes: 14, lastSessionMinutes: 0 },
    dna: { visual: 78, textual: 52, examples: 68, challenge: 46, pace: 55, retention: 50 },
    graph: []
};
let teacherState = {
    phase: 'entry',
    topic: '',
    subject: 'General',
    diagnostic: { index: 0, max: 5, questions: [], answers: [], result: null },
    roadmap: [],
    mastery: 0,
    confidence: 0,
    difficulty: { label: 'Calibrating', value: 35 },
    xp: 0,
    level: 'Initiate',
    combo: 0,
    rank: 'Unranked',
    materialsUsed: [],
    boss: null,
    visualMode: 'concept',
    lastInterrupt: ''
};
let teacherConfidence = 35;
let lastTriageSuggestion = null;
let arenaProblems = [], arenaSubmissions = new Map(), arenaBatchGeneratedAt = null, arenaTimer = null;

const TEACHER_ROADMAPS = {
    'JavaScript': [
        'Variables and Data Types',
        'Operators and Expressions',
        'Control Flow (if/else, switch)',
        'Loops (for, while, do-while)',
        'Functions and Scope',
        'Arrays and Array Methods',
        'Objects and Object Methods',
        'ES6 Features (let, const, arrow functions)',
        'DOM Manipulation',
        'Events and Event Handling',
        'Async JavaScript (callbacks, promises, async/await)',
        'Error Handling',
        'Modules and Imports',
        'Classes and OOP',
        'Local Storage and Session Storage',
        'Fetch API and AJAX',
        'JSON Handling',
        'Regular Expressions',
        'Date and Time',
        'Math Functions',
        'String Methods',
        'Number Methods'
    ],
    'Python': [
        'Variables and Data Types',
        'Operators and Expressions',
        'Control Flow (if/else, elif)',
        'Loops (for, while)',
        'Functions and Parameters',
        'Lists and List Methods',
        'Tuples and Sets',
        'Dictionaries and Dict Methods',
        'Strings and String Methods',
        'File I/O',
        'Exception Handling',
        'Modules and Imports',
        'Classes and OOP',
        'Inheritance',
        'Polymorphism',
        'Decorators',
        'Generators',
        'List Comprehensions',
        'Lambda Functions',
        'Virtual Environments',
        'NumPy Basics',
        'Pandas Basics',
        'Web Frameworks (Flask/Django basics)'
    ],
    'C': [
        'Variables and Data Types',
        'Operators and Expressions',
        'Control Flow (if/else, switch)',
        'Loops (for, while, do-while)',
        'Functions and Parameters',
        'Arrays and Pointers',
        'Pointers and Memory',
        'Strings and String Functions',
        'Structures',
        'Unions',
        'File I/O',
        'Dynamic Memory Allocation',
        'Linked Lists',
        'Stacks and Queues',
        'Trees (Binary Trees)',
        'Sorting Algorithms',
        'Searching Algorithms',
        'Recursion',
        'Preprocessor Directives',
        'Header Files',
        'Makefile Basics'
    ],
    'C++': [
        'Variables and Data Types',
        'Operators and Expressions',
        'Control Flow (if/else, switch)',
        'Loops (for, while, do-while)',
        'Functions and Parameters',
        'Arrays and Vectors',
        'Pointers and References',
        'Strings and String Classes',
        'Classes and Objects',
        'Constructors and Destructors',
        'Inheritance',
        'Polymorphism',
        'Virtual Functions',
        'Templates',
        'STL Containers',
        'STL Algorithms',
        'Exception Handling',
        'File I/O',
        'Memory Management',
        'Smart Pointers',
        'Lambda Expressions',
        'Multithreading Basics'
    ],
    'Java': [
        'Variables and Data Types',
        'Operators and Expressions',
        'Control Flow (if/else, switch)',
        'Loops (for, while, do-while)',
        'Methods and Parameters',
        'Arrays and ArrayList',
        'Strings and StringBuilder',
        'Classes and Objects',
        'Constructors',
        'Inheritance',
        'Polymorphism',
        'Abstract Classes',
        'Interfaces',
        'Packages and Imports',
        'Exception Handling',
        'Collections Framework',
        'Generics',
        'File I/O',
        'Multithreading',
        'Lambda Expressions',
        'Streams API',
        'Design Patterns Basics'
    ],
    'HTML/CSS': [
        'HTML Basic Structure',
        'HTML Tags and Elements',
        'HTML Forms and Inputs',
        'HTML Semantic Elements',
        'CSS Selectors',
        'CSS Box Model',
        'CSS Layout (Flexbox, Grid)',
        'CSS Positioning',
        'CSS Responsive Design',
        'CSS Animations',
        'CSS Transitions',
        'CSS Variables',
        'JavaScript Integration',
        'Media Queries',
        'CSS Frameworks Basics',
        'Accessibility Basics',
        'SEO Basics',
        'Performance Optimization'
    ],
    'SQL': [
        'Database Basics',
        'SQL Syntax',
        'SELECT Statements',
        'WHERE Clause',
        'ORDER BY and LIMIT',
        'GROUP BY and HAVING',
        'JOIN Operations',
        'Subqueries',
        'INSERT, UPDATE, DELETE',
        'Aggregate Functions',
        'Indexes',
        'Constraints',
        'Transactions',
        'Views',
        'Stored Procedures',
        'Normalization',
        'Database Design',
        'Performance Tuning',
        'Security Basics'
    ],
    'Mathematics': ['Number Systems', 'Algebraic Identities', 'Linear Equations', 'Quadratic Equations', 'Functions', 'Trigonometry', 'Coordinate Geometry', 'Limits', 'Differentiation', 'Integration', 'Probability', 'Statistics'],
    'Physics': ['Units and Dimensions', 'Vectors', 'Kinematics', 'Newton Laws', 'Work Energy Power', 'Rotational Motion', 'Gravitation', 'Thermodynamics', 'Waves', 'Electrostatics', 'Current Electricity', 'Optics'],
    'Chemistry': ['Atomic Structure', 'Periodic Table', 'Chemical Bonding', 'Mole Concept', 'Thermodynamics', 'Equilibrium', 'Redox Reactions', 'Organic Basics', 'Hydrocarbons', 'Coordination Compounds'],
    'Biology': ['Cell Biology', 'Biomolecules', 'Genetics', 'Human Physiology', 'Plant Physiology', 'Ecology', 'Evolution', 'Biotechnology', 'Reproduction'],
    'Computer Networks': ['OSI Model', 'TCP/IP', 'IP Addressing', 'Subnetting', 'DNS', 'HTTP and HTTPS', 'Routing', 'Congestion Control', 'Network Security'],
    'DBMS': ['ER Models', 'Relational Model', 'SQL Joins', 'Normalization', 'Transactions', 'ACID', 'Indexing', 'Query Optimization', 'Concurrency Control'],
    'Operating Systems': ['Processes and Threads', 'CPU Scheduling', 'Synchronization', 'Deadlocks', 'Memory Management', 'Paging', 'File Systems', 'I/O Management']
};

function extractJSON(text, fallback = null) {
    try {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
            return JSON.parse(text.substring(start, end + 1));
        }
    } catch (e) {}
    return fallback;
}

function normalizeTeacherAnswerIndex(value) {
    if (typeof value === 'number') return value;
    const text = String(value || '').trim().toUpperCase();
    if (/^[A-D]$/.test(text)) return text.charCodeAt(0) - 65;
    const number = Number(text);
    return Number.isFinite(number) ? number : -1;
}

const LEVELS = [
    { min: 0,   max: 24,  name: 'Rookie',   emoji: '🌱' },
    { min: 25,  max: 49,  name: 'Warrior',  emoji: '⚔️' },
    { min: 50,  max: 74,  name: 'Knight',   emoji: '🛡️' },
    { min: 75,  max: 99,  name: 'Champion', emoji: '🏆' },
    { min: 100, max: Infinity, name: 'Legend' }
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

function getLevel(xp) { return LEVELS.find(l => xp >= l.min && xp <= l.max) || LEVELS[0]; }
function getLevelNum(xp) { return LEVELS.findIndex(l => xp >= l.min && xp <= l.max) + 1; }
function getXPProgress(xp) { const l = getLevel(xp); if (l.max === Infinity) return 100; return Math.round(((xp - l.min) / (l.max - l.min + 1)) * 100); }
function getXPToNext(xp) { const l = getLevel(xp); return l.max === Infinity ? 0 : l.max - xp + 1; }
function isAdminUser() { return myRole === 'admin'; }
function getRoleBadge(role) { return role === 'admin' ? '<span class="admin-role-badge">Admin</span>' : ''; }
function canManageBug(bug) { return !!me && (isAdminUser() || bug?.user_id === me.id); }
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
    ['bug','profile','mission'].forEach(k => url.searchParams.delete(k));
    Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
    history.pushState({}, '', url);
}
function clearRoute() {
    const url = new URL(window.location.href);
    ['bug','profile','mission'].forEach(k => url.searchParams.delete(k));
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
    const bugId = params.get('bug'), profileId = params.get('profile'), missionId = params.get('mission');
    if (bugId) { await openBug(bugId, true); return true; }
    if (profileId) { await goProfile(profileId, true); return true; }
    if (missionId && typeof openMissionDetail === 'function') { await openMissionDetail(missionId, true); return true; }
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
        if (typeof data.error === 'string') return data.error;
        return data.error?.message || data.message || `AI request failed (${response.status})`;
    } catch(e) {
        return `AI request failed (${response.status})`;
    }
}

// ═══════════════════════════════════════════════════════════════
//  🧠 AI MENTOR MODE
// ═══════════════════════════════════════════════════════════════
const MENTOR_SYSTEM = `You are BUGOUT AI Mentor, a universal academic and research mentor for students from every field.

Core identity:
- Help any learner: school, college, competitive exams, undergraduate, postgraduate, PhD, and research-level users.
- Cover all domains: mathematics, physics, chemistry, biology, medicine, commerce, economics, law, psychology, sociology, political science, history, geography, literature, writing, design, coding, engineering, management, career, and general life/study decisions.
- Do not assume the user is a coder. Adapt to the user's field, level, language, and goal.
- If the user writes in Hindi/Hinglish, reply naturally in Hinglish. Otherwise use clear English.

For mathematics, physics, engineering, statistics, economics, and any equation-heavy subject:
- Solve like a serious student would write in an exam or notebook.
- Show definitions, assumptions, formulas used, substitutions, derivations, intermediate steps, and the final answer.
- Use LaTeX for equations. Use inline math with $...$ and display math with $$...$$ or \\[...\\].
- For long derivations, use aligned equations such as:
  $$
  \\begin{aligned}
  ...
  \\end{aligned}
  $$
- Check units, domains, boundary conditions, edge cases, and reasonableness when relevant.
- For proofs, state the claim, givens, proof method, logical steps, and conclusion.
- For research-level topics, explain intuition first, then formalism, then caveats/open problems if useful.

For humanities, social sciences, commerce, law, literature, and biology:
- Give structured, high-quality answers with concepts, examples, diagrams/tables in text when useful, counterpoints, and exam-ready phrasing.
- For essays/long answers, include thesis, arguments, evidence/examples, and conclusion.
- For biology/medicine, be careful and educational; suggest professional consultation for personal medical decisions.
- For law/finance, explain generally and mention jurisdiction/context limits when relevant.

For coding and technical questions:
- Provide working code when asked, explain bugs clearly, and include complexity/security notes when useful.

General answer style:
- Be precise, honest, and rigorous. If information is missing, state assumptions or ask a focused question.
- Do not hallucinate citations or facts. Say when something depends on syllabus, jurisdiction, dataset, or latest research.
- Prefer complete answers over vague advice. Give formulas, examples, tables, and final takeaways.
- Keep the tone friendly and motivating without becoming childish.
- If the user uploads an image, inspect it carefully and answer from the visual evidence.
- If the user asks for a curve, graph, or plotted math function, explain it briefly in text; the app can also show a generated graph when possible.
- If the user asks to generate a poster, logo, illustration, thumbnail, wallpaper, or other creative image, the app can generate an actual image instead of text.`;

const MENTOR_IMAGE_LIMIT = 5;
const MENTOR_IMAGE_PER_IMAGE_LIMIT = 3.4 * 1024 * 1024;
const MENTOR_IMAGE_TOTAL_LIMIT = 3.7 * 1024 * 1024;
const MENTOR_IMAGE_MAX_DIMENSION = 1600;

async function goMentor() {
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    showPage('mentorPage');
    setupMentorPasteUpload();
}

async function sendMentorMessage() {
    const input = document.getElementById('mentorInput');
    const msg = input.value.trim();
    const attachments = mentorPendingImages.slice();
    if (!msg && attachments.length === 0) return;
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    const visibleText = msg || 'Please explain the uploaded image.';
    const historyText = buildMentorHistoryText(visibleText, attachments);
    const priorHistory = mentorHistory.slice(-10);
    input.value = '';
    input.style.height = '44px';
    clearMentorPendingImages();
    setMentorBusy(true);

    const welcome = document.querySelector('.mentor-welcome');
    if (welcome) welcome.remove();

    appendMentorMessage(visibleText, true, { images: attachments });
    mentorHistory.push({ role: 'user', content: historyText });
    const typingId = showMentorTyping();

    try {
        await db.from('mentor_chats').insert({ user_id: me.id, message: historyText, is_user: true });

        const requestedGraph = createMentorGraphFromText(visibleText);
        const imageRequest = requestedGraph ? null : detectMentorImageGenerationRequest(visibleText);
        if (imageRequest) {
            const imagePrompt = attachments.length
                ? await buildMentorImagePromptFromAttachments(visibleText, attachments)
                : imageRequest.prompt;
            const generated = await callImageGenerator(imagePrompt, {
                size: imageRequest.size,
                quality: imageRequest.quality
            });
            const aiReply = generated.revised_prompt
                ? `Image ready! Prompt refined to: ${generated.revised_prompt}`
                : 'Image ready!';

            removeTyping(typingId);
            appendMentorMessage(aiReply, false, { generatedImage: generated });
            mentorHistory.push({ role: 'assistant', content: `${aiReply}\n[Generated image: ${imagePrompt}]` });

            await db.from('mentor_chats').insert({
                user_id: me.id,
                message: `${aiReply}\n\n[Generated image prompt: ${imagePrompt}]`,
                is_user: false
            });

            setMentorBusy(false);
            input.focus();
            return;
        }

        const messages = [
            { role: 'system', content: MENTOR_SYSTEM },
            ...priorHistory,
            buildMentorModelMessage(visibleText, attachments)
        ];

        const answerProfile = getMentorAnswerProfile(visibleText, attachments);
        const data = await callGroq(messages, {
            model: attachments.length ? GROQ_VISION_MODEL : GROQ_MODEL,
            max_tokens: answerProfile.maxTokens,
            temperature: answerProfile.temperature
        });
        const aiReply = data.choices?.[0]?.message?.content || 'Kuch error aa gaya — dobara try karo!';
        const graph = createMentorGraphFromText(visibleText);

        removeTyping(typingId);
        appendMentorMessage(aiReply, false, { graph });
        mentorHistory.push({ role: 'assistant', content: aiReply });

        await db.from('mentor_chats').insert({
            user_id: me.id,
            message: graph ? `${aiReply}\n\n[Generated visual: y = ${graph.expression}]` : aiReply,
            is_user: false
        });

    } catch(err) {
        removeTyping(typingId);
        appendMentorMessage(`😔 Error: ${err.message}. Dobara try karo!`, false);
    }

    setMentorBusy(false);
    input.focus();
}

function buildMentorHistoryText(text, images = []) {
    if (!images.length) return text;
    const names = images.map(img => img.name).join(', ');
    return `${text}\n\n[Uploaded image${images.length > 1 ? 's' : ''}: ${names}]`;
}

function getMentorAnswerProfile(text, images = []) {
    const raw = String(text || '').toLowerCase();
    const wantsFullWork = /\b(solve|derive|derivation|prove|proof|equation|integral|differentiate|derivative|limit|matrix|eigen|laplace|fourier|probability|statistics|regression|physics|chemistry|economics|phd|research|thesis|paper|full answer|step by step)\b/.test(raw);
    const isMathLike = /[$^=]|\\frac|\\int|\\sum|\\lim|sqrt|sin|cos|tan|log|ln|matrix|vector|tensor|theorem|lemma|calculus|algebra/.test(raw);
    const isAcademic = wantsFullWork || /\b(history|political science|sociology|psychology|biology|medicine|law|commerce|accounts|literature|geography|essay|case study|research methodology)\b/.test(raw);
    if (images.length) return { maxTokens: 2400, temperature: 0.35 };
    if (isMathLike || wantsFullWork) return { maxTokens: 4200, temperature: 0.18 };
    if (isAcademic) return { maxTokens: 3400, temperature: 0.35 };
    return { maxTokens: 2200, temperature: 0.55 };
}

function buildMentorModelMessage(text, images = []) {
    if (!images.length) return { role: 'user', content: text };
    return {
        role: 'user',
        content: [
            { type: 'text', text },
            ...images.map(img => ({
                type: 'image_url',
                image_url: { url: img.dataUrl }
            }))
        ]
    };
}

function detectMentorImageGenerationRequest(text) {
    const raw = String(text || '').trim();
    const lower = raw.toLowerCase();
    if (/^(can|could|will|do)\s+you\s+(generate|create|make|draw|design)\s+(images?|pictures?|pics?|photos?|art|visuals?)\??$/i.test(raw)) {
        return null;
    }
    const hasGenerateVerb = /\b(generate|create|make|draw|design|render|imagine|banao|banado|bana)\b/i.test(raw);
    const hasImageNoun = /\b(image|picture|pic|photo|poster|logo|illustration|wallpaper|thumbnail|artwork|visual|sticker|banner)\b/i.test(raw);
    if (!hasGenerateVerb || !hasImageNoun) return null;

    const prompt = normalizeMentorImagePrompt(raw);
    const wide = /\b(wide|landscape|banner|cover|youtube|thumbnail|16:9)\b/i.test(lower);
    const tall = /\b(portrait|story|poster|vertical|phone|wallpaper|9:16)\b/i.test(lower);
    return {
        prompt,
        size: wide ? '1536x1024' : tall ? '1024x1536' : '1024x1024',
        quality: /\b(high|hd|detailed|premium)\b/i.test(lower) ? 'high' : 'medium'
    };
}

function normalizeMentorImagePrompt(text) {
    const cleaned = String(text || '')
        .replace(/^(please\s+)?(can\s+you\s+)?(generate|create|make|draw|design|render|imagine|banao|banado|bana)\s+(me\s+)?(an?\s+)?/i, '')
        .replace(/^(image|picture|pic|photo|poster|logo|illustration|wallpaper|thumbnail|artwork|visual|sticker|banner)\s+(of|for)?\s*/i, '')
        .trim();
    return cleaned || text;
}

async function buildMentorImagePromptFromAttachments(text, attachments) {
    const promptBuilder = `Convert the user's request and uploaded reference image(s) into one polished image-generation prompt.
Use the images as visual references when relevant. Include style, subject, composition, colors, and important constraints.
Return only the final prompt. Do not add quotes, markdown, or commentary.`;
    const data = await callGroq([
        { role: 'system', content: promptBuilder },
        buildMentorModelMessage(text, attachments)
    ], {
        model: GROQ_VISION_MODEL,
        max_tokens: 500,
        temperature: 0.45
    });
    const prompt = data.choices?.[0]?.message?.content?.trim();
    return prompt || normalizeMentorImagePrompt(text);
}

function setMentorBusy(isBusy) {
    const sendBtn = document.getElementById('mentorSendBtn');
    const uploadBtn = document.getElementById('mentorUploadBtn');
    if (sendBtn) sendBtn.disabled = isBusy;
    if (uploadBtn) uploadBtn.disabled = isBusy;
}

function openMentorImagePicker() {
    const input = document.getElementById('mentorImageInput');
    if (input) input.click();
}

async function handleMentorImageFiles(fileList) {
    const files = Array.from(fileList || []).filter(file => file && file.type.startsWith('image/'));
    if (!files.length) return;
    const available = MENTOR_IMAGE_LIMIT - mentorPendingImages.length;
    if (available <= 0) {
        toast(`Max ${MENTOR_IMAGE_LIMIT} images ek message mein upload kar sakte ho.`, 'err');
        return;
    }
    const batch = files.slice(0, available);
    if (files.length > available) toast(`Sirf ${available} aur image add ho sakti hai.`, 'err');

    try {
        for (const file of batch) {
            const prepared = await prepareMentorImage(file);
            const totalBytes = mentorPendingImages.reduce((sum, img) => sum + img.bytes, 0) + prepared.bytes;
            if (totalBytes > MENTOR_IMAGE_TOTAL_LIMIT) {
                toast('Images thodi heavy hain. Ek chhoti/clear screenshot upload karo.', 'err');
                break;
            }
            mentorPendingImages.push(prepared);
        }
        renderMentorAttachmentPreview();
    } catch(err) {
        toast(err.message || 'Image upload nahi ho paya.', 'err');
    } finally {
        const picker = document.getElementById('mentorImageInput');
        if (picker) picker.value = '';
    }
}

async function prepareMentorImage(file) {
    const rawDataUrl = await readFileAsDataUrl(file);
    let dataUrl = rawDataUrl;
    let bytes = dataUrlByteLength(dataUrl);
    if (bytes > MENTOR_IMAGE_PER_IMAGE_LIMIT) {
        dataUrl = await compressMentorImage(rawDataUrl);
        bytes = dataUrlByteLength(dataUrl);
    }
    if (bytes > MENTOR_IMAGE_PER_IMAGE_LIMIT) {
        throw new Error(`${file.name || 'Image'} abhi bhi too large hai. Crop ya chhota screenshot try karo.`);
    }
    return {
        id: 'mentor-img-' + Date.now() + '-' + Math.random().toString(36).slice(2),
        name: file.name || 'image',
        bytes,
        dataUrl
    };
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Image read nahi ho payi.'));
        reader.readAsDataURL(file);
    });
}

function loadMentorImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image load nahi ho payi.'));
        img.src = dataUrl;
    });
}

async function compressMentorImage(dataUrl) {
    const img = await loadMentorImage(dataUrl);
    let maxDim = MENTOR_IMAGE_MAX_DIMENSION;
    let best = dataUrl;
    for (let pass = 0; pass < 4; pass++) {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.86, 0.76, 0.66, 0.56]) {
            best = canvas.toDataURL('image/jpeg', quality);
            if (dataUrlByteLength(best) <= MENTOR_IMAGE_PER_IMAGE_LIMIT) return best;
        }
        maxDim = Math.round(maxDim * 0.75);
    }
    return best;
}

function dataUrlByteLength(dataUrl) {
    const base64 = String(dataUrl || '').split(',')[1] || '';
    return Math.ceil(base64.length * 3 / 4);
}

function renderMentorAttachmentPreview() {
    const wrap = document.getElementById('mentorAttachmentPreview');
    if (!wrap) return;
    wrap.classList.toggle('show', mentorPendingImages.length > 0);
    wrap.innerHTML = mentorPendingImages.map(img => `
        <div class="mentor-attachment-chip">
            <img src="${img.dataUrl}" alt="${esc(img.name)}">
            <div class="mentor-attachment-meta">
                <div class="mentor-attachment-name">${esc(img.name)}</div>
                <div class="mentor-attachment-size">${formatMentorFileSize(img.bytes)}</div>
            </div>
            <button class="mentor-attachment-remove" onclick="removeMentorImage('${img.id}')" title="Remove image" aria-label="Remove image">×</button>
        </div>
    `).join('');
}

function removeMentorImage(id) {
    mentorPendingImages = mentorPendingImages.filter(img => img.id !== id);
    renderMentorAttachmentPreview();
}

function clearMentorPendingImages() {
    mentorPendingImages = [];
    renderMentorAttachmentPreview();
    const picker = document.getElementById('mentorImageInput');
    if (picker) picker.value = '';
}

function setupMentorPasteUpload() {
    if (mentorPasteReady) return;
    const input = document.getElementById('mentorInput');
    if (!input) return;
    input.addEventListener('paste', event => {
        const imageFiles = Array.from(event.clipboardData?.files || []).filter(file => file.type.startsWith('image/'));
        if (!imageFiles.length) return;
        event.preventDefault();
        handleMentorImageFiles(imageFiles);
    });
    mentorPasteReady = true;
}

function formatMentorFileSize(bytes) {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function appendMentorMessage(text, isUser, options = {}) {
    const container = document.getElementById('mentorMessages');
    const wrap = document.createElement('div');
    wrap.className = `mentor-bubble-wrap ${isUser ? 'user' : 'ai'}`;
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const avatarHTML = isUser
        ? `<div class="mentor-av user-av">${(myName||'U')[0].toUpperCase()}</div>`
        : `<div class="mentor-av ai">🧠</div>`;
    const formattedText = formatMentorText(normalizeMentorErrorText(text));
    const imageHTML = options.images?.length ? `<div class="mentor-bubble-media">${options.images.map(img => `<img src="${img.dataUrl}" alt="${esc(img.name)}">`).join('')}</div>` : '';
    const graphHTML = options.graph ? renderMentorGraphCard(options.graph) : '';
    const generatedImageHTML = options.generatedImage ? renderMentorGeneratedImageCard(options.generatedImage) : '';
    wrap.innerHTML = `${avatarHTML}<div><div class="mentor-bubble">${imageHTML}${formattedText}${graphHTML}${generatedImageHTML}</div><div class="mentor-time">${timeStr}</div></div>`;
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
    typesetMentorMath(wrap);
}

function normalizeMentorErrorText(text) {
    const message = String(text || '');
    if (/\b(billing|hard limit|quota|usage limit|insufficient_quota)\b/i.test(message)) {
        return `Image generation blocked: OpenAI billing limit reached. Admin ko OpenAI billing limit increase karna hoga ya working OPENAI_API_KEY lagani hogi. (${message.replace(/\s*Dobara try karo!?\s*/i, '').trim()})`;
    }
    return message;
}

function formatMentorText(text) {
    const placeholders = [];
    const hold = html => {
        const key = `@@MENTOR_BLOCK_${placeholders.length}@@`;
        placeholders.push([key, html]);
        return key;
    };

    let t = esc(text);
    t = t.replace(/```([\s\S]*?)```/g, (_, code) => hold(`<pre><code>${code.trim()}</code></pre>`));
    t = t.replace(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\])/g, match => hold(`<div class="mentor-math-block">${match}</div>`));
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\n/g, '<br>');
    placeholders.forEach(([key, html]) => { t = t.replace(key, html); });
    return t;
}

function typesetMentorMath(root) {
    if (!window.MathJax?.typesetPromise) return;
    window.MathJax.typesetPromise([root]).catch(() => {});
}

function createMentorGraphFromText(text) {
    const expression = extractMentorGraphExpression(text);
    if (!expression) return null;
    const parsed = parseMentorMathExpression(expression);
    if (!parsed) return null;
    return buildMentorGraph(parsed.expression, parsed.evaluate);
}

function extractMentorGraphExpression(text) {
    const raw = String(text || '').replace(/π/g, 'pi').replace(/[−–—]/g, '-');
    const wantsGraph = /\b(graph|plot|curve|draw|visuali[sz]e|image|pic|picture|banao|dikhao)\b/i.test(raw);
    const equationMatch = raw.match(/(?:y\s*=|f\s*\(\s*x\s*\)\s*=)\s*([a-z0-9xpie+\-*/^().\s]+)/i);
    if (equationMatch) return cleanupMentorExpression(equationMatch[1]);
    if (!wantsGraph) return null;
    const phraseMatch = raw.match(/(?:graph|plot|curve|draw|visuali[sz]e|show|image|pic|picture|banao|dikhao)(?:\s+(?:of|for|the|ka|ki|ko))?\s+([a-z0-9xpie+\-*/^().\s]+)/i);
    if (phraseMatch) return cleanupMentorExpression(phraseMatch[1]);
    const trigMatch = raw.match(/\b(sin|cos|tan)\s*x\b/i);
    if (trigMatch) return `${trigMatch[1]}(x)`;
    return null;
}

function cleanupMentorExpression(expr) {
    let value = String(expr || '');
    for (let i = 0; i < 3; i++) {
        value = value.replace(/^(?:such\s+as\s+)?(?:curve|graph|plot|draw|of|for|the|ka|ki|ko)\s+/i, '');
    }
    return value
        .replace(/\b(please|pls|karo|karna|bana|banao|dikhao|show|etc|instead|ascii|art)\b.*$/i, '')
        .replace(/\b(sin|cos|tan|log|ln|sqrt|abs|exp)\s*x\b/gi, '$1(x)')
        .replace(/\s+/g, '')
        .replace(/^y=/i, '')
        .trim();
}

function parseMentorMathExpression(input) {
    const expression = cleanupMentorExpression(input);
    if (!expression || expression.length > 80) return null;
    try {
        const tokens = insertMentorImplicitMultiplication(tokenizeMentorExpression(expression));
        let pos = 0;
        const peek = () => tokens[pos];
        const take = () => tokens[pos++];
        const parseExpression = () => {
            let node = parseTerm();
            while (peek()?.value === '+' || peek()?.value === '-') {
                const op = take().value;
                const right = parseTerm();
                const left = node;
                node = x => op === '+' ? left(x) + right(x) : left(x) - right(x);
            }
            return node;
        };
        const parseTerm = () => {
            let node = parsePower();
            while (peek()?.value === '*' || peek()?.value === '/') {
                const op = take().value;
                const right = parsePower();
                const left = node;
                node = x => op === '*' ? left(x) * right(x) : left(x) / right(x);
            }
            return node;
        };
        const parsePower = () => {
            let node = parseUnary();
            if (peek()?.value === '^') {
                take();
                const right = parsePower();
                const left = node;
                node = x => Math.pow(left(x), right(x));
            }
            return node;
        };
        const parseUnary = () => {
            if (peek()?.value === '+') { take(); return parseUnary(); }
            if (peek()?.value === '-') {
                take();
                const node = parseUnary();
                return x => -node(x);
            }
            return parsePrimary();
        };
        const parsePrimary = () => {
            const token = take();
            if (!token) throw new Error('Unexpected end');
            if (token.type === 'number') return () => token.value;
            if (token.type === 'variable') return x => x;
            if (token.type === 'constant') return () => token.value === 'pi' ? Math.PI : Math.E;
            if (token.type === 'func') {
                const fnName = token.value;
                const arg = parsePrimary();
                return x => applyMentorMathFunction(fnName, arg(x));
            }
            if (token.value === '(') {
                const node = parseExpression();
                if (take()?.value !== ')') throw new Error('Missing closing paren');
                return node;
            }
            throw new Error('Bad token');
        };
        const evaluate = parseExpression();
        if (pos !== tokens.length) return null;
        return { expression, evaluate };
    } catch(e) {
        return null;
    }
}

function tokenizeMentorExpression(expression) {
    const tokens = [];
    let i = 0;
    while (i < expression.length) {
        const ch = expression[i];
        if (/[0-9.]/.test(ch)) {
            let j = i + 1;
            while (j < expression.length && /[0-9.]/.test(expression[j])) j++;
            const value = Number(expression.slice(i, j));
            if (!Number.isFinite(value)) throw new Error('Bad number');
            tokens.push({ type: 'number', value });
            i = j;
            continue;
        }
        if (/[a-z]/i.test(ch)) {
            let j = i + 1;
            while (j < expression.length && /[a-z]/i.test(expression[j])) j++;
            const word = expression.slice(i, j).toLowerCase();
            if (word === 'x') tokens.push({ type: 'variable', value: word });
            else if (word === 'pi' || word === 'e') tokens.push({ type: 'constant', value: word });
            else if (['sin','cos','tan','asin','acos','atan','sqrt','abs','log','ln','exp'].includes(word)) tokens.push({ type: 'func', value: word });
            else throw new Error('Unsupported token');
            i = j;
            continue;
        }
        if ('+-*/^()'.includes(ch)) {
            tokens.push({ type: ch === '(' || ch === ')' ? 'paren' : 'op', value: ch });
            i++;
            continue;
        }
        throw new Error('Bad character');
    }
    return tokens;
}

function insertMentorImplicitMultiplication(tokens) {
    const out = [];
    const endsValue = token => token && (['number','variable','constant'].includes(token.type) || token.value === ')');
    const startsValue = token => token && (['number','variable','constant','func'].includes(token.type) || token.value === '(');
    tokens.forEach(token => {
        const prev = out[out.length - 1];
        if (endsValue(prev) && startsValue(token)) out.push({ type: 'op', value: '*' });
        out.push(token);
    });
    return out;
}

function applyMentorMathFunction(name, value) {
    const fns = {
        sin: Math.sin, cos: Math.cos, tan: Math.tan,
        asin: Math.asin, acos: Math.acos, atan: Math.atan,
        sqrt: Math.sqrt, abs: Math.abs, log: Math.log10 || (v => Math.log(v) / Math.LN10),
        ln: Math.log, exp: Math.exp
    };
    return fns[name](value);
}

function buildMentorGraph(expression, evaluate) {
    const W = 720, H = 420, PAD = 48;
    const trig = /\b(sin|cos|tan|asin|acos|atan)\b/i.test(expression);
    const xMin = trig ? -2 * Math.PI : -10;
    const xMax = trig ? 2 * Math.PI : 10;
    const samples = 520;
    const points = [];
    for (let i = 0; i <= samples; i++) {
        const x = xMin + (i / samples) * (xMax - xMin);
        const y = evaluate(x);
        points.push({ x, y: Number.isFinite(y) && Math.abs(y) < 1e5 ? y : null });
    }
    const ys = points.map(p => p.y).filter(y => y !== null).sort((a, b) => a - b);
    if (!ys.length) return null;
    const low = ys[Math.floor(ys.length * 0.03)];
    const high = ys[Math.floor(ys.length * 0.97)];
    let yMin = Number.isFinite(low) ? low : ys[0];
    let yMax = Number.isFinite(high) ? high : ys[ys.length - 1];
    if (Math.abs(yMax - yMin) < 0.0001) { yMin -= 1; yMax += 1; }
    const yPad = (yMax - yMin) * 0.14;
    yMin -= yPad;
    yMax += yPad;
    const sx = x => PAD + ((x - xMin) / (xMax - xMin)) * (W - PAD * 2);
    const sy = y => H - PAD - ((y - yMin) / (yMax - yMin)) * (H - PAD * 2);
    const grid = [];
    for (let i = 0; i <= 8; i++) {
        const gx = PAD + i * ((W - PAD * 2) / 8);
        const gy = PAD + i * ((H - PAD * 2) / 8);
        grid.push(`<line class="mentor-graph-grid" x1="${gx}" y1="${PAD}" x2="${gx}" y2="${H - PAD}"></line>`);
        grid.push(`<line class="mentor-graph-grid" x1="${PAD}" y1="${gy}" x2="${W - PAD}" y2="${gy}"></line>`);
    }
    const axis = [];
    if (xMin < 0 && xMax > 0) axis.push(`<line class="mentor-graph-axis" x1="${sx(0)}" y1="${PAD}" x2="${sx(0)}" y2="${H - PAD}"></line>`);
    if (yMin < 0 && yMax > 0) axis.push(`<line class="mentor-graph-axis" x1="${PAD}" y1="${sy(0)}" x2="${W - PAD}" y2="${sy(0)}"></line>`);
    const segments = [];
    let current = [];
    points.forEach((point, index) => {
        const y = point.y;
        if (y === null || y < yMin || y > yMax) {
            if (current.length > 1) segments.push(current);
            current = [];
            return;
        }
        const xy = `${sx(point.x).toFixed(1)},${sy(y).toFixed(1)}`;
        const prev = points[index - 1];
        if (prev && prev.y !== null && Math.abs(prev.y - y) > (yMax - yMin) * 0.42) {
            if (current.length > 1) segments.push(current);
            current = [];
        }
        current.push(xy);
    });
    if (current.length > 1) segments.push(current);
    const lines = segments.map(seg => `<polyline class="mentor-graph-line" points="${seg.join(' ')}"></polyline>`).join('');
    const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Graph of y equals ${esc(expression)}">
        <rect x="0" y="0" width="${W}" height="${H}" fill="#050505"></rect>
        ${grid.join('')}
        ${axis.join('')}
        ${lines}
        <text class="mentor-graph-label" x="${PAD}" y="${H - 16}">x: ${formatGraphNumber(xMin)} to ${formatGraphNumber(xMax)}</text>
        <text class="mentor-graph-label" x="${W - PAD - 170}" y="${H - 16}">y: ${formatGraphNumber(yMin)} to ${formatGraphNumber(yMax)}</text>
    </svg>`;
    return { expression, svg };
}

function formatGraphNumber(value) {
    if (Math.abs(value - Math.PI) < 0.01) return 'pi';
    if (Math.abs(value + Math.PI) < 0.01) return '-pi';
    if (Math.abs(value - 2 * Math.PI) < 0.01) return '2pi';
    if (Math.abs(value + 2 * Math.PI) < 0.01) return '-2pi';
    return Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(2);
}

function renderMentorGraphCard(graph) {
    if (!graph) return '';
    return `<div class="mentor-graph-card">
        <div class="mentor-graph-head"><strong>Generated graph</strong><span>y = ${esc(graph.expression)}</span></div>
        ${graph.svg}
    </div>`;
}

function renderMentorGeneratedImageCard(result) {
    if (!result?.image) return '';
    const label = result.model ? `${result.model} · ${result.size || 'image'}` : 'Generated image';
    const prompt = result.revised_prompt || result.prompt || '';
    const imageSrc = esc(result.image);
    return `<div class="mentor-generated-image-card">
        <div class="mentor-generated-image-head">
            <strong>Generated image</strong>
            <span>${esc(label)}</span>
        </div>
        <div class="mentor-image-frame">
            <div class="mentor-image-status">Generating image...</div>
            <img src="${imageSrc}" data-src-base="${imageSrc}" data-retry="0" alt="${esc(prompt || 'Generated image')}" loading="lazy" onload="markMentorGeneratedImageLoaded(this)" onerror="retryMentorGeneratedImage(this)">
        </div>
        <div class="mentor-generated-image-actions">
            <a class="mentor-image-download" href="${imageSrc}" download="bugout-mentor-image.png">Download</a>
        </div>
    </div>`;
}

function markMentorGeneratedImageLoaded(img) {
    const frame = img.closest('.mentor-image-frame');
    if (!frame) return;
    frame.classList.add('loaded');
    const status = frame.querySelector('.mentor-image-status');
    if (status) status.remove();
}

function retryMentorGeneratedImage(img) {
    const frame = img.closest('.mentor-image-frame');
    const status = frame?.querySelector('.mentor-image-status');
    const attempts = Number(img.dataset.retry || '0') + 1;
    img.dataset.retry = String(attempts);

    if (attempts > 8) {
        if (status) status.textContent = 'Free image server is slow. Retry from prompt or use Download after a minute.';
        return;
    }

    if (status) status.textContent = attempts < 3 ? 'Still generating image...' : 'Free image server is warming up...';
    const base = img.dataset.srcBase || img.src;
    const separator = base.includes('?') ? '&' : '?';
    setTimeout(() => {
        img.src = `${base}${separator}retry=${attempts}&t=${Date.now()}`;
    }, Math.min(2500 + attempts * 1500, 10000));
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
    clearMentorPendingImages();
    document.getElementById('mentorMessages').innerHTML = `
        <div class="mentor-welcome">
            <div class="mentor-welcome-icon">🧠</div>
            <h3>BUGOUT AI Mentor</h3>
            <p>Ask anything from school basics to PhD-level research. I can solve equations, derive formulas, explain biology, write social science answers, review essays, debug code, and help you study deeply.</p>
            <div class="mentor-suggestions">
                <button class="mentor-suggest-btn" onclick="sendMentorSuggestion('Solve this step by step: integrate x^2 sin(x) dx')">Math derivation</button>
                <button class="mentor-suggest-btn" onclick="sendMentorSuggestion('Explain photosynthesis at NEET level with equations and key terms')">Biology answer</button>
                <button class="mentor-suggest-btn" onclick="sendMentorSuggestion('Write a UPSC-style answer on federalism in India with examples')">Social science</button>
                <button class="mentor-suggest-btn" onclick="sendMentorSuggestion('Explain quantum entanglement at undergraduate level')">Physics concept</button>
                <button class="mentor-suggest-btn" onclick="sendMentorSuggestion('Help me frame a research question and methodology for a thesis topic')">Research help</button>
            </div>
        </div>`;
    toast('Chat clear ho gaya! 🗑️', 'ok');
}

// AI Teacher Mentor OS V2: active diagnostics, memory, progression, and visual teaching.
const TEACHER_MEMORY_KEY = 'bugout_teacher_mentor_memory_v2';
const TEACHER_STATE_KEY = 'bugout_teacher_mentor_state_v2';
const TEACHER_PROGRESS_KEY = 'bugout_teacher_mentor_progress_v2';
const TEACHER_MAX_DIAGNOSTIC = 6;
const MENTOR_STOP_WORDS = new Set(['the','and','for','with','this','that','from','have','will','are','was','were','you','your','what','when','where','why','how','into','about','hai','hain','kya','aur','ke','ka','ki','ko','se','to','of','in','on']);

const TEACHER_TOPIC_BLUEPRINTS = {
    recursion: {
        subject: 'Programming',
        visual: 'recursion',
        keywords: ['base case','recursive call','return','stack','trace','n-1','call stack'],
        misconceptions: [
            { id: 'recursive-return-confusion', test: text => /call/i.test(text) && !/return|backtrack|unwind/i.test(text), label: 'Confusing recursive calls with recursive returns' },
            { id: 'missing-base-case', test: text => !/base|stop|terminat/i.test(text), label: 'Base case is not part of the mental model yet' }
        ],
        path: ['Call stack basics', 'Base case discipline', 'Call vs return tracing', 'State snapshots', 'Edge cases', 'Timed recursion boss']
    },
    sql: {
        subject: 'Databases',
        visual: 'sql',
        keywords: ['join','left','right','inner','outer','null','matching','rows','table'],
        misconceptions: [
            { id: 'join-preservation', test: text => /left/i.test(text) && !/all|preserve|null|unmatched/i.test(text), label: 'JOIN type is memorized, not reasoned from preserved rows' },
            { id: 'cartesian-risk', test: text => /join/i.test(text) && !/on|condition|key/i.test(text), label: 'Join condition is being treated as optional' }
        ],
        path: ['Table mental model', 'Keys and matching rows', 'INNER vs LEFT', 'NULL preservation', 'Aggregation after joins', 'Timed query boss']
    },
    electrostatics: {
        subject: 'Physics',
        visual: 'field',
        keywords: ['charge','field','force','vector','direction','superposition','potential','coulomb'],
        misconceptions: [
            { id: 'scalar-vector-mix', test: text => /formula|kq|r/i.test(text) && !/direction|vector|component|superposition/i.test(text), label: 'Treating electric field like a scalar formula' },
            { id: 'sign-direction', test: text => /negative|positive|charge/i.test(text) && !/towards|away|direction/i.test(text), label: 'Charge sign is not connected to field direction' }
        ],
        path: ['Charge and field intuition', 'Vector direction', 'Superposition', 'Potential vs field', 'JEE trap drills', 'Timed electrostatics boss']
    },
    organic: {
        subject: 'Chemistry',
        visual: 'chemistry',
        keywords: ['mechanism','nucleophile','electrophile','intermediate','leaving group','electron','stability'],
        misconceptions: [
            { id: 'reaction-memorization', test: text => /memor|remember|name reaction/i.test(text) && !/mechanism|electron|why/i.test(text), label: 'Reactions are being memorized without electron-flow logic' },
            { id: 'site-selection', test: text => /attack|substitution|addition/i.test(text) && !/electrophile|nucleophile|stability|leaving/i.test(text), label: 'Attack site is not being chosen from mechanism constraints' }
        ],
        path: ['Electron flow', 'Nucleophile/electrophile roles', 'Leaving groups', 'Intermediate stability', 'Reaction family map', 'Timed mechanism boss']
    },
    tree: {
        subject: 'DSA',
        visual: 'tree',
        keywords: ['root','node','edge','child','subtree','height','traversal','recursion'],
        misconceptions: [
            { id: 'linear-tree-model', test: text => /list|array|line/i.test(text) && !/branch|child|subtree|root/i.test(text), label: 'Trees are being flattened into a linear structure' },
            { id: 'traversal-order', test: text => /inorder|preorder|postorder/i.test(text) && !/root|left|right/i.test(text), label: 'Traversal names are memorized without node-order reasoning' }
        ],
        path: ['Node relationships', 'Recursive subtrees', 'Traversal order', 'Height and balance', 'Search/insertion traces', 'Timed tree boss']
    },
    default: {
        subject: 'General',
        visual: 'concept',
        keywords: ['definition','example','why','rule','apply','edge','mistake'],
        misconceptions: [
            { id: 'definition-only', test: text => text.split(/\s+/).length < 18, label: 'The answer is too shallow to trust yet' }
        ],
        path: ['Prerequisites', 'Core mental model', 'Worked examples', 'Common traps', 'Challenge applications', 'Boss battle']
    }
};

function getTeacherBlueprint(topic = teacherState.topic) {
    const t = String(topic || '').toLowerCase();
    if (/recursion|recursive|call stack/.test(t)) return TEACHER_TOPIC_BLUEPRINTS.recursion;
    if (/sql|join|database|dbms/.test(t)) return TEACHER_TOPIC_BLUEPRINTS.sql;
    if (/electrostatic|electric field|coulomb|charge/.test(t)) return TEACHER_TOPIC_BLUEPRINTS.electrostatics;
    if (/organic|reaction|chemistry|sn1|sn2|hydrocarbon/.test(t)) return TEACHER_TOPIC_BLUEPRINTS.organic;
    if (/binary tree|tree|graph traversal|bst|heap/.test(t)) return TEACHER_TOPIC_BLUEPRINTS.tree;
    return TEACHER_TOPIC_BLUEPRINTS.default;
}

function resetTeacherState(topic = '') {
    const blueprint = getTeacherBlueprint(topic);
    teacherState = {
        phase: topic ? 'diagnostic' : 'entry',
        topic,
        subject: blueprint.subject,
        diagnostic: { index: 0, max: 5, questions: [], answers: [], result: null },
        roadmap: [],
        mastery: 0,
        confidence: 0,
        difficulty: { label: 'Calibrating', value: 35 },
        xp: Number(teacherState?.xp || teacherMemory?.xp || 0),
        level: teacherState?.level || 'Initiate',
        combo: 0,
        rank: teacherState?.rank || 'Unranked',
        materialsUsed: teacherMaterials.map(item => item.name),
        boss: null,
        visualMode: blueprint.visual,
        lastInterrupt: ''
    };
}

async function goTeacher() {
    showPage('teacherPage');
    initTeacherLibraries();
    await loadTeacherMemory();
    await loadTeacherProgress();
    restoreTeacherState();
    renderTeacherEntry();
    renderTeacherScreen();
}

function initTeacherLibraries() {
    if (window.mermaid && !window._teacherMermaidReady) {
        window.mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
        window._teacherMermaidReady = true;
    }
}

function restoreTeacherState() {
    try {
        const saved = JSON.parse(localStorage.getItem(TEACHER_STATE_KEY) || '{}');
        if (saved && saved.topic && saved.phase !== 'entry') {
            teacherState = { ...teacherState, ...saved };
            teacherState.diagnostic = { ...teacherState.diagnostic, ...(saved.diagnostic || {}) };
        }
    } catch(e) {}
}

function persistTeacherState() {
    try {
        localStorage.setItem(TEACHER_STATE_KEY, JSON.stringify({
            phase: teacherState.phase,
            topic: teacherState.topic,
            subject: teacherState.subject,
            diagnostic: teacherState.diagnostic,
            roadmap: teacherState.roadmap,
            mastery: teacherState.mastery,
            confidence: teacherState.confidence,
            difficulty: teacherState.difficulty,
            xp: teacherState.xp,
            level: teacherState.level,
            rank: teacherState.rank,
            visualMode: teacherState.visualMode
        }));
    } catch(e) {}
}

function renderTeacherScreen() {
    const entry = document.getElementById('teacherEntryScreen');
    const diagnostic = document.getElementById('teacherDiagnosticScreen');
    const lab = document.getElementById('teacherLabScreen');
    if (!entry || !diagnostic || !lab) return;
    entry.hidden = teacherState.phase !== 'entry';
    diagnostic.hidden = teacherState.phase !== 'diagnostic';
    lab.hidden = teacherState.phase !== 'learning';
    if (teacherState.phase === 'diagnostic') renderTeacherDiagnostic();
    if (teacherState.phase === 'learning') {
        renderTeacherLab();
        startTeacherVisualEngine();
    }
}

function renderTeacherEntry() {
    const strip = document.getElementById('teacherEntryMemoryStrip');
    if (!strip) return;
    const weak = (teacherMemory.weakTopics || [])[0] || 'None yet';
    const style = teacherMemory.preferredStyle || 'visual + direct';
    const retention = Math.round(teacherMemory.dna?.retention || 50);
    strip.innerHTML = `
        <div><span>Memory</span><strong>${esc((teacherMemory.graph || []).length)} signals</strong></div>
        <div><span>Focus next</span><strong>${esc(weak)}</strong></div>
        <div><span>Best style</span><strong>${esc(style)}</strong></div>
        <div><span>Retention</span><strong>${retention}%</strong></div>
    `;
}

function startTeacherFromExample(topic) {
    const input = document.getElementById('teacherStruggleInput');
    if (input) input.value = topic;
    startTeacherDiagnosticFromEntry();
}

function handleTeacherEntryKey(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        startTeacherDiagnosticFromEntry();
    }
}

function autoResizeTeacherEntry(el) {
    if (!el) return;
    el.style.height = '56px';
    el.style.height = Math.min(el.scrollHeight, 132) + 'px';
}

function startTeacherDiagnosticFromEntry() {
    const input = document.getElementById('teacherStruggleInput');
    const topic = String(input?.value || '').trim();
    if (!topic) {
        toast('Type one topic you are struggling with.', 'err');
        input?.focus();
        return;
    }
    resetTeacherState(topic.slice(0, 120));
    const blueprint = getTeacherBlueprint(topic);
    teacherState.subject = blueprint.subject;
    teacherState.visualMode = blueprint.visual;
    teacherState.diagnostic.questions = [buildTeacherDiagnosticQuestion(0)];
    teacherState.diagnostic.max = 5;
    teacherConfidence = 35;
    persistTeacherState();
    renderTeacherScreen();
}

function buildTeacherDiagnosticQuestion(index) {
    const topic = teacherState.topic || 'this topic';
    const blueprint = getTeacherBlueprint(topic);
    const prior = teacherState.diagnostic.answers;
    const last = prior[prior.length - 1];
    if (index === 0) {
        return {
            skill: 'Mental model',
            difficulty: 'Warm start',
            prompt: `Explain ${topic} in your own words. Keep it short, but make the idea precise.`,
            choices: []
        };
    }
    if (index === 1) return buildAppliedDiagnosticQuestion(topic, blueprint);
    if (index === 2) {
        return {
            skill: 'Self-awareness',
            difficulty: 'Calibration',
            prompt: 'Which part is most likely to break when you solve a real problem?',
            choices: ['I know the definition but freeze in problems', 'I confuse steps or order', 'I miss edge cases', 'I can solve easy ones but not hard ones']
        };
    }
    if (last?.analysis?.confidenceMismatch) {
        return {
            skill: 'Confidence audit',
            difficulty: 'Challenge',
            prompt: `You sounded more confident than your reasoning showed. Defend one key step in ${topic} without using memorized words.`,
            choices: []
        };
    }
    if ((last?.analysis?.score || 0) < 45) {
        return {
            skill: 'Prerequisite scan',
            difficulty: 'Foundation',
            prompt: `Name the prerequisite you need before ${topic} starts making sense, then give one tiny example.`,
            choices: []
        };
    }
    return {
        skill: 'Edge case',
        difficulty: 'Adaptive',
        prompt: `Now handle a slightly uncomfortable case in ${topic}. What changes when the usual simple example is no longer clean?`,
        choices: []
    };
}

function buildAppliedDiagnosticQuestion(topic, blueprint) {
    if (blueprint.visual === 'recursion') {
        return {
            skill: 'Trace',
            difficulty: 'Applied',
            prompt: 'Trace `f(3)` for `int f(int n){ if(n==0)return 1; return n*f(n-1); }`. Where do calls stop, and where do returns begin?',
            choices: []
        };
    }
    if (blueprint.visual === 'sql') {
        return {
            skill: 'Preserved rows',
            difficulty: 'Applied',
            prompt: 'You have `students` and `marks`. Which JOIN keeps students who have no marks yet, and why?',
            choices: ['INNER JOIN, because it keeps every student', 'LEFT JOIN from students, because unmatched marks become NULL', 'RIGHT JOIN from marks, because marks are important', 'CROSS JOIN, because every row must combine']
        };
    }
    if (blueprint.visual === 'field') {
        return {
            skill: 'Vector reasoning',
            difficulty: 'Applied',
            prompt: 'Two positive charges sit near a point. How do you decide the net electric field direction at that point?',
            choices: []
        };
    }
    if (blueprint.visual === 'chemistry') {
        return {
            skill: 'Mechanism',
            difficulty: 'Applied',
            prompt: 'In an organic reaction, how do you decide where a nucleophile attacks instead of just memorizing the product?',
            choices: []
        };
    }
    if (blueprint.visual === 'tree') {
        return {
            skill: 'Structure',
            difficulty: 'Applied',
            prompt: 'For a binary tree, what is the difference between visiting a node and finishing a subtree?',
            choices: []
        };
    }
    return {
        skill: 'Transfer',
        difficulty: 'Applied',
        prompt: `Give one example where ${topic} is used, then explain what could go wrong in that example.`,
        choices: []
    };
}

function renderTeacherDiagnostic() {
    const title = document.getElementById('teacherDiagnosticTitle');
    const count = document.getElementById('teacherDiagnosticCount');
    const level = document.getElementById('teacherDiagnosticLevel');
    const thread = document.getElementById('teacherDiagnosticThread');
    const choices = document.getElementById('teacherDiagnosticChoices');
    const answer = document.getElementById('teacherDiagnosticAnswer');
    if (!thread || !choices) return;
    const actionButton = document.querySelector('.teacher-diagnostic-card > .teacher-primary-pill');
    if (actionButton) {
        actionButton.textContent = 'Answer';
        actionButton.setAttribute('onclick', 'submitTeacherDiagnosticAnswer()');
        actionButton.setAttribute('type', 'button');
    }
    document.getElementById('teacherConfidenceRow')?.classList.remove('hidden');
    const questions = teacherState.diagnostic.questions;
    const current = questions[teacherState.diagnostic.index] || questions[questions.length - 1];
    if (title) title.textContent = teacherState.topic;
    if (count) count.textContent = `${teacherState.diagnostic.index + 1}/${teacherState.diagnostic.max}`;
    if (level) level.textContent = teacherState.difficulty.label;
    thread.innerHTML = `
        ${teacherState.diagnostic.answers.map((item, i) => `
            <div class="teacher-diag-turn answered">
                <span>Q${i + 1} - ${esc(item.question.skill)}</span>
                <p>${esc(item.question.prompt)}</p>
                <strong>${esc(item.answer)}</strong>
                ${item.analysis.interrupt ? `<em>${esc(item.analysis.interrupt)}</em>` : ''}
            </div>
        `).join('')}
        <div class="teacher-diag-turn current">
            <span>${esc(current.skill)} - ${esc(current.difficulty)}</span>
            <p>${esc(current.prompt)}</p>
        </div>
    `;
    choices.innerHTML = (current.choices || []).map(choice => `<button type="button" onclick="selectTeacherDiagnosticChoice('${esc(choice)}')">${esc(choice)}</button>`).join('');
    if (answer) {
        answer.value = '';
        answer.focus();
    }
    renderTeacherDiagnosticSignals();
}

function selectTeacherDiagnosticChoice(choice) {
    const answer = document.getElementById('teacherDiagnosticAnswer');
    if (answer) {
        answer.value = choice;
        answer.focus();
    }
}

function setTeacherConfidence(value, button) {
    teacherConfidence = Number(value) || 35;
    document.querySelectorAll('#teacherConfidenceRow button').forEach(btn => btn.classList.toggle('active', btn === button));
}

function handleTeacherDiagnosticKey(event) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        submitTeacherDiagnosticAnswer();
    }
}

function submitTeacherDiagnosticAnswer() {
    const input = document.getElementById('teacherDiagnosticAnswer');
    const answer = String(input?.value || '').trim();
    if (!answer) {
        toast('Give the mentor something to diagnose.', 'err');
        input?.focus();
        return;
    }
    const q = teacherState.diagnostic.questions[teacherState.diagnostic.index];
    const analysis = analyzeTeacherAnswer(q, answer, teacherConfidence);
    teacherState.diagnostic.answers.push({ question: q, answer, confidence: teacherConfidence, analysis, created_at: new Date().toISOString() });
    updateTeacherStateFromAnalysis(analysis);
    if (analysis.interrupt) showTeacherInterrupt(analysis.interrupt);
    if (shouldFinishTeacherDiagnostic()) {
        finishTeacherDiagnostic();
        return;
    }
    teacherState.diagnostic.index += 1;
    teacherState.diagnostic.questions.push(buildTeacherDiagnosticQuestion(teacherState.diagnostic.index));
    persistTeacherState();
    renderTeacherDiagnostic();
}

function analyzeTeacherAnswer(question, answer, confidence = 50) {
    const blueprint = getTeacherBlueprint();
    const text = String(answer || '').toLowerCase();
    const tokens = tokenizeMentorText(text);
    const hitCount = blueprint.keywords.reduce((sum, key) => sum + (text.includes(key.toLowerCase()) ? 1 : 0), 0);
    const structure = /because|therefore|so|when|if|then|first|next|finally|example|case/i.test(answer) ? 16 : 0;
    const lengthScore = Math.min(38, tokens.length * 3);
    const keywordScore = Math.min(34, hitCount * 10);
    const choiceBoost = (question.choices || []).includes(answer) ? 10 : 0;
    let score = Math.max(8, Math.min(96, lengthScore + keywordScore + structure + choiceBoost));
    if (/i don't know|idk|not sure|confused|no idea/i.test(answer)) score = Math.min(score, 28);
    const foundMisconceptions = blueprint.misconceptions.filter(item => item.test(text)).map(item => item.label);
    if (foundMisconceptions.length) score = Math.min(score, 58);
    const confidenceMismatch = confidence - score > 24;
    const lowConfidenceGood = score - confidence > 22;
    const weakness = foundMisconceptions[0] || (score < 45 ? `${question.skill} needs rebuilding` : '');
    const strength = score >= 70 ? `${question.skill} has usable structure` : (lowConfidenceGood ? 'Underconfident but reasoning is promising' : '');
    const interrupt = confidenceMismatch
        ? `No - your confidence is ahead of your reasoning. ${weakness || 'You gave the label, but not the mechanism.'}`
        : foundMisconceptions[0]
            ? `Stop there: ${foundMisconceptions[0]}. That is the misconception to fix first.`
            : '';
    return {
        score,
        confidence,
        confidenceMismatch,
        lowConfidenceGood,
        weakness,
        strength,
        misconceptions: foundMisconceptions,
        interrupt
    };
}

function tokenizeMentorText(value) {
    return String(value || '').toLowerCase()
        .replace(/[^a-z0-9+#.\s-]/g, ' ')
        .split(/\s+/)
        .filter(token => token.length > 2 && !MENTOR_STOP_WORDS.has(token));
}

function updateTeacherStateFromAnalysis(analysis) {
    const answers = teacherState.diagnostic.answers;
    const avgScore = Math.round(answers.reduce((sum, item) => sum + item.analysis.score, 0) / answers.length);
    const avgConfidence = Math.round(answers.reduce((sum, item) => sum + item.confidence, 0) / answers.length);
    teacherState.mastery = avgScore;
    teacherState.confidence = avgConfidence;
    teacherState.difficulty = resolveTeacherDifficulty(avgScore, avgConfidence);
    if (analysis.weakness) addTeacherMemoryItem('weakTopics', analysis.weakness);
    (analysis.misconceptions || []).forEach(item => {
        addTeacherMemoryItem('misconceptions', item);
        addTeacherMemoryItem('repeatedMistakes', item);
    });
    teacherMemory.confidenceTrend = [...(teacherMemory.confidenceTrend || []), { topic: teacherState.topic, score: analysis.score, confidence: analysis.confidence, at: new Date().toISOString() }].slice(-80);
    updateTeacherDNA(analysis);
    saveTeacherMemory();
}

function resolveTeacherDifficulty(score, confidence) {
    if (score < 35) return { label: 'Rebuild fundamentals', value: 25 };
    if (score < 55) return { label: 'Guided practice', value: 44 };
    if (score < 75) return { label: 'Core mastery', value: 64 };
    if (confidence > 82) return { label: 'Pressure challenge', value: 86 };
    return { label: 'Edge-case training', value: 74 };
}

function addTeacherMemoryItem(key, value) {
    if (!value) return;
    const list = Array.isArray(teacherMemory[key]) ? teacherMemory[key] : [];
    teacherMemory[key] = [value, ...list.filter(item => item !== value)].slice(0, 12);
}

function updateTeacherDNA(analysis) {
    const dna = teacherMemory.dna || {};
    if (analysis.score < 45) {
        dna.visual = Math.min(96, (dna.visual || 60) + 4);
        dna.examples = Math.min(96, (dna.examples || 60) + 5);
        dna.pace = Math.max(25, (dna.pace || 55) - 4);
    } else if (analysis.score > 78) {
        dna.challenge = Math.min(96, (dna.challenge || 50) + 6);
        dna.pace = Math.min(90, (dna.pace || 55) + 3);
    } else {
        dna.retention = Math.min(90, (dna.retention || 50) + 2);
    }
    teacherMemory.dna = dna;
    teacherMemory.preferredStyle = dna.visual >= 70 ? 'visual + worked examples' : 'concise + challenge-driven';
}

function shouldFinishTeacherDiagnostic() {
    const answers = teacherState.diagnostic.answers;
    if (answers.length < 3) return false;
    if (answers.length >= TEACHER_MAX_DIAGNOSTIC) return true;
    const mismatch = answers.some(item => item.analysis.confidenceMismatch);
    const avg = teacherState.mastery;
    if (mismatch && answers.length < 5) return false;
    if (avg >= 78 && answers.length < 4) return false;
    if (avg <= 36 && answers.length >= 3) return true;
    return answers.length >= 5;
}

function finishTeacherDiagnostic() {
    const result = buildTeacherDiagnosticResult();
    teacherState.diagnostic.result = result;
    teacherState.roadmap = buildAdaptiveRoadmap(result);
    teacherState.phase = 'diagnostic';
    persistTeacherState();
    saveTeacherMemory();
    renderTeacherDiagnosticResult(result);
}

function buildTeacherDiagnosticResult() {
    const answers = teacherState.diagnostic.answers;
    const strengths = answers.map(item => item.analysis.strength).filter(Boolean);
    const weaknesses = answers.map(item => item.analysis.weakness).filter(Boolean);
    const misconceptions = answers.flatMap(item => item.analysis.misconceptions || []);
    const confidenceMismatch = answers.filter(item => item.analysis.confidenceMismatch).length;
    const mastery = teacherState.mastery;
    const confidence = teacherState.confidence;
    return {
        topic: teacherState.topic,
        subject: teacherState.subject,
        mastery,
        confidence,
        confidenceMismatch,
        strengths: [...new Set(strengths)].slice(0, 4),
        weaknesses: [...new Set(weaknesses)].slice(0, 5),
        misconceptions: [...new Set(misconceptions)].slice(0, 5),
        recommendedPath: getTeacherBlueprint().path,
        difficulty: teacherState.difficulty.label
    };
}

function renderTeacherDiagnosticResult(result) {
    const thread = document.getElementById('teacherDiagnosticThread');
    const choices = document.getElementById('teacherDiagnosticChoices');
    const answer = document.getElementById('teacherDiagnosticAnswer');
    const title = document.getElementById('teacherDiagnosticTitle');
    const count = document.getElementById('teacherDiagnosticCount');
    const level = document.getElementById('teacherDiagnosticLevel');
    if (title) title.textContent = 'Diagnostic complete';
    if (count) count.textContent = `${teacherState.diagnostic.answers.length}/${teacherState.diagnostic.answers.length}`;
    if (level) level.textContent = result.difficulty;
    if (choices) choices.innerHTML = '';
    if (answer) answer.style.display = 'none';
    document.getElementById('teacherConfidenceRow')?.classList.add('hidden');
    const button = document.querySelector('.teacher-diagnostic-card > .teacher-primary-pill');
    if (button) button.outerHTML = '<button class="teacher-primary-pill" type="button" onclick="beginTeacherLearning()">Begin lesson</button>';
    if (!thread) return;
    thread.innerHTML = `
        <div class="teacher-diagnostic-result">
            <span>Student model built</span>
            <h3>${esc(result.topic)}</h3>
            <div class="teacher-result-grid">
                <div><b>${result.mastery}%</b><small>estimated mastery</small></div>
                <div><b>${result.confidence}%</b><small>confidence</small></div>
                <div><b>${result.confidenceMismatch}</b><small>confidence mismatches</small></div>
            </div>
            <h4>Strengths</h4>
            <p>${esc(result.strengths.join(', ') || 'The mentor needs more evidence. We will build from fundamentals.')}</p>
            <h4>Weaknesses</h4>
            <p>${esc(result.weaknesses.join(', ') || 'No major weakness detected yet. The lesson will test edge cases.')}</p>
            <h4>Recommended path</h4>
            <div class="teacher-mini-path">${result.recommendedPath.map(node => `<b>${esc(node)}</b>`).join('')}</div>
        </div>
    `;
    renderTeacherDiagnosticSignals();
}

function renderTeacherDiagnosticSignals() {
    const mastery = document.getElementById('teacherDiagMastery');
    const masteryBar = document.getElementById('teacherDiagMasteryBar');
    const confidence = document.getElementById('teacherDiagConfidence');
    const confidenceBar = document.getElementById('teacherDiagConfidenceBar');
    const weakness = document.getElementById('teacherDiagWeakness');
    if (mastery) mastery.textContent = teacherState.mastery ? `${teacherState.mastery}%` : '--';
    if (masteryBar) masteryBar.style.width = `${teacherState.mastery || 8}%`;
    if (confidence) confidence.textContent = teacherState.confidence ? `${teacherState.confidence}%` : '--';
    if (confidenceBar) confidenceBar.style.width = `${teacherState.confidence || 8}%`;
    if (weakness) weakness.textContent = (teacherMemory.weakTopics || [])[0] || 'Scanning';
}

function buildAdaptiveRoadmap(result = teacherState.diagnostic.result) {
    const path = result?.recommendedPath || getTeacherBlueprint().path;
    const mastery = Number(result?.mastery || teacherState.mastery || 0);
    const confidence = Number(result?.confidence || teacherState.confidence || 0);
    return path.map((title, index) => {
        const nodeMastery = Math.max(0, Math.min(96, mastery - index * 8 + (index === 0 ? 10 : 0)));
        return {
            id: `${index}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            title,
            mastery: nodeMastery,
            confidence: Math.max(8, Math.min(96, confidence - index * 5)),
            difficulty: index < 2 ? 'Foundation' : index < 4 ? 'Core' : 'Challenge',
            revisionNeed: nodeMastery < 60 ? 'High' : nodeMastery < 78 ? 'Medium' : 'Low',
            status: index === 0 ? 'active' : nodeMastery > 72 ? 'ready' : 'locked'
        };
    });
}

async function beginTeacherLearning() {
    if (!teacherState.diagnostic.result) teacherState.diagnostic.result = buildTeacherDiagnosticResult();
    teacherState.phase = 'learning';
    teacherState.roadmap = teacherState.roadmap.length ? teacherState.roadmap : buildAdaptiveRoadmap();
    teacherState.visualMode = getTeacherBlueprint().visual;
    document.getElementById('teacherDiagnosticAnswer')?.style.removeProperty('display');
    document.getElementById('teacherConfidenceRow')?.classList.remove('hidden');
    persistTeacherState();
    renderTeacherScreen();
    await startAdaptiveMentorLesson();
}

function renderTeacherLab() {
    const topic = document.getElementById('teacherActiveTopic');
    if (topic) topic.textContent = teacherState.topic || 'Adaptive session';
    renderTeacherRoadmapNodes();
    renderTeacherIntelligenceRail();
    if (!document.getElementById('teacherLessonStream')?.dataset.ready) {
        const stream = document.getElementById('teacherLessonStream');
        if (stream) {
            stream.dataset.ready = '1';
            stream.innerHTML = '';
            appendTeacherStreamCard('mentor', 'Diagnostic read', buildDiagnosticReadMarkdown(), { system: true });
        }
    }
}

function buildDiagnosticReadMarkdown() {
    const result = teacherState.diagnostic.result || buildTeacherDiagnosticResult();
    const weakness = result.weaknesses[0] || 'edge-case transfer';
    const mismatch = result.confidenceMismatch ? `I detected ${result.confidenceMismatch} confidence mismatch signal(s).` : 'Your confidence roughly matches the evidence so far.';
    return `I have a working model of you on **${result.topic}**.\n\nMastery is about **${result.mastery}%**. ${mismatch}\n\nThe first target is **${weakness}**. I will interrupt when your answer sounds fluent but the mechanism is missing.`;
}

async function startAdaptiveMentorLesson() {
    cancelTeacherGeneration(false);
    teacherAbortController = new AbortController();
    const cardId = appendTeacherStreamCard('mentor', 'Live lesson', 'Preparing the mentor stream...', { streaming: true });
    const prompt = buildAdaptiveMentorPrompt();
    currentTeacherLesson = {
        language: teacherState.subject,
        level: teacherState.difficulty.label,
        mode: 'Adaptive Mentor OS',
        examMode: 'Personalized mastery',
        topic: teacherState.topic,
        markdown: '',
        practice: null,
        branchId: crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
    };
    teacherLastPrompt = { settings: getTeacherSettings(), messages: [{ role: 'system', content: buildTeacherSystemPrompt(getTeacherSettings()) }, { role: 'user', content: prompt }], model: GROQ_MODEL };
    try {
        await callGroqStream(teacherLastPrompt.messages, {
            model: GROQ_MODEL,
            max_tokens: 3600,
            temperature: 0.42,
            signal: teacherAbortController.signal
        }, (_token, fullText) => {
            currentTeacherLesson.markdown = fullText;
            updateTeacherStreamCard(cardId, renderTeacherMarkdown(fullText || 'Thinking...'), true);
        });
        currentTeacherLesson.markdown = normalizeMentorLesson(currentTeacherLesson.markdown);
        updateTeacherStreamCard(cardId, renderTeacherMarkdown(currentTeacherLesson.markdown), false);
        enhanceTeacherRichContent(document.getElementById(cardId));
        addTeacherXP(18, 'lesson');
        persistTeacherSession('lesson', currentTeacherLesson.markdown);
    } catch(err) {
        if (err.name !== 'AbortError') {
            currentTeacherLesson.markdown = buildOfflineMentorLesson(err.message);
            updateTeacherStreamCard(cardId, renderTeacherMarkdown(currentTeacherLesson.markdown), false);
            addTeacherXP(8, 'offline lesson');
        }
    } finally {
        teacherAbortController = null;
        renderTeacherIntelligenceRail();
    }
}

function buildAdaptiveMentorPrompt() {
    const result = teacherState.diagnostic.result || buildTeacherDiagnosticResult();
    const materials = buildMaterialContext(4200);
    return `You are Bugout Mentor OS, an elite adaptive tutor, not a chatbot.
Teach this student actively.

Topic: ${teacherState.topic}
Subject: ${teacherState.subject}
Diagnostic result JSON:
${JSON.stringify(result, null, 2)}
Long-term memory JSON:
${JSON.stringify({
    weakTopics: teacherMemory.weakTopics,
    misconceptions: teacherMemory.misconceptions,
    repeatedMistakes: teacherMemory.repeatedMistakes,
    preferredStyle: teacherMemory.preferredStyle,
    dna: teacherMemory.dna,
    confidenceTrend: (teacherMemory.confidenceTrend || []).slice(-8)
}, null, 2)}
Uploaded context:
${materials || 'No uploaded materials.'}

Required behavior:
- Start by naming the exact weakness you will fix.
- Teach the mental model visually and concretely.
- Include one interruptive correction starting with "Stop:" if a known misconception exists.
- Explain why a likely wrong answer happens, what assumption failed, and how to prevent it.
- Adapt difficulty based on the diagnostic.
- End with a compact challenge and what you will remember about the student.

Keep it premium, direct, emotionally engaging, and concise. Use Markdown, tables, code, math, or Mermaid only when useful.`;
}

function normalizeMentorLesson(text) {
    const value = String(text || '').trim();
    if (!value) return buildOfflineMentorLesson('');
    return value.replace(/let me know if you want[\s\S]*$/i, '').trim();
}

function buildOfflineMentorLesson(reason = '') {
    const result = teacherState.diagnostic.result || buildTeacherDiagnosticResult();
    const firstWeakness = result.weaknesses[0] || 'the missing mental model';
    return `## Mentor read\nYou are learning **${teacherState.topic}**. Mastery estimate: **${result.mastery}%**.\n\n## First correction\nStop: ${firstWeakness}. We fix that before adding more theory.\n\n## Mental model\nLearn the concept as a moving system, not a definition. First identify the objects, then the rule that changes them, then the point where beginners make a false assumption.\n\n## Why the mistake happens\nThe wrong answer usually comes from trusting a memorized label without tracing the mechanism. The fix is to predict the next state, verify it, and name the assumption that changed.\n\n## Challenge\nExplain the concept once, solve one tiny example, then solve one edge case. If the edge case breaks, that break becomes tomorrow's revision.\n\n${reason ? `Offline fallback reason: ${reason}` : ''}`;
}

function appendTeacherStreamCard(role, title, body, options = {}) {
    const stream = document.getElementById('teacherLessonStream');
    if (!stream) return '';
    const id = `teacher-stream-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const node = document.createElement('article');
    node.id = id;
    node.className = `teacher-stream-card-v2 ${role || 'mentor'}${options.system ? ' system' : ''}`;
    node.innerHTML = `
        <div class="teacher-card-kicker">${role === 'student' ? 'Student' : 'Mentor'}</div>
        <h3>${esc(title)}</h3>
        <div class="teacher-card-body">${typeof body === 'string' && /<[^>]+>/.test(body) ? body : renderTeacherMarkdown(body)}</div>
        ${options.streaming ? '<span class="teacher-streaming-cursor"></span>' : ''}
    `;
    stream.appendChild(node);
    stream.scrollTop = stream.scrollHeight;
    enhanceTeacherRichContent(node);
    return id;
}

function updateTeacherStreamCard(id, html, streaming = false) {
    const node = document.getElementById(id);
    if (!node) return;
    const body = node.querySelector('.teacher-card-body');
    if (body) body.innerHTML = html;
    const cursor = node.querySelector('.teacher-streaming-cursor');
    if (streaming && !cursor) node.insertAdjacentHTML('beforeend', '<span class="teacher-streaming-cursor"></span>');
    if (!streaming && cursor) cursor.remove();
    enhanceTeacherRichContent(node);
    node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function renderTeacherMarkdown(text) {
    const value = text || '';
    if (window.marked && window.DOMPurify) {
        return window.DOMPurify.sanitize(window.marked.parse(value, { breaks: true, gfm: true }));
    }
    return formatTeacherMentorFallback(value);
}

function formatTeacherMentorFallback(text) {
    return esc(text || '')
        .replace(/```mermaid([\s\S]*?)```/gi, '<div class="mermaid teacher-mermaid">$1</div>')
        .replace(/```([a-z0-9+#.-]*)\n?([\s\S]*?)```/gi, '<pre><code class="language-$1">$2</code></pre>')
        .replace(/^### (.*)$/gm, '<h3>$1</h3>')
        .replace(/^## (.*)$/gm, '<h2>$1</h2>')
        .replace(/^# (.*)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^\s*[-*] (.*)$/gm, '<li>$1</li>')
        .replace(/\n/g, '<br>');
}

function enhanceTeacherRichContent(root) {
    if (!root) return;
    root.querySelectorAll('pre code').forEach(block => {
        try { if (window.hljs) window.hljs.highlightElement(block); } catch(e) {}
    });
    root.querySelectorAll('code.language-mermaid, pre code.language-mermaid').forEach(block => {
        const source = block.textContent;
        const target = document.createElement('div');
        target.className = 'mermaid teacher-mermaid';
        target.textContent = source;
        block.closest('pre')?.replaceWith(target);
    });
    if (window.mermaid) {
        try { window.mermaid.run({ nodes: root.querySelectorAll('.mermaid') }); } catch(e) {}
    }
    if (window.MathJax?.typesetPromise) {
        window.MathJax.typesetPromise([root]).catch(() => {});
    }
}

function renderTeacherRoadmapNodes() {
    const wrap = document.getElementById('teacherRoadmapNodes');
    if (!wrap) return;
    if (!teacherState.roadmap.length) teacherState.roadmap = buildAdaptiveRoadmap();
    wrap.innerHTML = teacherState.roadmap.map((node, index) => `
        <button type="button" class="teacher-roadmap-node ${esc(node.status)}" onclick="focusTeacherRoadmapNode(${index})">
            <span>${String(index + 1).padStart(2, '0')}</span>
            <strong>${esc(node.title)}</strong>
            <small>${node.mastery}% mastery - ${esc(node.revisionNeed)} revision</small>
        </button>
    `).join('');
}

function focusTeacherRoadmapNode(index) {
    const node = teacherState.roadmap[index];
    if (!node) return;
    appendTeacherStreamCard('mentor', `Focus: ${node.title}`, `We are zooming into **${node.title}**.\n\nMastery: **${node.mastery}%**\nConfidence: **${node.confidence}%**\nRevision need: **${node.revisionNeed}**\n\nGive me one attempt or ask for a visual trace from the composer.`);
}

function buildTeacherRoadmap() {
    teacherState.roadmap = buildAdaptiveRoadmap();
    renderTeacherRoadmapNodes();
    appendTeacherStreamCard('mentor', 'Roadmap updated', `I rebuilt the path around your latest memory.\n\n${teacherState.roadmap.map(node => `- ${node.title}: ${node.mastery}% mastery, ${node.revisionNeed} revision`).join('\n')}`);
    persistTeacherState();
}

function renderTeacherIntelligenceRail() {
    const masteryValue = document.getElementById('teacherMasteryValue');
    const masteryBar = document.getElementById('teacherMasteryBar');
    const difficulty = document.getElementById('teacherDifficultyLabel');
    const weakCount = document.getElementById('teacherWeaknessCount');
    const weakList = document.getElementById('teacherWeaknessList');
    const dnaSummary = document.getElementById('teacherDNASummary');
    const dnaList = document.getElementById('teacherDNAList');
    const xp = document.getElementById('teacherXPValue');
    const progression = document.getElementById('teacherProgressionList');
    if (masteryValue) masteryValue.textContent = `${teacherState.mastery || 0}%`;
    if (masteryBar) masteryBar.style.width = `${Math.max(6, teacherState.mastery || 0)}%`;
    if (difficulty) difficulty.textContent = `Difficulty: ${teacherState.difficulty?.label || 'calibrating'}`;
    if (weakCount) weakCount.textContent = String((teacherMemory.weakTopics || []).length);
    if (weakList) weakList.innerHTML = (teacherMemory.weakTopics || []).slice(0, 5).map(item => `<span>${esc(item)}</span>`).join('') || '<span>None detected yet</span>';
    const dna = teacherMemory.dna || {};
    if (dnaSummary) dnaSummary.textContent = (dna.visual || 0) >= 70 ? 'Highly visual' : 'Mixed';
    if (dnaList) {
        dnaList.innerHTML = [
            ['Visual', dna.visual || 50],
            ['Examples', dna.examples || 50],
            ['Challenge', dna.challenge || 50],
            ['Pace', dna.pace || 50],
            ['Retention', dna.retention || 50]
        ].map(([label, value]) => `<div><span>${label}</span><b style="width:${value}%"></b><strong>${Math.round(value)}%</strong></div>`).join('');
    }
    if (xp) xp.textContent = `${teacherState.xp || 0} XP`;
    if (progression) {
        progression.innerHTML = `
            <div><span>Rank</span><strong>${esc(resolveTeacherRank())}</strong></div>
            <div><span>Streak</span><strong>${teacherMemory.streak || 0}</strong></div>
            <div><span>Combo</span><strong>${teacherState.combo || 0}x</strong></div>
        `;
    }
}

function resolveTeacherRank() {
    const xp = Number(teacherState.xp || teacherMemory.xp || 0);
    if (xp >= 1200) return 'Apex Mentor Track';
    if (xp >= 650) return 'Mastery Builder';
    if (xp >= 260) return 'Deep Learner';
    if (xp >= 80) return 'Concept Climber';
    return 'Initiate';
}

function addTeacherXP(amount, reason = 'progress') {
    teacherState.xp = Number(teacherState.xp || teacherMemory.xp || 0) + amount;
    teacherState.combo = Number(teacherState.combo || 0) + 1;
    teacherState.rank = resolveTeacherRank();
    teacherMemory.xp = teacherState.xp;
    teacherMemory.graph = [
        { type: 'xp', topic: teacherState.topic, reason, amount, at: new Date().toISOString() },
        ...(teacherMemory.graph || [])
    ].slice(0, 120);
    saveTeacherMemory();
    persistTeacherState();
}

async function sendTeacherDoubt() {
    const input = document.getElementById('teacherDoubtInput');
    const text = String(input?.value || '').trim();
    if (!text) return;
    input.value = '';
    autoResizeTeacherDoubt(input);
    appendTeacherStreamCard('student', 'Your attempt', text);
    const analysis = analyzeTeacherAnswer({ skill: 'Live reasoning', choices: [] }, text, /sure|understand|easy|obvious/i.test(text) ? 86 : 58);
    updateLiveMemoryFromDoubt(text, analysis);
    if (analysis.interrupt) {
        showTeacherInterrupt(analysis.interrupt);
        appendTeacherStreamCard('critic', 'Why that answer is risky', buildWhyWrongMarkdown(analysis));
    }
    await streamTeacherDoubtReply(text, analysis);
}

function updateLiveMemoryFromDoubt(text, analysis) {
    updateTeacherStateFromAnalysis(analysis);
    if (/skip|later|not needed/i.test(text)) addTeacherMemoryItem('skippedConcepts', teacherState.topic);
    teacherState.mastery = Math.round((teacherState.mastery * 0.72) + (analysis.score * 0.28));
    teacherState.difficulty = resolveTeacherDifficulty(teacherState.mastery, analysis.confidence);
    saveTeacherMemory();
    renderTeacherIntelligenceRail();
}

function buildWhyWrongMarkdown(analysis) {
    const weak = analysis.weakness || 'the reasoning is underspecified';
    return `**Why it happened:** ${weak}.\n\n**Failed assumption:** you treated a label as proof of understanding.\n\n**Fix:** trace one concrete state change, then say what would break in an edge case.`;
}

async function streamTeacherDoubtReply(text, analysis) {
    const cardId = appendTeacherStreamCard('mentor', 'Adaptive reply', 'Reading your reasoning...', { streaming: true });
    const messages = [
        { role: 'system', content: buildTeacherSystemPrompt(getTeacherSettings()) },
        { role: 'user', content: `Student topic: ${teacherState.topic}
Diagnostic: ${JSON.stringify(teacherState.diagnostic.result || {}, null, 2)}
Memory: ${JSON.stringify({ weakTopics: teacherMemory.weakTopics, misconceptions: teacherMemory.misconceptions, dna: teacherMemory.dna }, null, 2)}
Student said: ${text}
Local critic analysis: ${JSON.stringify(analysis, null, 2)}

Reply as an elite tutor. If wrong, interrupt directly and explain why the mistake happened. If right, increase difficulty and give the next challenge. Keep it concise.` }
    ];
    try {
        await callGroqStream(messages, { max_tokens: 1300, temperature: 0.38 }, (_token, fullText) => {
            updateTeacherStreamCard(cardId, renderTeacherMarkdown(fullText), true);
        });
        updateTeacherStreamCard(cardId, document.querySelector(`#${cardId} .teacher-card-body`)?.innerHTML || '', false);
        addTeacherXP(6, 'doubt');
    } catch(err) {
        updateTeacherStreamCard(cardId, renderTeacherMarkdown(buildOfflineDoubtReply(analysis)), false);
    }
}

function buildOfflineDoubtReply(analysis) {
    if (analysis.score >= 72) {
        return `Good. Your reasoning has structure. Now raise the difficulty: solve the same idea with one edge case and no hints.`;
    }
    return `${analysis.interrupt || 'Stop: the reasoning is still too thin.'}\n\nRebuild it with this pattern: define the moving parts, trace one tiny example, then name the exact point where the answer could fail.`;
}

function showTeacherInterrupt(text) {
    teacherState.lastInterrupt = text;
    const banner = document.getElementById('teacherInterruptBanner');
    if (!banner) return;
    banner.innerHTML = `<strong>Mentor interrupt</strong><span>${esc(text)}</span>`;
    banner.classList.add('show');
    setTimeout(() => banner.classList.remove('show'), 9000);
}

function handleTeacherDoubtKey(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendTeacherDoubt();
    }
}

function autoResizeTeacherDoubt(el) {
    if (!el) return;
    el.style.height = '42px';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function startTeacherBossBattle() {
    if (teacherState.phase !== 'learning') {
        toast('Finish the diagnostic first.', 'err');
        return;
    }
    if (teacherBossTimer) clearInterval(teacherBossTimer);
    teacherState.boss = {
        index: 0,
        score: 0,
        remaining: 90,
        combo: 0,
        questions: buildTeacherBossQuestions()
    };
    const id = appendTeacherStreamCard('mentor', 'Boss battle', renderTeacherBossBattle(), { system: true });
    teacherState.boss.cardId = id;
    teacherBossTimer = setInterval(() => {
        if (!teacherState.boss) return;
        teacherState.boss.remaining -= 1;
        const timer = document.getElementById('teacherBossTimer');
        if (timer) timer.textContent = `${teacherState.boss.remaining}s`;
        if (teacherState.boss.remaining <= 0) finishTeacherBossBattle();
    }, 1000);
}

function buildTeacherBossQuestions() {
    const blueprint = getTeacherBlueprint();
    return [
        { skill: blueprint.path[1] || 'Core idea', prompt: `Explain the core mechanism of ${teacherState.topic} in one precise sentence.` },
        { skill: blueprint.path[2] || 'Trace', prompt: `Give a tiny example and trace what changes step by step.` },
        { skill: blueprint.path[4] || 'Trap', prompt: `Name one trap in ${teacherState.topic} and how you avoid it.` }
    ];
}

function renderTeacherBossBattle() {
    const boss = teacherState.boss;
    if (!boss) return '';
    const q = boss.questions[boss.index];
    if (!q) return renderTeacherBossResult();
    return `
        <div class="teacher-boss-card">
            <div class="teacher-boss-head"><span id="teacherBossTimer">${boss.remaining}s</span><strong>Combo ${boss.combo}x</strong></div>
            <h4>${esc(q.skill)}</h4>
            <p>${esc(q.prompt)}</p>
            <textarea id="teacherBossAnswer" rows="3" placeholder="Answer under pressure."></textarea>
            <button class="teacher-primary-pill" type="button" onclick="submitTeacherBossAnswer()">Lock answer</button>
        </div>
    `;
}

function submitTeacherBossAnswer() {
    const boss = teacherState.boss;
    const input = document.getElementById('teacherBossAnswer');
    if (!boss || !input) return;
    const answer = input.value.trim();
    if (!answer) return;
    const analysis = analyzeTeacherAnswer({ skill: boss.questions[boss.index].skill, choices: [] }, answer, 75);
    if (analysis.score >= 62) {
        boss.score += Math.round(analysis.score / 10);
        boss.combo += 1;
    } else {
        boss.combo = 0;
        if (analysis.weakness) addTeacherMemoryItem('weakTopics', analysis.weakness);
    }
    boss.index += 1;
    const card = document.getElementById(boss.cardId)?.querySelector('.teacher-card-body');
    if (card) card.innerHTML = boss.index >= boss.questions.length ? renderTeacherBossResult() : renderTeacherBossBattle();
    if (boss.index >= boss.questions.length) finishTeacherBossBattle();
}

function renderTeacherBossResult() {
    const boss = teacherState.boss || {};
    const rating = boss.score >= 22 ? 'Dominant' : boss.score >= 14 ? 'Solid' : 'Needs rematch';
    return `
        <div class="teacher-boss-result">
            <span>Boss complete</span>
            <h4>${rating}</h4>
            <p>Score: ${boss.score || 0}. The mentor saved the weak signals for revision.</p>
        </div>
    `;
}

function finishTeacherBossBattle() {
    if (teacherBossTimer) clearInterval(teacherBossTimer);
    teacherBossTimer = null;
    const boss = teacherState.boss;
    if (!boss) return;
    addTeacherXP(Math.max(10, boss.score || 0), 'boss battle');
    teacherState.mastery = Math.min(98, teacherState.mastery + Math.round((boss.score || 0) / 3));
    teacherState.combo = Math.max(teacherState.combo || 0, boss.combo || 0);
    teacherState.boss = null;
    renderTeacherIntelligenceRail();
    persistTeacherState();
}

function startTeacherVisualEngine() {
    const canvas = document.getElementById('teacherSimulationCanvas');
    if (!canvas) return;
    if (teacherVisualFrame) cancelAnimationFrame(teacherVisualFrame);
    const ctx = canvas.getContext('2d');
    const start = performance.now();
    const frame = now => {
        drawTeacherVisualFrame(ctx, canvas, (now - start) / 1000);
        teacherVisualFrame = requestAnimationFrame(frame);
    };
    teacherVisualFrame = requestAnimationFrame(frame);
}

function drawTeacherVisualFrame(ctx, canvas, time) {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, '#07100f');
    gradient.addColorStop(1, '#101018');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    drawTeacherParticles(ctx, w, h, time);
    const mode = teacherState.visualMode || getTeacherBlueprint().visual;
    if (mode === 'recursion') drawRecursionVisual(ctx, w, h, time);
    else if (mode === 'sql') drawSqlVisual(ctx, w, h, time);
    else if (mode === 'field') drawFieldVisual(ctx, w, h, time);
    else if (mode === 'chemistry') drawChemistryVisual(ctx, w, h, time);
    else if (mode === 'tree') drawTreeVisual(ctx, w, h, time);
    else drawConceptVisual(ctx, w, h, time);
}

function drawTeacherParticles(ctx, w, h, time) {
    ctx.save();
    for (let i = 0; i < 36; i++) {
        const x = (i * 83 + time * 18) % w;
        const y = (Math.sin(time * 0.7 + i) * 0.5 + 0.5) * h;
        ctx.fillStyle = `rgba(120, 220, 255, ${0.05 + (i % 4) * 0.02})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.4 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function drawRecursionVisual(ctx, w, h, time) {
    const labels = ['f(3)', 'f(2)', 'f(1)', 'f(0)', 'return 1', 'return 1', 'return 2', 'return 6'];
    const active = Math.floor(time * 1.25) % labels.length;
    ctx.font = '700 18px Segoe UI';
    labels.forEach((label, i) => {
        const stackIndex = i < 4 ? i : 7 - i;
        const x = w * 0.18 + stackIndex * 108;
        const y = h * 0.18 + stackIndex * 48;
        const isActive = i === active;
        roundedRect(ctx, x, y, 170, 42, 10, isActive ? '#7cf7c8' : 'rgba(255,255,255,0.08)', isActive ? '#04100b' : '#dce7e1');
        ctx.fillText(label, x + 18, y + 27);
    });
    drawStageLabel(ctx, 'Animated recursion: calls go down, returns unwind back up');
}

function drawSqlVisual(ctx, w, h, time) {
    drawTable(ctx, 70, 78, 'students', ['1 Asha', '2 Ravi', '3 Noor']);
    drawTable(ctx, w - 270, 78, 'marks', ['1 92', '3 88']);
    const t = (time % 3) / 3;
    const x = 260 + t * (w - 550);
    roundedRect(ctx, x, 180, 190, 44, 10, '#7cf7c8', '#04100b');
    ctx.font = '700 16px Segoe UI';
    ctx.fillText(t < 0.55 ? 'match by id' : 'unmatched -> NULL', x + 18, 208);
    drawStageLabel(ctx, 'SQL join animation: preserved rows decide the result');
}

function drawFieldVisual(ctx, w, h, time) {
    const charges = [{ x: w * 0.33, y: h * 0.52, s: '+' }, { x: w * 0.67, y: h * 0.52, s: '+' }];
    charges.forEach(c => {
        ctx.fillStyle = '#ffcf7c';
        ctx.beginPath();
        ctx.arc(c.x, c.y, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#160d02';
        ctx.font = '900 24px Segoe UI';
        ctx.fillText(c.s, c.x - 7, c.y + 8);
        for (let i = 0; i < 18; i++) {
            const a = i / 18 * Math.PI * 2 + time * 0.25;
            ctx.strokeStyle = 'rgba(124,247,200,0.32)';
            ctx.beginPath();
            ctx.moveTo(c.x + Math.cos(a) * 34, c.y + Math.sin(a) * 34);
            ctx.lineTo(c.x + Math.cos(a) * 118, c.y + Math.sin(a) * 82);
            ctx.stroke();
        }
    });
    drawStageLabel(ctx, 'Electrostatics: field is vector direction plus magnitude');
}

function drawChemistryVisual(ctx, w, h, time) {
    const nodes = ['nucleophile', 'electrophile', 'intermediate', 'product'];
    nodes.forEach((label, i) => {
        const x = 90 + i * ((w - 180) / 3);
        const y = h * 0.52 + Math.sin(time + i) * 12;
        roundedRect(ctx, x, y, 150, 48, 14, i === Math.floor(time) % nodes.length ? '#7cf7c8' : 'rgba(255,255,255,0.08)', i === Math.floor(time) % nodes.length ? '#06110c' : '#dce7e1');
        ctx.font = '700 15px Segoe UI';
        ctx.fillText(label, x + 15, y + 30);
        if (i < nodes.length - 1) drawArrow(ctx, x + 160, y + 24, x + 232, y + 24);
    });
    drawStageLabel(ctx, 'Organic chemistry: predict products through mechanism flow');
}

function drawTreeVisual(ctx, w, h, time) {
    const nodes = [
        { x: w * 0.5, y: 82, label: 'root' },
        { x: w * 0.32, y: 180, label: 'left' },
        { x: w * 0.68, y: 180, label: 'right' },
        { x: w * 0.22, y: 290, label: 'L.L' },
        { x: w * 0.42, y: 290, label: 'L.R' }
    ];
    [[0,1],[0,2],[1,3],[1,4]].forEach(([a,b]) => {
        ctx.strokeStyle = 'rgba(124,247,200,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(nodes[a].x, nodes[a].y);
        ctx.lineTo(nodes[b].x, nodes[b].y);
        ctx.stroke();
    });
    const active = Math.floor(time * 1.2) % nodes.length;
    nodes.forEach((node, i) => {
        ctx.fillStyle = i === active ? '#7cf7c8' : '#17211e';
        ctx.beginPath();
        ctx.arc(node.x, node.y, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = i === active ? '#04100b' : '#dce7e1';
        ctx.font = '800 14px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y + 5);
        ctx.textAlign = 'left';
    });
    drawStageLabel(ctx, 'Trees: every node owns subtrees, not a flat sequence');
}

function drawConceptVisual(ctx, w, h, time) {
    const labels = ['Prereq', 'Idea', 'Example', 'Mistake', 'Challenge'];
    const cx = w / 2, cy = h / 2;
    labels.forEach((label, i) => {
        const angle = time * 0.18 + i / labels.length * Math.PI * 2;
        const x = cx + Math.cos(angle) * 245;
        const y = cy + Math.sin(angle) * 118;
        drawArrow(ctx, cx, cy, x, y, 'rgba(124,247,200,0.18)');
        roundedRect(ctx, x - 62, y - 24, 124, 48, 14, i === 1 ? '#7cf7c8' : 'rgba(255,255,255,0.08)', i === 1 ? '#04100b' : '#dce7e1');
        ctx.font = '800 15px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, y + 5);
        ctx.textAlign = 'left';
    });
    roundedRect(ctx, cx - 86, cy - 28, 172, 56, 18, '#d9e8ff', '#06111a');
    ctx.font = '900 17px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText((teacherState.topic || 'Concept').slice(0, 20), cx, cy + 6);
    ctx.textAlign = 'left';
    drawStageLabel(ctx, 'Concept graph: learn by linking idea, example, mistake, and challenge');
}

function drawTable(ctx, x, y, title, rows) {
    roundedRect(ctx, x, y, 200, 170, 12, 'rgba(255,255,255,0.07)', '#dce7e1');
    ctx.font = '900 17px Segoe UI';
    ctx.fillText(title, x + 16, y + 30);
    ctx.font = '600 15px Segoe UI';
    rows.forEach((row, i) => {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x + 14, y + 48 + i * 34, 172, 26);
        ctx.fillStyle = '#dce7e1';
        ctx.fillText(row, x + 24, y + 67 + i * 34);
    });
}

function drawStageLabel(ctx, label) {
    ctx.fillStyle = 'rgba(255,255,255,0.68)';
    ctx.font = '700 15px Segoe UI';
    ctx.fillText(label, 28, 34);
}

function roundedRect(ctx, x, y, w, h, r, fill, textFill) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.fillStyle = textFill;
}

function drawArrow(ctx, x1, y1, x2, y2, color = 'rgba(124,247,200,0.45)') {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - Math.cos(angle - 0.45) * 12, y2 - Math.sin(angle - 0.45) * 12);
    ctx.lineTo(x2 - Math.cos(angle + 0.45) * 12, y2 - Math.sin(angle + 0.45) * 12);
    ctx.closePath();
    ctx.fill();
}

function generateTeacherVisual() {
    teacherState.visualMode = getTeacherBlueprint().visual;
    appendTeacherStreamCard('mentor', 'Visual reframe', `I switched the simulation to **${teacherState.visualMode}** mode and tied it to your current weakness.`);
    startTeacherVisualEngine();
}

function getTeacherSettings() {
    return {
        language: teacherState.subject || 'General',
        level: teacherState.difficulty?.label || 'Adaptive',
        mode: 'Adaptive Mentor OS',
        examMode: 'Personalized mastery',
        personality: 'direct elite mentor',
        goal: `Master ${teacherState.topic}`,
        dailyTime: 'adaptive',
        intensity: teacherState.difficulty?.label || 'adaptive',
        examDate: '',
        topic: teacherState.topic || ''
    };
}

function buildTeacherSystemPrompt(settings = getTeacherSettings()) {
    return `You are Bugout Mentor OS, an elite adaptive AI tutor.
You diagnose, teach, challenge, interrupt, adapt, remember, and evolve.
Never behave like a passive chatbot.
If the student shows fake confidence or a misconception, interrupt directly but respectfully.
Always explain why the mistake happened, which assumption failed, and how to avoid it.
Student topic: ${settings.topic}
Difficulty: ${settings.level}
Preferred style: ${teacherMemory.preferredStyle || 'visual + direct'}`;
}

function buildTeacherLessonPrompt(settings = getTeacherSettings()) {
    return buildAdaptiveMentorPrompt(settings);
}

function buildTeacherMessages(settings, promptText) {
    return [{ role: 'system', content: buildTeacherSystemPrompt(settings) }, { role: 'user', content: promptText || buildAdaptiveMentorPrompt() }];
}

async function startTeacherLesson() {
    if (teacherState.phase === 'entry') startTeacherDiagnosticFromEntry();
    else if (teacherState.phase === 'diagnostic' && teacherState.diagnostic.result) await beginTeacherLearning();
    else await startAdaptiveMentorLesson();
}

async function runTeacherStreamingLesson(settings, messages, model) {
    teacherLastPrompt = { settings, messages, model };
    const cardId = appendTeacherStreamCard('mentor', 'Regenerated lesson', 'Rebuilding the lesson...', { streaming: true });
    try {
        await callGroqStream(messages, { model: model || GROQ_MODEL, max_tokens: 3200, temperature: 0.4 }, (_token, fullText) => {
            updateTeacherStreamCard(cardId, renderTeacherMarkdown(fullText), true);
        });
        updateTeacherStreamCard(cardId, document.querySelector(`#${cardId} .teacher-card-body`)?.innerHTML || '', false);
    } catch(err) {
        updateTeacherStreamCard(cardId, renderTeacherMarkdown(buildOfflineMentorLesson(err.message)), false);
    }
}

function cancelTeacherGeneration(showToast = true) {
    if (teacherAbortController) {
        teacherAbortController.abort();
        teacherAbortController = null;
        if (showToast) toast('Mentor stream stopped.', 'info');
    }
}

async function regenerateTeacherResponse() {
    if (teacherLastPrompt) return runTeacherStreamingLesson(teacherLastPrompt.settings, teacherLastPrompt.messages, teacherLastPrompt.model);
    return startAdaptiveMentorLesson();
}

function branchTeacherResponse() {
    appendTeacherStreamCard('mentor', 'Branch created', 'Ask for a different explanation style, a harder challenge, or a slower visual trace.');
}

function copyTeacherResponse() {
    const text = currentTeacherLesson?.markdown || document.getElementById('teacherLessonStream')?.innerText || '';
    if (!text) { toast('Nothing to copy yet.', 'err'); return; }
    navigator.clipboard.writeText(text).then(() => toast('Mentor notes copied.', 'ok')).catch(() => toast('Copy failed.', 'err'));
}

function exportTeacherNotes() {
    const text = currentTeacherLesson?.markdown || document.getElementById('teacherLessonStream')?.innerText || '';
    if (!text) { toast('Start a lesson first.', 'err'); return; }
    const blob = new Blob([`# ${teacherState.topic}\n\n${text}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bugout-mentor-${(teacherState.topic || 'lesson').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md`;
    link.click();
    URL.revokeObjectURL(url);
}

async function loadTeacherMemory() {
    try {
        teacherMemory = { ...teacherMemory, ...JSON.parse(localStorage.getItem(TEACHER_MEMORY_KEY) || '{}') };
    } catch(e) {}
    if (!me) return;
    try {
        const { data, error } = await db.from('teacher_memory').select('*').eq('user_id', me.id).maybeSingle();
        if (error || !data) return;
        teacherMemory = {
            ...teacherMemory,
            weakTopics: data.weak_topics || data.weakTopics || teacherMemory.weakTopics || [],
            strongTopics: data.strong_topics || data.strongTopics || teacherMemory.strongTopics || [],
            misconceptions: data.misconceptions || teacherMemory.misconceptions || [],
            repeatedMistakes: data.repeated_mistakes || teacherMemory.repeatedMistakes || [],
            skippedConcepts: data.skipped_concepts || teacherMemory.skippedConcepts || [],
            preferredStyle: data.preferred_teaching_style || data.preferred_style || teacherMemory.preferredStyle,
            learningSpeed: data.learning_speed || teacherMemory.learningSpeed,
            streak: data.study_streak || teacherMemory.streak || 0,
            confidenceTrend: data.confidence_trend || teacherMemory.confidenceTrend || [],
            attentionPattern: data.attention_pattern || teacherMemory.attentionPattern,
            dna: data.learning_dna || data.dna || teacherMemory.dna,
            graph: data.memory_graph || teacherMemory.graph || [],
            xp: data.xp || teacherMemory.xp || 0
        };
        teacherState.xp = teacherMemory.xp || teacherState.xp || 0;
    } catch(e) {}
}

async function saveTeacherMemory(patch = {}) {
    teacherMemory = { ...teacherMemory, ...patch };
    try { localStorage.setItem(TEACHER_MEMORY_KEY, JSON.stringify(teacherMemory)); } catch(e) {}
    if (!me) return;
    try {
        await db.from('teacher_memory').upsert({
            user_id: me.id,
            weak_topics: teacherMemory.weakTopics || [],
            strong_topics: teacherMemory.strongTopics || [],
            misconceptions: teacherMemory.misconceptions || [],
            repeated_mistakes: teacherMemory.repeatedMistakes || [],
            skipped_concepts: teacherMemory.skippedConcepts || [],
            preferred_teaching_style: teacherMemory.preferredStyle || 'visual + direct',
            learning_speed: teacherMemory.learningSpeed || 'normal',
            study_streak: teacherMemory.streak || 0,
            confidence_trend: teacherMemory.confidenceTrend || [],
            attention_pattern: teacherMemory.attentionPattern || {},
            learning_dna: teacherMemory.dna || {},
            memory_graph: teacherMemory.graph || [],
            xp: teacherMemory.xp || teacherState.xp || 0,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    } catch(e) {}
}

async function loadTeacherProgress() {
    try {
        teacherProgress = JSON.parse(localStorage.getItem(TEACHER_PROGRESS_KEY) || '[]');
    } catch(e) {
        teacherProgress = [];
    }
    if (me) {
        try {
            const { data, error } = await db.from('teacher_sessions').select('*').eq('user_id', me.id).order('created_at', { ascending: false }).limit(80);
            if (!error && Array.isArray(data)) teacherProgress = data;
        } catch(e) {}
    }
    updateTeacherMemoryFromProgress();
}

function updateTeacherMemoryFromProgress() {
    teacherMemory.streak = calculateTeacherStreak(teacherProgress);
    saveTeacherMemory();
}

function calculateTeacherStreak(rows) {
    const days = new Set((rows || []).map(row => String(row.created_at || row.updated_at || '').slice(0, 10)).filter(Boolean));
    let streak = 0;
    const cursor = new Date();
    for (let i = 0; i < 365; i++) {
        const key = cursor.toISOString().slice(0, 10);
        if (!days.has(key)) break;
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
}

function renderTeacherProgress() {
    renderTeacherEntry();
    renderTeacherIntelligenceRail();
}

function renderTeacherMetrics() {
    renderTeacherIntelligenceRail();
}

function updateTeacherTopicChips() {}

function applyTeacherTopic(topic) {
    const input = document.getElementById('teacherStruggleInput');
    if (input) input.value = topic;
    teacherState.topic = topic;
}

function decideTeacherTopic(language) {
    const weak = (teacherMemory.weakTopics || [])[0];
    if (weak) return weak;
    const topics = TEACHER_ROADMAPS[language] || TEACHER_ROADMAPS.JavaScript || [];
    return topics[0] || 'Fundamentals';
}

async function persistTeacherSession(kind, content) {
    const row = {
        id: `local-${Date.now()}`,
        user_id: me?.id || 'guest',
        subject: teacherState.subject,
        topic: teacherState.topic,
        session_type: kind,
        content,
        mastery: teacherState.mastery,
        confidence: teacherState.confidence,
        diagnostic_json: teacherState.diagnostic,
        roadmap_json: teacherState.roadmap,
        memory_snapshot: teacherMemory,
        created_at: new Date().toISOString()
    };
    teacherProgress = [row, ...teacherProgress].slice(0, 80);
    try { localStorage.setItem(TEACHER_PROGRESS_KEY, JSON.stringify(teacherProgress)); } catch(e) {}
    if (!me) return;
    try {
        await db.from('teacher_sessions').insert({
            user_id: me.id,
            subject: row.subject,
            topic: row.topic,
            session_type: row.session_type,
            content: row.content,
            mastery: row.mastery,
            confidence: row.confidence,
            diagnostic_json: row.diagnostic_json,
            roadmap_json: row.roadmap_json,
            memory_snapshot: row.memory_snapshot
        });
    } catch(e) {}
}

function loadTeacherProgressLesson(id) {
    const row = teacherProgress.find(item => String(item.id) === String(id));
    if (!row) return;
    teacherState.topic = row.topic || teacherState.topic;
    teacherState.subject = row.subject || teacherState.subject;
    teacherState.mastery = row.mastery || teacherState.mastery;
    teacherState.confidence = row.confidence || teacherState.confidence;
    teacherState.phase = 'learning';
    renderTeacherScreen();
    appendTeacherStreamCard('mentor', row.topic || 'Saved session', row.content || 'Saved mentor session loaded.');
}

function startPlacementTest() {
    startTeacherDiagnosticFromEntry();
}

async function generateCollegePlan() {
    if (teacherState.phase === 'entry') startTeacherDiagnosticFromEntry();
    if (!teacherState.diagnostic.result) teacherState.diagnostic.result = buildTeacherDiagnosticResult();
    teacherState.roadmap = buildAdaptiveRoadmap();
    teacherState.phase = 'learning';
    renderTeacherScreen();
    buildTeacherRoadmap();
}

function generateTeacherStudyPlan() {
    const roadmap = teacherState.roadmap.length ? teacherState.roadmap : buildAdaptiveRoadmap();
    appendTeacherStreamCard('mentor', 'Study plan', `Today's plan:\n\n${roadmap.slice(0, 4).map((node, i) => `${i + 1}. ${node.title} - ${node.revisionNeed} revision`).join('\n')}\n\nRevision rule: weak nodes return automatically until mastery clears 75%.`);
}

function renderTeacherInsights() {
    renderTeacherIntelligenceRail();
}

function openTeacherMaterialPicker() {
    document.getElementById('teacherMaterialInput')?.click();
}

function openTeacherImagePicker() {
    openTeacherMaterialPicker();
}

async function handleTeacherMaterialFiles(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    for (const file of list) {
        const item = { id: `${Date.now()}-${Math.random()}`, name: file.name, type: file.type || file.name.split('.').pop(), size: file.size, text: '', dataUrl: '' };
        if ((file.type || '').startsWith('image/')) {
            item.dataUrl = await readFileAsDataURL(file);
            item.text = 'Image available to the vision model.';
            teacherPendingImages.push({ name: file.name, dataUrl: item.dataUrl });
        } else {
            item.text = await extractTeacherFileText(file);
        }
        teacherMaterials.unshift(item);
    }
    rebuildTeacherMaterialIndex();
    teacherState.materialsUsed = teacherMaterials.map(item => item.name);
    appendTeacherStreamCard('mentor', 'Material loaded', `${list.length} file(s) are now part of memory grounding: ${list.map(file => file.name).join(', ')}`);
    persistTeacherState();
}

async function handleTeacherImageFiles(files) {
    return handleTeacherMaterialFiles(files);
}

function isTeacherTextFile(file) {
    return /^text\//.test(file.type || '') || /\.(md|txt|csv|json|js|ts|tsx|jsx|py|java|cpp|c|html|css|sql)$/i.test(file.name || '');
}

async function extractTeacherFileText(file) {
    const name = file.name || 'material';
    try {
        if (isTeacherTextFile(file)) return (await file.text()).slice(0, 80000);
        if (/\.pdf$/i.test(name)) return await extractTeacherPdfText(file);
        if (/\.docx$/i.test(name)) return await extractTeacherDocxText(file);
        if (/\.pptx$/i.test(name)) return await extractTeacherPptxText(file);
    } catch(err) {
        return `Could not extract ${name}: ${err.message}.`;
    }
    return `Document uploaded: ${name}. Text extraction is not available for this format yet.`;
}

async function extractTeacherPdfText(file) {
    const pdfjs = window.pdfjsLib || await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.mjs');
    if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.mjs';
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let pageNo = 1; pageNo <= Math.min(pdf.numPages, 80); pageNo++) {
        const page = await pdf.getPage(pageNo);
        const content = await page.getTextContent();
        const text = content.items.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
        if (text) pages.push(`[page ${pageNo}] ${text}`);
    }
    return pages.join('\n\n').slice(0, 120000);
}

async function extractTeacherDocxText(file) {
    const buffer = await file.arrayBuffer();
    if (window.mammoth?.extractRawText) {
        const result = await window.mammoth.extractRawText({ arrayBuffer: buffer });
        return String(result.value || '').slice(0, 120000);
    }
    if (!window.JSZip) throw new Error('DOCX reader library unavailable');
    const zip = await window.JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')?.async('text');
    return extractXmlText(xml).slice(0, 120000);
}

async function extractTeacherPptxText(file) {
    if (!window.JSZip) throw new Error('PPTX reader library unavailable');
    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    const slideFiles = Object.keys(zip.files)
        .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
        .sort((a, b) => Number(a.match(/slide(\d+)/i)?.[1] || 0) - Number(b.match(/slide(\d+)/i)?.[1] || 0));
    const slides = [];
    for (const slideName of slideFiles.slice(0, 80)) {
        const slideNo = slideName.match(/slide(\d+)/i)?.[1] || slides.length + 1;
        slides.push(`[slide ${slideNo}] ${extractXmlText(await zip.file(slideName).async('text'))}`);
    }
    return slides.join('\n\n').slice(0, 120000);
}

function extractXmlText(xml) {
    if (!xml) return '';
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    return [...doc.getElementsByTagName('*')]
        .filter(node => /(^|:)t$/i.test(node.nodeName))
        .map(node => node.textContent.trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function chunkTeacherMaterial(item) {
    const text = String(item.text || '').replace(/\r/g, '').trim();
    if (!text) return [];
    const chunks = [];
    const size = 1400, overlap = 240;
    for (let start = 0; start < text.length; start += size - overlap) {
        const slice = text.slice(start, start + size).trim();
        if (slice.length < 80) continue;
        chunks.push({ id: `${item.id || item.name}-${chunks.length}`, materialId: item.id, source: item.name, text: slice, tokens: tokenizeMentorText(slice) });
    }
    return chunks;
}

function rebuildTeacherMaterialIndex() {
    teacherMaterialChunks = teacherMaterials.flatMap(chunkTeacherMaterial);
}

function rankTeacherMaterialChunks(query, limit = 6) {
    const qTokens = tokenizeMentorText(query);
    if (!qTokens.length || !teacherMaterialChunks.length) return [];
    const qSet = new Set(qTokens);
    return teacherMaterialChunks
        .map(chunk => {
            let score = 0;
            const seen = new Set();
            chunk.tokens.forEach(token => {
                if (qSet.has(token)) score += seen.has(token) ? 1 : 5;
                seen.add(token);
            });
            return { ...chunk, score };
        })
        .filter(chunk => chunk.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

function buildMaterialContext(maxChars = 5000) {
    const query = `${teacherState.topic} ${teacherState.subject} ${(teacherMemory.weakTopics || []).join(' ')}`;
    const ranked = rankTeacherMaterialChunks(query, 8);
    const text = ranked.length
        ? ranked.map(chunk => `Source: ${chunk.source}\n${chunk.text}`).join('\n\n---\n\n')
        : teacherMaterials.filter(item => item.text).map(item => `Source: ${item.name}\n${item.text.slice(0, 1600)}`).join('\n\n---\n\n');
    const imageNames = teacherPendingImages.map(img => img.name).join(', ');
    return `${text.slice(0, maxChars)}${imageNames ? `\n\nUploaded images available for vision: ${imageNames}` : ''}`.trim();
}

function clearTeacherMaterials() {
    teacherMaterials = [];
    teacherMaterialChunks = [];
    teacherPendingImages = [];
    teacherState.materialsUsed = [];
    appendTeacherStreamCard('mentor', 'Material memory cleared', 'Uploaded grounding for this session was cleared.');
}

function renderTeacherMaterials() {
    appendTeacherStreamCard('mentor', 'Materials', teacherMaterials.length ? teacherMaterials.map(item => `- ${item.name}`).join('\n') : 'No materials loaded yet.');
}

function startTeacherVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { toast('Speech recognition is not supported in this browser.', 'err'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.onerror = e => toast(e.error || 'Voice input failed', 'err');
    recognition.onresult = event => {
        const text = event.results?.[0]?.[0]?.transcript || '';
        const target = teacherState.phase === 'entry' ? document.getElementById('teacherStruggleInput') : document.getElementById('teacherDoubtInput');
        if (target) {
            target.value = text;
            if (teacherState.phase === 'entry') startTeacherDiagnosticFromEntry();
            else sendTeacherDoubt();
        }
    };
    recognition.start();
}

function speakTeacherLesson() {
    const text = (currentTeacherLesson?.markdown || document.getElementById('teacherLessonStream')?.innerText || '').slice(0, 5000);
    if (!text) { toast('Start a lesson first.', 'err'); return; }
    if (!window.speechSynthesis) { toast('Text-to-speech is not supported.', 'err'); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/```[\s\S]*?```/g, 'code example omitted'));
    utterance.rate = teacherMemory.dna?.pace < 45 ? 0.88 : 0.96;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
}

function stopTeacherVoice() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
}

function setTeacherStatus() {}
function switchTeacherTab() {}
function initTeacherWhiteboard() {}
function selectTeacherWhiteboardTool() {}
function setTeacherWhiteboardColor() {}
function clearTeacherWhiteboard() {}
function downloadTeacherWhiteboard() {}
function drawTeacherConceptMap() { generateTeacherVisual(); }
function renderTeacherPractice() {}
function submitTeacherQuiz() {}
function checkTeacherCode() {}
function runTeacherCode() {}
function renderTeacherCoachWelcome() {}
function handleTeacherCoachKey(event) { if (event.key === 'Enter' && !event.shiftKey) sendTeacherDoubt(); }
function autoResizeTeacherCoach(el) { autoResizeTeacherDoubt(el); }
function sendTeacherCoachMessage() { sendTeacherDoubt(); }

function restartTeacherMentor() {
    cancelTeacherGeneration(false);
    if (teacherVisualFrame) cancelAnimationFrame(teacherVisualFrame);
    resetTeacherState('');
    localStorage.removeItem(TEACHER_STATE_KEY);
    const input = document.getElementById('teacherStruggleInput');
    if (input) input.value = '';
    document.getElementById('teacherLessonStream')?.removeAttribute('data-ready');
    renderTeacherScreen();
    renderTeacherEntry();
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
    return `<div class="dash-section daily-quest-card">
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
        <div class="dash-quest-footer">
            <span class="dash-quest-note">All 3 complete karo aur +15 XP bonus claim karo.</span>
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

            <div class="dash-section dashboard-full">
                <div class="dash-section-title">🗓️ Activity Calendar (Last Year)</div>
                <div class="calendar-grid">${calData.map(d => `<div class="cal-day level-${d.level}" title="${d.date}: ${d.count} activity"></div>`).join('')}</div>
                <div class="cal-legend">Less <div class="cal-legend-squares">${[0,1,2,3,4].map(l => `<div class="cal-legend-sq cal-day level-${l}"></div>`).join('')}</div> More</div>
            </div>

            <div class="dash-insight-grid">
                <div class="dash-section">
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
                <div class="dash-section">
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
function getPostDraft() {
    const rawTagInput = document.getElementById('tagRawInput')?.value.trim() || '';
    const draftTags = rawTagInput ? [...currentTags, rawTagInput] : [...currentTags];
    return {
        title: document.getElementById('bugTitle')?.value.trim() || '',
        description: document.getElementById('bugDesc')?.value.trim() || '',
        category: document.getElementById('bugCat')?.value || '',
        tags: sanitizeAITags(draftTags)
    };
}

function normalizeCategory(value) {
    const allowed = ['Coding', 'Life', 'Studies', 'Career', 'Relationships', 'Random'];
    const found = allowed.find(cat => cat.toLowerCase() === String(value || '').trim().toLowerCase());
    return found || '';
}

function normalizeList(value) {
    if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
    if (!value) return [];
    return String(value).split(/\n|;/).map(item => item.replace(/^[-*\d.)\s]+/, '').trim()).filter(Boolean);
}

function sanitizeAITags(tags) {
    const unique = [];
    (Array.isArray(tags) ? tags : []).forEach(tag => {
        const clean = String(tag || '').toLowerCase().replace(/^#/, '').replace(/[^a-z0-9_\-]/g, '').slice(0, 20);
        if (clean && !unique.includes(clean)) unique.push(clean);
    });
    return unique.slice(0, 5);
}

function normalizeTriageReport(report, draft) {
    const safe = report && typeof report === 'object' ? report : {};
    return {
        title: String(safe.title || safe.improved_title || draft.title || '').trim().slice(0, 90),
        category: normalizeCategory(safe.category) || draft.category || 'Coding',
        severity: String(safe.severity || safe.priority || 'Medium').trim().slice(0, 24),
        summary: String(safe.summary || safe.problem_summary || draft.description || '').trim(),
        repro_steps: normalizeList(safe.repro_steps || safe.steps_to_reproduce),
        expected_result: String(safe.expected_result || safe.expected || '').trim(),
        actual_result: String(safe.actual_result || safe.actual || '').trim(),
        clarifying_questions: normalizeList(safe.clarifying_questions || safe.questions),
        tags: sanitizeAITags(safe.tags || draft.tags)
    };
}

async function runAITriage() {
    const draft = getPostDraft();
    if (!draft.title && !draft.description) { toast('Pehle title ya description likho!', 'err'); return; }
    const btn = document.getElementById('aiTriageBtn');
    const box = document.getElementById('triageBox');
    const content = document.getElementById('triageContent');
    if (!btn || !box || !content) return;
    btn.disabled = true;
    btn.textContent = 'Triaging...';
    box.classList.add('show');
    content.innerHTML = '<div class="ai-loading-wrap"><div class="spinner"></div><div class="ai-loading-text">AI post ko polish kar raha hai...</div></div>';
    const prompt = `You are BUGOUT's AI triage assistant. Improve a community bug/problem post without inventing facts.

Draft:
Title: ${draft.title || 'Missing'}
Category: ${draft.category || 'Missing'}
Tags: ${draft.tags.join(', ') || 'None'}
Description:
${draft.description || 'Missing'}

Return ONLY JSON:
{
  "title": "clear searchable title under 90 characters",
  "category": "Coding/Life/Studies/Career/Relationships/Random",
  "severity": "Low/Medium/High/Urgent",
  "summary": "clean problem summary in Hinglish",
  "repro_steps": ["step 1", "step 2"],
  "expected_result": "what should happen",
  "actual_result": "what is happening",
  "clarifying_questions": ["question the community should answer"],
  "tags": ["up to 5 lowercase tags"]
}
If details are missing, ask questions instead of making them up.`;
    try {
        const data = await callGroq([{ role: 'user', content: prompt }], {
            max_tokens: 1100,
            temperature: 0.25,
            response_format: { type: 'json_object' }
        });
        const report = normalizeTriageReport(extractJSON(data.choices?.[0]?.message?.content || '', {}), draft);
        lastTriageSuggestion = report;
        renderTriageReport(report);
        toast('AI triage ready!', 'ok');
    } catch(err) {
        content.innerHTML = `<div class="ai-error-wrap"><p>Triage failed: ${esc(err.message)}</p><button class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="runAITriage()">Retry</button></div>`;
        toast('Triage error: ' + err.message, 'err');
    }
    btn.disabled = false;
    btn.textContent = 'AI Triage & Polish';
}

function renderTriageReport(report) {
    const content = document.getElementById('triageContent');
    if (!content) return;
    const steps = report.repro_steps.length ? report.repro_steps : ['Details missing - community ko exact steps batao.'];
    const questions = report.clarifying_questions.length ? report.clarifying_questions : ['Kya exact error/output aa raha hai?', 'Expected result kya tha?'];
    content.innerHTML = `
        <div class="triage-report">
            <div class="triage-topline">
                <span class="triage-pill">${esc(report.severity)}</span>
                <span class="triage-pill">${esc(report.category)}</span>
                ${report.tags.map(tag => `<span class="triage-pill">#${esc(tag)}</span>`).join('')}
            </div>
            <h3>${esc(report.title || 'Polished bug title')}</h3>
            <p>${esc(report.summary || 'Summary missing.')}</p>
            <div class="triage-grid">
                <div><strong>Expected</strong><span>${esc(report.expected_result || 'Add expected result.')}</span></div>
                <div><strong>Actual</strong><span>${esc(report.actual_result || 'Add actual result.')}</span></div>
            </div>
            <div class="triage-mini-list"><strong>Repro steps</strong>${steps.map((step, i) => `<span>${i + 1}. ${esc(step)}</span>`).join('')}</div>
            <div class="triage-mini-list"><strong>Questions to add</strong>${questions.map(q => `<span>${esc(q)}</span>`).join('')}</div>
            <div class="triage-actions">
                <button class="btn btn-sm" onclick="applyTriageSuggestion()">Apply Triage</button>
                <button class="btn btn-sm btn-ghost" onclick="scanSimilarBugsFromPost()">Check Similar Bugs</button>
            </div>
        </div>
    `;
}

function applyTriageSuggestion() {
    const report = lastTriageSuggestion;
    if (!report) { toast('Pehle AI triage run karo.', 'err'); return; }
    const titleEl = document.getElementById('bugTitle');
    const catEl = document.getElementById('bugCat');
    const descEl = document.getElementById('bugDesc');
    if (titleEl && report.title) titleEl.value = report.title;
    if (catEl && normalizeCategory(report.category)) catEl.value = normalizeCategory(report.category);
    if (descEl) {
        const lines = [];
        if (report.summary) lines.push(report.summary);
        if (report.repro_steps.length) lines.push('', 'Steps to reproduce:', ...report.repro_steps.map((step, i) => `${i + 1}. ${step}`));
        if (report.expected_result) lines.push('', 'Expected:', report.expected_result);
        if (report.actual_result) lines.push('', 'Actual:', report.actual_result);
        if (report.clarifying_questions.length) lines.push('', 'Extra context needed:', ...report.clarifying_questions.map(q => `- ${q}`));
        descEl.value = lines.join('\n').trim() || descEl.value;
    }
    currentTags = sanitizeAITags(report.tags);
    renderTagPills();
    toast('Triage apply ho gaya!', 'ok');
}

const SIMILARITY_STOP_WORDS = new Set(['the','and','for','with','this','that','from','have','has','are','was','were','your','you','but','not','can','how','why','what','when','where','kya','hai','hain','mera','meri','mere','nahi','error','issue','problem']);

function tokenizeForSimilarity(value) {
    return String(value || '').toLowerCase()
        .replace(/[^a-z0-9+#.\-\s]/g, ' ')
        .split(/\s+/)
        .map(token => token.trim())
        .filter(token => token.length > 1 && !SIMILARITY_STOP_WORDS.has(token));
}

function scoreSimilarBug(bug, context, excludeId) {
    if (!bug || (excludeId && String(bug.id) === String(excludeId))) return 0;
    const queryTokens = new Set(tokenizeForSimilarity(`${context.title || ''} ${context.description || ''} ${(context.tags || []).join(' ')} ${context.category || ''}`));
    if (!queryTokens.size) return 0;
    const titleTokens = new Set(tokenizeForSimilarity(bug.title));
    const descTokens = new Set(tokenizeForSimilarity(bug.description));
    const bugTags = sanitizeAITags(bug.tags || []);
    const tagTokens = new Set(bugTags);
    let score = 0;
    queryTokens.forEach(token => {
        if (titleTokens.has(token)) score += 7;
        if (tagTokens.has(token)) score += 10;
        if (descTokens.has(token)) score += 3;
    });
    const contextTags = sanitizeAITags(context.tags || []);
    contextTags.forEach(tag => { if (bugTags.includes(tag)) score += 12; });
    if (context.category && bug.category === context.category) score += 5;
    return score;
}

async function findSimilarBugs(context, excludeId = null) {
    const { data, error } = await db.from('bugs')
        .select('id,title,description,category,tags,solutions_count,status,created_at,username')
        .order('created_at', { ascending: false })
        .limit(120);
    if (error) throw error;
    return (data || [])
        .map(bug => ({ ...bug, similarityScore: scoreSimilarBug(bug, context, excludeId) }))
        .filter(bug => bug.similarityScore >= 10)
        .sort((a, b) => b.similarityScore - a.similarityScore || parseSupabaseDate(b.created_at) - parseSupabaseDate(a.created_at))
        .slice(0, 4);
}

function renderSimilarBugCards(matches, emptyText) {
    if (!matches.length) return `<div class="related-empty">${esc(emptyText)}</div>`;
    return `<div class="related-bug-list">${matches.map(bug => `
        <button type="button" class="related-bug-card" onclick="openBug('${bug.id}')">
            <span>${esc(bug.title || 'Untitled bug')}</span>
            <small>${esc(bug.category || 'General')} - ${esc(bug.status || 'open')} - ${bug.solutions_count || 0} solutions - ${timeAgo(bug.created_at)}</small>
            <em>${Math.min(99, bug.similarityScore)} match</em>
        </button>
    `).join('')}</div>`;
}

async function renderSimilarBugs(boxId, contentId, context, options = {}) {
    const box = document.getElementById(boxId);
    const content = document.getElementById(contentId);
    if (!box || !content) return;
    box.classList.add('show');
    content.innerHTML = '<div class="ai-loading-wrap"><div class="spinner"></div><div class="ai-loading-text">Similar bugs scan ho rahe hain...</div></div>';
    try {
        const matches = await findSimilarBugs(context, options.excludeId || null);
        content.innerHTML = renderSimilarBugCards(matches, options.emptyText || 'Close duplicate nahi mila. Post fresh lag raha hai.');
    } catch(err) {
        content.innerHTML = `<div class="ai-error-wrap">Similar scan failed: ${esc(err.message)}</div>`;
    }
}

async function scanSimilarBugsFromPost() {
    const context = getPostDraft();
    if (!context.title && !context.description && !context.tags.length) { toast('Pehle title, description ya tags do.', 'err'); return; }
    const btn = document.getElementById('similarBugBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Scanning...'; }
    await renderSimilarBugs('postSimilarBox', 'postSimilarContent', context);
    if (btn) { btn.disabled = false; btn.textContent = 'Find Similar Bugs'; }
}

function loadRelatedBugsForActive() {
    if (!activeBug) return;
    renderSimilarBugs('relatedBugBox', 'relatedBugContent', {
        title: activeBug.title,
        description: activeBug.description,
        category: activeBug.category,
        tags: activeBug.tags || []
    }, {
        excludeId: activeBug.id,
        emptyText: 'Is bug ke close related posts abhi nahi mile.'
    });
}

async function reviewSolutionWithAI() {
    if (!activeBug) return;
    const input = document.getElementById('solText');
    const box = document.getElementById('solutionCoachBox');
    const content = document.getElementById('solutionCoachContent');
    const solution = input?.value.trim() || '';
    if (!solution) { toast('Pehle solution likho.', 'err'); return; }
    if (solution.length > 9000) { toast('Solution thoda chhota karo.', 'err'); return; }
    if (!box || !content) return;
    box.classList.add('show');
    content.innerHTML = '<div class="ai-loading-wrap"><div class="spinner"></div><div class="ai-loading-text">Solution quality check ho raha hai...</div></div>';
    const prompt = `You are BUGOUT's strict but friendly solution quality coach. Review the draft before it is posted.

Bug:
Title: ${activeBug.title}
Category: ${activeBug.category}
Description:
${activeBug.description}

Draft solution:
${solution}

Return ONLY JSON:
{
  "score": 0,
  "verdict": "short Hinglish verdict",
  "strengths": ["what is good"],
  "risks": ["bugs, missing proof, unclear steps"],
  "missing_details": ["details user should add"],
  "improved_solution": "a clearer post-ready version, preserving the user's idea",
  "post_checklist": ["quick checks before posting"]
}`;
    try {
        const data = await callGroq([{ role: 'user', content: prompt }], {
            max_tokens: 1600,
            temperature: 0.25,
            response_format: { type: 'json_object' }
        });
        const review = extractJSON(data.choices?.[0]?.message?.content || '', {});
        renderSolutionCoach(review);
        toast('Solution review ready!', 'ok');
    } catch(err) {
        content.innerHTML = `<div class="ai-error-wrap"><p>Review failed: ${esc(err.message)}</p><button class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="reviewSolutionWithAI()">Retry</button></div>`;
    }
}

function renderSolutionCoach(review) {
    const content = document.getElementById('solutionCoachContent');
    if (!content) return;
    const score = Math.max(0, Math.min(100, Number(review?.score) || 0));
    const strengths = normalizeList(review?.strengths);
    const risks = normalizeList(review?.risks);
    const missing = normalizeList(review?.missing_details);
    const checklist = normalizeList(review?.post_checklist);
    window._solutionCoachImproved = String(review?.improved_solution || '').trim();
    content.innerHTML = `
        <div class="solution-coach-card">
            <div class="solution-score-ring">
                <strong>${score}</strong>
                <span>/100</span>
            </div>
            <div class="solution-coach-body">
                <h3>${esc(review?.verdict || 'Review complete')}</h3>
                <div class="coach-columns">
                    <div><strong>Strengths</strong>${(strengths.length ? strengths : ['Idea useful hai.']).map(x => `<span>${esc(x)}</span>`).join('')}</div>
                    <div><strong>Risks</strong>${(risks.length ? risks : ['Edge cases aur clarity ek baar check karo.']).map(x => `<span>${esc(x)}</span>`).join('')}</div>
                </div>
                ${missing.length ? `<div class="triage-mini-list"><strong>Missing details</strong>${missing.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
                ${checklist.length ? `<div class="triage-mini-list"><strong>Post checklist</strong>${checklist.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
                ${window._solutionCoachImproved ? `<div class="triage-mini-list"><strong>Improved version</strong><span>${esc(window._solutionCoachImproved)}</span></div><button class="btn btn-sm" onclick="useImprovedSolution()">Use Improved Version</button>` : ''}
            </div>
        </div>
    `;
}

function useImprovedSolution() {
    const improved = window._solutionCoachImproved;
    const input = document.getElementById('solText');
    if (!improved || !input) return;
    input.value = improved;
    input.focus();
    toast('Improved solution apply ho gaya!', 'ok');
}

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
    if (!routed) loadBugs();
    loadStats();
});

async function loadStats() {
    try {
        const [{ count: b }, { count: s }, { count: u }] = await Promise.all([
            db.from('bugs').select('*', { count: 'exact', head: true }),
            db.from('solutions').select('*', { count: 'exact', head: true }),
            db.from('profiles').select('*', { count: 'exact', head: true })
        ]);
        document.getElementById('statBugs').textContent = b || 0;
        document.getElementById('statSolutions').textContent = s || 0;
        document.getElementById('statWarriors').textContent = u || 0;
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
        const role = profile.role || 'user';
        const color = profile.avatar_color || '#00ff88', interests = profile.interests || [], canMsg = me && !isMe;
        const badgesArr = Array.isArray(badges) ? badges : [];
        wrap.innerHTML = `
            <button class="back-btn" onclick="goHome()">← Back</button>
            <div class="profile-card">
                <div class="profile-top">
                    ${makeAvatar(displayName[0].toUpperCase(), color, 80)}
                    <div class="profile-info">
                        <h2>${esc(displayName)} ${isMe ? '😈' : ''} ${getRoleBadge(role)}</h2>
                        <div class="username-tag">@${esc(profile.username || 'anonymous')}</div>
                        ${profile.bio ? `<div class="bio-text">${esc(profile.bio)}</div>` : ''}
                        <div class="level-badge">${lvl.emoji} Level ${lvlNum} — ${lvl.name}</div>
                        ${role === 'admin' ? '<div class="admin-note">Platform admin - can moderate bugs and manage status</div>' : ''}
                        <div style="margin-top:8px;"><span class="streak-pill">🔥 ${profile.streak || 0} day streak</span></div>
                        ${interests.length > 0 ? `<div class="interests-wrap">${interests.map(i => `<span class="interest-tag">${esc(i)}</span>`).join('')}</div>` : ''}
                    </div>
                </div>
                <div class="follow-stats">
                    <div class="follow-stat" onclick="showFollowList('${userId}','followers')"><div class="follow-count" id="profile-followers-count">${counts.followers}</div><div class="follow-label">Followers</div></div>
                    <div class="follow-stat" onclick="showFollowList('${userId}','following')"><div class="follow-count">${counts.following}</div><div class="follow-label">Following</div></div>
                </div>
                <div class="profile-actions">
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
                <div class="profile-badges-section"><h3 class="profile-badges-title">🏅 Badges</h3>${renderBadges(badgesArr)}</div>
            </div>
            ${bugsPosted > 0 ? `<div class="profile-bugs"><h3>Recent Bugs</h3><div class="profile-recent-list">${bugs.slice(0, 6).map(b => `<div class="bug-card" onclick="openBug('${b.id}')"><div class="bug-card-head"><span class="bug-tag">${esc(b.category)}</span>${getStatusBadge(b.status || 'open')}</div><h3 style="font-size:1rem;">${esc(b.title)}</h3><div class="bug-footer" style="margin-top:0.5rem;"><span>${timeAgo(b.created_at)}</span><span>💡 ${b.solutions_count || 0} solutions</span></div></div>`).join('')}</div></div>` : ''}`;
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
        const { data } = await db.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
        if (data) { myName = data.display_name || data.username || user.email.split('@')[0]; myXP = data.xp || 0; myRole = data.role || 'user'; }
        else { myName = user.email.split('@')[0]; myXP = 0; myRole = 'user'; }
    } catch(e) { myName = user.email.split('@')[0]; myXP = 0; myRole = 'user'; }
    renderUserUI(); startUnreadCheck(); startNotifCheck(); await loadMyBookmarks();
}

function clearUser() {
    me = null; myName = null; myXP = 0; myRole = 'user'; myBookmarks = new Set(); mentorHistory = []; teacherProgress = []; currentTeacherLesson = null;
    clearMentorPendingImages();
    if (unreadCheckInterval) { clearInterval(unreadCheckInterval); unreadCheckInterval = null; }
    if (notifCheckInterval) { clearInterval(notifCheckInterval); notifCheckInterval = null; }
    if (msgSubscription) { msgSubscription.unsubscribe(); msgSubscription = null; }
    renderUserUI();
}

function renderUserUI() {
    const on = !!me;
    document.getElementById('authBtn').textContent = on ? 'Sign Out' : 'Sign In';
    document.getElementById('userPill').style.display = on ? 'flex' : 'none';
    document.getElementById('userPill').classList.toggle('admin', on && isAdminUser());
    document.getElementById('postBtn').style.display = on ? 'inline-flex' : 'none';
    document.getElementById('msgBell').style.display = on ? 'flex' : 'none';
    document.getElementById('homeNavBtn').style.display = 'inline-flex';
    document.getElementById('teacherNavBtn').style.display = 'inline-flex';
    document.getElementById('arenaNavBtn').style.display = 'inline-flex';
    document.getElementById('missionsNavBtn').style.display = 'inline-flex';
    const careerNavBtn = document.getElementById('careerNavBtn');
    if (careerNavBtn) careerNavBtn.style.display = 'inline-flex';
    document.getElementById('bookmarkNavBtn').style.display = on ? 'inline-flex' : 'none';
    document.getElementById('dashboardNavBtn').style.display = on ? 'inline-flex' : 'none';
    document.getElementById('mentorNavBtn').style.display = 'none';
    document.getElementById('analyzerNavBtn').style.display = 'none';
    document.getElementById('collabNavBtn').style.display = on ? 'inline-flex' : 'none';
    document.getElementById('notifBellWrap').classList.toggle('show', on);
    if (on && typeof initCollaboration === 'function') initCollaboration();
    if (on) { const lvl = getLevel(myXP); document.getElementById('userName').textContent = lvl.emoji + ' ' + myName; document.getElementById('userXP').textContent = (isAdminUser() ? 'ADMIN - ' : '') + myXP + ' XP'; }
    renderMissionControl();
}

async function addXP(amount) {
    if (!me) return;
    try {
        const oldLvl = getLevelNum(myXP); myXP += amount;
        await db.from('profiles').update({ xp: myXP }).eq('user_id', me.id);
        const newLvl = getLevelNum(myXP), lvl = getLevel(myXP);
        document.getElementById('userXP').textContent = (isAdminUser() ? 'ADMIN - ' : '') + myXP + ' XP';
        document.getElementById('userName').textContent = lvl.emoji + ' ' + myName;
        if (newLvl > oldLvl) toast(`🎉 Level Up! Tu ab ${lvl.emoji} ${lvl.name} hai!`, 'ok');
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
    updatePrimaryNav(id);
    if (id === 'homePage') renderMissionControl();
    if (id === 'careerPage') renderCareerPage();
    window.scrollTo(0, 0);
    if (id !== 'chatPage' && msgSubscription) { msgSubscription.unsubscribe(); msgSubscription = null; }
    closeNotifPanel();
}
function goHome() { clearRoute(); showPage('homePage'); clearSearch(); activeStatusFilter = null; loadBugs(); loadStats(); }

function updatePrimaryNav(pageId) {
    const activeMap = {
        homePage: 'homeNavBtn',
        dashboardPage: 'homeNavBtn',
        detailPage: 'homeNavBtn',
        postPage: 'homeNavBtn',
        bookmarksPage: 'homeNavBtn',
        teacherPage: 'teacherNavBtn',
        mentorPage: 'teacherNavBtn',
        arenaPage: 'arenaNavBtn',
        analyzerPage: 'arenaNavBtn',
        missionsPage: 'missionsNavBtn',
        missionDetailPage: 'missionsNavBtn',
        collabPage: 'missionsNavBtn',
        collabRoomPage: 'missionsNavBtn',
        careerPage: 'careerNavBtn',
        leaderboardPage: 'careerNavBtn',
        profilePage: 'careerNavBtn'
    };
    document.querySelectorAll('.os-nav-btn').forEach(btn => btn.classList.remove('active'));
    const active = document.getElementById(activeMap[pageId] || 'homeNavBtn');
    if (active) active.classList.add('active');
}

function getStoredTeacherProgress() {
    if (Array.isArray(teacherProgress) && teacherProgress.length) return teacherProgress;
    try {
        const saved = JSON.parse(localStorage.getItem(TEACHER_PROGRESS_KEY) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch(e) {
        return [];
    }
}

function getGrowthMetrics() {
    const progress = getStoredTeacherProgress();
    const lessons = progress.length;
    const avg = lessons ? Math.round(progress.reduce((sum, row) => sum + Number(row.score || row.mastery || 0), 0) / lessons) : 0;
    const baseXP = Number(myXP || 0);
    const learningXP = Math.max(teacherMemory?.xp || 0, lessons * 25);
    const practiceXP = Math.round(baseXP * 0.38);
    const buildXP = Math.round(baseXP * 0.28);
    const careerXP = Math.round(baseXP * 0.16);
    const readiness = Math.max(18, Math.min(96, Math.round(22 + (baseXP / 18) + lessons * 5 + (avg / 5) + (me ? 8 : 0))));
    return { progress, lessons, avg, baseXP, learningXP, practiceXP, buildXP, careerXP, readiness };
}

function renderMissionControl() {
    const root = document.getElementById('homePage');
    if (!root) return;
    const metrics = getGrowthMetrics();
    const lvl = getLevel(Number(myXP || 0));
    const weak = (teacherMemory?.weakTopics || [])[0];
    const userName = document.getElementById('mcUserName');
    const globalLevel = document.getElementById('mcGlobalLevel');
    const nextAction = document.getElementById('mcNextAction');
    const journeyTitle = document.getElementById('mcJourneyTitle');
    const journeyCopy = document.getElementById('mcJourneyCopy');
    const objectives = document.getElementById('mcTodayObjectives');
    const career = document.getElementById('mcCareerReadiness');
    const weekly = document.getElementById('mcWeeklyMomentum');
    const radar = document.getElementById('mcSkillRadar');
    if (userName) userName.textContent = me ? (myName || 'BUGOUT student') : 'Guest student';
    if (globalLevel) globalLevel.textContent = me ? `${lvl.name} - ${metrics.baseXP} XP synced` : 'Sign in to sync your growth system.';
    if (nextAction) nextAction.textContent = weak ? `Repair ${weak}` : (metrics.lessons ? 'Solve one Arena challenge' : 'Run a diagnostic lesson');
    if (journeyTitle) journeyTitle.textContent = metrics.lessons ? `Continue from ${metrics.progress[0]?.topic || 'your last lesson'}` : 'Your growth system is ready.';
    if (journeyCopy) journeyCopy.textContent = metrics.lessons
        ? `Average mastery is ${metrics.avg}%. BUGOUT recommends one targeted practice session before the next build sprint.`
        : 'Start with one diagnostic lesson. BUGOUT will use that signal to shape your learning path, practice work, and career proof.';
    if (objectives) {
        objectives.innerHTML = [
            weak ? `Repair weak area: ${esc(weak)}.` : 'Complete one adaptive lesson.',
            metrics.baseXP > 0 ? 'Add one proof point through Arena or Missions.' : 'Create an account to sync XP and progress.',
            'Write one community answer or improve one stuck point.'
        ].map(item => `<li>${esc(item)}</li>`).join('');
    }
    if (career) career.textContent = `${metrics.readiness}%`;
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = String(value); };
    setText('mcLearningXP', metrics.learningXP);
    setText('mcPracticeXP', metrics.practiceXP);
    setText('mcBuildXP', metrics.buildXP);
    setText('mcCareerXP', metrics.careerXP);
    if (weekly) weekly.textContent = me ? 'Protect the streak: learn, practice, build, and log one proof point this week.' : 'One focused session today is enough to restart your streak.';
    if (radar) {
        const learn = Math.min(96, 34 + metrics.lessons * 10 + metrics.avg / 3);
        const practice = Math.min(96, 28 + metrics.practiceXP / 12);
        const build = Math.min(96, 24 + metrics.buildXP / 14);
        const careerScore = metrics.readiness;
        radar.innerHTML = [
            ['Learning', learn],
            ['Practice', practice],
            ['Build', build],
            ['Career', careerScore]
        ].map(([label, value]) => `<span style="--v:${Math.round(value)}%">${label}</span>`).join('');
    }
}

function runMissionControlNext() {
    const metrics = getGrowthMetrics();
    if (!metrics.lessons || (teacherMemory?.weakTopics || []).length) {
        goTeacher();
        return;
    }
    if (metrics.practiceXP < 80) {
        goArena();
        return;
    }
    if (metrics.buildXP < 120) {
        goMissions();
        return;
    }
    goCareer();
}

function goCareer() {
    showPage('careerPage');
    renderCareerPage();
}

function getCareerScores() {
    const metrics = getGrowthMetrics();
    const skills = Math.min(96, Math.round(30 + metrics.lessons * 8 + metrics.avg / 3));
    const projects = Math.min(96, Math.round(22 + metrics.buildXP / 8));
    const interview = Math.min(96, Math.round(28 + metrics.practiceXP / 9 + metrics.lessons * 3));
    const portfolio = Math.min(96, Math.round(20 + metrics.careerXP / 8 + metrics.buildXP / 16));
    const readiness = Math.round((skills * 0.3) + (projects * 0.25) + (interview * 0.25) + (portfolio * 0.2));
    return { ...metrics, skills, projects, interview, portfolio, readiness };
}

function renderCareerPage() {
    const page = document.getElementById('careerPage');
    if (!page) return;
    const scores = getCareerScores();
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    set('careerReadinessScore', `${scores.readiness}%`);
    set('careerSkillsScore', `${scores.skills}%`);
    set('careerProjectsScore', `${scores.projects}%`);
    set('careerInterviewScore', `${scores.interview}%`);
    set('careerPortfolioScore', `${scores.portfolio}%`);
    const output = document.getElementById('careerOutput');
    if (!output) return;
    if (!me) {
        output.innerHTML = `
            <h3>Start your career profile</h3>
            <p>Sign in, finish one lesson, solve one Arena problem, and join one mission. BUGOUT will turn those actions into a resume and portfolio story.</p>
            <button class="btn btn-sm" onclick="openModal()">Create account</button>
        `;
    }
}

function generateCareerResume() {
    const scores = getCareerScores();
    const progress = scores.progress.slice(0, 4);
    const output = document.getElementById('careerOutput');
    if (!output) return;
    const name = myName || 'Student';
    const level = getLevel(Number(myXP || 0)).name;
    const weak = (teacherMemory?.weakTopics || []).slice(0, 3);
    output.innerHTML = `
        <h3>Resume Snapshot</h3>
        <p><strong>${esc(name)}</strong> - ${esc(level)} BUGOUT operator with ${scores.baseXP} global XP and ${scores.readiness}% career readiness.</p>
        <ul>
            <li>Learning: ${scores.lessons || 0} adaptive lesson signal(s), average mastery ${scores.avg || 0}%.</li>
            <li>Practice: ${scores.practiceXP} Practice XP from problem solving and code improvement activity.</li>
            <li>Build: ${scores.buildXP} Build XP toward project-based proof and mission deliverables.</li>
            <li>Career: ${scores.careerXP} Career XP toward interview preparation, resume quality, and portfolio strength.</li>
            ${progress.length ? progress.map(row => `<li>Recent learning proof: ${esc(row.topic || row.subject || 'Adaptive lesson')} - ${Number(row.score || row.mastery || 0)}% mastery.</li>`).join('') : '<li>Recommended next proof: complete one AI Teacher diagnostic and one Arena challenge.</li>'}
            ${weak.length ? `<li>Current improvement targets: ${esc(weak.join(', '))}.</li>` : '<li>Current improvement target: discover weak topics through a diagnostic lesson.</li>'}
        </ul>
    `;
}

function generatePortfolioSummary() {
    const scores = getCareerScores();
    const output = document.getElementById('careerOutput');
    if (!output) return;
    output.innerHTML = `
        <h3>Portfolio Story Draft</h3>
        <p><strong>Positioning:</strong> A student building visible proof across learning, practice, and projects inside BUGOUT OS.</p>
        <ul>
            <li><strong>Learn:</strong> Uses adaptive AI lessons to diagnose weak areas and build mastery loops.</li>
            <li><strong>Practice:</strong> Solves Arena challenges and receives code-quality feedback for improvement.</li>
            <li><strong>Build:</strong> Converts missions into project deliverables, collaboration records, and certificates.</li>
            <li><strong>Career:</strong> Packages ${scores.baseXP} XP, ${scores.lessons} lesson signal(s), and project work into resume-ready evidence.</li>
        </ul>
        <p><strong>Next portfolio move:</strong> Join one mission, deploy the result, then add the live URL and a short engineering write-up.</p>
    `;
}

async function startCareerInterviewPrep() {
    await goTeacher();
    setTimeout(() => {
        const input = document.getElementById('teacherStruggleInput');
        if (input) {
            input.value = 'Placement interview preparation based on my projects, coding practice, weak topics, and resume gaps';
            input.focus();
        }
    }, 120);
}
function goPost() {
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    resetTagInput();
    document.getElementById('aiBox').classList.remove('show');
    document.getElementById('triageBox').classList.remove('show');
    document.getElementById('postSimilarBox').classList.remove('show');
    document.getElementById('aiSolveBtn').disabled = false;
    document.getElementById('aiSolveBtn').innerHTML = '🤖 Get AI Solutions First (Optional)';
    const triageBtn = document.getElementById('aiTriageBtn');
    const similarBtn = document.getElementById('similarBugBtn');
    if (triageBtn) { triageBtn.disabled = false; triageBtn.textContent = 'AI Triage & Polish'; }
    if (similarBtn) { similarBtn.disabled = false; similarBtn.textContent = 'Find Similar Bugs'; }
    window._aiSolutions = [];
    lastTriageSuggestion = null;
    showPage('postPage');
}

function showPostModal() {
    goPost();
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
        <div class="bug-card-head"><span class="bug-tag">${esc(b.category)}</span>${getStatusBadge(b.status || 'open')}</div>
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
    if (!canManageBug(activeBug)) { toast('Sirf owner ya admin edit kar sakta hai!', 'err'); return; }
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
        let query = db.from('bugs').update({ title, category, description, tags: editBugTags }).eq('id', editingBugId);
        if (!isAdminUser()) query = query.eq('user_id', me.id);
        const { error } = await query;
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
    if (!bugToDelete) return;
    if (!canManageBug(activeBug)) { closeConfirm(); bugToDelete = null; toast('Sirf owner ya admin delete kar sakta hai!', 'err'); return; }
    closeConfirm();
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
        activeBug = bug; const solutions = sols || [], isOwner = me && bug.user_id === me.id, canManage = canManageBug(bug);
        const tags = bug.tags && bug.tags.length ? bug.tags : [];
        const tagsHTML = tags.length ? `<div class="bug-tags-wrap" style="margin-top:8px;">${tags.map(t => `<span class="bug-tag-pill" onclick="filterByTagFromDetail('${esc(t)}')">#${esc(t)}</span>`).join('')}</div>` : '';
        const currentStatus = bug.status || 'open';
        const statusHTML = canManage ? `<div class="status-select-wrap"><label>📊 Status:</label><select class="status-select" onchange="updateBugStatus('${bug.id}',this.value)"><option value="open" ${currentStatus === 'open' ? 'selected' : ''}>🔴 Open</option><option value="in_progress" ${currentStatus === 'in_progress' ? 'selected' : ''}>🟡 In Progress</option><option value="solved" ${currentStatus === 'solved' ? 'selected' : ''}>🟢 Solved</option></select></div>` : '';
        wrap.innerHTML = `
            <button class="back-btn" onclick="goHome()">← Back to bugs</button>
            <div class="detail-card">
                <div class="detail-tag-row"><span class="bug-tag">${esc(bug.category)}</span>${getStatusBadge(currentStatus)}</div>
                <h2>${esc(bug.title)}</h2>${tagsHTML}
                <p class="desc" style="margin-top:12px;">${esc(bug.description)}</p>
                ${statusHTML}
                <div class="detail-meta">
                    <span>by <strong style="cursor:pointer;color:var(--accent);" onclick="goProfile('${bug.user_id}')">${esc(bug.username || 'Anonymous')}</strong></span>
                    <span>${timeAgo(bug.created_at)}</span><span>💡 ${solutions.length} solutions</span>
                    <span class="detail-actions"><button class="share-btn" onclick="copyShareLink('bug','${bug.id}')">🔗 Share</button>${canManage ? `<button class="btn btn-ghost btn-sm" onclick="openEditBugModal()">✏️ Edit</button><button class="btn btn-danger btn-sm" onclick="askDelete('${bug.id}',event)">🗑️ Delete</button>` : ''}</span>
                </div>
            </div>
            <div class="ai-box show related-bug-box" id="relatedBugBox">
                <div class="ai-box-header"><span>Radar</span><span class="ai-box-title">Related Bug Radar</span><span class="ai-box-subtitle">Same context</span></div>
                <div id="relatedBugContent"><div class="ai-loading-wrap"><div class="spinner"></div><div class="ai-loading-text">Related bugs scan ho rahe hain...</div></div></div>
            </div>
            <div class="solutions-header">Solutions (${solutions.length})</div>
            ${me ? `<div class="solution-input-box"><h4>Post your solution 💡</h4><div class="field"><textarea id="solText" placeholder="Share your solution..." rows="4"></textarea></div>
                <div class="solution-action-row">
                    <button class="btn btn-sm" id="solBtn" onclick="submitSolution()">Post Solution</button>
                    <button class="btn btn-sm btn-ghost" onclick="reviewSolutionWithAI()">Review Solution</button>
                    <button class="ai-solver-btn ai-compact-btn" onclick="getAISolutionsForDetail('${bug.id}')">🤖 Ask AI</button>
                </div>
                <div class="ai-box" id="solutionCoachBox" style="margin-top:0.75rem;">
                    <div class="ai-box-header"><span>Coach</span><span class="ai-box-title">Solution Quality Coach</span><span class="ai-box-subtitle">Before posting</span></div>
                    <div id="solutionCoachContent"></div>
                </div>
                <div class="ai-box" id="aiBoxDetail" style="margin-top:0.75rem;">
                    <div class="ai-box-header"><span>🤖</span><span class="ai-box-title">AI Suggestions</span><span class="ai-box-subtitle">Groq · LLaMA 3</span></div>
                    <div id="aiDetailContent"></div>
                    <div class="ai-footer-note">⚡ "↗ Use as my solution" click karo!</div>
                </div>
            </div>` : `<div class="solution-signin-card"><p>Solution post karne ke liye Sign In karo</p><button class="btn btn-sm" onclick="openModal()">Sign In</button></div>`}
            <div class="solutions-list">${solutions.length === 0 ? '<div class="empty" style="grid-column:unset;"><p>Koi solution nahi abhi 💪<br>Pehle warrior bano!</p></div>' : solutions.map(s => renderSolutionCard(s, canManage, bug.id)).join('')}</div>`;
        loadRelatedBugsForActive();
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

// Collaboration integration
function updateAuthUI() {
    const authBtn = document.getElementById('authBtn');
    const userPill = document.getElementById('userPill');
    const postBtn = document.getElementById('postBtn');
    const msgBell = document.getElementById('msgBell');
    const notifBellWrap = document.getElementById('notifBellWrap');
    const homeNavBtn = document.getElementById('homeNavBtn');
    const teacherNavBtn = document.getElementById('teacherNavBtn');
    const arenaNavBtn = document.getElementById('arenaNavBtn');
    const missionsNavBtn = document.getElementById('missionsNavBtn');
    const careerNavBtn = document.getElementById('careerNavBtn');
    const dashboardNavBtn = document.getElementById('dashboardNavBtn');
    const mentorNavBtn = document.getElementById('mentorNavBtn');
    const analyzerNavBtn = document.getElementById('analyzerNavBtn');
    const collabNavBtn = document.getElementById('collabNavBtn');
    const bookmarkNavBtn = document.getElementById('bookmarkNavBtn');
    const notifBell = document.getElementById('notifBell');

    if (me) {
        authBtn.textContent = 'Sign Out';
        authBtn.onclick = handleSignOut;
        userPill.style.display = 'flex';
        userPill.classList.toggle('admin', isAdminUser());
        document.getElementById('userName').textContent = myName || 'User';
        document.getElementById('userXP').textContent = (isAdminUser() ? 'ADMIN - ' : '') + myXP + ' XP';
        if (homeNavBtn) homeNavBtn.style.display = 'inline-flex';
        if (teacherNavBtn) teacherNavBtn.style.display = 'inline-flex';
        if (arenaNavBtn) arenaNavBtn.style.display = 'inline-flex';
        if (missionsNavBtn) missionsNavBtn.style.display = 'inline-flex';
        if (careerNavBtn) careerNavBtn.style.display = 'inline-flex';
        postBtn.style.display = 'inline-flex';
        msgBell.style.display = 'inline-flex';
        notifBellWrap.style.display = 'block';
        if (dashboardNavBtn) dashboardNavBtn.style.display = 'inline-flex';
        if (missionsNavBtn) missionsNavBtn.style.display = 'inline-flex';
        if (mentorNavBtn) mentorNavBtn.style.display = 'none';
        if (analyzerNavBtn) analyzerNavBtn.style.display = 'none';
        if (bookmarkNavBtn) bookmarkNavBtn.style.display = 'inline-flex';

        if (typeof initCollaboration === 'function') initCollaboration();
    } else {
        authBtn.textContent = 'Sign In';
        authBtn.onclick = handleAuth;
        postBtn.style.display = 'none';
        if (homeNavBtn) homeNavBtn.style.display = 'inline-flex';
        if (teacherNavBtn) teacherNavBtn.style.display = 'inline-flex';
        if (arenaNavBtn) arenaNavBtn.style.display = 'inline-flex';
        if (missionsNavBtn) missionsNavBtn.style.display = 'inline-flex';
        if (careerNavBtn) careerNavBtn.style.display = 'inline-flex';
        if (dashboardNavBtn) dashboardNavBtn.style.display = 'none';
        if (mentorNavBtn) mentorNavBtn.style.display = 'none';
        if (analyzerNavBtn) analyzerNavBtn.style.display = 'none';
        if (collabNavBtn) collabNavBtn.style.display = 'none';
        if (bookmarkNavBtn) bookmarkNavBtn.style.display = 'none';
        if (userPill) { userPill.style.display = 'none'; userPill.classList.remove('admin'); }
        if (notifBell) notifBell.style.display = 'none';
        if (msgBell) msgBell.style.display = 'none';
    }
    renderMissionControl();
}

// Enhanced handleSignOut to include collaboration cleanup
async function handleSignOut() {
    // Leave collaboration room if in one
    if (typeof leaveCollabRoom === 'function' && currentRoomId) {
        leaveCollabRoom();
    }
    
    await db.auth.signOut();
    me = null; myName = null; myXP = 0;
    updateAuthUI();
    goHome();
    clearRoute();
}

// Add collaboration to initial auth check
document.addEventListener('DOMContentLoaded', () => {
    // Existing initialization code...
    
    // Update auth UI after a short delay to ensure DOM is ready
    setTimeout(updateAuthUI, 100);
});
