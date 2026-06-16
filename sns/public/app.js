// SNS App - Main JavaScript
const API = {
  auth: '/api/auth.php',
  posts: '/api/posts.php',
  messages: '/api/messages.php',
  profiles: '/api/profiles.php',
  notifications: '/api/notifications.php',
};

let currentUserId = null;
let currentPage = 'timeline';
let prevPage = null;
let chatPartnerId = null;
let chatInterval = null;
let notifInterval = null;
let otherProfileFrom = null;

// ---- Utility ----
function showError(msg) {
  document.getElementById('errorDialogMsg').textContent = msg;
  document.getElementById('errorDialog').style.display = 'flex';
}
document.getElementById('errorDialogOk').onclick = () => {
  document.getElementById('errorDialog').style.display = 'none';
};

function post(url, data) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.append(k, v);
  return fetch(url, { method: 'POST', body: fd }).then(r => r.json());
}

function get(url, params = {}) {
  const qs = new URLSearchParams(params).toString();
  return fetch(url + (qs ? '?' + qs : '')).then(r => r.json());
}

function showFieldError(elId, msg) {
  const el = document.getElementById(elId);
  el.textContent = msg;
  el.style.display = 'block';
}
function clearFieldError(elId) {
  const el = document.getElementById(elId);
  el.style.display = 'none';
}

function gradeLabel(g) {
  const map = { 0: '職員', 1: '学部1年', 2: '学部2年', 3: '学部3年', 4: '学部4年', 5: '修士1年', 6: '修士2年', 7: '博士1年', 8: '博士2年', 9: '博士3年', 10: '博士4年', 11: '教員' };
  return map[g] || '不明';
}

// ---- 所属カスケード ----
// 配列 = フラット選択（工学部）、オブジェクト = 課程→コースの2段階
const SHOZOKU_COURSES = {
  '工学部': [
    '機械工学課程 基幹機械コース(機械工学科)',
    '機械工学課程 先進機械コース(機械機能工学科)',
    '物質化学課程 環境・物質工学コース(材料工学科)',
    '物質化学課程 化学・生命コース(応用化学科)',
    '電気電子工学課程 電気・ロボット工学コース(電気工学科)',
    '電気電子工学課程 先端電子工学コース(電子工学科)',
    '情報・通信工学課程 情報通信コース(情報通信工学科)',
    '情報・通信工学課程 情報工学コース(情報工学科)',
    '土木工学課程 都市・環境コース(土木工学科)',
    '先進国際課程',
  ],
  'システム理工学部': {
    '情報課程(電子情報システム学科)': ['IoTコース', 'ソフトウェアコース', 'メディアコース', 'データサイエンスコース'],
    '機械・電気課程(機械制御システム学科)': ['機械・電気コース'],
    '建築・環境課程(環境システム学科)': ['建築コース', '環境・都市コース'],
    '生命科学課程(生命科学科)': ['生命科学コース', '医工学コース', 'スポーツ工学コース'],
    '数理科学課程(数理科学科)': ['数理科学コース'],
  },
  'デザイン工学部': {
    'デザイン工学科': ['社会情報システムコース', 'UXコース', 'プロダクトコース', '生産・プロダクトデザイン系', 'ロボティクス・情報デザイン系'],
  },
  '建築学部': {
    '建築学科': ['SAコース', 'UAコース', 'APコース'],
  },
  '大学院 理工学研究科': [
    '電気電子情報工学専攻',
    '材料工学専攻',
    '応用化学専攻',
    '機械工学専攻',
    'システム理工学専攻',
    '国際理工学専攻',
    '社会基盤学専攻',
    '建築学専攻',
    '地域環境システム専攻',
    '機能制御システム専攻',
  ],
};

const GRAD_COURSES = {
  masters: [
    '電気電子情報工学専攻',
    '材料工学専攻',
    '応用化学専攻',
    '機械工学専攻',
    'システム理工学専攻',
    '国際理工学専攻',
    '社会基盤学専攻',
    '建築学専攻',
  ],
  doctoral: [
    '地域環境システム専攻',
    '機能制御システム専攻',
  ],
};

// ---- 研究室データ（コースキー → 研究室リスト） ----
// 学科・コース（または大学院の専攻）を選択すると、ここに登録された研究室が
// プルダウンに一覧表示される。配列が空の間は自由入力欄にフォールバックする。
// TODO: 各学科の公式サイトの研究室一覧をもとに '研究室名(教員名)' 形式で追加する
const LAB_DATA = {
  '機械工学課程 基幹機械コース(機械工学科)': [
    '生産加工プロセス研究室(青木 孝史朗)',
    '機械制御工学研究室(内村 裕)',
    '燃焼工学研究室(斎藤 寛泰)',
    '粒状体力学研究室(佐伯 暢人)',
    '固体力学研究室(坂上 賢一)',
    '臨床機械加工研究室(澤 武一)',
    '熱流体理工学研究室(白井 克明)',
    '応用伝熱工学研究室(丹下 学)',
    'エネルギー変換工学研究室(角田 和巳)',
    '離散数学研究室(西村 強)',
    '材料強度学研究室(橋村 真治)',
    '生物微小流体工学研究室(二井 信行)',
    '熱工学研究室(矢作 裕司)',
    '科学技術と社会研究室(栃内 文彦)',
  ],
  '機械工学課程 先進機械コース(機械機能工学科)': [],
  '物質化学課程 環境・物質工学コース(材料工学科)': [],
  '物質化学課程 化学・生命コース(応用化学科)': [],
  '電気電子工学課程 電気・ロボット工学コース(電気工学科)': [],
  '電気電子工学課程 先端電子工学コース(電子工学科)': [],
  '情報・通信工学課程 情報通信コース(情報通信工学科)': [],
  '情報・通信工学課程 情報工学コース(情報工学科)': [],
  '土木工学課程 都市・環境コース(土木工学科)': [],
  '先進国際課程': [],
  '情報課程(電子情報システム学科) - IoTコース': [],
  '情報課程(電子情報システム学科) - ソフトウェアコース': [],
  '情報課程(電子情報システム学科) - メディアコース': [],
  '情報課程(電子情報システム学科) - データサイエンスコース': [],
  '機械・電気課程(機械制御システム学科) - 機械・電気コース': [],
  '建築・環境課程(環境システム学科) - 建築コース': [],
  '建築・環境課程(環境システム学科) - 環境・都市コース': [],
  '生命科学課程(生命科学科) - 生命科学コース': [],
  '生命科学課程(生命科学科) - 医工学コース': [],
  '生命科学課程(生命科学科) - スポーツ工学コース': [],
  '数理科学課程(数理科学科) - 数理科学コース': [],
  'デザイン工学科 - 社会情報システムコース': [],
  'デザイン工学科 - UXコース': [],
  'デザイン工学科 - プロダクトコース': [],
  'デザイン工学科 - 生産・プロダクトデザイン系': [],
  'デザイン工学科 - ロボティクス・情報デザイン系': [],
  '建築学科 - SAコース': [],
  '建築学科 - UAコース': [],
  '建築学科 - APコース': [],
  // 大学院（専攻名がそのままキー）
  '電気電子情報工学専攻': [],
  '材料工学専攻': [],
  '応用化学専攻': [],
  '機械工学専攻': [],
  'システム理工学専攻': [],
  '国際理工学専攻': [],
  '社会基盤学専攻': [],
  '建築学専攻': [],
  '地域環境システム専攻': [],
  '機能制御システム専攻': [],
};

function getAllLabsForFaculty(faculty) {
  const courseData = SHOZOKU_COURSES[faculty];
  if (!courseData) return [];
  const keys = Array.isArray(courseData) ? courseData
    : Object.entries(courseData).flatMap(([dept, courses]) => courses.map(c => dept + ' - ' + c));
  return keys.flatMap(k => LAB_DATA[k] || []);
}

function getCourseKeyForLab(labValue) {
  for (const [key, labs] of Object.entries(LAB_DATA)) {
    if (labs.includes(labValue)) return key;
  }
  return null;
}

function getFacultyForCourseKey(courseKey) {
  for (const [faculty, courseData] of Object.entries(SHOZOKU_COURSES)) {
    if (Array.isArray(courseData)) {
      if (courseData.includes(courseKey)) return faculty;
    } else {
      for (const [dept, courses] of Object.entries(courseData)) {
        if (courses.some(c => dept + ' - ' + c === courseKey)) return faculty;
      }
    }
  }
  return null;
}

function getCurrentCourseKey(pfx) {
  // 大学院生: 専攻名がそのまま研究室データのキー
  const gradGroup = document.getElementById(pfx + 'GradCourseGroup');
  if (gradGroup && gradGroup.style.display !== 'none') {
    return document.getElementById(pfx + 'GradCourseSelect')?.value || null;
  }
  const faculty = document.getElementById(pfx + 'Faculty')?.value || '';
  if (!faculty) return null;
  const courseData = SHOZOKU_COURSES[faculty];
  if (!courseData) return null;
  const courseVal = document.getElementById(pfx + 'CourseSelect')?.value || '';
  if (!courseVal) return null;
  if (Array.isArray(courseData)) return courseVal;
  const subCourse = document.getElementById(pfx + 'SubCourseSelect')?.value || '';
  if (subCourse) return courseVal + ' - ' + subCourse;
  if (courseData[courseVal]?.length === 1) return courseVal + ' - ' + courseData[courseVal][0];
  return null;
}

function updateLabSelect(pfx) {
  const courseKey = getCurrentCourseKey(pfx);
  const faculty = document.getElementById(pfx + 'Faculty')?.value || '';
  const labs = courseKey ? (LAB_DATA[courseKey] || []) : [];
  const group = document.getElementById(pfx + 'LabGroup');
  const sel = document.getElementById(pfx + 'LabSelect');
  const otherGroup = document.getElementById(pfx + 'LabOtherGroup');
  if (!group) return;
  if (labs.length > 0) {
    // 学科・専攻に登録済みの研究室を一覧表示して選択
    sel.innerHTML = '<option value="">選択してください</option>' +
      labs.map(l => `<option value="${l}">${l}</option>`).join('') +
      '<option value="__other__">その他（自由入力）</option>';
    group.style.display = 'block';
    otherGroup.style.display = 'none';
  } else if (courseKey || faculty) {
    // 研究室データ未登録の学科・専攻は自由入力
    group.style.display = 'none';
    otherGroup.style.display = 'block';
  } else {
    group.style.display = 'none';
    otherGroup.style.display = 'none';
  }
}

function onLabSelectChange(pfx) {
  const val = document.getElementById(pfx + 'LabSelect').value;
  document.getElementById(pfx + 'LabOtherGroup').style.display = val === '__other__' ? 'block' : 'none';
}

function getLabValue(pfx) {
  const group = document.getElementById(pfx + 'LabGroup');
  if (group && group.style.display !== 'none') {
    const val = document.getElementById(pfx + 'LabSelect').value;
    if (val === '__other__') return document.getElementById(pfx + 'LabOther').value;
    return val;
  }
  return document.getElementById(pfx + 'LabOther')?.value || '';
}

function setLabValue(pfx, labValue) {
  const group = document.getElementById(pfx + 'LabGroup');
  const sel = document.getElementById(pfx + 'LabSelect');
  if (group && group.style.display !== 'none' && sel) {
    const exists = Array.from(sel.options).some(o => o.value === labValue);
    if (exists) { sel.value = labValue; return; }
    if (labValue) {
      sel.value = '__other__';
      document.getElementById(pfx + 'LabOtherGroup').style.display = 'block';
      document.getElementById(pfx + 'LabOther').value = labValue;
    }
  } else if (labValue) {
    const otherGroup = document.getElementById(pfx + 'LabOtherGroup');
    if (otherGroup) {
      otherGroup.style.display = 'block';
      document.getElementById(pfx + 'LabOther').value = labValue;
    }
  }
}

// ---- 検索フォーム 研究室オートコンプリート ----
function getSearchLabOptions() {
  const faculty = document.getElementById('searchFaculty').value;
  const course = document.getElementById('searchCourse').value;
  const query = document.getElementById('searchLab').value.toLowerCase();
  let labs = [];
  if (course) {
    labs = LAB_DATA[course] || [];
  } else if (faculty) {
    labs = getAllLabsForFaculty(faculty);
  } else {
    labs = Object.values(LAB_DATA).flat();
  }
  if (query) labs = labs.filter(l => l.toLowerCase().includes(query));
  return [...new Set(labs)];
}

function renderLabDropdown() {
  const labs = getSearchLabOptions();
  const dropdown = document.getElementById('labSearchDropdown');
  if (labs.length === 0) { dropdown.style.display = 'none'; return; }
  dropdown.innerHTML = labs.map(l =>
    `<div class="lab-dropdown-item" onmousedown="selectSearchLab(${JSON.stringify(l)})">${l}</div>`
  ).join('');
  dropdown.style.display = 'block';
}

function onSearchLabInput() { renderLabDropdown(); }

function selectSearchLab(labValue) {
  document.getElementById('searchLab').value = labValue;
  document.getElementById('labSearchDropdown').style.display = 'none';
  const courseKey = getCourseKeyForLab(labValue);
  if (courseKey) {
    const faculty = getFacultyForCourseKey(courseKey);
    if (faculty) {
      document.getElementById('searchFaculty').value = faculty;
      onSearchFacultyChange();
      document.getElementById('searchCourse').value = courseKey;
    }
  }
}

function onSearchFacultyChange() {
  const faculty = document.getElementById('searchFaculty').value;
  const courseData = SHOZOKU_COURSES[faculty];
  const sel = document.getElementById('searchCourse');
  sel.innerHTML = '<option value="">すべて</option>';
  if (courseData) {
    if (Array.isArray(courseData)) {
      courseData.forEach(opt => { const o = document.createElement('option'); o.value = opt; o.textContent = opt; sel.appendChild(o); });
    } else {
      Object.entries(courseData).forEach(([dept, courses]) => {
        courses.forEach(course => {
          const o = document.createElement('option');
          o.value = dept + ' - ' + course;
          o.textContent = dept + ' - ' + course;
          sel.appendChild(o);
        });
      });
    }
  }
  renderLabDropdown();
}

function onSearchCourseChange() { renderLabDropdown(); }

document.addEventListener('click', (e) => {
  if (!e.target.closest('.lab-search-wrapper')) {
    const dd = document.getElementById('labSearchDropdown');
    if (dd) dd.style.display = 'none';
  }
});

function getGradeCat(grade) {
  const g = parseInt(grade);
  if ([1,2,3,4,11].includes(g)) return 'faculty';
  if ([5,6].includes(g)) return 'masters';
  if ([7,8,9,10].includes(g)) return 'doctoral';
  if (g === 0) return 'staff';
  return null;
}

function onGradeChange(pfx) {
  const grade = document.getElementById(pfx + 'Grade').value;
  const cat = getGradeCat(grade);
  const isGrad = cat === 'masters' || cat === 'doctoral';
  document.getElementById(pfx + 'FacultyGroup').style.display = cat === 'faculty' ? 'block' : 'none';
  document.getElementById(pfx + 'GradGroup').style.display = isGrad ? 'block' : 'none';
  document.getElementById(pfx + 'StaffGroup').style.display = cat === 'staff' ? 'block' : 'none';
  document.getElementById(pfx + 'CourseGroup').style.display = 'none';
  document.getElementById(pfx + 'SubCourseGroup').style.display = 'none';
  document.getElementById(pfx + 'ProgramGroup').style.display = 'none';
  if (isGrad) {
    const courses = cat === 'masters' ? GRAD_COURSES.masters : GRAD_COURSES.doctoral;
    const sel = document.getElementById(pfx + 'GradCourseSelect');
    sel.innerHTML = '<option value="">選択してください</option>' +
      courses.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById(pfx + 'GradCourseGroup').style.display = 'block';
  } else {
    document.getElementById(pfx + 'GradCourseGroup').style.display = 'none';
  }
  const fac = document.getElementById(pfx + 'Faculty');
  if (fac) {
    fac.value = '';
    const gradOpt = fac.querySelector('option[value="大学院 理工学研究科"]');
    if (gradOpt) gradOpt.style.display = parseInt(grade) === 11 ? '' : 'none';
  }
  updateLabSelect(pfx);
}

function onFacultyChange(pfx) {
  const faculty = document.getElementById(pfx + 'Faculty').value;
  const courseData = SHOZOKU_COURSES[faculty];
  document.getElementById(pfx + 'SubCourseGroup').style.display = 'none';
  document.getElementById(pfx + 'ProgramGroup').style.display = faculty === 'システム理工学部' ? 'block' : 'none';
  updateLabSelect(pfx);
  if (!courseData) { document.getElementById(pfx + 'CourseGroup').style.display = 'none'; return; }
  const options = Array.isArray(courseData) ? courseData : Object.keys(courseData);
  const sel = document.getElementById(pfx + 'CourseSelect');
  sel.innerHTML = '<option value="">選択してください</option>' +
    options.map(c => `<option value="${c}">${c}</option>`).join('');
  document.getElementById(pfx + 'CourseGroup').style.display = 'block';
}

function onCourseChange(pfx) {
  const faculty = document.getElementById(pfx + 'Faculty').value;
  const courseData = SHOZOKU_COURSES[faculty];
  const course = document.getElementById(pfx + 'CourseSelect').value;
  if (!Array.isArray(courseData) && courseData && course) {
    const subCourses = courseData[course] || [];
    if (subCourses.length > 1) {
      const sel = document.getElementById(pfx + 'SubCourseSelect');
      sel.innerHTML = '<option value="">選択してください</option>' +
        subCourses.map(c => `<option value="${c}">${c}</option>`).join('');
      document.getElementById(pfx + 'SubCourseGroup').style.display = 'block';
      updateLabSelect(pfx);
      return;
    }
  }
  document.getElementById(pfx + 'SubCourseGroup').style.display = 'none';
  updateLabSelect(pfx);
}

function getShozokuValues(pfx) {
  const grade = parseInt(document.getElementById(pfx + 'Grade').value);
  const cat = getGradeCat(grade);
  let department = '', course = '';
  if (cat === 'faculty') {
    department = document.getElementById(pfx + 'Faculty').value;
    const courseData = SHOZOKU_COURSES[department];
    const courseVal = document.getElementById(pfx + 'CourseSelect').value;
    if (Array.isArray(courseData)) {
      course = courseVal;
    } else {
      const subCourseEl = document.getElementById(pfx + 'SubCourseSelect');
      const subCourse = subCourseEl.value;
      if (subCourse) {
        course = courseVal + ' - ' + subCourse;
      } else if (courseVal && courseData) {
        const subs = courseData[courseVal] || [];
        course = subs.length === 1 ? courseVal + ' - ' + subs[0] : courseVal;
      } else {
        course = courseVal;
      }
    }
    if (department === 'システム理工学部') {
      const prog = document.getElementById(pfx + 'Program').value;
      if (prog === '国際プログラム') {
        course += course ? ' [国際プログラム]' : '[国際プログラム]';
      }
    }
  } else if (cat === 'masters' || cat === 'doctoral') {
    department = '大学院 理工学研究科';
    course = document.getElementById(pfx + 'GradCourseSelect').value;
  } else if (cat === 'staff') {
    department = document.getElementById(pfx + 'StaffDept').value.trim();
  }
  return { department, course };
}

function setShozokuValues(pfx, department, course, grade) {
  document.getElementById(pfx + 'Grade').value = grade;
  onGradeChange(pfx);
  const cat = getGradeCat(grade);
  if (cat === 'faculty') {
    const knownFaculties = ['工学部', 'システム理工学部', 'デザイン工学部', '建築学部'];
    if (knownFaculties.includes(department)) {
      document.getElementById(pfx + 'Faculty').value = department;
      onFacultyChange(pfx);
      let courseVal = course || '';
      let isIntl = false;
      if (courseVal.endsWith(' [国際プログラム]')) {
        courseVal = courseVal.slice(0, -' [国際プログラム]'.length);
        isIntl = true;
      }
      const courseData = SHOZOKU_COURSES[department];
      if (Array.isArray(courseData)) {
        document.getElementById(pfx + 'CourseSelect').value = courseVal;
      } else {
        const dashIdx = courseVal.indexOf(' - ');
        if (dashIdx !== -1) {
          const cp = courseVal.substring(0, dashIdx);
          const sp = courseVal.substring(dashIdx + 3);
          document.getElementById(pfx + 'CourseSelect').value = cp;
          onCourseChange(pfx);
          document.getElementById(pfx + 'SubCourseSelect').value = sp;
        } else {
          document.getElementById(pfx + 'CourseSelect').value = courseVal;
        }
      }
      const prog = document.getElementById(pfx + 'Program');
      if (prog) prog.value = isIntl ? '国際プログラム' : '一般プログラム';
    }
  } else if (cat === 'masters' || cat === 'doctoral') {
    document.getElementById(pfx + 'GradCourseSelect').value = course || '';
  } else if (cat === 'staff') {
    document.getElementById(pfx + 'StaffDept').value = department || '';
  }
}

function avatarEl(name, cls = '') {
  const letter = (name || '?')[0].toUpperCase();
  const colors = ['#1877f2','#e41e3f','#1a7a1a','#e67e22','#8e44ad'];
  const c = colors[letter.charCodeAt(0) % colors.length];
  return `<div class="avatar ${cls}" style="background:${c}">${letter}</div>`;
}

function timeAgo(dateStr) {
  const d = new Date(dateStr.replace(' ', 'T'));
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'たった今';
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  return `${Math.floor(diff / 86400)}日前`;
}

function navigate(page, extra = {}) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn[data-page]').forEach(b => b.classList.remove('active'));

  const pageEl = document.getElementById('page' + page.charAt(0).toUpperCase() + page.slice(1));
  if (pageEl) pageEl.classList.add('active');
  const navBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');

  if (chatInterval && page !== 'chat') {
    clearInterval(chatInterval);
    chatInterval = null;
  }

  prevPage = currentPage;
  currentPage = page;

  if (page === 'timeline') loadTimeline();
  if (page === 'search') document.getElementById('searchResults').innerHTML = '';
  if (page === 'messages') loadPartners();
  if (page === 'notifications') loadNotifications();
  if (page === 'myprofile') loadMyProfile();
  if (page === 'postDetail' && extra.postId) loadPostDetail(extra.postId);
  if (page === 'chat' && extra.partnerId) openChat(extra.partnerId);
  if (page === 'otherProfile' && extra.userId) loadOtherProfile(extra.userId);
  if (page === 'editProfile') loadEditProfile();
}

// ---- Auth Section ----
function showAuthPage(page) {
  ['loginPage','registerPage','resetPage'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  document.getElementById(page).style.display = 'flex';
}

document.getElementById('toRegister').onclick = (e) => { e.preventDefault(); showAuthPage('registerPage'); };
document.getElementById('toForgotPassword').onclick = (e) => { e.preventDefault(); showAuthPage('resetPage'); };
document.getElementById('toLoginFromReg').onclick = (e) => { e.preventDefault(); showAuthPage('loginPage'); };
document.getElementById('toLoginFromReset').onclick = (e) => { e.preventDefault(); showAuthPage('loginPage'); };
document.getElementById('toLoginFromDone').onclick = () => showAuthPage('loginPage');
document.getElementById('toLoginFromResetDone').onclick = () => showAuthPage('loginPage');

// Login
document.getElementById('loginForm').onsubmit = async (e) => {
  e.preventDefault();
  clearFieldError('loginError');
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const res = await post(API.auth, { action: 'login', email, password });
  if (res.status === 'ok') {
    currentUserId = res.user_id;
    startApp();
  } else {
    showFieldError('loginError', res.message);
  }
};

// Register Step 1 - send code
document.getElementById('sendCodeBtn').onclick = async () => {
  clearFieldError('regStep1Error');
  const email = document.getElementById('regEmail').value.trim();
  const res = await post(API.auth, { action: 'send_code', email });
  if (res.status === 'ok') {
    document.getElementById('regStep1').style.display = 'none';
    document.getElementById('regStep2').style.display = 'block';
  } else {
    showFieldError('regStep1Error', res.message);
  }
};

// Register Step 2 - verify code + password
document.getElementById('verifyCodeBtn').onclick = async () => {
  clearFieldError('regStep2Error');
  const email = document.getElementById('regEmail').value.trim();
  const code = document.getElementById('regCode').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regPasswordConfirm').value;

  // Validate code first
  const verRes = await post(API.auth, { action: 'verify_code', email, code });
  if (verRes.status !== 'ok') {
    showFieldError('regStep2Error', verRes.message);
    return;
  }
  // Validate password client-side
  if (password.length < 8 || password.length > 16) {
    showFieldError('regStep2Error', 'パスワードは8〜16文字で入力してください');
    return;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    showFieldError('regStep2Error', 'パスワードには英数字記号すべてが含まれている必要があります');
    return;
  }
  if (password !== confirm) {
    showFieldError('regStep2Error', 'パスワードが一致しません');
    return;
  }
  document.getElementById('regStep2').style.display = 'none';
  document.getElementById('regStep3').style.display = 'block';
};

// Register Step 3 - profile info
document.getElementById('completeRegBtn').onclick = async () => {
  clearFieldError('regStep3Error');
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regPasswordConfirm').value;
  const lastName = document.getElementById('regLastName').value.trim();
  const firstName = document.getElementById('regFirstName').value.trim();
  const grade = document.getElementById('regGrade').value;
  if (!lastName) { showFieldError('regStep3Error', '氏名（姓）を入力してください'); return; }
  if (grade === '') { showFieldError('regStep3Error', '学年/職員欄を選択してください'); return; }

  const { department: regDept, course: regCourse } = getShozokuValues('reg');
  const res = await post(API.auth, {
    action: 'register', email, password, confirm_password: confirm,
    last_name: lastName, first_name: firstName, grade,
    department: regDept,
    course: regCourse,
    lab: getLabValue('reg'),
    clubs: document.getElementById('regClubs').value,
    bio: document.getElementById('regBio').value,
  });
  if (res.status === 'ok') {
    document.getElementById('regStep3').style.display = 'none';
    document.getElementById('regStep4').style.display = 'block';
  } else {
    showFieldError('regStep3Error', res.message);
  }
};

// Password Reset
document.getElementById('resetSendCodeBtn').onclick = async () => {
  clearFieldError('resetStep1Error');
  const email = document.getElementById('resetEmail').value.trim();
  const res = await post(API.auth, { action: 'send_code', email });
  if (res.status === 'ok') {
    document.getElementById('resetStep1').style.display = 'none';
    document.getElementById('resetStep2').style.display = 'block';
  } else {
    showFieldError('resetStep1Error', res.message);
  }
};

document.getElementById('resetSubmitBtn').onclick = async () => {
  clearFieldError('resetStep2Error');
  const email = document.getElementById('resetEmail').value.trim();
  const code = document.getElementById('resetCode').value.trim();
  const password = document.getElementById('resetPassword').value;
  const confirm = document.getElementById('resetPasswordConfirm').value;
  if (!code) { showFieldError('resetStep2Error', '学籍番号が入力されていません'); return; }
  if (password !== confirm) { showFieldError('resetStep2Error', 'パスワードが一致しません'); return; }

  const res = await post(API.auth, { action: 'reset_password', email, code, password, confirm_password: confirm });
  if (res.status === 'ok') {
    document.getElementById('resetStep2').style.display = 'none';
    document.getElementById('resetStep3').style.display = 'block';
  } else {
    showFieldError('resetStep2Error', res.message);
  }
};

// ---- Main App ----
function startApp() {
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('appSection').style.display = 'block';
  navigate('timeline');
  startNotifPolling();
}

// Nav buttons
document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
  btn.onclick = () => navigate(btn.dataset.page);
});

document.getElementById('logoutBtn').onclick = async () => {
  await post(API.auth, { action: 'logout' });
  currentUserId = null;
  if (notifInterval) clearInterval(notifInterval);
  document.getElementById('appSection').style.display = 'none';
  document.getElementById('authSection').style.display = 'block';
  showAuthPage('loginPage');
};

// ---- Timeline ----
async function loadTimeline() {
  document.getElementById('timelineList').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  document.getElementById('timelineEmpty').style.display = 'none';
  const res = await get(API.posts, { action: 'list' });
  if (res.status !== 'ok') { showError('タイムラインの取得に失敗しました'); return; }
  const posts = res.posts;
  if (posts.length === 0) {
    document.getElementById('timelineList').innerHTML = '';
    document.getElementById('timelineEmpty').style.display = 'block';
    return;
  }
  document.getElementById('timelineList').innerHTML = posts.map(p => `
    <div class="post-card" data-post-id="${p.post_id}" onclick="navigate('postDetail',{postId:${p.post_id}})">
      <div class="post-header">
        ${avatarEl(p.name)}
        <div class="post-meta">
          <div class="name" onclick="event.stopPropagation();openUserProfile(${p.user_id})">${esc(p.name)}</div>
          <div class="time">${timeAgo(p.created_at)}</div>
        </div>
        ${p.user_id == currentUserId ? `<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deletePost(${p.post_id})">削除</button>` : ''}
      </div>
      <div class="post-content">${esc(p.content)}</div>
      <div class="post-actions">
        <span class="reply-count">💬 ${p.reply_count}件の返信</span>
      </div>
    </div>
  `).join('');
}

// Post form char count
document.getElementById('postContent').oninput = function() {
  const len = Math.ceil(this.value.length * (this.value.match(/[^\x00-\x7F]/) ? 3 : 1) / 3);
  document.getElementById('postCharCount').textContent = `${this.value.length} / 340文字`;
};

document.getElementById('postSubmitBtn').onclick = async () => {
  clearFieldError('postError');
  const content = document.getElementById('postContent').value.trim();
  if (!content) { showFieldError('postError', '投稿内容を入力してください'); return; }
  if (new Blob([content]).size > 1024) { showFieldError('postError', '投稿内容は1024バイト以下にしてください'); return; }
  const res = await post(API.posts, { action: 'create', content });
  if (res.status === 'ok') {
    document.getElementById('postContent').value = '';
    document.getElementById('postCharCount').textContent = '0 / 340文字';
    loadTimeline();
  } else {
    showFieldError('postError', res.message);
  }
};

async function deletePost(postId) {
  if (!confirm('この投稿を削除しますか？')) return;
  const res = await post(API.posts, { action: 'delete', post_id: postId });
  if (res.status === 'ok') loadTimeline();
  else showError(res.message);
}

// ---- Post Detail ----
async function loadPostDetail(postId) {
  document.getElementById('detailContent').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const res = await get(API.posts, { action: 'detail', post_id: postId });
  if (res.status !== 'ok') { showError('投稿が見つかりません'); navigate('timeline'); return; }
  const p = res.post;
  const replies = res.replies;

  document.getElementById('detailContent').innerHTML = `
    <div class="post-card" style="cursor:default;">
      <div class="post-header">
        ${avatarEl(p.name)}
        <div class="post-meta">
          <div class="name" style="cursor:pointer;" onclick="openUserProfile(${p.user_id})">${esc(p.name)}</div>
          <div class="time">${timeAgo(p.created_at)}</div>
        </div>
        ${p.user_id == currentUserId ? `<button class="btn btn-danger btn-sm" onclick="deletePost(${p.post_id});navigate('timeline')">削除</button>` : ''}
      </div>
      <div class="post-content">${esc(p.content)}</div>
    </div>

    <div class="reply-form">
      <div class="form-group">
        <textarea id="replyContent" placeholder="返信を入力..." style="width:100%;border:1px solid #ccd0d5;border-radius:6px;padding:10px;font-size:14px;resize:vertical;min-height:70px;outline:none;"></textarea>
      </div>
      <div id="replyError" class="error-msg"></div>
      <button class="btn btn-primary btn-sm" onclick="submitReply(${postId})">返信する</button>
    </div>

    <div class="reply-list">
      ${replies.length === 0 ? '<div class="empty-state">まだ返信がありません</div>' : replies.map(r => `
        <div class="reply-card">
          <div class="post-header">
            ${avatarEl(r.name, 'sm')}
            <div class="post-meta">
              <div class="name" style="cursor:pointer;font-size:14px;" onclick="openUserProfile(${r.user_id})">${esc(r.name)}</div>
              <div class="time">${timeAgo(r.created_at)}</div>
            </div>
          </div>
          <div class="post-content" style="font-size:14px;">${esc(r.content)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

async function submitReply(postId) {
  clearFieldError('replyError');
  const content = document.getElementById('replyContent').value.trim();
  if (!content) { showFieldError('replyError', '返信内容を入力してください'); return; }
  if (new Blob([content]).size > 1024) { showFieldError('replyError', '返信内容は1024バイト以下にしてください'); return; }
  const res = await post(API.posts, { action: 'reply', post_id: postId, content });
  if (res.status === 'ok') {
    document.getElementById('replyContent').value = '';
    loadPostDetail(postId);
  } else {
    showFieldError('replyError', res.message);
  }
}

document.getElementById('backToTimeline').onclick = () => navigate('timeline');

// ---- Profile ----
function openUserProfile(userId) {
  if (userId == currentUserId) {
    navigate('myprofile');
  } else {
    otherProfileFrom = currentPage;
    navigate('otherProfile', { userId });
  }
}

async function loadMyProfile() {
  document.getElementById('myProfileContent').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const res = await get(API.profiles, { action: 'get' });
  if (res.status !== 'ok') { showError('プロフィール情報の取得に失敗しました。時間をおいて再度お試しください。'); return; }
  const p = res.profile;
  document.getElementById('myProfileContent').innerHTML = buildProfileCard(p, true);
}

async function loadOtherProfile(userId) {
  document.getElementById('otherProfileContent').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const res = await get(API.profiles, { action: 'get', user_id: userId });
  if (res.status !== 'ok') { showError(res.message || 'このユーザーは退会済みです'); navigate(otherProfileFrom || 'timeline'); return; }
  const p = res.profile;
  document.getElementById('otherProfileContent').innerHTML = buildProfileCard(p, false);
}

function buildProfileCard(p, isOwn) {
  const gLabel = gradeLabel(p.grade);
  return `
    <div class="profile-card">
      <div class="profile-header">
        ${avatarEl(p.name).replace('class="avatar"', 'class="profile-avatar"')}
        <div class="profile-info">
          <h2>${esc(p.name)}</h2>
          <p>${gLabel}${p.department ? ' / ' + esc(p.department) : ''}</p>
          ${isOwn ? '' : `<button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="startDM(${p.user_id})">💬 メッセージ</button>`}
          ${isOwn ? `<button class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="navigate('editProfile')">✏️ プロフィール編集</button>` : ''}
        </div>
      </div>
      <div class="profile-details">
        ${p.bio ? `<div class="profile-detail-row"><span class="label">自己紹介</span><span>${esc(p.bio)}</span></div>` : ''}
        ${p.department ? `<div class="profile-detail-row"><span class="label">所属</span><span>${esc(p.department)}</span></div>` : ''}
        ${p.course ? `<div class="profile-detail-row"><span class="label">コース</span><span>${esc(p.course)}</span></div>` : ''}
        ${p.lab ? `<div class="profile-detail-row"><span class="label">研究室</span><span>${esc(p.lab)}</span></div>` : ''}
        ${p.clubs ? `<div class="profile-detail-row"><span class="label">サークル・部活動</span><span>${esc(p.clubs)}</span></div>` : ''}
        ${p.timetable ? `<div class="profile-detail-row"><span class="label">時間割</span><span>${esc(p.timetable)}</span></div>` : ''}
      </div>
    </div>
  `;
}

document.getElementById('backFromOtherProfile').onclick = () => navigate(otherProfileFrom || 'timeline');

async function loadEditProfile() {
  const res = await get(API.profiles, { action: 'get' });
  if (res.status !== 'ok') { showError('プロフィールの取得に失敗しました'); return; }
  const p = res.profile;
  document.getElementById('editLastName').value = p.last_name || '';
  document.getElementById('editFirstName').value = p.first_name || '';
  setShozokuValues('edit', p.department || '', p.course || '', p.grade ?? 1);
  updateLabSelect('edit');
  setLabValue('edit', p.lab || '');
  document.getElementById('editClubs').value = p.clubs || '';
  document.getElementById('editBio').value = p.bio || '';
  document.getElementById('editTimetable').value = p.timetable || '';
}

document.getElementById('editProfileForm').onsubmit = async (e) => {
  e.preventDefault();
  clearFieldError('editProfileError');
  const editLastName = document.getElementById('editLastName').value.trim();
  const editFirstName = document.getElementById('editFirstName').value.trim();
  const bio = document.getElementById('editBio').value.trim();
  if (!editLastName) { showFieldError('editProfileError', '名前（姓）を入力してください'); return; }
  if (new Blob([editLastName + ' ' + editFirstName]).size > 64) { showFieldError('editProfileError', '名前は64バイト以下にしてください'); return; }
  if (new Blob([bio]).size > 1024) { showFieldError('editProfileError', '自己紹介は1024バイト以下にしてください'); return; }

  const { department: editDept, course: editCourse } = getShozokuValues('edit');
  const res = await post(API.profiles, {
    action: 'update', last_name: editLastName, first_name: editFirstName,
    grade: document.getElementById('editGrade').value,
    department: editDept,
    course: editCourse,
    lab: getLabValue('edit'),
    clubs: document.getElementById('editClubs').value,
    bio,
    timetable: document.getElementById('editTimetable').value,
  });
  if (res.status === 'ok') {
    navigate('myprofile');
  } else {
    showFieldError('editProfileError', res.message);
  }
};

document.getElementById('cancelEditProfile').onclick = () => navigate('myprofile');
document.getElementById('backFromEditProfile').onclick = () => navigate('myprofile');

// ---- Search ----
document.getElementById('searchBtn').onclick = async () => {
  const params = {
    action: 'search',
    name: document.getElementById('searchName').value,
    grade: document.getElementById('searchGrade').value,
    course: document.getElementById('searchCourse').value,
    lab: document.getElementById('searchLab').value,
    clubs: document.getElementById('searchClubs').value,
  };
  const res = await get(API.profiles, params);
  if (res.status !== 'ok') { showError(res.message); return; }
  const profiles = res.profiles;
  if (profiles.length === 0) {
    document.getElementById('searchResults').innerHTML = '<div class="empty-state">該当件数0<br>条件を変えて再検索してください</div>';
    return;
  }
  document.getElementById('searchResults').innerHTML = profiles.map(p => `
    <div class="search-result-card" onclick="openUserProfile(${p.user_id})">
      ${avatarEl(p.name, 'sm')}
      <div class="search-result-info">
        <div class="name">${esc(p.name)}</div>
        <div class="sub">${gradeLabel(p.grade)}${p.course ? ' / ' + esc(p.course) : ''}</div>
        ${p.bio ? `<div class="sub">${esc(p.bio.substring(0, 40))}${p.bio.length > 40 ? '...' : ''}</div>` : ''}
      </div>
    </div>
  `).join('');
};

// Enter key on search inputs
document.querySelectorAll('#pageSearch input, #pageSearch select').forEach(el => {
  el.onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('searchBtn').click(); };
});

// ---- Messages ----
async function loadPartners() {
  document.getElementById('partnerList').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  document.getElementById('partnerEmpty').style.display = 'none';
  const res = await get(API.messages, { action: 'partners' });
  if (res.status !== 'ok') { showError('メッセージ一覧の取得に失敗しました'); return; }
  const partners = res.partners;
  if (partners.length === 0) {
    document.getElementById('partnerList').innerHTML = '';
    document.getElementById('partnerEmpty').style.display = 'block';
    return;
  }
  document.getElementById('partnerList').innerHTML = partners.map(p => `
    <div class="partner-card" onclick="navigate('chat',{partnerId:${p.partner_id}})">
      ${avatarEl(p.name, 'sm')}
      <div class="partner-info">
        <div class="name">${esc(p.name)} ${p.unread_count > 0 ? `<span class="badge" style="position:static;display:inline-block;">${p.unread_count}</span>` : ''}</div>
        <div class="last-msg">${p.last_message ? esc(p.last_message) : ''}</div>
      </div>
      <div style="font-size:12px;color:#65676b;">${p.last_at ? timeAgo(p.last_at) : ''}</div>
    </div>
  `).join('');
}

function startDM(userId) {
  navigate('chat', { partnerId: userId });
}

async function openChat(partnerId) {
  chatPartnerId = partnerId;
  const res = await get(API.messages, { action: 'history', partner_id: partnerId });
  if (res.status !== 'ok') { showError('メッセージの取得に失敗しました'); return; }
  const partner = res.partner;
  document.getElementById('chatPartnerName').textContent = partner ? partner.name : '相手';
  document.getElementById('chatPartnerAvatar').textContent = (partner?.name || '?')[0].toUpperCase();
  renderMessages(res.messages);
  // Poll for new messages every 3 seconds
  chatInterval = setInterval(() => pollNewMessages(partnerId), 3000);
}

async function pollNewMessages(partnerId) {
  const res = await get(API.messages, { action: 'history', partner_id: partnerId });
  if (res.status === 'ok') renderMessages(res.messages);
}

function renderMessages(messages) {
  const container = document.getElementById('chatMessages');
  const wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
  container.innerHTML = messages.map(m => {
    const isMine = m.sender_id == currentUserId;
    const time = new Date(m.sent_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    return `<div style="display:flex;flex-direction:column;align-items:${isMine ? 'flex-end' : 'flex-start'};">
      <div class="chat-bubble ${isMine ? 'mine' : 'theirs'}">${esc(m.content)}</div>
      <div class="chat-time" style="align-self:${isMine ? 'flex-end' : 'flex-start'}">${time}${isMine && m.is_read ? ' ✓既読' : ''}</div>
    </div>`;
  }).join('');
  if (wasAtBottom || messages.length === 0) {
    container.scrollTop = container.scrollHeight;
  }
}

document.getElementById('chatSendBtn').onclick = sendChatMessage;
document.getElementById('chatInput').onkeydown = (e) => { if (e.key === 'Enter') sendChatMessage(); };

async function sendChatMessage() {
  clearFieldError('chatError');
  const content = document.getElementById('chatInput').value.trim();
  if (!content) { showFieldError('chatError', 'メッセージを入力してください'); return; }
  if (new Blob([content]).size > 256) { showFieldError('chatError', 'メッセージは256バイト以下にしてください'); return; }
  const res = await post(API.messages, { action: 'send', receiver_id: chatPartnerId, content });
  if (res.status === 'ok') {
    document.getElementById('chatInput').value = '';
    pollNewMessages(chatPartnerId);
  } else {
    showFieldError('chatError', res.message);
  }
}

document.getElementById('backToMessages').onclick = () => {
  if (chatInterval) { clearInterval(chatInterval); chatInterval = null; }
  navigate('messages');
};

// ---- Notifications ----
async function loadNotifications() {
  document.getElementById('notifList').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  document.getElementById('notifEmpty').style.display = 'none';
  const res = await get(API.notifications, { action: 'list' });
  if (res.status !== 'ok') { showError('通知を取得できませんでした'); return; }
  const notifs = res.notifications;
  document.getElementById('notifBadge').style.display = 'none';
  if (notifs.length === 0) {
    document.getElementById('notifList').innerHTML = '';
    document.getElementById('notifEmpty').style.display = 'block';
    return;
  }
  document.getElementById('notifList').innerHTML = notifs.map(n => `
    <div class="notif-card ${n.is_read ? 'read' : ''}">
      <div>${n.type === 'reply' ? '💬' : '✉️'} ${esc(n.message)}</div>
      <div class="notif-time">${timeAgo(n.created_at)}</div>
    </div>
  `).join('');
}

function startNotifPolling() {
  checkBadges();
  notifInterval = setInterval(checkBadges, 15000);
}

async function checkBadges() {
  // Check unread notifications
  try {
    const res = await get(API.notifications, { action: 'list' });
    if (res.status === 'ok') {
      const unread = res.notifications.filter(n => !n.is_read).length;
      const badge = document.getElementById('notifBadge');
      if (unread > 0) { badge.textContent = unread; badge.style.display = 'inline-block'; }
      else { badge.style.display = 'none'; }
      // Re-mark as unread if we're not on notif page (hack: fetch without marking read)
    }
  } catch(e) {}
}

// ---- Helpers ----
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---- Init ----
async function init() {
  // Check if already logged in
  try {
    const res = await get(API.auth, { action: 'check_session' });
    if (res.status === 'ok') {
      currentUserId = res.user_id;
      startApp();
    }
  } catch(e) {
    // Not logged in, show auth
  }
}

init();
