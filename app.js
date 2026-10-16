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

// One continuous route. Every coordinate comes from the actual page geometry.
// The connection from the hero to the services travels outside the sheet.
function roundedRoute(points, radius) {
  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const before = distance(a, b), after = distance(b, c);
    if (before < .1 || after < .1) continue;
    const r = Math.min(radius, before / 2, after / 2);
    const p = { x: b.x + (a.x - b.x) * r / before, y: b.y + (a.y - b.y) * r / before };
    const q = { x: b.x + (c.x - b.x) * r / after, y: b.y + (c.y - b.y) * r / after };
    d += ` L ${p.x} ${p.y} Q ${b.x} ${b.y} ${q.x} ${q.y}`;
  }
  const end = points.at(-1); return `${d} L ${end.x} ${end.y}`;
}
let routeFrame;
function scheduleRoute() { cancelAnimationFrame(routeFrame); routeFrame = requestAnimationFrame(drawRoute); }
function drawRoute() {
  const sheet = $('.sheet'), base = sheet.getBoundingClientRect(), width = base.width;
  const rect = (element) => {
    const r = (typeof element === 'string' ? $(element) : element).getBoundingClientRect();
    return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height, right: r.right - base.left, bottom: r.bottom - base.top };
  };
  const point = (x, y) => ({ x, y });
  const anchors = (selector) => $$(selector).map((el) => { const r = rect(el); return point(r.x, r.y); });
  const svg = $('.route'); svg.setAttribute('viewBox', `0 0 ${width} ${base.height}`);
  const cta = rect('#hero-cta'), hero = rect('.hero-area'), services = rect('#services'), process = rect('#process'), benefits = rect('#benefits'), faq = rect('#faq'), contact = rect('#contact');
  let points, nodes;
  if (width < 768) {
    const gutter = width < 360 ? 12 : 16;
    const serviceNodes = anchors('.service .route-anchor');
    const stepNodes = anchors('.steps .route-anchor');
    const benefitNodes = anchors('.benefit .route-anchor');
    points = [point(cta.right, cta.y + cta.h / 2), point(width - 18, cta.y + cta.h / 2), point(width - 18, hero.bottom - 30), point(gutter, hero.bottom - 30), point(gutter, contact.bottom - 25), point(width * .85, contact.bottom - 25)];
    nodes = [...serviceNodes, ...stepNodes, ...benefitNodes].map((p) => point(gutter, p.y));
  } else {
    const s = anchors('.service .route-anchor'), steps = anchors('.steps .route-anchor'), b = anchors('.benefit .route-anchor');
    const photos = $$('.service img').map(rect), gap1 = (photos[0].right + photos[1].x) / 2, gap2 = (photos[1].right + photos[2].x) / 2;
    const serviceLow = photos[0].bottom - width * .015, outside = width + 25;
    const right = width * .951, leftGap = rect('.benefits-grid').x - width * .018;
    const processGap = width * .36;
    const faqLane = rect('.faq-list').x - width * .045;
    points = [point(cta.right - 1, cta.y + cta.h / 2),point(width * .47, cta.y + cta.h / 2), point(width * .83, hero.h * .10),point(width * .83, -20),point(outside,-20),point(outside,services.y + 7),point(s[0].x,services.y + 7),s[0],point(gap1,s[0].y),point(gap1,serviceLow),point(gap2,serviceLow),point(gap2,s[2].y),s[2],point(right,s[2].y),point(right,steps[0].y),...steps.toReversed(),point(processGap,steps[0].y),point(processGap,benefits.y - 14),point(-20,benefits.y - 14),point(-20,benefits.bottom - width * .052),point(leftGap,benefits.bottom - width * .052),point(leftGap,b[0].y),b[0]];
    // Two-row benefit grids follow the same modules without crossing their text.
    const rows = [];
    b.forEach((p) => { let row = rows.find((r) => Math.abs(r[0].y - p.y) < 3); if (!row) { row = []; rows.push(row); } row.push(p); });
    rows.forEach((row, i) => {
      if (i) points.push(point(leftGap,row[0].y),row[0]);
      points.push(...row.slice(i ? 0 : 1),point(right,row[0].y));
      if (i < rows.length - 1) {
        const bottom = rect($$('.benefit')[i * 2 + 1]).bottom + width * .012;
        points.push(point(right,bottom),point(leftGap,bottom));
      }
    });
    // FAQ loop stays entirely to the left of the questions.
    points.push(point(right,benefits.bottom - 8),point(outside,benefits.bottom - 8),point(outside,base.height + 20),point(-20,base.height + 20),point(-20,faq.bottom - 25),point(faqLane,faq.bottom - 25),point(faqLane,faq.y + faq.h * .51),point(width * .334,faq.y + faq.h * .51),point(faqLane,faq.y + faq.h * .51),point(faqLane,faq.bottom - 25),point(-20,faq.bottom - 25),point(-20,contact.bottom - 17),point(width * .83,contact.bottom - 17),point(width * .86,contact.y + contact.h * .64),point(width * .77,contact.y + contact.h * .64));
    nodes = [...s,...steps,...b];
  }
  $('#route-path').setAttribute('d', roundedRoute(points, width < 768 ? 23 : width * .045));
  $('#route-nodes').replaceChildren(...nodes.map((p) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
    circle.setAttribute('cx',p.x); circle.setAttribute('cy',p.y); circle.setAttribute('r',width < 768 ? 3.5 : Math.max(4,width*.0045)); return circle;
  }));
}
new ResizeObserver(scheduleRoute).observe($('.sheet'));
window.addEventListener('resize', () => { if (innerWidth >= 768) closeMenu(); scheduleRoute(); });
document.fonts.ready.then(scheduleRoute);
window.addEventListener('load', scheduleRoute);
scheduleRoute();
