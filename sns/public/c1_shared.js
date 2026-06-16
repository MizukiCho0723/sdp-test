// C1 UI処理部 - 共通定数・ユーティリティ
// 外部変数(設計書 4章)および各モジュール共通の関数・データ群

const API = {
  auth: '../api/auth.php',
  posts: '../api/posts.php',
  messages: '../api/messages.php',
  profiles: '../api/profiles.php',
  notifications: '../api/notifications.php',
};

// 外部変数
let currentUserId = null;
let currentPage = 'timeline';
let prevPage = null;
let chatPartnerId = null;
let chatInterval = null;
let notifInterval = null;
let otherProfileFrom = null;

// HTTP通信ユーティリティ
function post(url, data) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.append(k, v);
  return fetch(url, { method: 'POST', body: fd }).then(r => r.json());
}

function get(url, params = {}) {
  const qs = new URLSearchParams(params).toString();
  return fetch(url + (qs ? '?' + qs : '')).then(r => r.json());
}

// エラー表示
function showError(msg) {
  document.getElementById('errorDialogMsg').textContent = msg;
  document.getElementById('errorDialog').style.display = 'flex';
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

document.getElementById('errorDialogOk').onclick = () => {
  document.getElementById('errorDialog').style.display = 'none';
};

// XSSエスケープ
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function gradeLabel(g) {
  const map = { 0: '職員', 1: '学部1年', 2: '学部2年', 3: '学部3年', 4: '学部4年',
    5: '修士1年', 6: '修士2年', 7: '博士1年', 8: '博士2年', 9: '博士3年', 10: '博士4年', 11: '教員' };
  return map[g] || '不明';
}

function avatarEl(name, cls = '') {
  const letter = (name || '?')[0].toUpperCase();
  const colors = ['#1877f2', '#e41e3f', '#1a7a1a', '#e67e22', '#8e44ad'];
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

// ---- 所属カスケードデータ ----
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
    '電気電子情報工学専攻', '材料工学専攻', '応用化学専攻', '機械工学専攻',
    'システム理工学専攻', '国際理工学専攻', '社会基盤学専攻', '建築学専攻',
    '地域環境システム専攻', '機能制御システム専攻',
  ],
};

const GRAD_COURSES = {
  masters: ['電気電子情報工学専攻', '材料工学専攻', '応用化学専攻', '機械工学専攻',
    'システム理工学専攻', '国際理工学専攻', '社会基盤学専攻', '建築学専攻'],
  doctoral: ['地域環境システム専攻', '機能制御システム専攻'],
};

const LAB_DATA = {
  '機械工学課程 基幹機械コース(機械工学科)': [
    '生産加工プロセス研究室(青木 孝史朗)', '機械制御工学研究室(内村 裕)', '燃焼工学研究室(斎藤 寛泰)',
    '粒状体力学研究室(佐伯 暢人)', '固体力学研究室(坂上 賢一)', '臨床機械加工研究室(澤 武一)',
    '熱流体理工学研究室(白井 克明)', '応用伝熱工学研究室(丹下 学)', 'エネルギー変換工学研究室(角田 和巳)',
    '離散数学研究室(西村 強)', '材料強度学研究室(橋村 真治)', '生物微小流体工学研究室(二井 信行)',
    '熱工学研究室(矢作 裕司)', '科学技術と社会研究室(栃内 文彦)',
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
  '電気電子情報工学専攻': [], '材料工学専攻': [], '応用化学専攻': [], '機械工学専攻': [],
  'システム理工学専攻': [], '国際理工学専攻': [], '社会基盤学専攻': [], '建築学専攻': [],
  '地域環境システム専攻': [], '機能制御システム専攻': [],
};

// ---- 所属カスケードヘルパー ----
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
    sel.innerHTML = '<option value="">選択してください</option>' +
      labs.map(l => `<option value="${l}">${l}</option>`).join('') +
      '<option value="__other__">その他（自由入力）</option>';
    group.style.display = 'block';
    otherGroup.style.display = 'none';
  } else if (courseKey || faculty) {
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
  if (course) { labs = LAB_DATA[course] || []; }
  else if (faculty) { labs = getAllLabsForFaculty(faculty); }
  else { labs = Object.values(LAB_DATA).flat(); }
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
      courseData.forEach(opt => {
        const o = document.createElement('option'); o.value = opt; o.textContent = opt; sel.appendChild(o);
      });
    } else {
      Object.entries(courseData).forEach(([dept, courses]) => {
        courses.forEach(course => {
          const o = document.createElement('option');
          o.value = dept + ' - ' + course; o.textContent = dept + ' - ' + course; sel.appendChild(o);
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

// ---- 学年・所属カスケード制御 ----
function getGradeCat(grade) {
  const g = parseInt(grade);
  if ([1, 2, 3, 4, 11].includes(g)) return 'faculty';
  if ([5, 6].includes(g)) return 'masters';
  if ([7, 8, 9, 10].includes(g)) return 'doctoral';
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
      const subCourse = document.getElementById(pfx + 'SubCourseSelect').value;
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
      if (prog === '国際プログラム') course += course ? ' [国際プログラム]' : '[国際プログラム]';
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
  updateLabSelect(pfx);
}
