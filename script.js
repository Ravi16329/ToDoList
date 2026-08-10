(() => {
    'use strict';

    /* ============================================================
       DATE HEADER
       ============================================================ */
    const now = new Date();
    document.getElementById('todayDay').textContent = String(now.getDate()).padStart(2, '0');
    document.getElementById('todayMonth').textContent = now.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    document.getElementById('todayYear').textContent = now.getFullYear();

    /* ============================================================
       STATE
       ============================================================ */
    const STORAGE_KEY = 'todoTasks';
    const STORAGE_NEXTID_KEY = 'todoNextId';

    let tasks = []; // { id, text, when, complete, alerted }
    let nextId = 1;

    const els = {
        form: document.getElementById('composer'),
        input: document.getElementById('taskInput'),
        when: document.getElementById('taskWhen'),
        list: document.getElementById('taskList'),
        count: document.getElementById('countLabel'),
        clearDone: document.getElementById('clearDone'),
        empty: document.getElementById('emptyState'),
        alertOverlay: document.getElementById('alertOverlay'),
        alertTaskName: document.getElementById('alertTaskName'),
        alertVideo: document.getElementById('alertVideo'),
        alertSnooze: document.getElementById('alertSnooze'),
        alertDismiss: document.getElementById('alertDismiss'),
    };

    /* Reminder video sequence — update paths to match your /videos folder */
    const REMINDER_VIDEOS = ['videos/video4.mp4', 'videos/video6.mp4'];
    //'videos/video5.mp4'

    /* ============================================================
       ICONS
       ============================================================ */
    const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    const ICON_SAVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';

    /* ============================================================
       PERSISTENCE (localStorage)
       ============================================================ */
    function saveTasks() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
            localStorage.setItem(STORAGE_NEXTID_KEY, String(nextId));
        } catch (err) {
            console.error('Could not save tasks to localStorage:', err);
        }
    }

    function loadTasks() {
        try {
            const savedTasks = localStorage.getItem(STORAGE_KEY);
            const savedNextId = localStorage.getItem(STORAGE_NEXTID_KEY);

            if (savedTasks) {
                tasks = JSON.parse(savedTasks);
            }

            if (savedNextId) {
                nextId = parseInt(savedNextId, 10);
            } else if (tasks.length) {
                // Fallback: derive nextId from existing tasks if it wasn't saved
                nextId = Math.max(...tasks.map(t => t.id)) + 1;
            }
        } catch (err) {
            console.error('Could not load tasks from localStorage:', err);
            tasks = [];
            nextId = 1;
        }
    }

    /* ============================================================
       RENDER
       ============================================================ */
    function fmtWhen(iso) {
        if (!iso) return null;
        const d = new Date(iso);
        if (isNaN(d)) return null;
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return `${dateStr}, ${timeStr}`;
    }

    function urgency(task) {
        if (!task.when || task.complete) return 'none';
        const diff = new Date(task.when) - Date.now();
        if (diff <= 0) return 'overdue';
        if (diff < 30 * 60 * 1000) return 'due-soon'; // under 30 min
        return 'scheduled';
    }

    function render() {
        els.list.innerHTML = '';

        tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = 'task';
            if (task.complete) li.classList.add('complete');
            const u = urgency(task);
            if (u === 'overdue') li.classList.add('overdue');
            if (u === 'due-soon') li.classList.add('due-soon');
            li.dataset.id = task.id;

            const checkBtn = document.createElement('button');
            checkBtn.className = 'task-check';
            checkBtn.type = 'button';
            checkBtn.innerHTML = ICON_CHECK;
            checkBtn.setAttribute('aria-label', task.complete ? 'Mark as not done' : 'Mark as done');
            checkBtn.addEventListener('click', () => toggleComplete(task.id));

            const body = document.createElement('div');
            body.className = 'task-body';

            const text = document.createElement('div');
            text.className = 'task-text';
            text.textContent = task.text;
            text.contentEditable = 'false';
            body.appendChild(text);

            const whenStr = fmtWhen(task.when);
            if (whenStr) {
                const whenRow = document.createElement('div');
                whenRow.className = 'task-when';
                whenRow.innerHTML = `<span class="task-when-dot"></span><span>${u === 'overdue' ? 'Was due' : 'Due'} ${whenStr}</span>`;
                body.appendChild(whenRow);
            }

            const actions = document.createElement('div');
            actions.className = 'task-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'task-icon-btn';
            editBtn.type = 'button';
            editBtn.innerHTML = ICON_EDIT;
            editBtn.setAttribute('aria-label', 'Edit task');
            editBtn.addEventListener('click', () => {
                const editing = text.contentEditable === 'true';
                if (editing) {
                    task.text = text.textContent.trim() || task.text;
                    text.textContent = task.text;
                    text.contentEditable = 'false';
                    editBtn.innerHTML = ICON_EDIT;
                    saveTasks(); // persist the edited text
                } else {
                    text.contentEditable = 'true';
                    text.focus();
                    placeCaretAtEnd(text);
                    editBtn.innerHTML = ICON_SAVE;
                }
            });

            const delBtn = document.createElement('button');
            delBtn.className = 'task-icon-btn danger';
            delBtn.type = 'button';
            delBtn.innerHTML = ICON_TRASH;
            delBtn.setAttribute('aria-label', 'Delete task');
            delBtn.addEventListener('click', () => removeTask(task.id));

            actions.append(editBtn, delBtn);
            li.append(checkBtn, body, actions);
            els.list.appendChild(li);
        });

        updateMeta();
    }

    function placeCaretAtEnd(el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    function updateMeta() {
        const open = tasks.filter(t => !t.complete).length;
        const done = tasks.length - open;

        els.empty.classList.toggle('show', tasks.length === 0);
        els.count.textContent = tasks.length === 0
            ? 'No tasks yet'
            : `${open} open · ${done} done`;
        els.clearDone.hidden = done === 0;
    }

    /* ============================================================
       ACTIONS
       ============================================================ */
    function addTask(text, when) {
        tasks.push({ id: nextId++, text, when: when || null, complete: false, alerted: false });
        saveTasks();
        render();
    }

    function toggleComplete(id) {
        const t = tasks.find(t => t.id === id);
        if (t) t.complete = !t.complete;
        saveTasks();
        render();
    }

    function removeTask(id) {
        tasks = tasks.filter(t => t.id !== id);
        saveTasks();
        render();
    }

    els.clearDone.addEventListener('click', () => {
        tasks = tasks.filter(t => !t.complete);
        saveTasks();
        render();
    });

    els.form.addEventListener('submit', e => {
        e.preventDefault();
        const text = els.input.value.trim();
        if (!text) return;
        addTask(text, els.when.value);
        els.input.value = '';
        els.when.value = '';
        els.input.focus();
    });

    /* ============================================================
       DEADLINE ALERT
       ============================================================ */
    let alertQueue = [];
    let alertActiveTask = null;

    function checkDeadlines() {
        const now = Date.now();
        let changed = false;
        tasks.forEach(t => {
            if (t.when && !t.complete && !t.alerted && new Date(t.when).getTime() <= now) {
                t.alerted = true;
                alertQueue.push(t);
                changed = true;
            }
        });
        if (changed) saveTasks();
        if (alertQueue.length && !alertActiveTask) playNextAlert();
        render(); // refresh urgency colors
    }

    function playNextAlert() {
        alertActiveTask = alertQueue.shift();
        if (!alertActiveTask) return;

        els.alertTaskName.textContent = alertActiveTask.text;
        els.alertOverlay.hidden = false;
        playReminderSequence();
    }

    function playReminderSequence(index = 0) {
        if (index >= REMINDER_VIDEOS.length) return;
        els.alertVideo.src = REMINDER_VIDEOS[index];
        els.alertVideo.currentTime = 0;
        els.alertVideo.volume = 1;
        els.alertVideo.play().catch(() => { });
        els.alertVideo.onended = () => playReminderSequence(index + 1);
    }

    function closeAlert() {
        els.alertOverlay.hidden = true;
        els.alertVideo.pause();
        els.alertVideo.removeAttribute('src');
        els.alertVideo.load();
        alertActiveTask = null;
        if (alertQueue.length) setTimeout(playNextAlert, 300);
    }

    els.alertDismiss.addEventListener('click', closeAlert);

    els.alertSnooze.addEventListener('click', () => {
        if (alertActiveTask) {
            const newTime = new Date(Date.now() + 15 * 60 * 1000);
            alertActiveTask.when = newTime.toISOString().slice(0, 16);
            alertActiveTask.alerted = false;
            saveTasks();
        }
        closeAlert();
    });

    /* Check every 20s for due/overdue tasks */
    setInterval(checkDeadlines, 20000);

    /* ============================================================
       INIT
       ============================================================ */
    loadTasks();
    render();
})();