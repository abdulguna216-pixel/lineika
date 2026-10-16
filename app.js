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

// The approved route is rebuilt from the section geometry. Deliberate exits
// and re-entries are exactly those visible in the approved reference.
let routeFrame;
function scheduleRoute() { cancelAnimationFrame(routeFrame); routeFrame = requestAnimationFrame(drawRoute); }
function matchType() {
  const width = $('.sheet').getBoundingClientRect().width;
  const scale = width / 941;
  $$('[data-width]').forEach((span) => {
    const target = Number(span.dataset.width) * (width >= 768 ? scale : (span.closest('h1') ? (width < 360 ? .91 : 1) : 1));
    span.style.transform = `scaleX(${target / span.offsetWidth})`;
  });
}
function drawRoute() {
  const sheet = $('.sheet'), base = sheet.getBoundingClientRect(), width = base.width, scale = width / 941;
  const box = (selector) => {
    const r = $(selector).getBoundingClientRect();
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
    path += ` M ${x(314)} ${y(s,31)} H ${x(407)} Q ${x(448)} ${y(s,31)} ${x(448)} ${y(s,72)} V ${y(s,179)} Q ${x(448)} ${y(s,224)} ${x(493)} ${y(s,224)} H ${x(646)} Q ${x(690)} ${y(s,224)} ${x(690)} ${y(s,180)} V ${y(s,74)} Q ${x(690)} ${y(s,31)} ${x(733)} ${y(s,31)} H ${x(853)} Q ${x(894)} ${y(s,31)} ${x(894)} ${y(s,72)} V ${y(p,30)} Q ${x(894)} ${y(p,73)} ${x(851)} ${y(p,73)} H ${x(357)}`;
    path += ` M 0 ${y(b,186)} H ${x(262)} Q ${x(297)} ${y(b,186)} ${x(297)} ${y(b,151)} V ${y(b,65)} Q ${x(297)} ${y(b,26)} ${x(336)} ${y(b,26)} H ${x(825)} Q ${x(864)} ${y(b,26)} ${x(864)} ${y(b,65)} V ${y(b,99)}`;
    const faqBottom = f.h / scale - 25;
    path += ` M 0 ${y(f,faqBottom)} H ${x(383)} Q ${x(422)} ${y(f,faqBottom)} ${x(422)} ${y(f,faqBottom-39)} V ${y(f,126)} Q ${x(422)} ${y(f,86)} ${x(382)} ${y(f,86)} H ${x(315)}`;
    contactPath = `M ${x(707)} ${y(c,140)} L ${x(796)} ${y(c,135)} Q ${x(800)} ${y(c,140)} ${x(793)} ${y(c,157)} L ${x(778)} ${y(c,188)} Q ${x(770)} ${y(c,200)} ${x(790)} ${y(c,201)} L ${x(871)} ${y(c,208)} Q ${x(896)} ${y(c,212)} ${x(918)} ${c.bottom}`;
    nodes = [[314,y(s,31)],[523,y(s,31)],[741,y(s,31)],[357,y(p,73)],[460,y(p,73)],[571,y(p,73)],[690,y(p,73)],[826,y(p,73)],[335,y(b,26)],[517,y(b,26)],[718,y(b,26)]].map(([cx,cy]) => ({ x: cx * scale, y:Number(cy) }));
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
