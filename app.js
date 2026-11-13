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
  const draft = document.createElement('small');
  draft.textContent = 'Предварительная информация. Условия требуют согласования.';
  panel.append(draft);
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

const serviceDialog = $('#service-dialog');
let serviceTrigger;
let startedOnBackdrop = false;

$$('.service-select').forEach((button) => {
  button.addEventListener('click', () => {
    serviceTrigger = button;
    $('#service-dialog-title').textContent = button.dataset.service;
    $('#service-dialog-description').textContent = config.services[button.dataset.service];
    serviceDialog.showModal();
  });
});

$('.service-dialog-close').addEventListener('click', () => serviceDialog.close());
serviceDialog.addEventListener('pointerdown', (event) => {
  startedOnBackdrop = event.target === serviceDialog;
});
serviceDialog.addEventListener('click', (event) => {
  if (startedOnBackdrop && event.target === serviceDialog) serviceDialog.close();
  startedOnBackdrop = false;
});
serviceDialog.addEventListener('close', () => {
  if (serviceDialog.open) return;
  serviceTrigger?.focus({ preventScroll: true });
  serviceTrigger = undefined;
  startedOnBackdrop = false;
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
  const h = box('.hero-area'), b = box('#benefits'), f = box('#faq');
  const intro = box('.hero-copy > p');
  const startX = intro.x + 5 * (width >= 768 ? scale : 1);
  let path, nodes = [];
  if (width >= 768) {
    const x = (v) => (v * scale).toFixed(2);
    const y = (section, v) => (section.y + v * scale).toFixed(2);
    const cy = intro.bottom + 20 * scale;
    path = `M ${startX} ${cy} H ${x(435)} Q ${x(460)} ${cy} ${x(477)} ${cy - 24 * scale} L ${x(704)} ${y(h,78)} V 0`;
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
    nodes = [...services,...steps,...benefits];
  } else {
    const gutter = width < 360 ? 12 : 15;
    const bend = width - 16;
    const middle = intro.bottom + 20;
    path = `M ${startX} ${middle} H ${bend-20} Q ${bend} ${middle} ${bend} ${middle+20} V ${h.bottom-40} Q ${bend} ${h.bottom-20} ${bend-20} ${h.bottom-20} H ${gutter+20} Q ${gutter} ${h.bottom-20} ${gutter} ${h.bottom} V ${f.bottom-35} Q ${gutter} ${f.bottom-15} ${gutter+20} ${f.bottom-15} H ${width-35}`;
    nodes = $$('.service .route-anchor,.steps .route-anchor,.benefit .route-anchor').map((el) => ({x:gutter,y:el.getBoundingClientRect().top-base.top}));
  }
  $('#route-path').setAttribute('d',path);
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
