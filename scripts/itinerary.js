/* Offline itinerary controls. Travel facts live in the source itinerary. */
(() => {
  'use strict';
  /* Shared clock parsing for the viewer and its local desktop editor. */
const timeRanges = (() => {
 const pad=value=>String(value).padStart(2,'0');
 const clock=(hour,minute,period)=>{
  hour=Number(hour);minute=Number(minute);
  if(minute>59||hour>(period?12:23)||(period&&hour<1))return null;
  return (period?hour%12+(/PM/i.test(period)?12:0):hour)*60+minute;
 };
 function parse(value) {
  const m=/^\s*(\d{1,2}):(\d{2})\s*(AM|PM)?\s*(?:[-–—]|to)\s*(\d{1,2}):(\d{2})\s*(AM|PM)?\s*(·[\s\S]*)?$/i.exec(value);
  if(!m)return null;
  const start=clock(m[1],m[2],m[3]||m[6]),end=clock(m[4],m[5],m[6]||m[3]);
  // A missing AM/PM across noon or midnight is ambiguous; never guess a new time.
  if(Boolean(m[3])!==Boolean(m[6])&&start>end)return null;
  return start===null||end===null?null:{start,end,note:(m[7]||'').replace(/^·\s*/,'')};
 }
 function format(start,end,note='') {
  const label=value=>{const hour=Math.floor(value/60);return pad(hour%12||12)+':'+pad(value%60)+' '+(hour<12?'AM':'PM');};
  return label(start)+' - '+label(end)+(note?' · '+note:'');
 }
 return {parse,format,normalize(value){const range=parse(value);return range?format(range.start,range.end,range.note):value;}};
})();

  const themeKey = 'reminiscence-kl-2026:theme:v1';
  const themeToggle = document.getElementById('theme-toggle');
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  let chosenTheme;
  try { chosenTheme = localStorage.getItem(themeKey); } catch {}
  if (!['light', 'dark'].includes(chosenTheme)) chosenTheme = null;
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeToggle.setAttribute('aria-checked', String(theme === 'dark'));
    themeToggle.title = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  }
  applyTheme(chosenTheme || (systemTheme.matches ? 'dark' : 'light'));
  themeToggle.addEventListener('click', () => {
    chosenTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(chosenTheme);
    try { localStorage.setItem(themeKey, chosenTheme); } catch { /* Switching still works without storage. */ }
  });
  systemTheme.addEventListener('change', () => {
    if (!chosenTheme) applyTheme(systemTheme.matches ? 'dark' : 'light');
  });
  const data = JSON.parse(document.getElementById('itinerary-data').textContent);
  data.days.forEach(day=>day.stops.forEach(stop=>{stop.when=timeRanges.normalize(stop.when);}));
  const tabs = document.getElementById('day-tabs');
  const columns = document.getElementById('columns');
  const panel = document.getElementById('day-panel');
  const dialog = document.getElementById('detail-dialog');
  const content = document.getElementById('dialog-content');
  const close = document.getElementById('close-dialog');
  const optional = document.getElementById('optional-button');
  const desktop = window.matchMedia('(min-width:1000px)');
  const printMedia = window.matchMedia('print');
  const key = 'reminiscence-kl-2026:selected-day:v1';
  let selected = data.days[0].id;
  let returnFocus = null;
  let oldOverflow = '';
  let fitFrame = 0;
  let printing = false;
  const groups = [];
  try {
    const saved = localStorage.getItem(key);
    if (data.days.some(day => day.id === saved)) selected = saved;
  } catch { /* Day selection still works when local storage is blocked. */ }

  const shortTitles = {
    'd1-s1': 'Land at KLIA Terminal 2', 'd1-s2': 'Late check-in, sleep & brunch',
    'd1-s3': 'Grab to Ombak KLCC', 'd1-s4': 'Ombak KLCC & Pokémon pop-up',
    'd1-s5': 'KLCC Park walk', 'd1-s6': 'Suria KLCC quick browse',
    'd1-s7': 'Oriental Kopi dinner', 'd1-s8': 'Twin Towers at dusk',
    'd1-s9': 'Lake Symphony',
    'd2-s1': 'Early transfer to Batu Caves', 'd2-s2': 'Batu Caves & the rainbow stairs',
    'd2-s3': 'Return to Brickfields', 'd2-s4': 'Roti canai breakfast',
    'd2-s5': 'Nasi kandar lunch', 'd2-s6': 'Mon Chinese Beef Roti',
    'd2-s7': 'CHAGEE at WOLO', 'd2-s8': '13DE MARZO Café',
    'd2-s9': 'DON DON DONKI, Lot 10', 'd2-s10': 'KKV Bukit Bintang',
    'd2-s11': 'McDonald’s Bukit Bintang', 'd2-s12': 'Dinner at Damascus',
    'd2-s13': 'Kunafa Finger’s',
    'd3-s1': 'Kaya toast at KL Sentral', 'd3-s2': 'Coach to Awana',
    'd3-s3': 'Awana SkyWay ascent', 'd3-s4': 'Highland views & photos',
    'd3-s5': 'A little SkyAvenue browsing', 'd3-s6': 'Lunch at SkyAvenue',
    'd3-s7': 'Chin Swee & the cable car down', 'd3-s8': 'Coach back & return to KLCC',
    'd3-s9': 'Dinner near Sky Suites',
    'd4-s1': 'Klook pickup at Sky Suites',
    'd4-s2': 'Guided Melaka tour, lunch & river walk',
    'd4-s3': '4 PM departure · KL around 6 PM',
    'd5-s1': 'Conlay MRT → Putrajaya → mosque', 'd5-s2': 'Putra Mosque · up to 1 hour',
    'd5-s3': 'KLIA Transit → KL Sentral → Pasar Seni', 'd5-s4': 'Central Market & lunch',
    'd5-s5': 'Jamboo Café', 'd5-s6': 'REXKL & BookXcess',
    'd5-s7': 'I ♥ KL sculpture', 'd5-s8': 'Merdeka Square',
    'd5-s9': 'Dinner & rest near Pasar Seni', 'd5-s10': 'River of Life night walk',
    'd6-s1': 'Breakfast, packing & checkout', 'd6-s2': 'The Exchange TRX',
    'd6-s3': 'Lindt & chocolate shopping', 'd6-s4': 'Quick TRX rooftop photos',
    'd6-s5': 'Return & collect luggage', 'd6-s6': 'Noon transfer to KLIA Terminal 2',
    'd6-s7': '2:20 PM · airport formalities & lunch', 'd6-s8': 'Boarding · flight departs 6:20 PM'
  };
  data.days.forEach(day => day.stops.forEach(stop => { stop.title ??= shortTitles[stop.id] || stop.name; }));
  const titleFor = stop => stop.title || stop.name;
  data.copy = Object.assign({
    documentTitle: document.title,
    brand: document.querySelector('.wordmark').textContent,
    eyebrow: document.querySelector('.hero .eyebrow').textContent,
    pageTitle: document.getElementById('page-title').textContent,
    people: document.querySelector('.trip-people').textContent,
    tripStamp: document.querySelector('.trip-stamp span:last-child').textContent,
    footer: document.querySelector('.footer > span:first-child').textContent,
    footerHint: document.querySelector('.footer-hint').textContent,
    railTitle: 'KL Rail Guide', railKicker: 'MRT · LRT · KTM · ERL',
    railHelp: 'Scroll up or down over the map to zoom. Drag with the left mouse button to pan. On phones and tablets, pinch with two fingers to zoom and drag with one finger to pan.',
    tripButton: 'Trip details',
    tripTitle: 'Four friends. Six days.', tripKicker: 'The essentials',
    photoCaption: 'Photo reference from the original itinerary; imagery may be illustrative.'
  }, data.copy);
  function applyCopy() {
    document.title = data.copy.documentTitle;
    if (data.brand?.src) {
      const logo = document.getElementById('brand-logo');
      logo.src = data.brand.headerSrc || data.brand.src;
      logo.hidden = false;
      document.getElementById('site-icon').setAttribute('href', data.brand.src);
    }
    for (const [selector, key] of Object.entries({
      '.wordmark':'brand','.hero .eyebrow':'eyebrow','#page-title':'pageTitle',
      '.trip-people':'people','.trip-stamp span:last-child':'tripStamp',
      '.footer > span:first-child':'footer','.footer-hint':'footerHint'
    })) document.querySelector(selector).textContent = data.copy[key];
    for (const [id, key] of [['rail-button','railTitle'],['trip-button','tripButton']]) {
      document.getElementById(id).firstChild.textContent = data.copy[key] + ' ';
    }
  }
  applyCopy();

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function heading(title) {
    const h2 = element('h2', '', title);
    h2.id = 'dialog-title';
    content.append(h2);
  }

  function bulletList(steps, className = 'detail-steps') {
    const list = element('ul', className);
    steps.forEach(step => list.append(element('li', '', step)));
    return list;
  }

  function sentenceSteps(text) {
    const protectedText = text.replace(/\b([A-Z])\.(?=\s+[A-Z][a-z])/g, '$1\uE000');
    return protectedText.split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map(step => step.replaceAll('\uE000', '.').trim()).filter(Boolean);
  }

  function openDialog(kicker, title) {
    returnFocus = document.activeElement;
    dialog.classList.remove('rail-dialog');
    content.replaceChildren();
    document.getElementById('dialog-kicker').textContent = kicker;
    heading(title);
    oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    close.focus({ preventScroll: true });
  }

  function showStop(stop, day) {
    openDialog(`${day.date} · ${stop.category || 'Travel'} · 2026`, titleFor(stop));
    content.append(element('div', 'dialog-time', stop.when));
    if (stop.name !== titleFor(stop)) content.append(element('p', 'detail-place', stop.name));
    if (stop.photo) {
      const photo = element('img', 'dialog-photo');
      photo.src = stop.photo;
      photo.alt = stop.photoAlt;
      content.append(photo, element('p', 'photo-caption', stop.photoCaption ?? data.copy.photoCaption));
    }
    if (stop.travel) {
      content.append(element('span', 'detail-label', 'Getting there'), bulletList(stop.travelSteps || [stop.travel], 'detail-steps travel-steps'));
    }
    if (stop.detail) content.append(element('span', 'detail-label', 'The plan'), bulletList(stop.detailSteps || [stop.detail], 'detail-steps plan-steps'));
    if (stop.cost) content.append(element('span', 'detail-label', 'Budget estimate'), bulletList(sentenceSteps(stop.cost), 'detail-steps detail-cost'));
    if (stop.links.length) {
      const links = element('div', 'map-links');
      stop.links.forEach(link => {
        const a = element('a', '', link.label.replace('📍 ', ''));
        a.href = link.href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        links.append(a);
      });
      content.append(links);
    }
    dialog.scrollTop = 0;
  }

  function stopCard(stop, day) {
    const button = element('button', 'stop-card');
    button.type = 'button';
    button.dataset.stop = stop.id;
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-label', `${stop.when.split(' · ')[0]}, ${titleFor(stop)}. Open details`);
    const media = element('span', 'stop-media');
    media.setAttribute('aria-hidden', 'true');
    if (stop.customPhoto && stop.photo) {
      const thumbnail = element('img', 'activity-thumb');
      thumbnail.src = stop.photo;
      thumbnail.alt = '';
      media.replaceChildren(thumbnail);
      button.classList.add('has-photo');
    }
    const text = element('span', 'stop-text');
    text.append(element('span', 'stop-time', stop.when.split(' · ')[0]), element('span', 'stop-title', titleFor(stop)));
    const arrow = element('span', 'stop-arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    button.append(media, text, arrow);
    button.addEventListener('click', () => showStop(stop, day));
    return button;
  }

  function showGroupPage(group) {
    const cards = group.pages[group.page] || [];
    group.list.replaceChildren(...cards);
    const first = group.pages.slice(0, group.page).reduce((n, page) => n + page.length, 0) + 1;
    group.caption.textContent = group.pages.length > 1
      ? `${first}–${first + cards.length - 1} of ${group.cards.length} stops`
      : `${group.cards.length} ${group.cards.length === 1 ? 'stop' : 'stops'}`;
    group.pager.hidden = group.pages.length < 2;
    group.status.textContent = `${group.page + 1} / ${group.pages.length}`;
    group.previous.disabled = group.page === 0;
    group.next.disabled = group.page === group.pages.length - 1;
  }

  function fitColumns() {
    for (const group of groups) {
      if (!group.cards.length) continue;
      const focused = group.list.contains(document.activeElement) ? document.activeElement : null;
      group.list.replaceChildren(...group.cards);
      const sizes = group.cards.map(card => Math.ceil(card.getBoundingClientRect().height));
      const gap = parseFloat(getComputedStyle(group.list).gap) || 0;
      const capacity = desktop.matches && innerHeight > 520 && !printing && !printMedia.matches
        ? group.list.clientHeight : Infinity;
      const pages = [[]];
      let used = 0;
      group.cards.forEach((card, i) => {
        const height = sizes[i] + (pages[pages.length - 1].length ? gap : 0);
        if (used + height > capacity && pages[pages.length - 1].length) {
          pages.push([]);
          used = 0;
        }
        pages[pages.length - 1].push(card);
        used += sizes[i] + (pages[pages.length - 1].length > 1 ? gap : 0);
      });
      group.pages = pages;
      group.page = Math.min(group.page, pages.length - 1);
      if (focused) group.page = pages.findIndex(page => page.includes(focused));
      showGroupPage(group);
      if (focused) focused.focus({ preventScroll: true });
    }
  }

  function queueFit() {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(fitColumns);
  }

  function renderDay(id, save = true) {
    const day = data.days.find(item => item.id === id);
    if (!day) return;
    selected = id;
    for (const tab of tabs.children) {
      const active = tab.dataset.day === id;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    panel.setAttribute('aria-labelledby', `tab-${id}`);
    document.getElementById('day-date').textContent = `${day.date} · Day ${data.days.indexOf(day) + 1}`;
    document.getElementById('day-title').textContent = day.title;
    document.getElementById('day-subtitle').textContent = day.subtitle;
    const scheduled = day.stops.filter(stop => stop.phase !== 'optional');
    document.getElementById('stop-count').textContent = `${scheduled.length} stops · timings flexible`;
    const extra = day.stops.find(stop => stop.phase === 'optional');
    optional.hidden = !extra;
    optional.onclick = extra ? () => showStop(extra, day) : null;
    columns.replaceChildren();
    groups.length = 0;
    for (const [phase, icon] of [['morning', '☀'], ['afternoon', '◒'], ['evening', '☾']]) {
      const section = element('section', 'phase-column');
      section.setAttribute('aria-label', phase[0].toUpperCase() + phase.slice(1));
      const top = element('div', 'phase-heading');
      const marker = element('span', 'phase-icon', icon);
      marker.setAttribute('aria-hidden', 'true');
      top.append(element('h3', '', phase), marker);
      const list = element('div', 'stop-list');
      const cards = scheduled.filter(stop => stop.phase === phase).map(stop => stopCard(stop, day));
      const footer = element('div', 'column-footer');
      const caption = element('span', 'column-count');
      const pager = element('div', 'pager');
      const previous = element('button', '', '←');
      previous.type = 'button';
      previous.setAttribute('aria-label', `Previous ${phase} stops`);
      const next = element('button', '', '→');
      next.type = 'button';
      next.setAttribute('aria-label', `Next ${phase} stops`);
      const status = element('span', 'page-status');
      status.setAttribute('aria-live', 'polite');
      pager.append(previous, status, next);
      footer.append(caption, pager);
      section.append(top, list, footer);
      columns.append(section);
      if (cards.length) {
        const group = { list, cards, footer, caption, pager, previous, next, status, page: 0, pages: [cards] };
        previous.addEventListener('click', () => { if (group.page > 0) { group.page--; showGroupPage(group); } });
        next.addEventListener('click', () => { if (group.page < group.pages.length - 1) { group.page++; showGroupPage(group); } });
        list.append(...cards);
        groups.push(group);
      } else {
        const message = day.id === 'day6' && phase === 'evening'
          ? 'Flight home at 6:20 PM. Be inside Terminal 2 by 2:20 PM for a four-hour buffer.'
          : 'A little breathing room. Let the day unfold.';
        list.append(element('p', 'empty-note', message));
        footer.hidden = true;
      }
    }
    if (save) {
      try { localStorage.setItem(key, id); } catch { /* Optional preference, not a requirement. */ }
    }
    queueFit();
    document.dispatchEvent(new Event('itinerary-day-change'));
  }

  data.days.forEach((day, i) => {
    const button = element('button', 'day-tab');
    button.type = 'button';
    button.id = `tab-${day.id}`;
    button.dataset.day = day.id;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', 'day-panel');
    const top = element('span', 'tab-top');
    top.append(element('span', 'tab-day', `Day 0${i + 1}`), element('span', 'tab-date', day.date));
    button.append(top, element('span', 'tab-title', day.title));
    button.title = `${day.date} — ${day.title}`;
    button.addEventListener('click', () => renderDay(day.id));
    button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (i + 1) % data.days.length;
      if (event.key === 'ArrowLeft') next = (i - 1 + data.days.length) % data.days.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = data.days.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        renderDay(data.days[next].id);
        tabs.children[next].focus({ preventScroll: true });
      }
    });
    tabs.append(button);
  });

  document.getElementById('rail-button').addEventListener('click', () => {
    openDialog(data.copy.railKicker, data.copy.railTitle);
    dialog.classList.add('rail-dialog');
    content.append(element('p', '', data.copy.railHelp));
    if (data.railMap.sourceUrl) {
      const source = element('p');
      const link = element('a', '', data.railMap.sourceLabel || 'Source PDF');
      link.href = data.railMap.sourceUrl;link.target = '_blank';link.rel = 'noopener noreferrer';
      source.append(link);content.append(source);
    }

    const toolbar = element('div', 'map-toolbar');
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', 'Rail map zoom controls');
    const fit = element('button', '', 'Fit');
    const original = element('button', '', 'Original size');
    const status = element('span', 'map-zoom-status', 'Loading map…');
    status.setAttribute('aria-live', 'polite');
    for (const button of [fit, original]) {
      button.type = 'button';
      button.disabled = true;
    }
    toolbar.append(fit, original, status);

    const viewport = element('div', 'rail-map-viewport');
    viewport.tabIndex = 0;
    viewport.setAttribute('role', 'region');
    viewport.setAttribute('aria-label', 'KL rail map. Mouse wheel to zoom; drag to pan. Touch users can pinch to zoom and drag to pan. Keyboard users can use plus or minus to zoom and arrow keys to pan.');
    const image = element('img', 'rail-map-image');
    image.draggable = false;
    image.alt = data.railMap.alt;
    viewport.append(image);
    content.append(toolbar, viewport);
    let zoom = 1;
    const pointers = new Map();

    // Zoom around the cursor or pinch midpoint, preserving the map position there.
    function zoomAt(nextZoom, x, y, previousX = x, previousY = y) {
      const before = image.getBoundingClientRect();
      if (!before.width || !before.height) return;
      const u = (previousX - before.left) / before.width;
      const v = (previousY - before.top) / before.height;
      zoom = nextZoom;
      drawMap();
      const after = image.getBoundingClientRect();
      viewport.scrollLeft += after.left + u * after.width - x;
      viewport.scrollTop += after.top + v * after.height - y;
    }

    viewport.addEventListener('wheel', event => {
      if (!image.naturalWidth) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
      zoomAt(zoom * Math.exp(-event.deltaY * unit * 0.002), event.clientX, event.clientY);
    }, { passive: false });

    viewport.addEventListener('keydown', event => {
      if (!['+', '=', '-', '_'].includes(event.key) || !image.naturalWidth) return;
      event.preventDefault();
      const box = viewport.getBoundingClientRect();
      zoomAt(zoom * (['+', '='].includes(event.key) ? 1.25 : 0.8),
        box.left + box.width / 2, box.top + box.height / 2);
    });

    function pinch() {
      const [a, b] = [...pointers.values()];
      return {
        x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
        distance: Math.hypot(a.x - b.x, a.y - b.y)
      };
    }

    viewport.addEventListener('pointerdown', event => {
      if ((event.pointerType === 'mouse' && event.button !== 0) || !image.naturalWidth) return;
      event.preventDefault();
      viewport.focus({ preventScroll: true });
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add('is-dragging');
    });
    viewport.addEventListener('pointermove', event => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      event.preventDefault();
      const before = pointers.size >= 2 ? pinch() : null;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (before) {
        const after = pinch();
        if (before.distance > 0) {
          zoomAt(zoom * after.distance / before.distance, after.x, after.y, before.x, before.y);
        }
      } else {
        viewport.scrollLeft += previous.x - event.clientX;
        viewport.scrollTop += previous.y - event.clientY;
      }
    });
    function endDrag(event) {
      if (!pointers.delete(event.pointerId)) return;
      if (!pointers.size) viewport.classList.remove('is-dragging');
      if (viewport.hasPointerCapture(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId);
      }
    }
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('lostpointercapture', endDrag);

    function drawMap() {
      const fitScale = Math.min(1, viewport.clientWidth / image.naturalWidth,
        viewport.clientHeight / image.naturalHeight);
      const maximum = Math.max(4, 1 / fitScale);
      zoom = Math.min(maximum, Math.max(1, zoom));
      const scale = fitScale * zoom;
      image.style.width = `${Math.floor(image.naturalWidth * scale)}px`;
      image.style.height = `${Math.floor(image.naturalHeight * scale)}px`;
      status.textContent = `${Math.round(scale * 100)}%`;
      fit.disabled = false;
      original.disabled = false;
    }

    image.addEventListener('load', () => {
      drawMap();
      dialog.scrollTop = 0;
    }, { once: true });
    image.addEventListener('error', () => {
      status.textContent = 'Map could not load. Reopen the guide to try again.';
    }, { once: true });
    fit.addEventListener('click', () => {
      zoom = 1;
      drawMap();
      viewport.scrollTo(0, 0);
    });
    original.addEventListener('click', () => {
      zoom = 1 / Math.min(1, viewport.clientWidth / image.naturalWidth,
        viewport.clientHeight / image.naturalHeight);
      drawMap();
    });
    const resize = new ResizeObserver(() => {
      if (image.naturalWidth) drawMap();
    });
    resize.observe(viewport);
    dialog.addEventListener('close', () => resize.disconnect(), { once: true });
    image.src = data.railMap.src;
  });

  data.tripFacts ??= [
      ['The group', 'Mac · Neru · Chad · Kim. Four adults, confirmed by Chad.'],
      ['Our base', 'The Sky Suites KLCC by the Park, 18 Jalan P. Ramlee. Deluxe Two Bedroom Apartment, booked Nov 28–Dec 4 for 4 adults.'],
      ['Flying out', 'Cebu Pacific 5J 501. Manila NAIA Terminal 3, Nov 28 at 8:05 PM → KLIA Terminal 2, Nov 29 at 12:10 AM.'],
      ['Flying home', 'Updated by Chad: AirAsia AK 584. KLIA Terminal 2, Dec 4 at 6:20 PM → Manila NAIA Terminal 1, Dec 4 at 10:25 PM. Both are on Dec 4.'],
      ['Arrival night', 'The Nov 28 booking covers the arrival night. The voucher requests 1–2 AM check-in the next day, subject to availability. Host acceptance and access after 2 AM still need confirmation.'],
      ['Departure buffer', 'Leave Sky Suites at 12:00 PM on Dec 4. Be inside KLIA Terminal 2 by 2:20 PM, four hours before the 6:20 PM departure. Lunch is at the airport. Confirm airline check-in and boarding deadlines.'],
      ['Bags & shopping', 'Return documents show 7 kg carry-on per passenger; no checked-baggage add-on is shown. Check later purchases and current allowances before shopping.'],
      ['Melaka tour', 'English join-in tour with professional guide, local lunch and round-trip transfers. Sky Suites KLCC pickup accepted, 7:45–8:15 AM. River walk only. Depart Melaka at 4 PM; expected KL return at 6 PM, traffic permitting. Confirm the return drop-off point.'],
      ['Budget & photos', 'Original costs are planning estimates, using RM1 ≈ ₱14. Confirm whether transport prices are per person or per vehicle. Embedded photo references may be illustrative.']
    ];
  data.tripNotes ??= ['Booking details were reviewed Nov 3, 2026.', 'Reconfirm transport, venue hours, tickets, host access and luggage storage.', 'All times are local. Check flight changes with the airline.'];
  document.getElementById('trip-button').addEventListener('click', () => {
    openDialog(data.copy.tripKicker, data.copy.tripTitle);
    const grid = element('div', 'facts-grid');
    data.tripFacts.forEach(([title, text]) => {
      const fact = element('div', 'fact');
      fact.append(element('h3', '', title), bulletList(sentenceSteps(text)));
      grid.append(fact);
    });
    const notice = element('div', 'notice');
    notice.append(bulletList(data.tripNotes));
    content.append(grid, notice);
    dialog.scrollTop = 0;
  });

  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = oldOverflow;
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  });
  window.addEventListener('resize', queueFit);
  printMedia.addEventListener('change', queueFit);
  window.addEventListener('beforeprint', () => { printing = true; fitColumns(); });
  window.addEventListener('afterprint', () => { printing = false; queueFit(); });
  renderDay(selected, false);

})();
