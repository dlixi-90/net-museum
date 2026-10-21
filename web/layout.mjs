import { readFile } from "node:fs/promises";
export const editor = await readFile(
  new URL("./partials/editor.html", import.meta.url),
  "utf8",
);
const icons = await readFile(
  new URL("./partials/icons.html", import.meta.url),
  "utf8",
);
export const routes = [
  ["home", "/", "Trang chủ"],
  ["collection", "/bo-suu-tap/", "Bộ sưu tập"],
  ["discover", "/kham-pha/", "Khám phá"],
  ["stories", "/cau-chuyen/", "Câu chuyện"],
  ["about", "/ve-bao-tang/", "Về bảo tàng"],
];
export function layout({ key, title, description, body }) {
  return `<!doctype html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#ffffff"><title>${title}</title><meta name="description" content="${description}"><link rel="icon" type="image/svg+xml" href="/assets/favicon.svg"><link rel="stylesheet" href="/fonts.css"><link rel="stylesheet" href="/styles.css">${["manage","account"].includes(key) ? '<link rel="stylesheet" href="/manage.css">' : ""}<link rel="stylesheet" href="/gallery.css"><script type="module" src="/app.js"></script>${["manage","account"].includes(key) ? `<script type="module" src="/${key}.js"></script>` : ""}</head><body data-page="${key}"><a class="skip-link" href="#main">Đến nội dung chính</a><header class="museum-header"><div class="gallery-header wrap"><nav id="museum-nav" aria-label="Điều hướng chính">${routes.map(([id, href, label]) => `<a href="${href}"${key === id ? ' class="active" aria-current="page"' : ""}>${label}</a>`).join("")}</nav><a class="gallery-brand" href="/" aria-label="Nét — Trang chủ">nét<span>✳</span><small>ART GALLERY</small></a><div class="gallery-header-actions"><form id="header-search" class="header-search" role="search" action="/bo-suu-tap/" method="get"><label class="visually-hidden" for="header-search-input">Tìm theo tên tác phẩm</label><input id="header-search-input" name="q" type="search" placeholder="Tìm tên tác phẩm…" maxlength="200" autocomplete="off" enterkeyhint="search"><button type="submit" aria-label="Tìm tác phẩm"><svg aria-hidden="true"><use href="#icon-search"/></svg></button></form><a class="saved-link" href="/da-luu/" aria-label="Tác phẩm đã lưu"><svg><use href="#icon-heart"/></svg><span id="saved-count">0</span></a><a id="account-link" class="header-visit" href="/tai-khoan/">Đăng nhập <span aria-hidden="true">↗</span></a><a data-admin-only hidden class="header-visit${key === "manage" ? " is-active" : ""}" href="/quan-ly/">Quản lý <span aria-hidden="true">↗</span></a><button id="mobile-menu-toggle" class="icon-button menu-toggle" aria-label="Mở điều hướng" aria-expanded="false" aria-controls="museum-nav"><span aria-hidden="true">☰</span></button></div></div></header><main id="main">${body}</main><footer class="site-footer"><div class="wrap footer-art"><p>Mỗi người một cách nhìn.<br><em>Gặp nhau trong nghệ thuật.</em></p><a class="circle-link" href="/bo-suu-tap/" aria-label="Khám phá bộ sưu tập">↗</a></div><div class="wrap footer-info"><a class="wordmark" href="/">nét.</a><p>Một bảo tàng trong tầm tay.<br>Một hành trình không vội vã.</p><div><a href="/ve-bao-tang/">Về bảo tàng ↗</a><a data-admin-only hidden href="/quan-ly/">Không gian quản trị ↗</a></div></div><div class="wrap footer-bottom"><span>Nét © 2026 · Dự án bảo tàng nghệ thuật số</span><span>NGẮM CHẬM. CẢM NHẬN SÂU.</span><a href="#main">Lên đầu trang ↑</a></div></footer><p id="app-status" class="visually-hidden" role="status" aria-live="polite"></p>${icons}</body></html>`;
}
export const breadcrumb = (label) =>
  `<div class="breadcrumb wrap"><a href="/">Nét</a><span>/</span><span>${label}</span></div>`;
export const heading = (label) =>
  `${breadcrumb(label)}<h1 class="visually-hidden">${label}</h1>`;

export const galleryTools = `<div class="collection-controls"><div class="filter-tabs" id="category-filters" role="group" aria-label="Nhóm nghệ thuật"></div><button id="advanced-toggle" class="filter-toggle" aria-expanded="false" aria-controls="advanced-filters"><svg><use href="#icon-filter"/></svg> Bộ lọc</button></div><div class="advanced-filters" id="advanced-filters" hidden><label>Niên đại<select id="era-filter"><option value="all">Tất cả niên đại</option><option value="early">Trước thế kỷ XV</option><option value="late">Từ thế kỷ XV</option></select></label><label>Sắp xếp<select id="sort-filter"><option value="curated">Thứ tự trưng bày</option><option value="name">Tên tác phẩm A–Z</option><option value="oldest">Niên đại sớm nhất</option></select></label><button id="reset-filters" class="text-link">Đặt lại ↻</button></div>`;
export const galleryResults =
  '<p id="search-status" class="visually-hidden" role="status" aria-live="polite">Đang mở bộ sưu tập…</p><div id="artwork-grid" class="artwork-grid"></div><div id="empty-state" class="empty-state" hidden><span aria-hidden="true">⌕</span><h2>Một khoảng lặng trong bộ sưu tập.</h2><p>Chưa tìm thấy tác phẩm phù hợp. Hãy thử tên khác hoặc mở rộng bộ lọc.</p><button id="empty-reset" class="button button-dark">Xem tất cả tác phẩm ↗</button></div>';
