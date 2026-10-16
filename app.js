const config = window.LINEYKA;
const $ = (query) => document.querySelector(query);
const $$ = (query) => [...document.querySelectorAll(query)];

// Neutral draft copy stays visibly identified until the business approves it.
config.faq.forEach(([question, answer], index) => {
  const item = document.createElement('div');
  item.className = 'faq-item';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'faq-question';
  button.id = `question-${index}`;
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', `answer-${index}`);
  const label = document.createElement('span');
  label.textContent = question;
  const icon = document.createElement('span');
  icon.className = 'faq-icon'; icon.textContent = '+'; icon.setAttribute('aria-hidden', 'true');
  button.append(label, icon);
  const panel = document.createElement('div');
  panel.className = 'faq-answer'; panel.id = `answer-${index}`; panel.hidden = true;
  panel.setAttribute('role', 'region'); panel.setAttribute('aria-labelledby', button.id);
  panel.textContent = answer;
  if (config.demoMode) {
    const draft = document.createElement('small');
    draft.textContent = 'Предварительная информация. Условия требуют согласования.';
    panel.append(draft);
  }
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') === 'true';
    $$('.faq-question').forEach((other) => {
      other.setAttribute('aria-expanded', 'false');
      document.getElementById(other.getAttribute('aria-controls')).hidden = true;
    });
    button.setAttribute('aria-expanded', String(!open)); panel.hidden = open;
    scheduleRoute();
  });
  item.append(button, panel); $('#faq-list').append(item);
});

const menu = $('.menu-toggle');
function closeMenu() {
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', 'Открыть меню'); $('#mobile-nav').hidden = true;
}
menu.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  $('#mobile-nav').hidden = !open;
});
$$('#mobile-nav a').forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { closeMenu(); menu.focus(); }
});

$$('.service-select').forEach((button) => {
  button.addEventListener('click', () => {
    const service = $('#service');
    service.value = button.dataset.service;
    service.dispatchEvent(new Event('change', { bubbles: true }));
    $('#form-status').textContent = '';
    $('#service-selection-status').textContent = `Выбрана услуга: ${service.value}. Заполните контактные данные.`;
    const nextField = !$('#name').value.trim() ? $('#name') : !$('#phone').value.trim() ? $('#phone') : service;
    nextField.focus({ preventScroll: true });
    $('#contact').scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start'
    });
  });
});

const isLive = !config.demoMode && /^https:\/\//.test(config.formEndpoint) && /^https:\/\//.test(config.privacyUrl);
if (isLive) {
  $('#demo-notice').hidden = true; $('#consent-label').hidden = false;
  $('#privacy-link').href = config.privacyUrl; $('#consent').required = true;
} else {
  // No personal data are persisted, logged or transmitted in this mode.
  $('#name').autocomplete = 'off'; $('#phone').autocomplete = 'off';
}
function validateField(field) {
  const value = field.value.trim();
  const digits = value.replace(/\D/g, '');
  let error = '';
  if (field.name === 'name' && (value.length < 2 || !/\p{L}/u.test(value))) error = 'Укажите имя: минимум 2 символа.';
  if (field.name === 'phone' && (!/^[+\d\s()−–-]+$/.test(value) || digits.length < 10 || digits.length > 15)) error = 'Укажите телефон: от 10 до 15 цифр.';
  field.setAttribute('aria-invalid', String(Boolean(error)));
  document.getElementById(`${field.name}-error`).textContent = error;
  return !error;
}
for (const field of [$('#name'), $('#phone')]) {
  field.addEventListener('blur', () => { if (field.value) validateField(field); });
  field.addEventListener('input', () => { if (field.getAttribute('aria-invalid') === 'true') validateField(field); });
}
$('#contact-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const fields = [$('#name'), $('#phone')];
  const valid = fields.map(validateField).every(Boolean);
  if (!valid) { fields.find((field) => field.getAttribute('aria-invalid') === 'true').focus(); scheduleRoute(); return; }
  const status = $('#form-status');
  if (isLive && !$('#consent').checked) {
    status.textContent = 'Для отправки необходимо согласие на обработку персональных данных.';
    $('#consent').focus(); return;
  }
  const submit = $('.submit-button');
  submit.disabled = true; submit.textContent = isLive ? 'Отправляем…' : 'Проверяем…';
  status.textContent = '';
  try {
    if (!isLive) {
      await new Promise((resolve) => setTimeout(resolve, 650));
      status.textContent = 'Проверка пройдена. Это деморежим: заявка не отправлена, данные не сохранены.';
    } else {
      const response = await fetch(config.formEndpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: $('#name').value.trim(), phone: $('#phone').value.trim(), service: $('#service').value, consent: true }),
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error('Request failed');
      status.textContent = 'Заявка отправлена. Спасибо за обращение!';
      $('#contact-form').reset(); fields.forEach((field) => field.removeAttribute('aria-invalid'));
    }
  } catch {
    status.textContent = 'Не удалось отправить заявку. Попробуйте ещё раз позже.';
  } finally {
    submit.disabled = false; submit.innerHTML = 'Отправить заявку <span>↗</span>'; scheduleRoute();
  }
});

// The route follows the current section geometry, including expanded desktop panels.
let routeFrame;
function scheduleRoute() { cancelAnimationFrame(routeFrame); routeFrame = requestAnimationFrame(drawRoute); }
function matchType() {
  const width = $('.sheet').getBoundingClientRect().width;
  const scale = width / 941;
  $$('[data-width]').forEach((span) => {
    const section = span.closest('.section');
    const titleScale = width >= 768 && section ? Number(getComputedStyle(section).getPropertyValue('--title-scale')) || 1 : 1;
    const target = Number(span.dataset.width) * titleScale * (width >= 768 ? scale : (span.closest('h1') ? (width < 360 ? .91 : 1) : 1));
    span.style.transform = `scaleX(${target / span.offsetWidth})`;
  });
}
function drawRoute() {
  const sheet = $('.sheet'), base = sheet.getBoundingClientRect(), width = base.width, scale = width / 941;
  const box = (selector) => {
    const r = (typeof selector === 'string' ? $(selector) : selector).getBoundingClientRect();
    return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height, right: r.right - base.left, bottom: r.bottom - base.top };
  };
  const svg = $('.route'); svg.setAttribute('viewBox', `0 0 ${width} ${base.height}`);
  const h = box('.hero-area'), s = box('#services'), p = box('#process'), b = box('#benefits'), f = box('#faq'), c = box('#contact');
  const cta = box('#hero-cta');
  let path, contactPath = '', nodes = [];
  if (width >= 768) {
    const x = (v) => (v * scale).toFixed(2);
    const y = (section, v) => (section.y + v * scale).toFixed(2);
    const cy = cta.y + cta.h / 2;
    path = `M ${cta.right} ${cy} H ${x(435)} Q ${x(460)} ${cy} ${x(477)} ${cy - 24 * scale} L ${x(704)} ${y(h,78)} V 0`;
    const anchors = (selector) => $$(selector).map((el) => { const r = box(el); return { x:r.x, y:r.y }; });
    const services = anchors('.service .route-anchor'), steps = anchors('.steps .route-anchor'), benefits = anchors('.benefit .route-anchor');
    const cards = $$('.service').map(box);
    const gap1 = (cards[0].right + cards[1].x) / 2, gap2 = (cards[1].right + cards[2].x) / 2;
    const low = box('.service img').bottom - 14 * scale;
    const right = width - 35 * scale, radius = 40 * scale;
    const sy = services[0].y, py = steps[0].y;
    path += ` M ${services[0].x} ${sy} H ${gap1-radius} Q ${gap1} ${sy} ${gap1} ${sy+radius} V ${low-radius} Q ${gap1} ${low} ${gap1+radius} ${low} H ${gap2-radius} Q ${gap2} ${low} ${gap2} ${low-radius} V ${sy+radius} Q ${gap2} ${sy} ${gap2+radius} ${sy} H ${right-radius} Q ${right} ${sy} ${right} ${sy+radius} V ${py-radius} Q ${right} ${py} ${right-radius} ${py} H ${steps[0].x}`;
    const left = box('.benefit').x - 30 * scale, by = benefits[0].y, bottom = b.bottom - 65 * scale;
    path += ` M 0 ${bottom} H ${left-radius} Q ${left} ${bottom} ${left} ${bottom-radius} V ${by+radius} Q ${left} ${by} ${left+radius} ${by} H ${right-radius} Q ${right} ${by} ${right} ${by+radius} V ${b.y+230*scale}`;
    const loopBottom = f.bottom - 42 * scale, loopTop = f.y + f.h * .64;
    path += ` M 0 ${loopBottom} H ${x(382)} Q ${x(422)} ${loopBottom} ${x(422)} ${loopBottom-radius} V ${loopTop+radius} Q ${x(422)} ${loopTop} ${x(382)} ${loopTop} H ${x(315)}`;
    contactPath = `M ${x(707)} ${c.y+c.h*.62} L ${x(796)} ${c.y+c.h*.60} Q ${x(800)} ${c.y+c.h*.62} ${x(793)} ${c.y+c.h*.70} L ${x(778)} ${c.y+c.h*.87} Q ${x(770)} ${c.y+c.h*.91} ${x(790)} ${c.y+c.h*.92} L ${x(871)} ${c.y+c.h*.96} Q ${x(896)} ${c.y+c.h*.98} ${x(918)} ${c.bottom}`;
    nodes = [...services,...steps,...benefits];
  } else {
    const gutter = width < 360 ? 12 : 15;
    const bend = width - 16;
    const middle = cta.y + cta.h / 2;
    path = `M ${cta.right} ${middle} H ${bend-20} Q ${bend} ${middle} ${bend} ${middle+20} V ${h.bottom-40} Q ${bend} ${h.bottom-20} ${bend-20} ${h.bottom-20} H ${gutter+20} Q ${gutter} ${h.bottom-20} ${gutter} ${h.bottom} V ${c.bottom-35} Q ${gutter} ${c.bottom-15} ${gutter+20} ${c.bottom-15} H ${width-35}`;
    nodes = $$('.service .route-anchor,.steps .route-anchor,.benefit .route-anchor').map((el) => ({x:gutter,y:el.getBoundingClientRect().top-base.top}));
  }
  $('#route-path').setAttribute('d',path);
  $('#contact-route').setAttribute('d',contactPath);
  $('#route-nodes').replaceChildren(...nodes.map(({x,y}) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
    circle.setAttribute('cx',x); circle.setAttribute('cy',y); circle.setAttribute('r',width >= 768 ? 4.5*scale : 3); return circle;
  }));
}
new ResizeObserver(() => { matchType(); scheduleRoute(); }).observe($('.sheet'));
window.addEventListener('resize', () => { if (innerWidth >= 768) closeMenu(); matchType(); scheduleRoute(); });
document.fonts.ready.then(() => { matchType(); scheduleRoute(); });
window.addEventListener('load', () => { matchType(); scheduleRoute(); });
scheduleRoute();
