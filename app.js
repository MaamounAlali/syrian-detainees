(() => {
  'use strict';

  const data = Array.isArray(window.SEARCH_DATA) ? window.SEARCH_DATA : [];
  const nameInput = document.getElementById('nameInput');
  const motherInput = document.getElementById('motherInput');
  const cityInput = document.getElementById('cityInput');
  const clearButton = document.getElementById('clearButton');
  const resultsEl = document.getElementById('results');
  const emptyState = document.getElementById('emptyState');
  const resultsCount = document.getElementById('resultsCount');
  const recordCount = document.getElementById('recordCount');
  const section = document.querySelector('.results-section');
  const attachmentGallery = document.getElementById('attachmentGallery');
  const imagePreview = document.getElementById('imagePreview');
  const previewImage = document.getElementById('previewImage');
  const previewTitle = document.getElementById('previewTitle');
  const closePreview = document.getElementById('closePreview');
  const previousImage = document.getElementById('previousImage');
  const nextImage = document.getElementById('nextImage');
  const MAX_RESULTS = 150;
  const ATTACHMENT_COUNT = 70;
  let activeImage = 1;

  recordCount.textContent = new Intl.NumberFormat('ar').format(data.length);

  function attachmentPath(number) {
    return `attachments/page-${String(number).padStart(2, '0')}.webp`;
  }

  function showAttachment(number) {
    activeImage = ((number - 1 + ATTACHMENT_COUNT) % ATTACHMENT_COUNT) + 1;
    const arabicNumber = new Intl.NumberFormat('ar').format(activeImage);
    previewImage.src = attachmentPath(activeImage);
    previewImage.alt = `صورة الصفحة ${arabicNumber} من القائمة الأصلية`;
    previewTitle.textContent = `الصورة ${arabicNumber} من ${new Intl.NumberFormat('ar').format(ATTACHMENT_COUNT)}`;
    if (!imagePreview.open) imagePreview.showModal();
  }

  attachmentGallery.innerHTML = Array.from({ length: ATTACHMENT_COUNT }, (_, index) => {
    const number = index + 1;
    const label = new Intl.NumberFormat('ar').format(number);
    return `<button class="attachment-button" type="button" data-attachment="${number}" aria-label="عرض الصورة ${label}">
      <img src="${attachmentPath(number)}" alt="صورة مصغرة للصفحة ${label}" loading="lazy">
      <span>صفحة ${label}</span>
    </button>`;
  }).join('');

  attachmentGallery.addEventListener('click', event => {
    const button = event.target.closest('[data-attachment]');
    if (button) showAttachment(Number(button.dataset.attachment));
  });
  closePreview.addEventListener('click', () => imagePreview.close());
  previousImage.addEventListener('click', () => showAttachment(activeImage - 1));
  nextImage.addEventListener('click', () => showAttachment(activeImage + 1));
  imagePreview.addEventListener('click', event => {
    if (event.target === imagePreview) imagePreview.close();
  });

  const digitMap = {
    '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
    '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'
  };

  function normalizeDigits(value) {
    return String(value || '').replace(/[٠-٩۰-۹]/g, d => digitMap[d] || d);
  }

  function normalizeArabic(value) {
    return normalizeDigits(value)
      .normalize('NFKD')
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ـ/g, '')
      .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function textMatches(haystack, query) {
    if (!query) return true;
    if (!haystack) return false;
    if (haystack.includes(query)) return true;
    const tokens = query.split(' ').filter(Boolean);
    return tokens.length > 1 && tokens.every(token => haystack.includes(token));
  }

  function nameScore(record, query) {
    if (!query) return 0;
    const name = record._normalizedName;
    if (name === query) return 1000;
    if (name.startsWith(query)) return 800 - Math.max(0, name.length - query.length);
    if (name.split(' ').some(word => word.startsWith(query))) return 650;
    if (name.includes(query)) return 500 - name.indexOf(query);
    return 100;
  }

  function highlight(value, rawQuery) {
    const source = String(value || '');
    const q = String(rawQuery || '').trim();
    const safe = escapeHtml(source || 'غير متوفر');
    if (!q) return safe;
    const index = source.indexOf(q);
    if (index < 0) return safe;
    return `${escapeHtml(source.slice(0, index))}<mark>${escapeHtml(source.slice(index, index + q.length))}</mark>${escapeHtml(source.slice(index + q.length))}`;
  }

  function detail(label, value, rawQuery = '') {
    const missing = !String(value || '').trim();
    return `
      <div class="detail">
        <dt>${escapeHtml(label)}</dt>
        <dd class="${missing ? 'missing' : ''}">${missing ? 'غير متوفر' : highlight(value, rawQuery)}</dd>
      </div>`;
  }

  function card(record, queries) {
    return `
      <article class="result-card">
        <div class="result-head">
          <h3 class="result-name">${highlight(record.name, queries.nameRaw)}</h3>
          <span class="result-number">رقم ${escapeHtml(record.number || '—')}</span>
        </div>
        <dl class="details-grid">
          ${detail('اسم الأم', record.mother, queries.motherRaw)}
          ${detail('المدينة', record.city, queries.cityRaw)}
          ${record.other ? detail('معلومات أخرى', record.other) : ''}
        </dl>
      </article>`;
  }

  function showInitial() {
    resultsEl.hidden = true;
    resultsEl.innerHTML = '';
    emptyState.hidden = false;
    emptyState.innerHTML = `
      <h3>ابحث عن اسم في القائمة</h3>
      <p>اكتب حرفين على الأقل في الاسم أو اسم الأم أو المدينة.</p>`;
    resultsCount.textContent = 'ابدأ بإدخال بيانات البحث';
    section.setAttribute('aria-busy', 'false');
  }

  function showNoResults() {
    resultsEl.hidden = true;
    resultsEl.innerHTML = '';
    emptyState.hidden = false;
    emptyState.innerHTML = `
      <h3>لا توجد نتيجة مطابقة</h3>
      <p>جرّب جزءاً أقصر من الاسم، أو احذف أحد حقول البحث لتوسيع النتائج.</p>`;
    resultsCount.textContent = '0 نتيجة';
    section.setAttribute('aria-busy', 'false');
  }

  function search() {
    const nameRaw = nameInput.value.trim();
    const motherRaw = motherInput.value.trim();
    const cityRaw = cityInput.value.trim();

    const nameQ = normalizeArabic(nameRaw);
    const motherQ = normalizeArabic(motherRaw);
    const cityQ = normalizeArabic(cityRaw);

    const hasName = nameQ.length >= 2;
    const hasMother = motherQ.length >= 2;
    const hasCity = cityQ.length >= 2;
    const hasAnyRaw = Boolean(nameRaw || motherRaw || cityRaw);

    clearButton.hidden = !hasAnyRaw;

    if (!hasName && !hasMother && !hasCity) {
      showInitial();
      return;
    }

    section.setAttribute('aria-busy', 'true');
    const matches = [];

    for (const record of data) {
      if (hasName && !textMatches(record._normalizedName, nameQ)) continue;
      if (hasMother && !textMatches(record._normalizedMother, motherQ)) continue;
      if (hasCity && !textMatches(record._normalizedCity, cityQ)) continue;

      matches.push({
        record,
        score: nameScore(record, hasName ? nameQ : '') + (hasMother ? 50 : 0) + (hasCity ? 25 : 0)
      });
    }

    matches.sort((a, b) => b.score - a.score || Number(a.record.number || 0) - Number(b.record.number || 0));

    if (!matches.length) {
      showNoResults();
      return;
    }

    const visible = matches.slice(0, MAX_RESULTS);
    const queries = { nameRaw, motherRaw, cityRaw };
    resultsEl.innerHTML = visible.map(({ record }) => card(record, queries)).join('');
    resultsEl.hidden = false;
    emptyState.hidden = true;

    const nf = new Intl.NumberFormat('ar');
    resultsCount.textContent = matches.length > MAX_RESULTS
      ? `${nf.format(matches.length)} نتيجة — عرض أول ${nf.format(MAX_RESULTS)}`
      : `${nf.format(matches.length)} نتيجة`;

    section.setAttribute('aria-busy', 'false');
  }

  for (const record of data) {
    record._normalizedName = normalizeArabic(record.name);
    record._normalizedMother = normalizeArabic(record.mother);
    record._normalizedCity = normalizeArabic(record.city);
  }

  let timer;
  [nameInput, motherInput, cityInput].forEach(input => {
    input.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(search, 70);
    });
  });

  clearButton.addEventListener('click', () => {
    nameInput.value = '';
    motherInput.value = '';
    cityInput.value = '';
    clearButton.hidden = true;
    showInitial();
    nameInput.focus();
  });

  showInitial();
})();
