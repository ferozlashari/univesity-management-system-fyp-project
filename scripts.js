// Shared frontend JS: interacts with backend API
const API_BASE = (location.hostname === 'localhost') ? 'http://localhost:3000/api' : '/api';

function fetchJSON(url, opts = {}) {
  const token = localStorage.getItem('ums_token');
  opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  return fetch(url, opts).then(async r => {
    const txt = await r.text();
    let json = {};
    try { json = txt ? JSON.parse(txt) : {}; } catch { json = { message: txt }; }
    if (!r.ok) return Promise.reject(json);
    return json;
  });
}

function onError(err, elId) {
  console.error(err);
  if (elId) {
    const el = document.getElementById(elId);
    if (el) el.textContent = err.message || 'Error';
  }
}

/* Utility: simple CSV export */
function exportCSV(rows, headers = []) {
  if (!rows.length) return;
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => {
    const v = r[h] == null ? '' : String(r[h]).replace(/"/g, '""');
    return `"${v}"`;
  }).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'export.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/* DOM Ready */
document.addEventListener('DOMContentLoaded', () => {
  // Login
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const role = document.getElementById('role').value;
      try {
        const res = await fetchJSON(`${API_BASE}/auth/login`, {
          method: 'POST',
          body: JSON.stringify({ email, password, role })
        });
        localStorage.setItem('ums_token', res.token);
        localStorage.setItem('ums_role', res.role);
        if (res.role === 'admin') location.href = 'admin-dashboard.html';
        else if (res.role === 'teacher') location.href = 'teacher-dashboard.html';
        else location.href = 'student-dashboard.html';
      } catch (err) {
        onError(err, 'loginMsg');
      }
    });
  }

  // Register
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async e => {
      e.preventDefault();
      const payload = {
        name: document.getElementById('stu-name').value,
        roll: document.getElementById('stu-roll').value,
        email: document.getElementById('stu-email').value,
        password: document.getElementById('stu-password').value,
        role: 'student'
      };
      try {
        await fetchJSON(`${API_BASE}/auth/register`, { method: 'POST', body: JSON.stringify(payload) });
        document.getElementById('regMsg').textContent = 'Registered. Please login.';
      } catch (err) {
        onError(err, 'regMsg');
      }
    });
  }

  // Logout links (re-used across pages)
  ['logoutLink', 'logoutLinkT', 'logoutLinkS'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', e => { e.preventDefault(); localStorage.removeItem('ums_token'); localStorage.removeItem('ums_role'); location.href = 'index.html'; });
  });

  // Admin stats
  if (document.getElementById('stat-students')) {
    fetchJSON(`${API_BASE}/students`).then(list => { document.getElementById('stat-students').textContent = list.length; }).catch(()=>{});
  }
  if (document.getElementById('stat-teachers')) {
    fetchJSON(`${API_BASE}/teachers`).then(list => { document.getElementById('stat-teachers').textContent = list.length; }).catch(()=>{});
  }
  if (document.getElementById('stat-fees')) {
    fetchJSON(`${API_BASE}/fees`).then(list => {
      const due = list.filter(f => f.status === 'due').reduce((s,i)=>s+Number(i.amount||0),0);
      document.getElementById('stat-fees').textContent = due;
    }).catch(()=>{});
  }

  /* Students management page */
  const sForm = document.getElementById('studentAddForm');
  if (sForm) {
    const tbody = document.querySelector('#studentsTable tbody');
    async function loadStudents() {
      tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
      try {
        const students = await fetchJSON(`${API_BASE}/students`);
        tbody.innerHTML = '';
        students.forEach(s => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${s.roll}</td><td>${s.name}</td><td>${s.email||''}</td>
            <td><button data-roll="${s.roll}" class="del-stu btn small">Delete</button></td>`;
          tbody.appendChild(tr);
        });
        tbody.querySelectorAll('.del-stu').forEach(btn=>{
          btn.addEventListener('click', async ()=>{
            if (!confirm('Delete student?')) return;
            await fetchJSON(`${API_BASE}/students/${btn.dataset.roll}`, { method: 'DELETE' });
            loadStudents();
          });
        });
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4">Error</td></tr>`;
        console.error(err);
      }
    }
    sForm.addEventListener('submit', async e => {
      e.preventDefault();
      const data = { name: document.getElementById('sname').value, roll: document.getElementById('sroll').value, email: document.getElementById('semail').value };
      try {
        await fetchJSON(`${API_BASE}/students`, { method: 'POST', body: JSON.stringify(data) });
        sForm.reset();
        loadStudents();
      } catch (err) { onError(err); }
    });
    loadStudents();
  }

  /* Teachers management */
  const tForm = document.getElementById('teacherAddForm');
  if (tForm) {
    const tbody = document.querySelector('#teachersTable tbody');
    async function loadTeachers() {
      tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
      try {
        const teachers = await fetchJSON(`${API_BASE}/teachers`);
        tbody.innerHTML = '';
        teachers.forEach(t => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${t.name}</td><td>${t.designation||''}</td><td>${t.email||''}</td>
            <td><button data-id="${t.id}" class="del-teach btn small">Delete</button></td>`;
          tbody.appendChild(tr);
        });
        tbody.querySelectorAll('.del-teach').forEach(btn=>{
          btn.addEventListener('click', async ()=>{
            if (!confirm('Delete teacher?')) return;
            await fetchJSON(`${API_BASE}/teachers/${btn.dataset.id}`, { method: 'DELETE' });
            loadTeachers();
          });
        });
      } catch (err) { tbody.innerHTML = `<tr><td colspan="4">Error</td></tr>`; console.error(err); }
    }
    tForm.addEventListener('submit', async e => {
      e.preventDefault();
      const data = { name: document.getElementById('tname').value, designation: document.getElementById('tdesignation').value, email: document.getElementById('temail').value };
      try { await fetchJSON(`${API_BASE}/teachers`, { method: 'POST', body: JSON.stringify(data) }); tForm.reset(); loadTeachers(); } catch (err) { onError(err); }
    });
    loadTeachers();
  }

  /* Attendance */
  const attForm = document.getElementById('attendanceForm');
  if (attForm) {
    const tbody = document.querySelector('#attendanceTable tbody');
    async function loadAtt() {
      tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
      try {
        const list = await fetchJSON(`${API_BASE}/attendance`);
        tbody.innerHTML = '';
        list.forEach(a => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${a.date}</td><td>${a.roll}</td><td>${a.status}</td>
            <td><button data-id="${a.id}" class="del-att btn small">Delete</button></td>`;
          tbody.appendChild(tr);
        });
        tbody.querySelectorAll('.del-att').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('Delete record?')) return;
            await fetchJSON(`${API_BASE}/attendance/${btn.dataset.id}`, { method: 'DELETE' });
            loadAtt();
          });
        });
      } catch (err) { tbody.innerHTML = `<tr><td colspan="4">Error</td></tr>`; console.error(err); }
    }
    attForm.addEventListener('submit', async e => {
      e.preventDefault();
      const data = { roll: document.getElementById('att-roll').value, date: document.getElementById('att-date').value, status: document.getElementById('att-status').value };
      try { await fetchJSON(`${API_BASE}/attendance`, { method: 'POST', body: JSON.stringify(data) }); attForm.reset(); loadAtt(); } catch (err) { onError(err); }
    });
    loadAtt();
  }

  /* Exams */
  const examForm = document.getElementById('examForm');
  if (examForm) {
    const tbody = document.querySelector('#examsTable tbody');
    async function loadExams() {
      tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
      try {
        const list = await fetchJSON(`${API_BASE}/exams`);
        tbody.innerHTML = '';
        list.forEach(x => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${x.course}</td><td>${x.date}</td><td>${x.time||''}</td>
            <td><button data-id="${x.id}" class="del-exam btn small">Delete</button></td>`;
          tbody.appendChild(tr);
        });
        tbody.querySelectorAll('.del-exam').forEach(btn => {
          btn.addEventListener('click', async ()=>{ if(!confirm('Delete exam?')) return; await fetchJSON(`${API_BASE}/exams/${btn.dataset.id}`, { method:'DELETE' }); loadExams(); });
        });
      } catch (err) { tbody.innerHTML = `<tr><td colspan="4">Error</td></tr>`; console.error(err); }
    }
    examForm.addEventListener('submit', async e => {
      e.preventDefault();
      const data = { course: document.getElementById('exam-course').value, date: document.getElementById('exam-date').value, time: document.getElementById('exam-time').value };
      try { await fetchJSON(`${API_BASE}/exams`, { method:'POST', body: JSON.stringify(data) }); examForm.reset(); loadExams(); } catch (err) { onError(err); }
    });
    loadExams();
  }

  /* Results */
  const resForm = document.getElementById('resultForm');
  if (resForm) {
    const tbody = document.querySelector('#resultsTable tbody');
    async function loadResults() {
      tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
      try {
        const list = await fetchJSON(`${API_BASE}/results`);
        tbody.innerHTML = '';
        list.forEach(r => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${r.roll}</td><td>${r.course}</td><td>${r.marks}</td>
            <td><button data-id="${r.id}" class="del-res btn small">Delete</button></td>`;
          tbody.appendChild(tr);
        });
        tbody.querySelectorAll('.del-res').forEach(btn => {
          btn.addEventListener('click', async ()=>{ if(!confirm('Delete result?')) return; await fetchJSON(`${API_BASE}/results/${btn.dataset.id}`, { method:'DELETE' }); loadResults(); });
        });
      } catch (err) { tbody.innerHTML = `<tr><td colspan="4">Error</td></tr>`; console.error(err); }
    }
    resForm.addEventListener('submit', async e => {
      e.preventDefault();
      const data = { roll: document.getElementById('res-roll').value, course: document.getElementById('res-course').value, marks: Number(document.getElementById('res-marks').value) };
      try { await fetchJSON(`${API_BASE}/results`, { method:'POST', body: JSON.stringify(data) }); resForm.reset(); loadResults(); } catch (err) { onError(err); }
    });
    loadResults();
  }

  /* Fees */
  const feeForm = document.getElementById('feeForm');
  if (feeForm) {
    const tbody = document.querySelector('#feesTable tbody');
    async function loadFees() {
      tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
      try {
        const list = await fetchJSON(`${API_BASE}/fees`);
        tbody.innerHTML = '';
        list.forEach(f => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${f.roll}</td><td>${f.amount}</td><td>${f.status}</td>
            <td><button data-id="${f.id}" class="del-fee btn small">Delete</button></td>`;
          tbody.appendChild(tr);
        });
        tbody.querySelectorAll('.del-fee').forEach(btn => {
          btn.addEventListener('click', async ()=>{ if(!confirm('Delete fee record?')) return; await fetchJSON(`${API_BASE}/fees/${btn.dataset.id}`, { method:'DELETE' }); loadFees(); });
        });
      } catch (err) { tbody.innerHTML = `<tr><td colspan="4">Error</td></tr>`; console.error(err); }
    }
    feeForm.addEventListener('submit', async e => {
      e.preventDefault();
      const data = { roll: document.getElementById('fee-roll').value, amount: Number(document.getElementById('fee-amount').value), status: document.getElementById('fee-status').value };
      try { await fetchJSON(`${API_BASE}/fees`, { method:'POST', body: JSON.stringify(data) }); feeForm.reset(); loadFees(); } catch (err) { onError(err); }
    });
    loadFees();
  }

  /* Timetable */
  const ttForm = document.getElementById('timetableForm');
  if (ttForm) {
    const tbody = document.querySelector('#ttTable tbody');
    async function loadTT() {
      tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
      try {
        const list = await fetchJSON(`${API_BASE}/timetable`);
        tbody.innerHTML = '';
        list.forEach(t => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${t.course}</td><td>${t.day}</td><td>${t.time}</td>
            <td><button data-id="${t.id}" class="del-tt btn small">Delete</button></td>`;
          tbody.appendChild(tr);
        });
        tbody.querySelectorAll('.del-tt').forEach(btn => {
          btn.addEventListener('click', async ()=>{ if(!confirm('Delete time?')) return; await fetchJSON(`${API_BASE}/timetable/${btn.dataset.id}`, { method:'DELETE' }); loadTT(); });
        });
      } catch (err) { tbody.innerHTML = `<tr><td colspan="4">Error</td></tr>`; console.error(err); }
    }
    ttForm.addEventListener('submit', async e => {
      e.preventDefault();
      const data = { course: document.getElementById('tt-course').value, day: document.getElementById('tt-day').value, time: document.getElementById('tt-time').value };
      try { await fetchJSON(`${API_BASE}/timetable`, { method:'POST', body: JSON.stringify(data) }); ttForm.reset(); loadTT(); } catch (err) { onError(err); }
    });
    loadTT();
  }

  /* Notices */
  const noticeForm = document.getElementById('noticeForm');
  if (noticeForm) {
    const listEl = document.getElementById('noticesList');
    async function loadNotices() {
      listEl.innerHTML = 'Loading...';
      try {
        const notices = await fetchJSON(`${API_BASE}/notices`);
        listEl.innerHTML = '';
        notices.forEach(n => {
          const li = document.createElement('li');
          li.innerHTML = `<strong>${n.title}</strong><div>${n.body}</div><div class="muted">${n.created_at}</div>`;
          listEl.appendChild(li);
        });
      } catch (err) { listEl.innerHTML = 'Error'; console.error(err); }
    }
    noticeForm.addEventListener('submit', async e => {
      e.preventDefault();
      const data = { title: document.getElementById('noticeTitle').value, body: document.getElementById('noticeBody').value };
      try { await fetchJSON(`${API_BASE}/notices`, { method:'POST', body: JSON.stringify(data) }); noticeForm.reset(); loadNotices(); } catch (err) { onError(err); }
    });
    loadNotices();
  }

  /* Profile */
  const profileForm = document.getElementById('profileForm');
  if (profileForm) {
    async function loadProfile() {
      // Assumes backend has /api/auth/me — if not, you can parse token to show name
      const token = localStorage.getItem('ums_token');
      if (!token) return;
      try {
        // Try to decode minimal info from token
        const payload = JSON.parse(atob(token.split('.')[1]));
        document.getElementById('prof-name').value = payload.name || '';
        document.getElementById('prof-email').value = payload.email || '';
        document.getElementById('prof-roll').value = payload.roll || '';
      } catch (err) {}
    }
    profileForm.addEventListener('submit', async e => {
      e.preventDefault();
      document.getElementById('profileMsg').textContent = 'Profile update not implemented in demo.';
    });
    loadProfile();
  }

  /* Reports */
  if (document.getElementById('r-students')) {
    fetchJSON(`${API_BASE}/students`).then(list => { document.getElementById('r-students').textContent = list.length; exportAvailable('r'); }).catch(()=>{});
  }
  if (document.getElementById('r-teachers')) {
    fetchJSON(`${API_BASE}/teachers`).then(list => { document.getElementById('r-teachers').textContent = list.length; exportAvailable('r'); }).catch(()=>{});
  }
  if (document.getElementById('r-fees')) {
    fetchJSON(`${API_BASE}/fees`).then(list => { const due = list.filter(f => f.status === 'due').reduce((s,i)=>s+Number(i.amount||0),0); document.getElementById('r-fees').textContent = due; exportAvailable('r'); }).catch(()=>{});
  }
  function exportAvailable(prefix) {
    const btn = document.getElementById('exportCsv');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      try {
        const students = await fetchJSON(`${API_BASE}/students`);
        exportCSV(students, ['roll','name','email']);
      } catch (err) { onError(err); }
    });
  }

  /* Course allocation simple local store (demo) */
  const allocForm = document.getElementById('allocateForm');
  if (allocForm) {
    const tbody = document.querySelector('#allocTable tbody');
    function loadAlloc() {
      const items = JSON.parse(localStorage.getItem('ums_alloc') || '[]');
      tbody.innerHTML = '';
      items.forEach((it, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${it.course}</td><td>${it.teacher}</td><td>${it.semester||''}</td>
          <td><button data-i="${idx}" class="del-alloc btn small">Delete</button></td>`;
        tbody.appendChild(tr);
      });
      tbody.querySelectorAll('.del-alloc').forEach(b=>{
        b.addEventListener('click', ()=>{
          const items = JSON.parse(localStorage.getItem('ums_alloc') || '[]');
          items.splice(Number(b.dataset.i),1);
          localStorage.setItem('ums_alloc', JSON.stringify(items));
          loadAlloc();
        });
      });
    }
    allocForm.addEventListener('submit', e => {
      e.preventDefault();
      const course = document.getElementById('courseName').value;
      const teacher = document.getElementById('toTeacher').value;
      const semester = document.getElementById('courseSemester').value;
      const items = JSON.parse(localStorage.getItem('ums_alloc') || '[]');
      items.push({ course, teacher, semester });
      localStorage.setItem('ums_alloc', JSON.stringify(items));
      allocForm.reset();
      loadAlloc();
    });
    loadAlloc();
  }

});
