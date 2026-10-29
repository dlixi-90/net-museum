import {api, escapeHtml as esc} from './catalog.js';
import {bytes, fileURL, trackView} from './multimedia.js';

// Both galleries and download categories support arrow keys without tabbing
// through every option. Native dialogs provide focus trapping and Escape.
function bindTabs(container, select) {
  const tabs = [...container.querySelectorAll('[role="tab"]')];
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      select(next);
      tabs[next].focus();
    });
  });
}

function selectTab(container, index) {
  container.querySelectorAll('[role="tab"]').forEach((tab, i) => {
    tab.setAttribute('aria-selected', String(i === index));
    tab.tabIndex = i === index ? 0 : -1;
  });
}

function downloadKind(resource) {
  if (['audio', 'video', 'image'].includes(resource.resourceType)) return resource.resourceType;
  const format = (resource.format || resource.originalName?.split('.').pop() || '').toLowerCase();
  if (format) return format;
  if (resource.mimeType === 'application/pdf') return 'pdf';
  if (resource.mimeType?.includes('wordprocessingml')) return 'docx';
  if (resource.resourceType === 'text') return 'txt';
  return 'other';
}

export async function enhanceArtwork(item) {
  const layout = document.querySelector('.detail-layout');
  if (!layout) return;
  const figure = layout.querySelector('.detail-figure');
  const actions = layout.querySelector('.detail-actions');
  const cover = {url: item.image, title: item.title, resourceType: 'image', label: 'Ảnh chính'};
  let resources = [], audio, utterance, loadError = false, loading = true;
  let media = [cover];

  actions.insertAdjacentHTML('beforeend', `
    <button id="speak-description" class="button button-outline" aria-pressed="false" aria-controls="artwork-narration">Nghe thuyết minh ▷</button>
    <button id="artwork-download" class="button button-outline" aria-haspopup="dialog" aria-controls="artwork-download-dialog">Tải xuống ↓</button>`);
  actions.insertAdjacentHTML('afterend', `
    <div id="artwork-narration" class="detail-narration" hidden></div>
    <p class="detail-media-status" role="status" aria-live="polite"></p>`);
  const speak = actions.querySelector('#speak-description');
  const narration = layout.querySelector('#artwork-narration');
  const status = layout.querySelector('.detail-media-status');
  const dialog = document.createElement('dialog');
  dialog.id = 'artwork-download-dialog';
  dialog.className = 'artwork-download-dialog';
  dialog.setAttribute('aria-labelledby', 'download-title');
  dialog.innerHTML = `
    <div class="download-heading"><div><p class="eyebrow">TƯ LIỆU TÁC PHẨM</p><h2 id="download-title">Tải xuống</h2><p class="download-artwork-title">${esc(item.title)}</p></div><button class="icon-button download-close" aria-label="Đóng tải xuống" autofocus>×</button></div>
    <div class="download-body"></div>`;
  layout.append(dialog);
  actions.querySelector('#artwork-download').addEventListener('click', () => dialog.showModal());
  dialog.querySelector('.download-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => actions.querySelector('#artwork-download').focus());
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); dialog.close(); }
  });
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });

  function resetSpeech() {
    speak.textContent = 'Nghe thuyết minh ▷';
    speak.setAttribute('aria-pressed', 'false');
  }
  function stopNarration() {
    audio?.pause();
    if (utterance) { window.speechSynthesis.cancel(); utterance = null; }
    resetSpeech();
  }
  function pauseVideo() { figure.querySelector('video')?.pause(); }

  function renderGallery() {
    const images = resources.filter(r => r.resourceType === 'image');
    const primary = images.find(r => r.purpose === 'cover' || r.url === item.image);
    media = [primary ? {...primary, label: 'Ảnh chính'} : cover,
      ...images.filter(r => r !== primary).map((r, i) => ({...r, label: `Ảnh chi tiết${images.length - (primary ? 1 : 0) > 1 ? ' ' + (i + 1) : ''}`})),
      ...resources.filter(r => r.resourceType === 'video').map((r, i) => ({...r, label: `Video${resources.filter(v => v.resourceType === 'video').length > 1 ? ' ' + (i + 1) : ''}`}))];
    if (!media.some(r => r.resourceType === 'video') && item.video) media.push({url: item.video, title: 'Video giới thiệu: ' + item.title, resourceType: 'video', label: 'Video'});
    figure.innerHTML = `<div class="detail-media-box"><div id="artwork-media-stage" class="zoom-stage" role="tabpanel" tabindex="0"></div><div class="detail-media-tabs" role="tablist" aria-label="Ảnh và video tác phẩm">${media.map((r, i) => `<button id="artwork-media-tab-${i}" class="detail-media-tab" role="tab" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" aria-controls="artwork-media-stage">${r.resourceType === 'video' ? '<span class="media-video-icon" aria-hidden="true">▷</span>' : `<img src="${esc(r.url)}" alt="" loading="lazy">`}<span>${esc(r.label)}</span></button>`).join('')}</div></div>`;
    const tabs = figure.querySelector('[role="tablist"]');
    const stage = figure.querySelector('.zoom-stage');
    function show(index) {
      pauseVideo();
      selectTab(tabs, index);
      stage.setAttribute('aria-labelledby', 'artwork-media-tab-' + index);
      const r = media[index];
      stage.innerHTML = r.resourceType === 'video'
        ? `<video controls playsinline preload="metadata" poster="${esc(item.image)}" src="${esc(r.id ? fileURL(r) : r.url)}" aria-label="${esc(r.title)}"></video>`
        : `<img id="detail-image" src="${esc(r.url)}" alt="${esc(r.title)}">`;
      const element = stage.querySelector('img, video');
      element.addEventListener('error', () => { status.textContent = 'Chưa mở được tư liệu. Vui lòng thử lại hoặc tải tệp trong mục Tải xuống.'; });
      if (r.resourceType === 'video') {
        element.addEventListener('play', stopNarration);
        if (r.id) element.addEventListener('play', () => trackView(r.id), {once: true});
      } else if (r.id) trackView(r.id);
    }
    bindTabs(tabs, show);
    show(0);
  }

  function renderNarration() {
    const recordings = resources.filter(r => r.resourceType === 'audio');
    if (!recordings.length) return;
    stopNarration();
    narration.innerHTML = `${recordings.length > 1 ? `<label class="narration-select">Bản thuyết minh<select aria-label="Chọn bản thuyết minh">${recordings.map((r, i) => `<option value="${i}">${esc(r.title)}</option>`).join('')}</select></label>` : ''}<audio controls preload="none" aria-label="Thuyết minh tác phẩm"></audio><p class="subtle-note narration-note"></p><details class="narration-transcript"><summary>Nội dung thuyết minh</summary><p></p></details>`;
    audio = narration.querySelector('audio');
    function choose(index) {
      stopNarration();
      const r = recordings[index];
      audio.src = fileURL(r);
      audio.setAttribute('aria-label', r.title || 'Thuyết minh tác phẩm');
      narration.querySelector('.narration-note').textContent = r.description || 'Thuyết minh tiếng Việt';
      narration.querySelector('details').hidden = !r.transcript;
      narration.querySelector('details p').textContent = r.transcript || '';
      audio.onplay = () => {
        pauseVideo();
        speak.textContent = 'Tạm dừng ❚❚';
        speak.setAttribute('aria-pressed', 'true');
        trackView(r.id);
      };
    }
    choose(0);
    narration.querySelector('select')?.addEventListener('change', event => choose(Number(event.target.value)));
    audio.addEventListener('pause', resetSpeech);
    audio.addEventListener('ended', resetSpeech);
    audio.addEventListener('error', () => { resetSpeech(); status.textContent = 'Chưa phát được thuyết minh. Bạn có thể tải audio hoặc đọc nội dung thuyết minh.'; });
  }

  speak.addEventListener('click', async () => {
    status.textContent = '';
    if (audio) {
      narration.hidden = false;
      if (!audio.paused) { audio.pause(); return; }
      pauseVideo();
      try { await audio.play(); } catch { resetSpeech(); status.textContent = 'Chưa phát được thuyết minh. Vui lòng thử lại hoặc tải audio.'; }
      return;
    }
    if (utterance) { stopNarration(); return; }
    if (!('speechSynthesis' in window)) { status.textContent = 'Thiết bị chưa hỗ trợ giọng đọc. Bạn có thể đọc mô tả tác phẩm phía trên.'; return; }
    pauseVideo();
    utterance = new SpeechSynthesisUtterance(`${item.title}. ${item.period}. ${item.description}`);
    utterance.lang = 'vi-VN';
    utterance.rate = .88;
    const voice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('vi'));
    if (voice) utterance.voice = voice;
    const finish = () => { utterance = null; resetSpeech(); };
    utterance.onend = finish;
    utterance.onerror = event => { finish(); if (!['canceled', 'interrupted'].includes(event.error)) status.textContent = 'Không phát được giọng đọc. Vui lòng đọc mô tả tác phẩm phía trên.'; };
    speak.textContent = 'Dừng đọc ■';
    speak.setAttribute('aria-pressed', 'true');
    window.speechSynthesis.speak(utterance);
  });
  window.addEventListener('pagehide', () => { stopNarration(); pauseVideo(); });

  function renderDownloads() {
    const body = dialog.querySelector('.download-body');
    if (loading) { body.innerHTML = '<p class="download-empty" role="status">Đang tải danh sách tư liệu…</p>'; return; }
    if (loadError) {
      body.innerHTML = '<p class="download-empty" role="status">Chưa tải được danh sách tư liệu. Vui lòng kiểm tra kết nối.</p><button class="button button-outline download-retry">Thử lại ↻</button>';
      body.querySelector('button').addEventListener('click', loadResources);
      return;
    }
    const groups = new Map([['audio', 'Audio'], ['video', 'Video'], ['pdf', 'PDF'], ['docx', 'DOCX'], ['image', 'Hình ảnh'], ['txt', 'TXT']]);
    resources.forEach(r => { const kind = downloadKind(r); if (!groups.has(kind)) groups.set(kind, kind === 'other' ? 'Khác' : kind.toUpperCase()); });
    const entries = [...groups];
    body.innerHTML = `<div class="download-tabs" role="tablist" aria-label="Loại tệp tải xuống">${entries.map(([key, label], i) => `<button id="download-tab-${i}" role="tab" aria-selected="false" tabindex="-1" aria-controls="download-panel">${esc(label)}<span>${resources.filter(r => downloadKind(r) === key).length}</span></button>`).join('')}</div><div id="download-panel" class="download-panel" role="tabpanel" tabindex="0"></div>`;
    const tabs = body.querySelector('[role="tablist"]'), panel = body.querySelector('[role="tabpanel"]');
    function show(index) {
      selectTab(tabs, index);
      panel.setAttribute('aria-labelledby', 'download-tab-' + index);
      const rows = resources.filter(r => downloadKind(r) === entries[index][0]);
      panel.innerHTML = rows.length ? `<ul class="download-files">${rows.map(r => `<li><div><h3>${esc(r.title || r.originalName || 'Tư liệu')}</h3><p>${esc(r.format || entries[index][1])} · ${bytes(r.sizeBytes)}${r.duration ? ' · ' + Math.round(r.duration) + ' giây' : ''}</p>${r.license ? `<p class="download-license">${esc(r.license)}</p>` : ''}</div><a class="button button-dark" href="${esc(fileURL(r, true))}" download aria-label="Tải ${esc(r.title || r.originalName || 'tư liệu')}">Tải tệp ↓</a></li>`).join('')}</ul>` : `<p class="download-empty">Chưa có tư liệu ${esc(entries[index][1])} cho tác phẩm này.</p>`;
    }
    bindTabs(tabs, show);
    const first = entries.findIndex(([key]) => resources.some(r => downloadKind(r) === key));
    show(Math.max(0, first));
    if (dialog.open) dialog.querySelector('.download-close').focus();
  }

  async function loadResources() {
    loading = true;
    loadError = false;
    renderDownloads();
    try {
      const result = await api('/artworks/' + encodeURIComponent(item.id) + '/resources');
      resources = result.items;
      renderGallery();
      renderNarration();
    } catch {
      loadError = true;
    } finally {
      loading = false;
      renderDownloads();
    }
  }
  renderGallery();
  await loadResources();
}
