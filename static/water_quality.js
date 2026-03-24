// 水质监测主脚本：配置来自 #wq-bootstrap（textarea 内嵌 JSON，由服务端渲染）
const _wqBootEl = document.getElementById('wq-bootstrap');
let _boot = { logoutUrl: '/logout', currentPage: 'entry', serverData: [] };
try {
  if (_wqBootEl && _wqBootEl.textContent && _wqBootEl.textContent.trim()) {
    _boot = JSON.parse(_wqBootEl.textContent);
  }
} catch (e) {
  console.error('wq-bootstrap JSON parse failed', e);
}
const LOGOUT_URL = _boot.logoutUrl || '/logout';
const CURRENT_PAGE = _boot.currentPage || 'entry';
const SERVER_DATA = Array.isArray(_boot.serverData) ? _boot.serverData : [];

let waterData = SERVER_DATA.slice();

function getData() {
  return waterData;
}
function saveData(arr) {
  waterData = arr;
}

// 阈值（只保存在内存变量）
const THRESHOLD_DEF = { FCR: 0.3, PHMin: 6.5, PHMax: 8.5, ECR: 1000, ORP: 500, NTU: 1 };
let threshold = { ...THRESHOLD_DEF };

// 告警 handled 状态与 alertTime（同样只在内存中保留）
let alertHandledMap = {}; // recordId -> true
let alertTimeMap = {}; // recordId -> iso string

// ========== 校验规则 ==========
const RULES = {
  pointId: v => /^[A-Za-z0-9\-]+$/.test(v) && v.length >= 2,
  date: v => /^\d{4}-\d{2}-\d{2}$/.test(v),
  FCR: v => v >= 0 && v <= 5,
  ECR: v => v >= 0 && v <= 2000,
  PH: v => v >= 0 && v <= 14,
  ORP: v => v >= -1000 && v <= 1000,
  NTU: v => v >= 0 && v <= 1000,
};
const MSG = {
  pointId: '监测点编号需为数字/字母组合，至少2位',
  date: '请选择有效日期',
  FCR: '余氯需在 0.00~5.00 之间',
  ECR: '电导率需在 0~2000 之间',
  PH: 'PH 值需在 0.00~14.00 之间',
  ORP: 'ORP 需在 -1000~1000 之间',
  NTU: '浊度需在 0~1000 之间',
};

function validateEntry() {
  return true;
}

function validateEdit() {
  const fields = ['FCR', 'ECR', 'PH', 'ORP', 'NTU'];
  const ids = { FCR: 'editFCR', ECR: 'editECR', PH: 'editPH', ORP: 'editORP', NTU: 'editNTU' };
  const errIds = { FCR: 'errEditFCR', ECR: 'errEditECR', PH: 'errEditPH', ORP: 'errEditORP', NTU: 'errEditNTU' };
  let valid = true;
  fields.forEach(f => {
    const el = document.getElementById(ids[f]);
    const errEl = document.getElementById(errIds[f]);
    const val = parseFloat(el.value);
    if (isNaN(val)) {
      el.classList.add('error');
      errEl.textContent = '此项必填';
      valid = false;
    } else if (!RULES[f](val)) {
      el.classList.add('error');
      errEl.textContent = MSG[f];
      valid = false;
    } else {
      el.classList.remove('error');
      errEl.textContent = '';
    }
  });
  return valid;
}

// ========== Toast ==========
function toast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ========== 路由（按当前页面类型初始化） ==========
function initCurrentPage() {
  const pageMap = {
    entry: { id: 'pageEntry', name: '数据录入' },
    edit: { id: 'pageEdit', name: '数据修改' },
    delete: { id: 'pageDelete', name: '数据删除' },
    query: { id: 'pageQuery', name: '数据查询' },
    alert: { id: 'pageAlert', name: '超标告警' },
  };
  const cfg = pageMap[CURRENT_PAGE] || pageMap.entry;
  const el = document.getElementById(cfg.id);
  if (el) {
    el.classList.add('active');
  }
  const nav = document.querySelector(`.nav-item[data-page="${CURRENT_PAGE}"]`);
  if (nav) {
    nav.classList.add('active');
  }
  const breadcrumb = document.getElementById('breadcrumb');
  if (breadcrumb) {
    breadcrumb.textContent = '首页 → ' + cfg.name;
  }

  if (CURRENT_PAGE === 'edit') {
    loadEditPointsDatalist().catch(e => { console.error(e); });
    loadEditTable().catch(e => { console.error(e); toast('加载编辑页失败', 'error'); });
  }
  if (CURRENT_PAGE === 'delete') loadDeleteTable().catch(e => { console.error(e); toast('加载删除页失败', 'error'); });
  if (CURRENT_PAGE === 'query') {
    buildQueryIndicators();
    loadQueryTable().catch(e => { console.error(e); toast('加载查询失败', 'error'); });
  }
  if (CURRENT_PAGE === 'alert') loadAlertPage().catch(e => { console.error(e); toast('加载告警失败', 'error'); });
}

document.getElementById('sidebarLogout')?.addEventListener('click', () => {
  document.getElementById('logoutModal').classList.add('show');
});
document.getElementById('topbarLogout')?.addEventListener('click', () => {
  document.getElementById('logoutModal').classList.add('show');
});
document.getElementById('settingsLogout')?.addEventListener('click', () => {
  document.getElementById('logoutModal').classList.add('show');
});
document.getElementById('logoutCancel')?.addEventListener('click', () => {
  document.getElementById('logoutModal').classList.remove('show');
});
document.getElementById('logoutOk')?.addEventListener('click', () => {
  document.getElementById('logoutModal').classList.remove('show');
  window.location.href = LOGOUT_URL;
});

// ========== 数据录入 ==========

// ========== 数据修改 ==========
async function loadEditPointsDatalist() {
  const dl = document.getElementById('editPointDatalist');
  if (!dl) return;
  const points = [...new Set(getData().map(r => r.pointId).filter(Boolean))].sort();
  dl.innerHTML = points.map(p => `<option value="${p}"></option>`).join('');
}

const PAGE_SIZE = 10;
let editPage = 1, editFiltered = [];

async function loadEditTable() {
  const point = document.getElementById('editQueryPoint')?.value?.trim() || '';
  const start = document.getElementById('editQueryStart')?.value || '';
  const end = document.getElementById('editQueryEnd')?.value || '';
  let list = getData();
  if (point) list = list.filter(r => (r.pointId || '').includes(point));
  if (start) list = list.filter(r => r.date >= start);
  if (end) list = list.filter(r => r.date <= end);
  list.sort(
    (a, b) => (b.date || '').localeCompare(a.date || '') || ((b.id || 0) - (a.id || 0))
  );
  editFiltered = list;
  editPage = 1;
  renderEditTable(); // 清空表格
}

function renderEditTable() {
  const tbody = document.getElementById('editTableBody');
  const pag = document.getElementById('editPagination');
  // 清空表格（不渲染任何行）
  tbody.innerHTML = '';
  pag.innerHTML = '';
}

document.getElementById('editQueryBtn')?.addEventListener('click', () => {
  loadEditTable().catch(e => { console.error(e); toast('加载编辑数据失败', 'error'); });
});

// ===== 静态渲染的编辑按钮（来自 edit.html 循环） =====
function openEditModalFromRow(btn) {
  const tr = btn.closest('tr');
  if (!tr) return;

  const cells = Array.from(tr.children);
  // 约定：0 point_id, 1 date, 2 FCR, 3 ECR, 4 PH, 5 ORP, 6 NTU, 7 操作按钮列
  const pointId = cells[0]?.textContent?.trim() || '';
  const date = cells[1]?.textContent?.trim() || '';
  const fcr = cells[2]?.textContent?.trim() || '';
  const ecr = cells[3]?.textContent?.trim() || '';
  const ph = cells[4]?.textContent?.trim() || '';
  const orp = cells[5]?.textContent?.trim() || '';
  const ntu = cells[6]?.textContent?.trim() || '';

  const recordId = parseInt(btn.dataset.editId);
  document.getElementById('editId').value = recordId || '';
  document.getElementById('editPoint').value = pointId;
  document.getElementById('editDate').value = date;

  document.getElementById('editFCR').value = (fcr && fcr !== 'None') ? fcr : '';
  document.getElementById('editECR').value = (ecr && ecr !== 'None') ? ecr : '';
  document.getElementById('editPH').value = (ph && ph !== 'None') ? ph : '';
  document.getElementById('editORP').value = (orp && orp !== 'None') ? orp : '';
  document.getElementById('editNTU').value = (ntu && ntu !== 'None') ? ntu : '';

  ['errEditFCR', 'errEditECR', 'errEditPH', 'errEditORP', 'errEditNTU'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });

  document.getElementById('editModal').classList.add('show');
}

document.querySelectorAll('[data-edit-id]').forEach(btn => {
  if (btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', () => openEditModalFromRow(btn));
});

function openEditModal(id) {
  const r = editFiltered.find(x => x.id === id);
  if (!r) return;
  document.getElementById('editId').value = r.id;
  document.getElementById('editPoint').value = r.pointId || '';
  document.getElementById('editDate').value = r.date;
  document.getElementById('editFCR').value = r.FCR ?? '';
  document.getElementById('editECR').value = r.ECR ?? '';
  document.getElementById('editPH').value = r.PH ?? '';
  document.getElementById('editORP').value = r.ORP ?? '';
  document.getElementById('editNTU').value = r.NTU ?? '';
  ['errEditFCR','errEditECR','errEditPH','errEditORP','errEditNTU'].forEach(id => document.getElementById(id).textContent = '');
  document.getElementById('editModal').classList.add('show');
}

document.getElementById('editModalCancel')?.addEventListener('click', () => {
  document.getElementById('editModal').classList.remove('show');
});

document.getElementById('editModalSave')?.addEventListener('click', async () => {
  if (!validateEdit()) return;
  const id = parseInt(document.getElementById('editId').value);
  const payload = {
    // 给你的 edit() 逻辑/接口提供完整字段（point_id/date + 5项指标）
    point_id: (document.getElementById('editPoint').value || '').trim(),
    date: (document.getElementById('editDate').value || '').trim(),
    FCR: parseFloat(document.getElementById('editFCR').value),
    ECR: parseFloat(document.getElementById('editECR').value),
    PH: parseFloat(document.getElementById('editPH').value),
    ORP: parseFloat(document.getElementById('editORP').value),
    NTU: parseFloat(document.getElementById('editNTU').value),
  };

  const data = getData();
  const idx = data.findIndex(x => x.id === id);
  if (idx < 0) return;
  data[idx] = { ...data[idx], ...payload };
  saveData(data);
  document.getElementById('editModal').classList.remove('show');
  toast('保存成功', 'success');
  loadEditTable();
});

// ========== 数据查询 ==========
const INDICATORS = [
  { key: 'FCR', label: '余氯', unit: 'mg/L' },
  { key: 'ECR', label: '电导率', unit: 'μS/cm' },
  { key: 'PH', label: 'PH值', unit: '' },
  { key: 'ORP', label: 'ORP', unit: 'mV' },
  { key: 'NTU', label: '浊度', unit: 'NTU' },
];

function buildQueryIndicators() {
  const container = document.getElementById('queryIndicators');
  if (!container) return;
  container.innerHTML = INDICATORS.map((ind, i) => `
    <div class="form-group" style="flex: 0 0 220px;">
      <label>${ind.label} ${ind.unit}</label>
      <div style="display:flex;gap:4px;">
        <select id="qOp${ind.key}" style="flex:0 0 70px;">
          <option value="gt">大于</option>
          <option value="lt">小于</option>
          <option value="eq">等于</option>
        </select>
        <input type="number" id="qVal${ind.key}" step="0.01" placeholder="可选" style="flex:1" />
      </div>
    </div>
  `).join('');
}
// 只有在查询页才需要构建指标，其他页面不调用

let queryFiltered = [], queryPage = 1;

async function loadQueryTable() {
  const point = document.getElementById('queryPoint').value.trim();
  const start = document.getElementById('queryStart').value;
  const end = document.getElementById('queryEnd').value;
  const logic = document.getElementById('queryLogic').value;
  let list = getData();
  if (point) list = list.filter(r => (r.pointId || '').includes(point));
  if (start) list = list.filter(r => r.date >= start);
  if (end) list = list.filter(r => r.date <= end);
  const conditions = [];
  INDICATORS.forEach(ind => {
    const op = document.getElementById('qOp' + ind.key)?.value;
    const val = parseFloat(document.getElementById('qVal' + ind.key)?.value);
    if (op && !isNaN(val)) conditions.push({ key: ind.key, op, val });
  });
  if (conditions.length > 0) {
    list = list.filter(r => {
      const matches = conditions.map(c => {
        const v = r[c.key];
        if (v == null) return false;
        if (c.op === 'gt') return v > c.val;
        if (c.op === 'lt') return v < c.val;
        return Math.abs(v - c.val) < 0.001;
      });
        return logic === 'and' ? matches.every(Boolean) : matches.some(Boolean);
    });
  }
  list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || ((b.id || 0) - (a.id || 0)));
  queryFiltered = list;
  queryPage = 1;
  renderQueryTable();
}

function renderQueryTable() {
  const start = (queryPage - 1) * PAGE_SIZE;
  const chunk = queryFiltered.slice(start, start + PAGE_SIZE);
  document.getElementById('queryTableBody').innerHTML = chunk.map(r => `
    <tr>
      <td>${r.pointId || '-'}</td>
      <td>${r.date}</td>
      <td>${r.FCR ?? '-'}</td>
      <td>${r.ECR ?? '-'}</td>
      <td>${r.PH ?? '-'}</td>
      <td>${r.ORP ?? '-'}</td>
      <td>${r.NTU ?? '-'}</td>
    </tr>
  `).join('');
  const total = queryFiltered.length;
  const pag = document.getElementById('queryPagination');
  pag.innerHTML = `
    <button ${queryPage <= 1 ? 'disabled' : ''} data-page="prev">上一页</button>
    <span class="page-info">${queryPage} / ${Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>
    <button ${queryPage >= Math.ceil(total / PAGE_SIZE) ? 'disabled' : ''} data-page="next">下一页</button>
  `;
  pag.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      if (b.dataset.page === 'prev') queryPage--;
      else queryPage++;
      renderQueryTable();
    });
  });
}

document.getElementById('queryBtn')?.addEventListener('click', () => {
  loadQueryTable().catch(e => { console.error(e); toast('加载查询数据失败', 'error'); });
});
document.getElementById('queryReset')?.addEventListener('click', () => {
  document.getElementById('queryPoint').value = '';
  document.getElementById('queryStart').value = '';
  document.getElementById('queryEnd').value = '';
  document.getElementById('queryLogic').value = 'and';
  INDICATORS.forEach(ind => {
    const el = document.getElementById('qVal' + ind.key);
    if (el) el.value = '';
  });
});

document.querySelector('.query-section.collapsible .query-header')?.addEventListener('click', () => {
  const body = document.querySelector('.query-section.collapsible .query-body');
  const toggle = document.getElementById('queryToggle');
  body.classList.toggle('collapsed');
  toggle.textContent = body.classList.contains('collapsed') ? '▶ 展开' : '▼ 收起';
});

// ========== 超标告警 ==========
function computeAlerts() {
  const data = getData();
  const th = threshold;
  const alerts = [];
  const nowIso = new Date().toISOString();

  data.forEach(r => {
    const over = [];
    if (r.FCR != null && r.FCR > th.FCR) over.push({ name: '余氯', val: r.FCR, th: th.FCR });
    if (r.PH != null && (r.PH < th.PHMin || r.PH > th.PHMax)) over.push({ name: 'PH', val: r.PH, th: th.PHMin + '~' + th.PHMax });
    if (r.ECR != null && r.ECR > th.ECR) over.push({ name: '电导率', val: r.ECR, th: th.ECR });
    if (r.ORP != null && r.ORP < th.ORP) over.push({ name: 'ORP', val: r.ORP, th: th.ORP });
    if (r.NTU != null && r.NTU > th.NTU) over.push({ name: '浊度', val: r.NTU, th: th.NTU });

    if (over.length > 0) {
      const recordId = r.id;
      if (!alertTimeMap[recordId]) alertTimeMap[recordId] = nowIso;
      alerts.push({
        recordId,
        pointId: r.pointId,
        date: r.date,
        over,
        handled: !!alertHandledMap[recordId],
        alertTime: alertTimeMap[recordId],
      });
    }
  });

  alerts.sort((a, b) => (b.alertTime || '').localeCompare(a.alertTime || ''));
  return alerts;
}

async function loadAlertPage() {
  const th = threshold;
  const alerts = computeAlerts();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const todayCount = alerts.filter(a => a.alertTime.startsWith(todayStr)).length;
  const weekCount = alerts.filter(a => a.alertTime >= weekStartStr).length;
  document.getElementById('statToday').textContent = todayCount;
  document.getElementById('statWeek').textContent = weekCount;
  document.getElementById('thFCR').value = th.FCR;
  document.getElementById('thPHMin').value = th.PHMin;
  document.getElementById('thPHMax').value = th.PHMax;
  document.getElementById('thECR').value = th.ECR;
  document.getElementById('thORP').value = th.ORP;
  document.getElementById('thNTU').value = th.NTU;
  const tbody = document.getElementById('alertTableBody');
  tbody.innerHTML = alerts.map(a => {
    const overStr = a.over.map(o => o.name).join(', ');
    const valStr = a.over.map(o => o.val + (o.th ? ' (阈值:' + o.th + ')' : '')).join('; ');
    return `
      <tr>
        <td>${a.pointId || '-'}</td>
        <td>${a.date}</td>
        <td>${overStr}</td>
        <td class="cell-overlimit">${valStr}</td>
        <td>${a.over.map(o => o.th).join('; ')}</td>
        <td>${a.alertTime.slice(0, 16)}</td>
      </tr>
    `;
  }).join('');
}

document.getElementById('thresholdToggle')?.addEventListener('click', () => {
  document.querySelector('.threshold-panel').classList.toggle('collapsed');
});

// ========== 导航 ==========
// 侧边栏导航现在直接是普通链接，无需额外 JS

// 点击模态框遮罩关闭（不关闭确认类弹窗）
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay && overlay.id !== 'deleteConfirmModal' && overlay.id !== 'logoutModal') {
      overlay.classList.remove('show');
    }
  });
});
