const SUPABASE_URL = "https://sacwilandxlfaapguusj.supabase.co";
const SUPABASE_ANON = "sb_publishable_38QTFajY5ulzYEu4707KUA_woeEHc5p";
let db = null;

try {
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
} catch (e) {
  console.error(
    "Supabase SDK init failed — check that the CDN script loaded:",
    e,
  );
}

const PRESET_TAGS = [
  "soups",
  "swallow",
  "grains",
  "rice",
  "stew",
  "grilled",
  "street food",
  "snack",
  "combo",
  "quick make",
  "breakfast",
  "vegan",
  "fried",
  "spicy",
  "baked",
  "slow-cooked",
  "steamed",
  "festive",
  "hearty",
  "bread",
  "aromatic",
];

const PAGE_SIZE = 12;

// ── State ──
let currentUser = null;
let savedIds = new Set();
let cachedFoods = [];
let selectedTag = "all";
let foodType = "dish";
let selectedFormTags = new Set();
let availableTags = new Set(PRESET_TAGS);
let currentPage = 0;
let hasMore = true;
let isLoading = false;

// ── Helpers ──
function normalizeFood(f) {
  return { ...f, img: f.img_url, desc: f.description };
}

function showLoader() {
  const el = document.getElementById("loader");
  if (el) el.style.display = "flex";
}

function hideLoader() {
  const el = document.getElementById("loader");
  if (el) el.style.display = "none";
}

function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

// ── Auth ──
async function getSession() {
  if (!db) return;
  const {
    data: { session },
  } = await db.auth.getSession();
  currentUser = session?.user ?? null;
  updateAuthUI();
  if (currentUser) await loadSaved();
}

async function doSignUp() {
  if (!db) {
    toast("database unavailable");
    return;
  }
  const email = document.getElementById("m-email").value.trim();
  const password = document.getElementById("m-pass").value.trim();
  if (!email || !password) {
    toast("fill in email and password ⚡");
    return;
  }
  showLoader();
  const { error } = await db.auth.signUp({ email, password });
  hideLoader();
  if (error) {
    console.error("signUp error:", error);
    toast(error.message);
    return;
  }
  toast("check your email to confirm your account 📬");
  closeModal();
}

async function doLogin() {
  if (!db) {
    toast("database unavailable");
    return;
  }
  const email = document.getElementById("m-email").value.trim();
  const password = document.getElementById("m-pass").value.trim();
  if (!email || !password) {
    toast("fill in email and password ⚡");
    return;
  }
  showLoader();
  const { error } = await db.auth.signInWithPassword({ email, password });
  hideLoader();
  if (error) {
    console.error("login error:", error);
    toast(error.message);
    return;
  }
  await getSession();
  closeModal();
  renderGrid();
  updateSavedCount();
  toast("welcome back! 🍽");
}

async function logOut() {
  if (!db) return;
  await db.auth.signOut();
  currentUser = null;
  savedIds.clear();
  updateAuthUI();
  updateSavedCount();
  renderGrid();
  toast("logged out 👋");
}

function toggleAuth() {
  if (currentUser) {
    showTab("saved");
  } else {
    showModal();
  }
}

function updateAuthUI() {
  const btn = document.getElementById("auth-btn");
  if (!btn) return;
  btn.textContent = currentUser ? `saved (${savedIds.size})` : "log in to save";
}

function showModal() {
  document.getElementById("auth-modal").style.display = "flex";
}

function closeModal() {
  document.getElementById("auth-modal").style.display = "none";
}

// ── Foods ──
async function loadFoods(reset = true) {
  if (!db) return;
  if (isLoading) return;
  if (!hasMore && !reset) return;

  if (reset) {
    currentPage = 0;
    hasMore = true;
    cachedFoods = [];
  }

  isLoading = true;
  if (reset) showLoader();

  try {
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await db
      .from("foods")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    const normalized = (data || []).map(normalizeFood);
    hasMore = normalized.length === PAGE_SIZE;
    currentPage++;

    // Merge any new tags from the DB into availableTags
    normalized.forEach((f) =>
      (f.tags || []).forEach((t) => availableTags.add(t)),
    );

    if (reset) {
      cachedFoods = normalized;
      renderCategoryFilters();
      renderFormTags();
      renderGrid();
    } else {
      cachedFoods = [...cachedFoods, ...normalized];
      renderCategoryFilters();
      renderGrid();
    }

    updateSavedCount();
  } catch (err) {
    console.error("loadFoods error:", err);
    toast("couldn't load foods 😕");
  } finally {
    isLoading = false;
    if (reset) hideLoader();
  }
}

async function loadMoreFoods() {
  await loadFoods(false);
}

async function addFood() {
  if (!db) {
    toast("database unavailable");
    return;
  }
  const name = document.getElementById("f-name").value.trim();
  const imgUrl = document.getElementById("f-img-url").value.trim();
  const customRaw = document.getElementById("f-tags-custom")?.value || "";
  const customTags = customRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const tags = [...selectedFormTags, ...customTags];

  if (!name) {
    toast("food name is required ⚡");
    return;
  }
  if (!imgUrl) {
    toast("an image is required ⚡");
    return;
  }
  if (!tags.length) {
    toast("pick at least one tag ⚡");
    return;
  }

  const country = document.getElementById("f-country").value.trim();
  const desc = document.getElementById("f-desc").value.trim();
  const recipeUrl = document.getElementById("f-recipe-url").value.trim();
  const recipes = recipeUrl ? [recipeUrl] : [];

  showLoader();
  const { error } = await db.from("foods").insert({
    name,
    country: country || null,
    type: foodType,
    tags,
    img_url: imgUrl,
    description: desc || null,
    recipes,
    added_by: currentUser?.id ?? null,
  });
  hideLoader();

  if (error) {
    console.error("addFood error:", error);
    toast("couldn't add food: " + error.message);
    return;
  }

  [
    "f-name",
    "f-country",
    "f-desc",
    "f-tags-custom",
    "f-img-url",
    "f-recipe-url",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  selectedFormTags.clear();
  renderFormTags();
  const preview = document.getElementById("img-preview");
  const placeholder = document.getElementById("upload-placeholder");
  if (preview) preview.style.display = "none";
  if (placeholder) placeholder.style.display = "flex";

  toast("added to the library! 🎉");
  await loadFoods(true);
  showTab("browse");
}

// ── Form tags ──
function renderFormTags() {
  const el = document.getElementById("form-tag-chips");
  if (!el) return;
  el.innerHTML = [...availableTags]
    .map(
      (t) =>
        `<div class="form-chip ${selectedFormTags.has(t) ? "active" : ""}" onclick="toggleFormTag('${t.replace(/'/g, "\\'")}')">
          ${t}
        </div>`,
    )
    .join("");
}

function toggleFormTag(t) {
  if (selectedFormTags.has(t)) {
    selectedFormTags.delete(t);
  } else {
    selectedFormTags.add(t);
  }
  renderFormTags();
}

// ── Saved ──
async function loadSaved() {
  if (!db || !currentUser) return;
  const { data, error } = await db
    .from("saved_foods")
    .select("food_id")
    .eq("user_id", currentUser.id);
  if (error) {
    console.error("loadSaved error:", error);
    return;
  }
  savedIds = new Set((data || []).map((r) => r.food_id));
  updateSavedCount();
}

async function toggleSave(e, id) {
  if (e) e.stopPropagation();
  if (!db) {
    toast("database unavailable");
    return;
  }
  if (!currentUser) {
    showModal();
    toast("log in to save dishes 👆");
    return;
  }

  if (savedIds.has(id)) {
    const { error } = await db
      .from("saved_foods")
      .delete()
      .eq("user_id", currentUser.id)
      .eq("food_id", id);
    if (error) {
      console.error("unsave error:", error);
      return;
    }
    savedIds.delete(id);
    toast("removed from library");
  } else {
    const { error } = await db
      .from("saved_foods")
      .insert({ user_id: currentUser.id, food_id: id });
    if (error) {
      console.error("save error:", error);
      return;
    }
    savedIds.add(id);
    toast("saved to your library 🔖");
  }

  updateSavedCount();
  renderGrid();
  renderSaved();

  const dc = document.getElementById("detail-content");
  if (dc && dc.innerHTML.trim()) showDetail(id);
}

function updateSavedCount() {
  updateAuthUI();
}

function renderSaved() {
  const grid = document.getElementById("saved-grid");
  if (!grid) return;

  if (!currentUser) {
    grid.innerHTML = `<div class="saved-empty">log in to see your saved dishes 🔐</div>`;
    return;
  }

  const saved = cachedFoods.filter((f) => savedIds.has(f.id));
  if (!saved.length) {
    grid.innerHTML = `<div class="empty-state">
      <span class="empty-icon">🏷</span>
      <div class="empty-title">no saved dishes yet</div>
      <div class="empty-text">browse the library and bookmark your favourites!</div>
    </div>`;
    return;
  }

  grid.innerHTML = saved.map((f) => cardHTML(f)).join("");
}

// ── Filters ──
function getAllTags() {
  const counts = {};
  cachedFoods.forEach((f) =>
    (f.tags || []).forEach((t) => {
      counts[t] = (counts[t] || 0) + 1;
    }),
  );
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);
  return ["all", ...sorted];
}

function renderCategoryFilters() {
  const el = document.getElementById("tag-filters");
  const wrap = document.querySelector(".filter-wrap");
  if (!el) return;
  const tags = getAllTags();
  if (wrap) wrap.style.display = tags.length <= 1 ? "none" : "flex";
  el.innerHTML = tags
    .map(
      (t) =>
        `<div class="chip ${selectedTag === t ? "active" : ""}" onclick="setTag('${t.replace(/'/g, "\\'")}')">
          ${t === "all" ? "all" : t}
        </div>`,
    )
    .join("");
}

function setTag(t) {
  selectedTag = t;
  renderCategoryFilters();
  renderGrid();
}

function filterFoods() {
  renderGrid();
}

function scrollFilters(dir) {
  const row = document.getElementById("tag-filters");
  if (row) row.scrollBy({ left: dir * 200, behavior: "smooth" });
}

// ── Render ──
function renderGrid() {
  const q = (
    document.getElementById("search-input")?.value || ""
  ).toLowerCase();
  const list = cachedFoods.filter((f) => {
    const matchTag =
      selectedTag === "all" || (f.tags || []).includes(selectedTag);
    const matchSearch =
      !q ||
      f.name.toLowerCase().includes(q) ||
      (f.country || "").toLowerCase().includes(q) ||
      (f.tags || []).some((t) => t.includes(q));
    return matchTag && matchSearch;
  });

  const grid = document.getElementById("food-grid");
  if (!grid) return;

  if (!list.length && !isLoading) {
    const msg =
      selectedTag !== "all"
        ? `hey, no foods in this category yet — <button onclick="showTab('add')" style="background:none;border:none;color:var(--brand);font-family:inherit;font-size:inherit;cursor:pointer;font-weight:600;padding:0">add one!</button>`
        : `no dishes found — <button onclick="showTab('add')" style="background:none;border:none;color:var(--brand);font-family:inherit;font-size:inherit;cursor:pointer;font-weight:600;padding:0">add one!</button>`;
    grid.innerHTML = `<div class="empty-state">
      <span class="empty-icon">🍽</span>
      <div class="empty-title">nothing here yet</div>
      <div class="empty-text">${msg}</div>
    </div>`;
    return;
  }

  grid.innerHTML = list.map((f) => cardHTML(f)).join("");
}

function cardHTML(f) {
  const isSaved = savedIds.has(f.id);
  const imgContent = f.img
    ? `<img class="card-img" src="${f.img}" alt="${f.name}" loading="lazy" onerror="this.style.display='none'">`
    : `<div class="card-img-placeholder">🍽</div>`;

  return `<div class="card" onclick="showDetail('${f.id}')">
    <div class="card-img-wrap">
      ${imgContent}
      <button class="save-btn ${isSaved ? "saved" : ""}" onclick="toggleSave(event,'${f.id}')" title="${isSaved ? "unsave" : "save"}">
        ${isSaved ? "🔖" : "🏷"}
      </button>
    </div>
    <div class="card-info">
      <div class="card-name">${f.name}</div>
      ${f.country ? `<div class="card-country-tag">${f.country}</div>` : ""}
    </div>
  </div>`;
}

// ── Detail ──
function showDetail(id) {
  const f = cachedFoods.find((x) => x.id === id);
  if (!f) return;

  const isSaved = savedIds.has(f.id);
  const imgHTML = f.img
    ? `<img class="detail-img" src="${f.img}" alt="${f.name}">`
    : `<div class="detail-img-placeholder">🍽</div>`;

  const tagsHTML = (f.tags || [])
    .map((t) => `<span class="detail-chip">${t}</span>`)
    .join("");

  const recipesHTML = (f.recipes || []).length
    ? (f.recipes || [])
        .map(
          (url) =>
            `<a class="recipe-link" href="${url}" target="_blank" rel="noopener"><i class="uil uil-link" style="font-size:16px;flex-shrink:0"></i>${url}</a>`,
        )
        .join("")
    : `<div class="recipe-empty">no recipes yet — be the first to add one!</div>`;

  const similar = cachedFoods
    .filter((x) => x.id !== id)
    .map((x) => ({
      ...x,
      score: (x.tags || []).filter((t) => (f.tags || []).includes(t)).length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const similarHTML = similar.length
    ? `<div class="similar-section">
        <div class="recipes-title">you might also like</div>
        <div class="similar-grid">
          ${similar.map((s) => similarCardHTML(s)).join("")}
        </div>
      </div>`
    : "";

  document.getElementById("detail-content").innerHTML = `
    <button class="back-btn" onclick="showTab('browse')">← back to library</button>
    <div class="detail-layout">
      <div>
        ${imgHTML}
        <button class="submit-btn" style="margin-top:12px" onclick="toggleSave(null,'${id}')">
          ${isSaved ? "🔖 unsave" : "🏷 save to library"}
        </button>
      </div>
      <div>
        <div class="detail-name">${f.name}</div>
        <div class="detail-chips">${tagsHTML}</div>
        ${f.desc ? `<div class="detail-desc">${f.desc}</div>` : ""}
      </div>
    </div>
    <div class="recipes-section">
      <div class="recipes-title">recipes</div>
      <div id="recipe-list-${id}">${recipesHTML}</div>
      <div class="recipe-add">
        <input class="form-input" id="recipe-url-input-${id}" placeholder="Paste a recipe URL to share..." />
        <button class="recipe-add-btn" onclick="addRecipeUrl('${id}')">add</button>
      </div>
    </div>
    ${similarHTML}`;

  setActiveTab("view-detail");
}

function similarCardHTML(f) {
  const imgHTML = f.img
    ? `<img src="${f.img}" alt="${f.name}" loading="lazy" onerror="this.style.display='none'">`
    : `<div class="similar-img-placeholder">🍽</div>`;
  return `<div class="similar-card" onclick="showDetail('${f.id}')">
    ${imgHTML}
    <div class="similar-name">${f.name}</div>
  </div>`;
}

async function addRecipeUrl(id) {
  if (!db) {
    toast("database unavailable");
    return;
  }
  const input = document.getElementById(`recipe-url-input-${id}`);
  const url = input?.value.trim();
  if (!url) return;
  try {
    new URL(url);
  } catch {
    toast("please enter a valid URL ⚡");
    return;
  }

  const f = cachedFoods.find((x) => x.id === id);
  if (!f) return;

  const updatedRecipes = [...(f.recipes || []), url];
  const { error } = await db
    .from("foods")
    .update({ recipes: updatedRecipes })
    .eq("id", id);

  if (error) {
    console.error("addRecipeUrl error:", error);
    toast("couldn't save recipe 😕");
    return;
  }

  f.recipes = updatedRecipes;
  const list = document.getElementById(`recipe-list-${id}`);
  if (list) {
    list.innerHTML = f.recipes
      .map(
        (u) =>
          `<a class="recipe-link" href="${u}" target="_blank" rel="noopener"><i class="uil uil-link" style="font-size:16px;flex-shrink:0"></i>${u}</a>`,
      )
      .join("");
  }
  if (input) input.value = "";
  toast("recipe added! 🍴");
}

// ── Add form ──
function setType(t, btn) {
  foodType = t;
  document
    .querySelectorAll(".type-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
}

function previewUrl() {
  const url = document.getElementById("f-img-url").value.trim();
  const preview = document.getElementById("img-preview");
  const placeholder = document.getElementById("upload-placeholder");
  if (url) {
    preview.src = url;
    preview.style.display = "block";
    placeholder.style.display = "none";
  } else {
    preview.style.display = "none";
    placeholder.style.display = "flex";
  }
}

function setupUploadZone() {
  const zone = document.getElementById("upload-zone");
  const fileInput = document.getElementById("img-file");
  if (!zone || !fileInput) return;

  zone.addEventListener("click", (e) => {
    if (e.target === fileInput) return;
    fileInput.click();
  });

  fileInput.addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById("img-preview");
      const placeholder = document.getElementById("upload-placeholder");
      preview.src = e.target.result;
      preview.style.display = "block";
      placeholder.style.display = "none";
      document.getElementById("f-img-url").value = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dragover");
  });

  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));

  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const preview = document.getElementById("img-preview");
        const placeholder = document.getElementById("upload-placeholder");
        preview.src = ev.target.result;
        preview.style.display = "block";
        placeholder.style.display = "none";
        document.getElementById("f-img-url").value = ev.target.result;
      };
      reader.readAsDataURL(file);
    }
  });
}

// ── Infinite scroll ──
function setupInfiniteScroll() {
  const sentinel = document.getElementById("scroll-sentinel");
  if (!sentinel) return;
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMore && !isLoading) {
        loadMoreFoods();
      }
    },
    { rootMargin: "300px" },
  );
  observer.observe(sentinel);
}

// ── Navigation ──
function showTab(tab) {
  document.getElementById("view-browse").style.display =
    tab === "browse" ? "block" : "none";
  document.getElementById("view-saved").style.display =
    tab === "saved" ? "block" : "none";
  document.getElementById("view-add").style.display =
    tab === "add" ? "block" : "none";
  document.getElementById("view-detail").style.display =
    tab === "detail" ? "block" : "none";
  if (tab === "saved") renderSaved();
  if (tab === "browse") renderGrid();
  if (tab === "add") renderFormTags();
}

function setActiveTab(view) {
  ["view-browse", "view-saved", "view-add", "view-detail"].forEach((v) => {
    document.getElementById(v).style.display = v === view ? "block" : "none";
  });
}

// ── Surprise ──
function surpriseMe() {
  if (!cachedFoods.length) {
    toast("loading dishes... try again in a moment!");
    return;
  }
  const r = cachedFoods[Math.floor(Math.random() * cachedFoods.length)];
  showDetail(r.id);
}

// ── Window exports ──
window.setTag = setTag;
window.filterFoods = filterFoods;
window.scrollFilters = scrollFilters;
window.toggleSave = toggleSave;
window.showDetail = showDetail;
window.addRecipeUrl = addRecipeUrl;
window.surpriseMe = surpriseMe;
window.showTab = showTab;
window.setType = setType;
window.previewUrl = previewUrl;
window.addFood = addFood;
window.toggleAuth = toggleAuth;
window.showModal = showModal;
window.closeModal = closeModal;
window.doLogin = doLogin;
window.doSignUp = doSignUp;
window.toggleFormTag = toggleFormTag;

// ── Init ──
if (db) {
  db.auth.onAuthStateChange(async (_event, session) => {
    const wasLoggedIn = !!currentUser;
    currentUser = session?.user ?? null;
    updateAuthUI();
    if (currentUser && !wasLoggedIn) {
      await loadSaved();
      updateSavedCount();
      renderGrid();
    } else if (!currentUser && wasLoggedIn) {
      savedIds.clear();
      updateSavedCount();
      renderGrid();
    }
  });
}

(async () => {
  renderFormTags();
  await getSession();
  await loadFoods(true);
  setupUploadZone();
  setupInfiniteScroll();
})();
