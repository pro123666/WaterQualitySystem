// 数据删除页逻辑（由 delete.html 在 water_quality.js 之后引入）
// ========== 数据删除（保留模板已渲染行，不再二次渲染） ==========
let deleteConfirmRow = null;

function getServerRows() {
  const table = document.querySelector('#pageDelete table');
  if (!table) return [];
  const allRows = Array.from(table.querySelectorAll('tr'));
  return allRows.filter(tr => !tr.closest('thead') && !tr.closest('#deleteTableBody'));
}

function rowPayload(tr) {
  if (tr.dataset.pointId) {
    return {
      point_id: tr.dataset.pointId || '',
      date: tr.dataset.date || '',
      FCR: tr.dataset.fcr || '',
      ECR: tr.dataset.ecr || '',
      PH: tr.dataset.ph || '',
      ORP: tr.dataset.orp || '',
      NTU: tr.dataset.ntu || '',
    };
  }

  const cells = Array.from(tr.children);
  return {
    point_id: (cells[1]?.textContent || '').trim(),
    date: (cells[2]?.textContent || '').trim(),
    FCR: (cells[3]?.textContent || '').trim(),
    ECR: (cells[4]?.textContent || '').trim(),
    PH: (cells[5]?.textContent || '').trim(),
    ORP: (cells[6]?.textContent || '').trim(),
    NTU: (cells[7]?.textContent || '').trim(),
  };
}

function decorateRowsOnce() {
  getServerRows().forEach(tr => {
    if (tr.dataset.decorated === '1') return;
    tr.dataset.decorated = '1';

    // 先缓存模板原始7列数据，避免后续插入复选框/操作列后索引错位
    const rawCells = Array.from(tr.children);
    tr.dataset.pointId = (rawCells[0]?.textContent || '').trim();
    tr.dataset.date = (rawCells[1]?.textContent || '').trim();
    tr.dataset.fcr = (rawCells[2]?.textContent || '').trim();
    tr.dataset.ecr = (rawCells[3]?.textContent || '').trim();
    tr.dataset.ph = (rawCells[4]?.textContent || '').trim();
    tr.dataset.orp = (rawCells[5]?.textContent || '').trim();
    tr.dataset.ntu = (rawCells[6]?.textContent || '').trim();

    const cbCell = document.createElement('td');
    cbCell.innerHTML = '<input type="checkbox" class="delete-row-cb" />';
    tr.insertBefore(cbCell, tr.firstElementChild);

    const opCell = document.createElement('td');
    opCell.innerHTML = '<button class="btn btn-danger" style="padding:4px 12px;font-size:12px;" data-del-row="1">删除</button>';
    tr.appendChild(opCell);

    tr.querySelector('.delete-row-cb')?.addEventListener('change', updateDeleteBatchBtn);
    tr.querySelector('[data-del-row="1"]')?.addEventListener('click', () => {
      deleteConfirmRow = tr;
      document.getElementById('deleteConfirmModal').classList.add('show');
    });
  });
}

function applyFilters() {
  const point = (document.getElementById('deleteQueryPoint')?.value || '').trim();
  const start = document.getElementById('deleteQueryStart')?.value || '';
  const end = document.getElementById('deleteQueryEnd')?.value || '';

  getServerRows().forEach(tr => {
    const p = rowPayload(tr);
    const matchPoint = !point || (p.point_id || '').includes(point);
    const matchStart = !start || (p.date || '').slice(0, 10) >= start;
    const matchEnd = !end || (p.date || '').slice(0, 10) <= end;
    tr.style.display = (matchPoint && matchStart && matchEnd) ? '' : 'none';
    if (tr.style.display === 'none') {
      const cb = tr.querySelector('.delete-row-cb');
      if (cb) cb.checked = false;
    }
  });

  document.getElementById('deletePagination').innerHTML = '';
  updateDeleteBatchBtn();
}

// 兼容基模板 initCurrentPage() 中对 loadDeleteTable 的调用
async function loadDeleteTable() {
  decorateRowsOnce();
  applyFilters();
}

function updateDeleteBatchBtn() {
  const checked = getServerRows()
    .filter(tr => tr.style.display !== 'none')
    .map(tr => tr.querySelector('.delete-row-cb'))
    .filter(Boolean)
    .filter(cb => cb.checked);
  const batchBtn = document.getElementById('deleteBatchBtn');
  if (batchBtn) batchBtn.disabled = checked.length === 0;
}

function buildDeletePayload(tr) {
  const payload = rowPayload(tr);
  payload.point_id = (payload.point_id || '').trim();
  payload.date = (payload.date || '').trim().slice(0, 10);
  ['FCR', 'ECR', 'PH', 'ORP', 'NTU'].forEach(k => {
    const v = (payload[k] || '').trim();
    payload[k] = (v === 'None' || v === 'null') ? '' : v;
  });
  return payload;
}

function validateDeletePayload(payload) {
  if (!payload.point_id || !payload.date) {
    throw new Error('缺少 point_id 或 date');
  }
  const same = (getData() || []).filter(r => {
    const d = (r.date || '').slice(0, 10);
    return (r.pointId || '') === payload.point_id && d === payload.date;
  });
  if (same.length === 0) {
    throw new Error('当前条件未匹配到记录（point_id + date）');
  }
  if (same.length > 1) {
    throw new Error('当前条件匹配到多条记录，后端 delete 无法唯一删除');
  }
}

/** 单条删除：用原生表单 POST，避免 fetch 在服务端异常时出现 net::ERR_CONNECTION_RESET 且难以排查 */
function submitDeleteForm(payload) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = '/delete';
  form.style.display = 'none';
  Object.keys(payload).forEach(k => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = k;
    input.value = payload[k] == null ? '' : String(payload[k]);
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

/** 批量等场景仍用 fetch（需多次请求） */
async function postDeleteByRowFetch(tr) {
  const payload = buildDeletePayload(tr);
  validateDeletePayload(payload);
  const body = new URLSearchParams(payload);
  const resp = await fetch('/delete', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body,
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`HTTP ${resp.status} ${txt.slice(0, 200)}`);
  }
  tr.remove();
}

document.getElementById('deleteQueryBtn')?.addEventListener('click', () => {
  applyFilters();
});

document.getElementById('deleteConfirmCancel')?.addEventListener('click', () => {
  document.getElementById('deleteConfirmModal').classList.remove('show');
  deleteConfirmRow = null;
});

document.getElementById('deleteConfirmOk')?.addEventListener('click', () => {
  if (!deleteConfirmRow) return;
  try {
    const payload = buildDeletePayload(deleteConfirmRow);
    validateDeletePayload(payload);
    document.getElementById('deleteConfirmModal').classList.remove('show');
    deleteConfirmRow = null;
    submitDeleteForm(payload);
  } catch (e) {
    console.error(e);
    toast(`删除失败：${e.message || '未知错误'}`, 'error');
  }
});

document.getElementById('deleteBatchBtn')?.addEventListener('click', async () => {
  const rows = getServerRows().filter(tr => {
    if (tr.style.display === 'none') return false;
    const cb = tr.querySelector('.delete-row-cb');
    return !!cb && cb.checked;
  });
  if (rows.length === 0) return;
  if (!confirm(`确定删除选中的 ${rows.length} 条数据？此操作不可恢复。`)) return;

  let ok = 0;
  for (const tr of rows) {
    try {
      await postDeleteByRowFetch(tr);
      ok++;
    } catch (e) {
      console.error(e);
    }
  }
  if (ok > 0) toast(`批量删除成功：${ok} 条`, 'success');
  if (ok < rows.length) toast(`部分删除失败：${rows.length - ok} 条`, 'warning');
  applyFilters();
});

document.getElementById('deleteSelectAll')?.addEventListener('change', e => {
  const checked = !!e.target.checked;
  getServerRows().forEach(tr => {
    if (tr.style.display === 'none') return;
    const cb = tr.querySelector('.delete-row-cb');
    if (cb) cb.checked = checked;
  });
  updateDeleteBatchBtn();
});

loadDeleteTable();
