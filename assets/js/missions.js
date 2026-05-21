// BUGOUT Missions: structured build challenges, teams, AI judging, rewards, and certificates.

let missionFilter = 'all';
let activeMissionId = null;
let activeCertificateSubmissionId = null;
let missionState = {
    missions: [],
    participants: [],
    submissions: [],
    certificates: [],
    active: null,
    tasks: [],
    activeParticipants: [],
    teams: [],
    teamMembers: [],
    progress: [],
    activeSubmissions: [],
    votes: [],
    activeCertificates: [],
    profiles: new Map()
};

const MISSION_TEMPLATE = {
    title: 'Build a Portfolio Website in 48 Hours',
    category: 'Build',
    type: 'solo',
    difficulty: 'Intermediate',
    reward: 300,
    teamSize: 4,
    brief: 'Ship a polished personal portfolio that can actually help you get opportunities.',
    description: 'Build and deploy a responsive portfolio with hero, projects, skills, contact section, and a short write-up about your build decisions. The best submissions balance clean UI, working links, accessibility, and clear explanation.',
    tasks: [
        'Choose stack and layout|20',
        'Build responsive landing page|50',
        'Add projects and skills sections|40',
        'Deploy live URL|50',
        'Write submission explanation|30'
    ],
    deliverables: [
        'Live deployed URL',
        'GitHub repository URL',
        'Short explanation of design and code choices',
        'At least one screenshot'
    ],
    rules: [
        'Submit before the deadline',
        'Use original work or clearly credit templates/assets',
        'All public links must be accessible to judges'
    ],
    criteria: [
        'Functionality',
        'Code quality',
        'UI/UX',
        'Creativity',
        'Explanation clarity'
    ]
};

function goMissions() {
    showPage('missionsPage');
    clearRoute();
    loadMissions();
}

async function loadMissions() {
    const grid = document.getElementById('missionsGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading missions...</p></div>';
    toggleMissionAdminUI();

    try {
        const { data: missions, error } = await db
            .from('missions')
            .select('*')
            .order('starts_at', { ascending: false });
        if (error) throw error;

        missionState.missions = missions || [];
        const ids = missionState.missions.map(m => m.id);
        missionState.participants = [];
        missionState.submissions = [];
        missionState.certificates = [];

        if (ids.length) {
            const [participantsRes, submissionsRes, certificatesRes] = await Promise.all([
                db.from('mission_participants').select('*').in('mission_id', ids),
                db.from('mission_submissions').select('*').in('mission_id', ids),
                db.from('mission_certificates').select('*').in('mission_id', ids)
            ]);
            if (participantsRes.error) throw participantsRes.error;
            if (submissionsRes.error) throw submissionsRes.error;
            if (certificatesRes.error) throw certificatesRes.error;
            missionState.participants = participantsRes.data || [];
            missionState.submissions = submissionsRes.data || [];
            missionState.certificates = certificatesRes.data || [];
        }

        renderMissionsHub();
    } catch (err) {
        renderMissionSetupNotice(grid, err);
    }
}

function renderMissionsHub() {
    const grid = document.getElementById('missionsGrid');
    if (!grid) return;

    const joinedIds = new Set((missionState.participants || []).filter(p => p.user_id === me?.id).map(p => p.mission_id));
    const certIds = new Set((missionState.certificates || []).filter(c => c.user_id === me?.id).map(c => c.mission_id));
    const liveCount = missionState.missions.filter(m => missionStatus(m).key === 'live').length;
    document.getElementById('missionsActiveCount').textContent = liveCount;
    document.getElementById('missionsJoinedCount').textContent = joinedIds.size;
    document.getElementById('missionsCertCount').textContent = certIds.size;

    let missions = missionState.missions.slice();
    if (missionFilter === 'live') missions = missions.filter(m => missionStatus(m).key === 'live');
    if (missionFilter === 'joined') missions = missions.filter(m => joinedIds.has(m.id));
    if (missionFilter === 'showcase') missions = missions.filter(m => missionStatus(m).key === 'ended' || (missionState.submissions || []).some(s => s.mission_id === m.id && s.featured));

    if (!missions.length) {
        grid.innerHTML = `<div class="mission-empty">
            <h3>No missions here yet</h3>
            <p>${isAdminUser() ? 'Create the first mission and turn BUGOUT into a builder arena.' : 'Ask an admin to launch a mission.'}</p>
        </div>`;
        return;
    }

    grid.innerHTML = missions.map(m => {
        const status = missionStatus(m);
        const participants = missionState.participants.filter(p => p.mission_id === m.id).length;
        const submissions = missionState.submissions.filter(s => s.mission_id === m.id).length;
        const joined = joinedIds.has(m.id);
        const featured = missionState.submissions.filter(s => s.mission_id === m.id && s.featured).length;
        return `<article class="mission-card ${joined ? 'joined' : ''}" onclick="openMissionDetail('${m.id}')">
            <div class="mission-card-top">
                <span class="mission-chip ${status.key}">${status.label}</span>
                <span class="mission-chip">${esc(m.difficulty || 'Open')}</span>
            </div>
            <h3>${esc(m.title)}</h3>
            <p>${esc(m.brief || m.description || 'Mission brief coming soon.')}</p>
            <div class="mission-card-meta">
                <span>${esc(m.category || 'General')}</span>
                <span>${formatMissionType(m.mission_type)}</span>
                <span>+${m.reward_xp || 0} XP</span>
            </div>
            <div class="mission-card-stats">
                <div><strong>${participants}</strong><span>joined</span></div>
                <div><strong>${submissions}</strong><span>submitted</span></div>
                <div><strong>${featured}</strong><span>featured</span></div>
            </div>
            <div class="mission-deadline">${missionDeadlineText(m)}</div>
        </article>`;
    }).join('');
}

function filterMissions(filter, btn) {
    missionFilter = filter;
    document.querySelectorAll('.mission-filter').forEach(el => el.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderMissionsHub();
}

async function openMissionDetail(missionId, fromRoute = false) {
    activeMissionId = missionId;
    if (!fromRoute) setRoute({ mission: missionId });
    showPage('missionDetailPage');
    const wrap = document.getElementById('missionDetailWrap');
    wrap.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading mission...</p></div>';

    try {
        const [
            missionRes,
            tasksRes,
            participantsRes,
            teamsRes,
            teamMembersRes,
            progressRes,
            submissionsRes,
            votesRes,
            certsRes
        ] = await Promise.all([
            db.from('missions').select('*').eq('id', missionId).single(),
            db.from('mission_tasks').select('*').eq('mission_id', missionId).order('sort_order', { ascending: true }),
            db.from('mission_participants').select('*').eq('mission_id', missionId),
            db.from('mission_teams').select('*').eq('mission_id', missionId).order('created_at', { ascending: true }),
            db.from('mission_team_members').select('*'),
            db.from('mission_task_progress').select('*').eq('mission_id', missionId),
            db.from('mission_submissions').select('*').eq('mission_id', missionId).order('score_total', { ascending: false, nullsFirst: false }),
            db.from('mission_votes').select('*').eq('mission_id', missionId),
            db.from('mission_certificates').select('*').eq('mission_id', missionId)
        ]);

        [missionRes, tasksRes, participantsRes, teamsRes, teamMembersRes, progressRes, submissionsRes, votesRes, certsRes].forEach(res => {
            if (res.error) throw res.error;
        });

        missionState.active = missionRes.data;
        missionState.tasks = tasksRes.data || [];
        missionState.activeParticipants = participantsRes.data || [];
        missionState.teams = teamsRes.data || [];
        missionState.teamMembers = (teamMembersRes.data || []).filter(tm => missionState.teams.some(t => t.id === tm.team_id));
        missionState.progress = progressRes.data || [];
        missionState.activeSubmissions = submissionsRes.data || [];
        missionState.votes = votesRes.data || [];
        missionState.activeCertificates = certsRes.data || [];
        await loadMissionProfiles();
        renderMissionDetail();
    } catch (err) {
        wrap.innerHTML = `<button class="back-btn" onclick="goMissions()">← Back</button><div class="mission-empty"><h3>Mission load failed</h3><p>${esc(err.message)}</p></div>`;
    }
}

async function loadMissionProfiles() {
    const ids = new Set();
    missionState.activeParticipants.forEach(p => ids.add(p.user_id));
    missionState.teamMembers.forEach(tm => ids.add(tm.user_id));
    missionState.activeSubmissions.forEach(s => ids.add(s.submitter_user_id));
    missionState.activeCertificates.forEach(c => c.user_id && ids.add(c.user_id));
    const userIds = [...ids].filter(Boolean);
    missionState.profiles = new Map();
    if (!userIds.length) return;
    const { data } = await db.from('profiles').select('user_id,username,display_name,avatar_color,xp').in('user_id', userIds);
    (data || []).forEach(p => missionState.profiles.set(p.user_id, p));
}

function renderMissionDetail() {
    const m = missionState.active;
    const wrap = document.getElementById('missionDetailWrap');
    if (!m || !wrap) return;

    const status = missionStatus(m);
    const myParticipant = getMyMissionParticipant();
    const myTeam = getMyMissionTeam();
    const taskDone = new Set(missionState.progress.filter(p => p.user_id === me?.id).map(p => p.task_id));
    const completion = missionState.tasks.length ? Math.round((taskDone.size / missionState.tasks.length) * 100) : 0;
    const leaderboard = getMissionLeaderboard();
    const rules = normalizeList(m.rules);
    const deliverables = normalizeList(m.deliverables);
    const criteria = normalizeCriteria(m.judging_criteria);

    wrap.innerHTML = `
        <button class="back-btn" onclick="goMissions()">← Back</button>
        <section class="mission-detail-hero">
            <div>
                <div class="mission-detail-tags">
                    <span class="mission-chip ${status.key}">${status.label}</span>
                    <span class="mission-chip">${esc(m.category || 'General')}</span>
                    <span class="mission-chip">${formatMissionType(m.mission_type)}</span>
                    <span class="mission-chip">+${m.reward_xp || 0} XP</span>
                </div>
                <h2>${esc(m.title)}</h2>
                <p>${esc(m.description || m.brief || '')}</p>
                <div class="mission-detail-actions">
                    ${myParticipant ? `<button class="btn btn-ghost" disabled>Joined</button>` : `<button class="btn" onclick="joinMission()">Join Mission</button>`}
                    <button class="btn" onclick="openMissionSubmissionModal()" ${!myParticipant ? 'disabled' : ''}>Submit Work</button>
                    ${isTeamMission(m) ? `<button class="btn btn-ghost" onclick="openMissionTeamModal()" ${!myParticipant ? 'disabled' : ''}>Teams</button>` : ''}
                    ${getMyCertificate() ? `<button class="btn btn-ghost" onclick="openMissionCertificate('${getMyCertificate().submission_id}')">Certificate</button>` : ''}
                    ${isAdminUser() ? `<button class="btn btn-ghost" onclick="refreshMissionJudging()">Rejudge Pending</button>` : ''}
                </div>
            </div>
            <aside class="mission-countdown-card">
                <div class="mission-countdown-label">${status.key === 'ended' ? 'Ended' : status.key === 'upcoming' ? 'Starts' : 'Deadline'}</div>
                <div class="mission-countdown-value">${missionCountdownText(m)}</div>
                <div class="mission-progress-mini">
                    <div><span>Tasks</span><strong>${taskDone.size}/${missionState.tasks.length}</strong></div>
                    <div class="mission-progress-bar"><div style="width:${completion}%"></div></div>
                    ${myTeam ? `<div class="mission-my-team">Team: ${esc(myTeam.name)}</div>` : ''}
                </div>
            </aside>
        </section>

        <section class="mission-detail-grid">
            <div class="mission-panel">
                <div class="mission-panel-head"><h3>Mission Tasks</h3><span>${completion}% complete</span></div>
                ${renderMissionTasks(taskDone, myParticipant)}
            </div>
            <div class="mission-panel">
                <div class="mission-panel-head"><h3>Deliverables</h3><span>${deliverables.length}</span></div>
                <div class="mission-list">${deliverables.map(x => `<div>${esc(x)}</div>`).join('') || '<div>No deliverables listed.</div>'}</div>
                <div class="mission-panel-head mission-subhead"><h3>Rules</h3><span>${rules.length}</span></div>
                <div class="mission-list">${rules.map(x => `<div>${esc(x)}</div>`).join('') || '<div>Standard BUGOUT rules apply.</div>'}</div>
            </div>
            <div class="mission-panel">
                <div class="mission-panel-head"><h3>AI Judging Criteria</h3><span>${criteria.length}</span></div>
                <div class="mission-criteria">${criteria.map(c => `<span>${esc(c)}</span>`).join('')}</div>
                <p class="mission-note">Submissions are judged by AI first. Admins can rejudge, feature entries, or adjust final standings later.</p>
            </div>
            <div class="mission-panel">
                <div class="mission-panel-head"><h3>Teams</h3><span>${missionState.teams.length}</span></div>
                ${renderMissionTeams(myParticipant, myTeam)}
            </div>
        </section>

        <section class="mission-wide-grid">
            <div class="mission-panel">
                <div class="mission-panel-head"><h3>Leaderboard</h3><span>${leaderboard.length} ranked</span></div>
                ${renderMissionLeaderboard(leaderboard)}
            </div>
            <div class="mission-panel">
                <div class="mission-panel-head"><h3>Showcase Submissions</h3><span>${missionState.activeSubmissions.length}</span></div>
                ${renderMissionSubmissions(leaderboard)}
            </div>
        </section>
    `;
}

function renderMissionTasks(doneSet, myParticipant) {
    if (!missionState.tasks.length) return '<div class="mission-empty compact">No tasks configured.</div>';
    return `<div class="mission-task-list">${missionState.tasks.map(task => {
        const done = doneSet.has(task.id);
        return `<button class="mission-task ${done ? 'done' : ''}" onclick="toggleMissionTask('${task.id}')" ${!myParticipant ? 'disabled' : ''}>
            <span>${done ? '✓' : '+'}</span>
            <div><strong>${esc(task.title)}</strong>${task.description ? `<small>${esc(task.description)}</small>` : ''}</div>
            <em>+${task.xp_reward || 0} XP</em>
        </button>`;
    }).join('')}</div>`;
}

function renderMissionTeams(myParticipant, myTeam) {
    const m = missionState.active;
    if (!isTeamMission(m)) return '<div class="mission-empty compact">This is a solo mission.</div>';
    if (!myParticipant) return '<div class="mission-empty compact">Join the mission to create or join a team.</div>';
    const memberCount = teamMemberCountMap();
    return `<div class="mission-team-list inline">
        ${missionState.teams.map(team => {
            const count = memberCount.get(team.id) || 0;
            const isMine = myTeam?.id === team.id;
            return `<div class="mission-team-row ${isMine ? 'mine' : ''}">
                <div><strong>${esc(team.name)}</strong><span>${esc(team.tagline || 'Ready to ship')}</span></div>
                <em>${count}/${m.max_team_size || 4}</em>
                ${isMine ? '<button class="btn btn-sm btn-ghost" disabled>Your team</button>' : `<button class="btn btn-sm" onclick="joinMissionTeam('${team.id}')">Join</button>`}
            </div>`;
        }).join('') || '<div class="mission-empty compact">No teams yet. Create one.</div>'}
        <button class="btn btn-sm btn-ghost" onclick="openMissionTeamModal()">Create Team</button>
    </div>`;
}

function renderMissionLeaderboard(rows) {
    if (!rows.length) return '<div class="mission-empty compact">No judged submissions yet.</div>';
    return `<div class="mission-leaderboard">${rows.map((row, index) => {
        const owner = submissionOwnerName(row);
        return `<div class="mission-rank-row">
            <div class="mission-rank">#${index + 1}</div>
            <div><strong>${esc(owner)}</strong><span>${esc(row.title || 'Mission submission')} · ${timeAgo(row.created_at)}</span></div>
            <div class="mission-score">${Math.round(row.score_total || 0)}</div>
        </div>`;
    }).join('')}</div>`;
}

function renderMissionSubmissions(leaderboard) {
    if (!missionState.activeSubmissions.length) return '<div class="mission-empty compact">No submissions yet.</div>';
    const rankMap = new Map(leaderboard.map((s, i) => [s.id, i + 1]));
    return `<div class="mission-submission-list">${missionState.activeSubmissions.map(s => {
        const judgement = s.ai_judgement || {};
        const voted = missionState.votes.some(v => v.submission_id === s.id && v.user_id === me?.id);
        const voteCount = missionState.votes.filter(v => v.submission_id === s.id).reduce((sum, v) => sum + (v.value || 1), 0);
        return `<article class="mission-submission-card ${s.featured ? 'featured' : ''}">
            <div class="mission-submission-top">
                <div><strong>${esc(s.title || 'Mission submission')}</strong><span>${esc(submissionOwnerName(s))} ${rankMap.get(s.id) ? `· Rank #${rankMap.get(s.id)}` : ''}</span></div>
                <div class="mission-score">${s.score_total == null ? 'Pending' : Math.round(s.score_total)}</div>
            </div>
            <p>${esc(s.summary || 'No summary provided.')}</p>
            <div class="mission-link-row">
                ${s.live_url ? `<a href="${esc(s.live_url)}" target="_blank" rel="noopener">Live</a>` : ''}
                ${s.repo_url ? `<a href="${esc(s.repo_url)}" target="_blank" rel="noopener">Code</a>` : ''}
                ${s.demo_url ? `<a href="${esc(s.demo_url)}" target="_blank" rel="noopener">Demo</a>` : ''}
            </div>
            ${judgement.verdict ? `<div class="mission-ai-verdict"><strong>AI Verdict</strong><span>${esc(judgement.verdict)}</span></div>` : ''}
            ${Array.isArray(judgement.strengths) && judgement.strengths.length ? `<div class="mission-mini-tags">${judgement.strengths.slice(0, 3).map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
            <div class="mission-submission-actions">
                <button class="btn btn-sm btn-ghost" onclick="voteMissionSubmission('${s.id}')" ${voted || s.submitter_user_id === me?.id ? 'disabled' : ''}>👏 ${voteCount}</button>
                ${s.certificate_id ? `<button class="btn btn-sm" onclick="openMissionCertificate('${s.id}')">Certificate</button>` : ''}
                ${isAdminUser() ? `<button class="btn btn-sm btn-ghost" onclick="rejudgeMissionSubmission('${s.id}')">Rejudge</button><button class="btn btn-sm btn-ghost" onclick="toggleMissionFeatured('${s.id}', ${!s.featured})">${s.featured ? 'Unfeature' : 'Feature'}</button>` : ''}
            </div>
        </article>`;
    }).join('')}</div>`;
}

async function joinMission() {
    if (!me) { toast('Pehle Sign In karo!', 'err'); openModal(); return; }
    const m = missionState.active;
    if (!m) return;
    try {
        const { error } = await db.from('mission_participants').upsert({
            mission_id: m.id,
            user_id: me.id,
            status: 'active',
            role: 'participant'
        }, { onConflict: 'mission_id,user_id' });
        if (error) throw error;
        toast('Mission joined! 🚀', 'ok');
        await openMissionDetail(m.id, true);
        if (isTeamMission(m)) openMissionTeamModal();
    } catch (err) {
        toast('Join failed: ' + err.message, 'err');
    }
}

async function toggleMissionTask(taskId) {
    if (!me) { openModal(); return; }
    const task = missionState.tasks.find(t => t.id === taskId);
    if (!task || !getMyMissionParticipant()) return;
    const existing = missionState.progress.find(p => p.task_id === taskId && p.user_id === me?.id);
    try {
        if (existing) {
            await db.from('mission_task_progress').delete().eq('id', existing.id);
            toast('Task unchecked', 'ok');
        } else {
            const { error } = await db.from('mission_task_progress').insert({
                mission_id: activeMissionId,
                task_id: taskId,
                user_id: me.id,
                xp_awarded: task.xp_reward || 0
            });
            if (error) throw error;
            if (task.xp_reward) await addXP(task.xp_reward);
            toast(`Task complete! +${task.xp_reward || 0} XP`, 'ok');
        }
        await openMissionDetail(activeMissionId, true);
    } catch (err) {
        toast('Task update failed: ' + err.message, 'err');
    }
}

function openMissionCreateModal() {
    if (!isAdminUser()) { toast('Admin only', 'err'); return; }
    fillMissionTemplate();
    document.getElementById('missionCreateModal').classList.add('show');
}

function closeMissionCreateModal() {
    document.getElementById('missionCreateModal').classList.remove('show');
}

function fillMissionTemplate() {
    const start = new Date(Date.now() + 60 * 60 * 1000);
    const end = new Date(Date.now() + 49 * 60 * 60 * 1000);
    document.getElementById('missionTitleInput').value = MISSION_TEMPLATE.title;
    document.getElementById('missionCategoryInput').value = MISSION_TEMPLATE.category;
    document.getElementById('missionTypeInput').value = MISSION_TEMPLATE.type;
    document.getElementById('missionDifficultyInput').value = MISSION_TEMPLATE.difficulty;
    document.getElementById('missionStartsInput').value = toDateTimeLocal(start);
    document.getElementById('missionEndsInput').value = toDateTimeLocal(end);
    document.getElementById('missionRewardInput').value = MISSION_TEMPLATE.reward;
    document.getElementById('missionTeamSizeInput').value = MISSION_TEMPLATE.teamSize;
    document.getElementById('missionBriefInput').value = MISSION_TEMPLATE.brief;
    document.getElementById('missionDescInput').value = MISSION_TEMPLATE.description;
    document.getElementById('missionTasksInput').value = MISSION_TEMPLATE.tasks.join('\n');
    document.getElementById('missionDeliverablesInput').value = MISSION_TEMPLATE.deliverables.join('\n');
    document.getElementById('missionRulesInput').value = MISSION_TEMPLATE.rules.join('\n');
    document.getElementById('missionCriteriaInput').value = MISSION_TEMPLATE.criteria.join('\n');
}

async function createMission() {
    if (!isAdminUser()) return;
    const btn = document.getElementById('missionCreateBtn');
    const title = document.getElementById('missionTitleInput').value.trim();
    if (!title) { toast('Mission title required', 'err'); return; }
    btn.textContent = 'Creating...';
    btn.disabled = true;
    try {
        const starts = document.getElementById('missionStartsInput').value;
        const ends = document.getElementById('missionEndsInput').value;
        const criteria = linesFrom('missionCriteriaInput');
        const { data: mission, error } = await db.from('missions').insert({
            title,
            slug: slugify(title) + '-' + Date.now().toString(36),
            brief: document.getElementById('missionBriefInput').value.trim(),
            description: document.getElementById('missionDescInput').value.trim(),
            category: document.getElementById('missionCategoryInput').value.trim() || 'General',
            difficulty: document.getElementById('missionDifficultyInput').value,
            mission_type: document.getElementById('missionTypeInput').value,
            status: 'active',
            starts_at: starts ? new Date(starts).toISOString() : new Date().toISOString(),
            ends_at: ends ? new Date(ends).toISOString() : new Date(Date.now() + 2 * 86400000).toISOString(),
            reward_xp: Number(document.getElementById('missionRewardInput').value || 250),
            max_team_size: Number(document.getElementById('missionTeamSizeInput').value || 4),
            rules: linesFrom('missionRulesInput'),
            deliverables: linesFrom('missionDeliverablesInput'),
            judging_criteria: criteria,
            created_by: me.id
        }).select().single();
        if (error) throw error;

        const tasks = linesFrom('missionTasksInput').map((line, index) => {
            const [taskTitle, xpRaw] = line.split('|');
            return {
                mission_id: mission.id,
                title: (taskTitle || line).trim(),
                xp_reward: Number(xpRaw || 0),
                sort_order: index + 1
            };
        }).filter(t => t.title);
        if (tasks.length) {
            const { error: taskError } = await db.from('mission_tasks').insert(tasks);
            if (taskError) throw taskError;
        }

        closeMissionCreateModal();
        toast('Mission created! 🚀', 'ok');
        await loadMissions();
        await openMissionDetail(mission.id);
    } catch (err) {
        toast('Mission create failed: ' + err.message, 'err');
    } finally {
        btn.textContent = 'Create Mission';
        btn.disabled = false;
    }
}

function openMissionTeamModal() {
    if (!getMyMissionParticipant()) { toast('Join mission first', 'err'); return; }
    document.getElementById('missionTeamModal').classList.add('show');
    renderMissionTeamModal();
}

function closeMissionTeamModal() {
    document.getElementById('missionTeamModal').classList.remove('show');
}

function renderMissionTeamModal() {
    const list = document.getElementById('missionTeamList');
    if (!list) return;
    const memberCount = teamMemberCountMap();
    list.innerHTML = missionState.teams.map(team => `<div class="mission-team-row">
        <div><strong>${esc(team.name)}</strong><span>${esc(team.tagline || 'Ready to ship')}</span></div>
        <em>${memberCount.get(team.id) || 0}/${missionState.active?.max_team_size || 4}</em>
        <button class="btn btn-sm" onclick="joinMissionTeam('${team.id}')">Join</button>
    </div>`).join('') || '<div class="mission-empty compact">No teams yet.</div>';
}

async function createMissionTeam() {
    if (!me || !activeMissionId) return;
    const name = document.getElementById('missionTeamNameInput').value.trim();
    const tagline = document.getElementById('missionTeamTaglineInput').value.trim();
    if (!name) { toast('Team name required', 'err'); return; }
    try {
        if (!getMyMissionParticipant()) await joinMission();
        const { data: team, error } = await db.from('mission_teams').insert({
            mission_id: activeMissionId,
            name,
            tagline,
            created_by: me.id
        }).select().single();
        if (error) throw error;
        missionState.teams.push(team);
        await joinMissionTeam(team.id, true);
        closeMissionTeamModal();
        toast('Team created!', 'ok');
    } catch (err) {
        toast('Team create failed: ' + err.message, 'err');
    }
}

async function joinMissionTeam(teamId, silent = false) {
    if (!me) { openModal(); return; }
    const team = missionState.teams.find(t => t.id === teamId);
    if (!team) return;
    const existingTeam = getMyMissionTeam();
    if (existingTeam && existingTeam.id !== teamId) {
        toast('You are already in another team for this mission.', 'err');
        return;
    }
    const count = missionState.teamMembers.filter(tm => tm.team_id === teamId).length;
    if (count >= (missionState.active?.max_team_size || 4)) {
        toast('Team is full', 'err');
        return;
    }
    try {
        if (!getMyMissionParticipant()) await joinMission();
        const { error } = await db.from('mission_team_members').upsert({
            team_id: teamId,
            user_id: me.id,
            role: team.created_by === me.id ? 'Lead' : 'Member'
        }, { onConflict: 'team_id,user_id' });
        if (error) throw error;
        if (!silent) toast('Joined team!', 'ok');
        await openMissionDetail(activeMissionId, true);
        if (document.getElementById('missionTeamModal').classList.contains('show')) renderMissionTeamModal();
    } catch (err) {
        toast('Join team failed: ' + err.message, 'err');
    }
}

function openMissionSubmissionModal() {
    if (!me) { openModal(); return; }
    if (!getMyMissionParticipant()) { toast('Join mission first', 'err'); return; }
    if (isTeamMission(missionState.active) && !getMyMissionTeam()) { toast('Create or join a team first', 'err'); openMissionTeamModal(); return; }
    const existing = getMySubmission();
    document.getElementById('missionSubmissionTitle').value = existing?.title || '';
    document.getElementById('missionSubmissionLive').value = existing?.live_url || '';
    document.getElementById('missionSubmissionRepo').value = existing?.repo_url || '';
    document.getElementById('missionSubmissionDemo').value = existing?.demo_url || '';
    document.getElementById('missionSubmissionSummary').value = existing?.summary || '';
    document.getElementById('missionSubmissionScreens').value = Array.isArray(existing?.screenshots) ? existing.screenshots.join('\n') : '';
    document.getElementById('missionSubmissionModal').classList.add('show');
}

function closeMissionSubmissionModal() {
    document.getElementById('missionSubmissionModal').classList.remove('show');
}

async function submitMissionWork() {
    if (!me || !missionState.active) return;
    const btn = document.getElementById('missionSubmitBtn');
    const title = document.getElementById('missionSubmissionTitle').value.trim();
    const summary = document.getElementById('missionSubmissionSummary').value.trim();
    if (!title || !summary) { toast('Title and summary required', 'err'); return; }
    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
        const participant = getMyMissionParticipant();
        const team = getMyMissionTeam();
        const payload = {
            mission_id: activeMissionId,
            participant_id: participant?.id || null,
            team_id: team?.id || null,
            submitter_user_id: me.id,
            title,
            summary,
            live_url: document.getElementById('missionSubmissionLive').value.trim() || null,
            repo_url: document.getElementById('missionSubmissionRepo').value.trim() || null,
            demo_url: document.getElementById('missionSubmissionDemo').value.trim() || null,
            screenshots: linesFrom('missionSubmissionScreens'),
            status: 'submitted'
        };

        const existing = getMySubmission();
        let submission;
        if (existing) {
            const { data, error } = await db.from('mission_submissions').update({
                ...payload,
                status: 'submitted',
                updated_at: new Date().toISOString()
            }).eq('id', existing.id).select().single();
            if (error) throw error;
            submission = data;
        } else {
            const { data, error } = await db.from('mission_submissions').insert(payload).select().single();
            if (error) throw error;
            submission = data;
        }

        btn.textContent = 'AI judging...';
        await judgeMissionSubmission(submission.id, false, submission);
        closeMissionSubmissionModal();
        toast('Submission judged and saved!', 'ok');
        await openMissionDetail(activeMissionId, true);
    } catch (err) {
        toast('Submit failed: ' + err.message, 'err');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Submit + AI Judge';
    }
}

async function judgeMissionSubmission(submissionId, force = false, knownSubmission = null) {
    const submission = knownSubmission || missionState.activeSubmissions.find(s => s.id === submissionId);
    const mission = missionState.active;
    if (!submission || !mission) return;
    if (!force && submission.score_total != null && submission.certificate_id) return;

    const previousXP = submission.xp_awarded || 0;
    const taskCompletion = getSubmissionTaskCompletion(submission);
    const judgement = await runMissionAIJudge(mission, submission, taskCompletion);
    const score = clampScore(judgement.total_score);
    const xpAwarded = Math.max(0, Math.round((mission.reward_xp || 100) * (score / 100)));
    const certificateId = submission.certificate_id || generateCertificateId();

    const { error } = await db.from('mission_submissions').update({
        status: 'judged',
        ai_judgement: judgement,
        scores: judgement.scores || {},
        score_total: score,
        xp_awarded: xpAwarded,
        certificate_id: certificateId,
        updated_at: new Date().toISOString()
    }).eq('id', submission.id);
    if (error) throw error;

    await upsertMissionCertificate(mission, submission, judgement, score, certificateId);
    if (submission.submitter_user_id === me?.id && xpAwarded > previousXP) {
        await addXP(xpAwarded - previousXP);
        await awardBadgeOnce('Mission Finisher', '🚀');
        if (score >= 90) await awardBadgeOnce('Mission Ace', '🏅');
    }
}

async function runMissionAIJudge(mission, submission, taskCompletion) {
    const criteria = normalizeCriteria(mission.judging_criteria);
    const prompt = `You are BUGOUT Mission Judge. Score this mission submission fairly and strictly.

Mission:
Title: ${mission.title}
Type: ${mission.mission_type}
Description: ${mission.description || mission.brief || ''}
Deliverables: ${normalizeList(mission.deliverables).join('; ')}
Criteria: ${criteria.join('; ')}

Submission:
Title: ${submission.title}
Summary: ${submission.summary}
Live URL: ${submission.live_url || 'missing'}
Repo URL: ${submission.repo_url || 'missing'}
Demo URL: ${submission.demo_url || 'missing'}
Screenshots: ${(submission.screenshots || []).join(', ') || 'none'}
Task completion: ${taskCompletion.completed}/${taskCompletion.total}

Return ONLY valid JSON:
{
  "total_score": 0-100,
  "scores": {"Functionality":0-100,"Code quality":0-100,"UI/UX":0-100,"Creativity":0-100,"Explanation clarity":0-100},
  "verdict": "2 sentence verdict",
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "badge_suggestion": "short badge title",
  "certificate_line": "one polished certificate sentence"
}`;
    const data = await callGroq([{ role: 'user', content: prompt }], {
        max_tokens: 1200,
        temperature: 0.25,
        response_format: { type: 'json_object' }
    });
    const parsed = extractJSON(data.choices?.[0]?.message?.content || '', null);
    if (!parsed || typeof parsed !== 'object') throw new Error('AI judge returned invalid JSON');
    return {
        total_score: clampScore(parsed.total_score),
        scores: parsed.scores || {},
        verdict: String(parsed.verdict || 'Submission reviewed.'),
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : [],
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, 5) : [],
        badge_suggestion: String(parsed.badge_suggestion || 'Mission Finisher'),
        certificate_line: String(parsed.certificate_line || 'Completed the mission with dedication and craft.')
    };
}

async function upsertMissionCertificate(mission, submission, judgement, score, certificateId) {
    const team = submission.team_id ? missionState.teams.find(t => t.id === submission.team_id) : null;
    const profile = missionState.profiles.get(submission.submitter_user_id);
    const recipient = team?.name || profile?.display_name || profile?.username || myName || 'BUGOUT Warrior';
    const payload = {
        mission_id: mission.id,
        submission_id: submission.id,
        user_id: submission.submitter_user_id,
        team_id: submission.team_id || null,
        certificate_id: certificateId,
        recipient_name: recipient,
        mission_title: mission.title,
        score_total: score,
        metadata: judgement
    };
    const { error } = await db
        .from('mission_certificates')
        .upsert(payload, { onConflict: 'submission_id' });
    if (error) throw error;
}

async function refreshMissionJudging() {
    if (!isAdminUser()) return;
    const pending = missionState.activeSubmissions.filter(s => s.score_total == null || !s.certificate_id);
    if (!pending.length) { toast('No pending submissions', 'ok'); return; }
    for (const s of pending.slice(0, 5)) {
        await judgeMissionSubmission(s.id, true, s);
    }
    toast('Pending submissions rejudged', 'ok');
    await openMissionDetail(activeMissionId, true);
}

async function rejudgeMissionSubmission(submissionId) {
    if (!isAdminUser()) return;
    try {
        await judgeMissionSubmission(submissionId, true);
        toast('Submission rejudged', 'ok');
        await openMissionDetail(activeMissionId, true);
    } catch (err) {
        toast('Rejudge failed: ' + err.message, 'err');
    }
}

async function voteMissionSubmission(submissionId) {
    if (!me) { openModal(); return; }
    const submission = missionState.activeSubmissions.find(s => s.id === submissionId);
    if (!submission || submission.submitter_user_id === me.id) return;
    try {
        const { error } = await db.from('mission_votes').insert({
            mission_id: activeMissionId,
            submission_id: submissionId,
            user_id: me.id,
            value: 1
        });
        if (error) throw error;
        toast('Vote added', 'ok');
        await openMissionDetail(activeMissionId, true);
    } catch (err) {
        toast('Vote failed: ' + err.message, 'err');
    }
}

async function toggleMissionFeatured(submissionId, featured) {
    if (!isAdminUser()) return;
    const { error } = await db.from('mission_submissions').update({ featured }).eq('id', submissionId);
    if (error) toast('Feature update failed: ' + error.message, 'err');
    else {
        toast(featured ? 'Submission featured' : 'Submission unfeatured', 'ok');
        await openMissionDetail(activeMissionId, true);
    }
}

function openMissionCertificate(submissionId) {
    activeCertificateSubmissionId = submissionId;
    const cert = getCertificateForSubmission(submissionId);
    const submission = missionState.activeSubmissions.find(s => s.id === submissionId);
    if (!cert || !submission) { toast('Certificate not ready yet', 'err'); return; }
    document.getElementById('missionCertificatePreview').innerHTML = renderCertificateHTML(cert, submission);
    document.getElementById('missionCertificateModal').classList.add('show');
}

function closeMissionCertificateModal() {
    document.getElementById('missionCertificateModal').classList.remove('show');
}

function renderCertificateHTML(cert, submission) {
    const rank = getMissionLeaderboard().findIndex(s => s.id === submission.id) + 1;
    const meta = cert.metadata || {};
    return `<div class="mission-cert-preview">
        <div class="mission-cert-kicker">BUGOUT Mission Certificate</div>
        <h3>${esc(cert.recipient_name)}</h3>
        <p>has completed</p>
        <h4>${esc(cert.mission_title)}</h4>
        <div class="mission-cert-score">${Math.round(cert.score_total || 0)} / 100 ${rank ? `· Rank #${rank}` : ''}</div>
        <p>${esc(meta.certificate_line || 'Completed the mission with dedication and craft.')}</p>
        <small>ID: ${esc(cert.certificate_id)} · ${new Date(cert.issued_at || Date.now()).toLocaleDateString('en-IN')}</small>
    </div>`;
}

function downloadMissionCertificate() {
    const cert = getCertificateForSubmission(activeCertificateSubmissionId);
    const submission = missionState.activeSubmissions.find(s => s.id === activeCertificateSubmissionId);
    if (!cert || !submission) return;
    const rank = getMissionLeaderboard().findIndex(s => s.id === submission.id) + 1;
    const canvas = document.createElement('canvas');
    canvas.width = 1400;
    canvas.height = 980;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#04130b');
    gradient.addColorStop(0.5, '#071b16');
    gradient.addColorStop(1, '#120611');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 8;
    ctx.strokeRect(50, 50, 1300, 880);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(78, 78, 1244, 824);

    drawCentered(ctx, 'BUGOUT by MindForgers', 700, 160, 34, '#9aa4ad', '700');
    drawCentered(ctx, 'MISSION CERTIFICATE', 700, 245, 64, '#00ff88', '900');
    drawCentered(ctx, cert.recipient_name, 700, 360, 58, '#ffffff', '900');
    drawCentered(ctx, 'has successfully completed', 700, 430, 28, '#9aa4ad', '600');
    wrapCanvasText(ctx, cert.mission_title, 700, 510, 1050, 44, '#ffffff', '800', 42);
    drawCentered(ctx, `${Math.round(cert.score_total || 0)} / 100${rank ? `  ·  Rank #${rank}` : ''}`, 700, 650, 38, '#ffaa00', '900');
    wrapCanvasText(ctx, cert.metadata?.certificate_line || 'Completed the mission with dedication and craft.', 700, 725, 1000, 30, '#dfe7ee', '500', 30);
    drawCentered(ctx, `Certificate ID: ${cert.certificate_id}`, 700, 835, 24, '#9aa4ad', '600');
    drawCentered(ctx, new Date(cert.issued_at || Date.now()).toLocaleDateString('en-IN'), 700, 875, 22, '#9aa4ad', '500');

    const link = document.createElement('a');
    link.download = `${cert.certificate_id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function drawCentered(ctx, text, x, y, size, color, weight = '600') {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px Segoe UI, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(String(text || ''), x, y);
}

function wrapCanvasText(ctx, text, x, y, maxWidth, size, color, weight = '600', lineHeight = size * 1.2) {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px Segoe UI, Arial, sans-serif`;
    ctx.textAlign = 'center';
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach(word => {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    });
    if (line) lines.push(line);
    lines.slice(0, 3).forEach((ln, i) => ctx.fillText(ln, x, y + i * lineHeight));
}

function getMissionLeaderboard() {
    return missionState.activeSubmissions
        .filter(s => s.score_total != null)
        .slice()
        .sort((a, b) => (b.score_total || 0) - (a.score_total || 0)
            || voteTotal(b.id) - voteTotal(a.id)
            || parseSupabaseDate(a.created_at) - parseSupabaseDate(b.created_at));
}

function getSubmissionTaskCompletion(submission) {
    if (submission.team_id) {
        const members = missionState.teamMembers.filter(tm => tm.team_id === submission.team_id).map(tm => tm.user_id);
        const completed = new Set(missionState.progress.filter(p => members.includes(p.user_id)).map(p => p.task_id));
        return { completed: completed.size, total: missionState.tasks.length };
    }
    return { completed: missionState.progress.filter(p => p.user_id === submission.submitter_user_id).length, total: missionState.tasks.length };
}

function getMyMissionParticipant() {
    return missionState.activeParticipants.find(p => p.user_id === me?.id);
}

function getMyMissionTeam() {
    const membership = missionState.teamMembers.find(tm => tm.user_id === me?.id);
    return membership ? missionState.teams.find(t => t.id === membership.team_id) : null;
}

function getMySubmission() {
    const team = getMyMissionTeam();
    if (team) return missionState.activeSubmissions.find(s => s.team_id === team.id);
    return missionState.activeSubmissions.find(s => s.submitter_user_id === me?.id && !s.team_id);
}

function getMyCertificate() {
    const submission = getMySubmission();
    return submission ? getCertificateForSubmission(submission.id) : null;
}

function getCertificateForSubmission(submissionId) {
    return missionState.activeCertificates.find(c => c.submission_id === submissionId);
}

function submissionOwnerName(submission) {
    if (submission.team_id) {
        return missionState.teams.find(t => t.id === submission.team_id)?.name || 'Mission Team';
    }
    const p = missionState.profiles.get(submission.submitter_user_id);
    return p?.display_name || p?.username || 'BUGOUT Warrior';
}

function teamMemberCountMap() {
    const map = new Map();
    missionState.teamMembers.forEach(tm => map.set(tm.team_id, (map.get(tm.team_id) || 0) + 1));
    return map;
}

function voteTotal(submissionId) {
    return missionState.votes.filter(v => v.submission_id === submissionId).reduce((sum, v) => sum + (v.value || 1), 0);
}

function isTeamMission(m) {
    return ['team', 'campus'].includes(String(m?.mission_type || '').toLowerCase());
}

function missionStatus(m) {
    const now = Date.now();
    const start = parseSupabaseDate(m.starts_at)?.getTime() || now;
    const end = parseSupabaseDate(m.ends_at)?.getTime() || now;
    if (m.status === 'cancelled') return { key: 'ended', label: 'Cancelled' };
    if (now < start) return { key: 'upcoming', label: 'Upcoming' };
    if (now > end || m.status === 'completed') return { key: 'ended', label: 'Ended' };
    return { key: 'live', label: 'Live' };
}

function missionDeadlineText(m) {
    const status = missionStatus(m);
    if (status.key === 'upcoming') return `Starts ${timeAgo(m.starts_at) || new Date(m.starts_at).toLocaleDateString('en-IN')}`;
    if (status.key === 'ended') return `Ended ${timeAgo(m.ends_at) || ''}`;
    return `Ends ${timeAgo(m.ends_at) ? 'in ' + missionTimeLeft(m.ends_at) : new Date(m.ends_at).toLocaleDateString('en-IN')}`;
}

function missionCountdownText(m) {
    const status = missionStatus(m);
    if (status.key === 'upcoming') return missionTimeLeft(m.starts_at);
    if (status.key === 'ended') return new Date(m.ends_at).toLocaleDateString('en-IN');
    return missionTimeLeft(m.ends_at);
}

function missionTimeLeft(dateValue) {
    const target = parseSupabaseDate(dateValue);
    if (!target) return '-';
    const diff = target.getTime() - Date.now();
    const abs = Math.abs(diff);
    const days = Math.floor(abs / 86400000);
    const hours = Math.floor((abs % 86400000) / 3600000);
    const minutes = Math.floor((abs % 3600000) / 60000);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function normalizeList(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed.filter(Boolean);
        } catch(e) {}
        return value.split('\n').map(x => x.trim()).filter(Boolean);
    }
    return [];
}

function normalizeCriteria(value) {
    const list = normalizeList(value);
    return list.length ? list : ['Functionality', 'Code quality', 'UI/UX', 'Creativity', 'Explanation clarity'];
}

function linesFrom(id) {
    const el = document.getElementById(id);
    return String(el?.value || '').split('\n').map(x => x.trim()).filter(Boolean);
}

function toDateTimeLocal(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatMissionType(type) {
    return String(type || 'solo').replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
}

function slugify(text) {
    return String(text || 'mission').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'mission';
}

function clampScore(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.min(100, Math.round(num)));
}

function generateCertificateId() {
    return `BUGOUT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function toggleMissionAdminUI() {
    document.querySelectorAll('.mission-admin-only').forEach(el => {
        el.style.display = isAdminUser() ? 'inline-flex' : 'none';
    });
}

function renderMissionSetupNotice(container, err) {
    const message = err?.message || 'Unknown error';
    container.innerHTML = `<div class="mission-empty">
        <h3>Missions database is not ready</h3>
        <p>${esc(message)}</p>
        <p>Run <strong>supabase-missions-schema.sql</strong> in Supabase SQL Editor, then refresh this page.</p>
    </div>`;
    document.getElementById('missionsActiveCount').textContent = '0';
    document.getElementById('missionsJoinedCount').textContent = '0';
    document.getElementById('missionsCertCount').textContent = '0';
}

document.addEventListener('DOMContentLoaded', () => {
    ['missionCreateModal', 'missionTeamModal', 'missionSubmissionModal', 'missionCertificateModal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', e => {
            if (e.target.id === id) e.target.classList.remove('show');
        });
    });
    toggleMissionAdminUI();
});
