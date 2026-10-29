import {renderStatistics} from './multimedia.js';
import {enhanceArtwork} from './artwork-detail.js';
import { api, loadCatalog, categoryNames, escapeHtml as esc } from "./catalog.js";
import { filterArtworks } from "./core.js";
import { initHero } from "./hero.js";
import { initAccess, syncAccess, sessionUser } from "./access.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const page = document.body.dataset.page;
initAccess();
if (page === "home") initHero();
function readStore(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
const previous = readStore("net.saved", []);
let saved = new Set(Array.isArray(previous) ? previous.map(String) : []),
  artworks = [];
const params = new URLSearchParams(location.search);
let state = {
  query: params.get("q") || "",
  category: Object.hasOwn(categoryNames, params.get("category"))
    ? params.get("category")
    : "all",
  era: ["early", "late"].includes(params.get("era"))
    ? params.get("era")
    : "all",
  sort: ["name", "oldest"].includes(params.get("sort"))
    ? params.get("sort")
    : "curated",
};
function announce(text) {
  $("#app-status").textContent = text;
}
function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    announce("Trình duyệt chưa cho phép lưu. Thay đổi được giữ trong phiên này.");
  }
}
function updateSaved() {
  $("#saved-count").textContent = saved.size;
  $$("[data-save]").forEach((button) => {
    const active = saved.has(button.dataset.save);
    button.classList.toggle("is-saved", active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute(
      "aria-label",
      active ? "Bỏ lưu tác phẩm" : "Lưu tác phẩm",
    );
    if (button.classList.contains("detail-save"))
      button.innerHTML = `<svg><use href="#icon-heart"/></svg>${active ? "Đã lưu tác phẩm" : "Lưu tác phẩm"}`;
  });
}
let favoritesQueue=Promise.resolve(),favoritesGeneration=0,favoritesOwner=null;
window.addEventListener("net-access-updated",async()=>{
  const user=sessionUser(),owner=user?.id||user?.email||null;if(owner===favoritesOwner)return;favoritesOwner=owner;const generation=++favoritesGeneration;
  if(!user){saved=new Set();persist("net.saved",[]);persist("net.saved.owner",null);updateSaved();if(page==="saved")renderGallery();return;}
  try{const previousOwner=readStore("net.saved.owner",null),guest=previousOwner?[]:[...saved];const result=await api("/favorites");if(generation!==favoritesGeneration)return;const serverIds=new Set(result.ids);for(const id of guest)if(!serverIds.has(id)){try{await api("/favorites/"+encodeURIComponent(id),{method:"PUT"});serverIds.add(id);}catch{}}if(generation!==favoritesGeneration)return;saved=serverIds;persist("net.saved",[...saved]);persist("net.saved.owner",owner);updateSaved();if(page==="saved")renderGallery();}catch(error){announce(error.message);}
});
function toggleSave(id) {
  saved.has(id) ? saved.delete(id) : saved.add(id);
  persist("net.saved", [...saved]);
  if(sessionUser()){const active=saved.has(id),generation=favoritesGeneration;favoritesQueue=favoritesQueue.then(()=>generation===favoritesGeneration?api("/favorites/"+encodeURIComponent(id),{method:active?"PUT":"DELETE"}):null).catch(error=>announce("Chưa đồng bộ mục đã lưu: "+error.message));}
  updateSaved();
  if (page === "saved") renderGallery();
  announce(saved.has(id) ? "Đã giữ lại một cảm hứng." : "Đã bỏ lưu tác phẩm.");
}
const artworkUrl = (id) => "/tac-pham/?id=" + encodeURIComponent(id);
function card(a, index) {
  return `<article class="artwork-card"><div class="artwork-image"><a class="artwork-image-link" href="${artworkUrl(a.id)}" aria-label="Xem ${esc(a.title)}"><img src="${esc(a.image)}" alt="${esc(a.title)}" loading="lazy"><span class="artwork-index">${esc(categoryNames[a.category] || a.categoryLabel)}</span><div class="artwork-caption"><span class="artwork-period">${esc(a.period)}</span><h3 class="card-title">${esc(a.title)} <span aria-hidden="true">↗</span></h3><p class="card-author">${esc(a.author || "Chưa xác định")} · ${esc(a.origin || "Việt Nam")}</p></div></a><button class="artwork-save" data-save="${esc(a.id)}" aria-label="Lưu tác phẩm" aria-pressed="false"><svg><use href="#icon-heart"/></svg></button></div></article>`;
}

function updateLocation() {
  if (page !== "collection") return;
  const next = new URLSearchParams();
  if (state.query) next.set("q", state.query);
  if (state.category !== "all") next.set("category", state.category);
  if (state.era !== "all") next.set("era", state.era);
  if (state.sort !== "curated") next.set("sort", state.sort);
  history.replaceState(
    null,
    "",
    location.pathname + (next.size ? "?" + next : ""),
  );
}
function renderGallery() {
  const list =
    page === "saved"
      ? artworks.filter((a) => saved.has(a.id))
      : filterArtworks(artworks, state);
  $("#artwork-grid").innerHTML = list
    .map((a) => card(a, artworks.indexOf(a)))
    .join("");
  $("#empty-state").hidden = list.length > 0;
  $("#search-status").textContent =
    `${list.length} tác phẩm${state.query && page === "collection" ? " · Tên chứa “" + state.query + "”" : ""}`;
  $$("[data-category]").forEach((b) => {
    const active = b.dataset.category === state.category;
    b.classList.toggle("selected", active);
    b.setAttribute("aria-pressed", String(active));
  });
  updateSaved();
  updateLocation();
}
function resetFilters() {
  state = { query: "", category: "all", era: "all", sort: "curated" };
  $("#header-search-input").value = "";
  for (const [selector, value] of [
    ["#era-filter", "all"],
    ["#sort-filter", "curated"],
  ])
    if ($(selector)) $(selector).value = value;
  renderGallery();
}
function initGallery() {
  if ($("#category-filters"))
    $("#category-filters").innerHTML =
      `<button data-category="all" aria-pressed="true">Tất cả <span>${artworks.length}</span></button>` +
      Object.entries(categoryNames)
        .filter(([key]) => artworks.some((a) => a.category === key))
        .map(
          ([key, label]) =>
            `<button data-category="${key}" aria-pressed="false">${label}</button>`,
        )
        .join("");
  for (const [selector, value] of [
    ["#era-filter", state.era],
    ["#sort-filter", state.sort],
  ])
    if ($(selector)) $(selector).value = value;
  if (state.era !== "all") {
    if ($("#advanced-filters")) $("#advanced-filters").hidden = false;
    $("#advanced-toggle")?.setAttribute("aria-expanded", "true");
  }
  $("#advanced-toggle")?.addEventListener("click", () => {
    const open = $("#advanced-filters").hidden;
    $("#advanced-filters").hidden = !open;
    $("#advanced-toggle").setAttribute("aria-expanded", String(open));
  });
  $("#era-filter")?.addEventListener("change", (e) => {
    state.era = e.target.value;
    renderGallery();
  });
  $("#sort-filter")?.addEventListener("change", (e) => {
    state.sort = e.target.value;
    renderGallery();
  });
  $("#reset-filters")?.addEventListener("click", resetFilters);
  $("#empty-reset")?.addEventListener("click", resetFilters);
  renderGallery();
}
function initHeaderSearch() {
  const form = $("#header-search"),
    input = $("#header-search-input");
  input.value = page === "collection" ? state.query : "";
  input.addEventListener("input", () => {
    if (page !== "collection") return;
    state.query = input.value;
    renderGallery();
  });
  form.addEventListener("submit", (e) => {
    if (page !== "collection") return;
    e.preventDefault();
    state.query = input.value.trim();
    input.value = state.query;
    renderGallery();
    $(".collection").scrollIntoView({ block: "start" });
  });
  $$("[data-focus-search]").forEach((link) =>
    link.addEventListener("click", (e) => {
      e.preventDefault();
      input.scrollIntoView({ block: "center" });
      input.focus({ preventScroll: true });
    }),
  );
}

function renderDetail() {
  const item = artworks.find((a) => a.id === params.get("id"));
  if (!item) {
    $("#artwork-detail").innerHTML =
      '<div class="empty-state"><h1>Chưa tìm thấy tác phẩm này.</h1><p>Tác phẩm có thể đã thay đổi hoặc đường dẫn chưa chính xác.</p><a class="button button-dark" href="/bo-suu-tap/">Trở lại bộ sưu tập ↗</a></div>';
    return;
  }
  const views = readStore("net.views", {}),
    safeViews =
      views && typeof views === "object" && !Array.isArray(views) ? views : {};
  safeViews[item.id] = (Number(safeViews[item.id]) || 0) + 1;
  persist("net.views", safeViews);
  document.title = item.title;
  $("#artwork-detail").innerHTML =
    `<div class="detail-layout"><div class="detail-figure"><div class="zoom-stage"><img id="detail-image" src="${esc(item.image)}" alt="${esc(item.title)}"></div></div><div class="detail-copy"><p class="eyebrow">${esc(categoryNames[item.category] || item.categoryLabel)}</p><h1>${esc(item.title)}</h1><p class="detail-description">${esc(item.description)}</p><dl><div><dt>Niên đại</dt><dd>${esc(item.period)}</dd></div><div><dt>Chất liệu</dt><dd>${esc(item.material || item.originalMedium)}</dd></div><div><dt>Xuất xứ</dt><dd>${esc(item.origin)}</dd></div><div><dt>Ảnh số</dt><dd>${esc(item.format || "Ảnh")} · ${(item.sizeBytes / 1024).toFixed(1)} KB</dd></div></dl><div class="detail-actions"><button class="button button-dark detail-save" data-save="${esc(item.id)}" aria-pressed="false"></button></div><a data-admin-only hidden class="detail-edit action-icon" href="/quan-ly/?edit=${encodeURIComponent(item.id)}" title="Chỉnh sửa hồ sơ tác phẩm" aria-label="Chỉnh sửa hồ sơ tác phẩm: ${esc(item.title)}"><svg aria-hidden="true" focusable="false"><use href="#icon-pencil"/></svg></a></div></div>`;
  syncAccess();
  enhanceArtwork(item);

  const related = artworks
    .filter((a) => a.id !== item.id)
    .sort(
      (a, b) => (b.category === item.category) - (a.category === item.category),
    )
    .slice(0, 3);
  $("#related-artworks").innerHTML = related
    .map((a) => card(a, artworks.indexOf(a)))
    .join("");
  updateSaved();
}
function renderStats(){return renderStatistics($("#stats-content"));}

document.addEventListener("click", (e) => {
  const save = e.target.closest("[data-save]");
  if (save) return toggleSave(save.dataset.save);
  const category = e.target.closest("[data-category]");
  if (category) {
    state.category = category.dataset.category;
    renderGallery();
  }
});
const menu = $("#mobile-menu-toggle");
function closeMenu() {
  $(".museum-header").classList.remove("menu-open");
  menu.setAttribute("aria-expanded", "false");
  menu.setAttribute("aria-label", "Mở điều hướng");
}
menu.addEventListener("click", () => {
  const open = $(".museum-header").classList.toggle("menu-open");
  menu.setAttribute("aria-expanded", String(open));
  menu.setAttribute("aria-label", open ? "Đóng điều hướng" : "Mở điều hướng");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});
window.addEventListener("storage", (e) => {
  if (e.key === "net.saved") {
    const values = readStore("net.saved", []);
    saved = new Set(Array.isArray(values) ? values.map(String) : []);
    updateSaved();
    if (page === "saved") renderGallery();
  }
});
updateSaved();
initHeaderSearch();
if (["home", "collection", "saved", "artwork", "stats"].includes(page)) {
  try {
    const result = await loadCatalog();
    artworks = result.items.map((a) => ({ ...a, id: String(a.id) }));
    if (page === "home") {
      $("#home-artworks").innerHTML = artworks
        .slice(0, 2)
        .map((a, i) => card(a, i))
        .join("");
      $("#curated-artworks").innerHTML = artworks
        .slice(2, 5)
        .map((a, i) => card(a, i + 2))
        .join("");
      updateSaved();
    }
    if (["collection", "saved"].includes(page)) initGallery();
    if (page === "artwork") renderDetail();
    if (page === "stats") renderStats();
  } catch {
    const target =
      $("#artwork-grid") || $("#home-artworks") || $("#artwork-detail");
    if (target)
      target.textContent =
        "Chưa tải được bộ sưu tập. Vui lòng kiểm tra kết nối và tải lại trang.";
  }
}
