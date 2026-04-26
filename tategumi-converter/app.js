/* ── State ── */
const state = {
  files: [],        // { name, text } sorted by filename
  currentIdx: 0,
  fontSize: 20,
  theme: 'sepia',
  sidebarOpen: true,
  imageMap: {},     // filename/path → blobURL
};

/* ── DOM refs ── */
const uploadScreen  = document.getElementById('uploadScreen');
const readerScreen  = document.getElementById('readerScreen');
const folderInput   = document.getElementById('folderInput');
const fileList      = document.getElementById('fileList');
const bookPage      = document.getElementById('bookPage');
const topbarTitle   = document.getElementById('topbarTitle');
const prevPage      = document.getElementById('prevPage');
const nextPage      = document.getElementById('nextPage');
const pageInfo      = document.getElementById('pageInfo');
const sidebar       = document.getElementById('sidebar');

const IMAGE_EXTS = /\.(png|jpe?g|gif|webp|svg|bmp)$/i;

/* ── File / Folder upload ── */
async function loadFiles(rawFiles) {
  const allFiles  = Array.from(rawFiles);
  const mdFiles   = allFiles.filter(f => f.name.endsWith('.md'));
  const imgFiles  = allFiles.filter(f => IMAGE_EXTS.test(f.name));

  if (mdFiles.length === 0) {
    alert('.md ファイルが見つかりませんでした。');
    return;
  }

  // 古いBlobURLを解放
  Object.values(state.imageMap).forEach(url => URL.revokeObjectURL(url));
  state.imageMap = {};

  // 画像をBlobURLに変換（ファイル名・相対パスの両方をキーに登録）
  imgFiles.forEach(f => {
    const blobUrl = URL.createObjectURL(f);
    state.imageMap[f.name] = blobUrl;
    if (f.webkitRelativePath) state.imageMap[f.webkitRelativePath] = blobUrl;
  });

  mdFiles.sort((a, b) =>
    (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, 'ja')
  );

  state.files = await Promise.all(mdFiles.map(async f => ({
    name: f.webkitRelativePath || f.name,
    displayName: f.name.replace(/\.md$/, ''),
    text: await f.text(),
  })));

  state.currentIdx = 0;
  initReader();
}

document.getElementById('fileInput').addEventListener('change', e => loadFiles(e.target.files));
folderInput.addEventListener('change', e => loadFiles(e.target.files));

/* ── Init reader ── */
function initReader() {
  uploadScreen.classList.add('hidden');
  readerScreen.classList.remove('hidden');

  applyTheme(state.theme);
  buildFileList();
  renderPage(state.currentIdx);
}

/* ── Build sidebar file list ── */
function buildFileList() {
  fileList.innerHTML = '';
  state.files.forEach((f, i) => {
    const li = document.createElement('li');
    li.textContent = f.displayName;
    li.dataset.idx = i;
    li.addEventListener('click', () => {
      renderPage(i);
      // スマホ時はサイドバーを閉じる
      if (window.innerWidth <= 700) toggleSidebar(false);
    });
    fileList.appendChild(li);
  });
}

/* ── Render a page ── */
function renderPage(idx) {
  state.currentIdx = idx;

  // サイドバーのアクティブ状態
  fileList.querySelectorAll('li').forEach((li, i) => {
    li.classList.toggle('active', i === idx);
  });

  const file = state.files[idx];
  topbarTitle.textContent = file.displayName;

  // Markdown → HTML → 縦書き表示
  const html = marked.parse(file.text);
  bookPage.innerHTML = html;

  // 記号を縦書き用Unicodeに変換
  verticalizeTextNodes(bookPage);

  // 画像srcをBlobURLに差し替え
  bookPage.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || '';
    if (!src || src.startsWith('http') || src.startsWith('blob:') || src.startsWith('data:')) return;

    // 相対パス完全一致 → ファイル名のみで検索の順に試みる
    const basename = src.split('/').pop();
    const resolved = state.imageMap[src] || state.imageMap[basename];
    if (resolved) img.src = resolved;
  });

  // レイアウト確定後に読み始め位置をリセット（右端から）
  const main = document.getElementById('readerMain');
  requestAnimationFrame(() => { main.scrollLeft = main.scrollWidth; });

  updateNav();
}

/* ── Navigation ── */
function updateNav() {
  const total = state.files.length;
  const cur   = state.currentIdx + 1;
  pageInfo.textContent = `${cur} / ${total}`;
  prevPage.disabled = state.currentIdx <= 0;
  nextPage.disabled = state.currentIdx >= total - 1;
}

prevPage.addEventListener('click', () => {
  if (state.currentIdx > 0) renderPage(state.currentIdx - 1);
});

nextPage.addEventListener('click', () => {
  if (state.currentIdx < state.files.length - 1) renderPage(state.currentIdx + 1);
});

// キーボード操作
document.addEventListener('keydown', (e) => {
  if (readerScreen.classList.contains('hidden')) return;
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowDown')  nextPage.click();
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp')    prevPage.click();
});

/* ── Font size ── */
document.getElementById('fontLarge').addEventListener('click', () => {
  state.fontSize = Math.min(state.fontSize + 2, 40);
  bookPage.style.fontSize = state.fontSize + 'px';
});

document.getElementById('fontSmall').addEventListener('click', () => {
  state.fontSize = Math.max(state.fontSize - 2, 12);
  bookPage.style.fontSize = state.fontSize + 'px';
});

/* ── Theme ── */
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    applyTheme(btn.dataset.theme);
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

function applyTheme(theme) {
  state.theme = theme;
  document.body.className = `theme-${theme}`;
}

/* ── Sidebar toggle ── */
document.getElementById('sidebarToggle').addEventListener('click', () => {
  toggleSidebar(!state.sidebarOpen);
});

function toggleSidebar(open) {
  state.sidebarOpen = open;
  sidebar.classList.toggle('closed', !open);
}

/* ── Back to upload ── */
document.getElementById('backBtn').addEventListener('click', () => {
  readerScreen.classList.add('hidden');
  uploadScreen.classList.remove('hidden');
  folderInput.value = '';
  state.files = [];
});

/* ── Scroll with mouse wheel (横スクロール補助) ── */
document.getElementById('readerMain').addEventListener('wheel', (e) => {
  e.preventDefault();
  e.currentTarget.scrollLeft -= e.deltaY * 2;
}, { passive: false });


/* ── 縦書き記号変換 ── */
const VERTICAL_MAP = [
  [/\(/g,  '︵'],  // 半角左丸括弧
  [/\)/g,  '︶'],  // 半角右丸括弧
  [/（/g,  '︵'],  // 全角左丸括弧
  [/）/g,  '︶'],  // 全角右丸括弧
  [/\[/g,  '﹇'],  // 半角左角括弧
  [/\]/g,  '﹈'],  // 半角右角括弧
  [/【/g,  '︻'],  // 全角左隅付き括弧
  [/】/g,  '︼'],  // 全角右隅付き括弧
  [/〔/g,  '︹'],  // 亀甲括弧
  [/〕/g,  '︺'],
  [/〈/g,  '︿'],  // 山括弧
  [/〉/g,  '﹀'],
  [/《/g,  '︽'],  // 二重山括弧
  [/》/g,  '︾'],
  [/—/g,   '︱'],  // emダッシュ
  [/–/g,   '︲'],  // enダッシュ
  [/ - /g, '\u3000︲\u3000'], // 前後スペース付きハイフン
];

function verticalizeTextNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const tag = node.parentElement?.tagName;
      // コードブロックは変換しない
      if (tag === 'CODE' || tag === 'PRE') return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes = [];
  let node;
  while ((node = walker.nextNode())) nodes.push(node);

  nodes.forEach(node => {
    let t = node.textContent;
    VERTICAL_MAP.forEach(([pat, rep]) => { t = t.replace(pat, rep); });
    node.textContent = t;
  });
}

/* ── Default theme ── */
applyTheme('sepia');
document.querySelector('[data-theme="sepia"]').classList.add('active');
