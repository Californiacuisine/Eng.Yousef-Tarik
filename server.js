'use strict';
// منصة م. يوسف طارق - Backend بدون أي مكتبات خارجية (Node 18+)
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = +process.env.PORT || 3000;
const DATA = path.join(__dirname, 'data'), UP = path.join(DATA, 'uploads'), PUB = path.join(__dirname, 'public');
fs.mkdirSync(UP, { recursive: true });

/* ---------- أدوات الأمان ---------- */
const rid = () => crypto.randomBytes(6).toString('hex');
const SECRET = process.env.SECRET || (() => { const f = path.join(DATA, '.secret'); try { return fs.readFileSync(f, 'utf8'); } catch { const s = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(f, s); return s; } })();
const hp = (p, s = crypto.randomBytes(16).toString('hex')) => s + ':' + crypto.scryptSync(String(p), s, 32).toString('hex');
const cp = (p, h) => { try { const [s, x] = h.split(':'); return crypto.timingSafeEqual(Buffer.from(x, 'hex'), crypto.scryptSync(String(p), s, 32)); } catch { return false; } };
const sign = o => { const p = Buffer.from(JSON.stringify(o)).toString('base64url'); return p + '.' + crypto.createHmac('sha256', SECRET).update(p).digest('base64url'); };
const unsign = t => { try { const [p, s] = String(t).split('.'); const e = crypto.createHmac('sha256', SECRET).update(p).digest('base64url'); if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null; const o = JSON.parse(Buffer.from(p, 'base64url')); return o.exp > Date.now() ? o : null; } catch { return null; } };
const hits = new Map();
const rl = (k, max, ms) => { const n = Date.now(), a = (hits.get(k) || []).filter(t => n - t < ms); a.push(n); hits.set(k, a); if (a.length > max) throw { s: 429, m: 'محاولات كثيرة، انتظر قليلاً ثم حاول مرة أخرى' }; };
const S = (x, n = 200) => String(x ?? '').trim().slice(0, n);

/* ---------- قاعدة البيانات (ملف JSON بكتابة ذرّية) ---------- */
const DBF = path.join(DATA, 'db.json');
let db; try { db = JSON.parse(fs.readFileSync(DBF, 'utf8')); } catch { }
if (!db) {
  const L = (t, q, h) => ({ id: rid(), title: t, items: [], quiz: q, hw: h });
  db = {
    settings: { name: 'Eng. Yousef Tarik in Math', teacher: 'م. يوسف طارق', hero: 'أقوى منصة لتعلّم الرياضيات', sub: 'شرح واضح، تدريبات ذكية، وامتحانات بتتصحح لوحدها. ابدأ من دلوقتي وخلّي الماث أسهل مادة عندك.', whatsapp: '201000000000', phone: '01000000000', footer: '© جميع الحقوق محفوظة - م. يوسف طارق', color: '#f7941d', logo: '/assets/logo.png', photo: '/assets/teacher.png' },
    users: [{ id: rid(), name: 'Admin', phone: process.env.ADMIN_PHONE || 'admin', pass: hp(process.env.ADMIN_PASS || 'admin123'), role: 'admin' }],
    courses: [{ id: 'demo', title: 'التفاضل - الصف الثالث الثانوي', desc: 'شرح كامل مع تدريبات وامتحانات', img: '', price: 1000, oldPrice: 1500, free: false, hidden: false, lessons: [
      L('الحصة 1: النهايات', [{ q: 'نهاية 2x عندما x تؤول إلى 3', o: ['3', '6', '9'], a: 1 }, { q: 'مشتقة x²', o: ['x', '2x', 'x³'], a: 1 }], [{ q: 'مشتقة 5x', o: ['5', 'x', '5x'], a: 0 }]),
      L('الحصة 2: قواعد الاشتقاق', [{ q: 'مشتقة عدد ثابت', o: ['0', '1', 'x'], a: 0 }], [{ q: 'مشتقة x³', o: ['3x', '3x²', 'x²'], a: 1 }])] }],
    enroll: {}, progress: {}, tickets: []
  };
}
{ const DS = { colors: { p: '#7c3aed', s: '#a78bfa', bgD: '#0c0a1d', cdD: '#181433', txD: '#f5f3ff', bgL: '#f6f4ff', cdL: '#ffffff', txL: '#1e1b4b' }, ui: { radius: 22, cardEffect: 'tilt', symbols: true, reveal: true, recs: true, tops: true }, icons: {}, centers: [], texts: {}, recIds: [], tops: [], css: '', social: { facebook: '', instagram: '', tiktok: '', youtube: '' }, guideTitle: '', guideUrl: '',
  features: [['🎯', 'حصص منظّمة', 'كل كورس مترتب، والحصة اللي بعدها بتفتح لما تخلّص اللي قبلها.'], ['📝', 'تصحيح تلقائي', 'كويز وواجب بيتصححوا فوراً وتشوف درجتك وإجاباتك.'], ['📊', 'متابعة مستمرة', 'إحصائيات لمستواك وتقدمك في كل كورس.'], ['🛡️', 'حماية للمحتوى', 'حساب على جهاز واحد وعلامة مائية باسمك على الفيديو.']].map(f => ({ icon: f[0], title: f[1], text: f[2] })) };
  for (const k in DS) if (db.settings[k] === undefined) db.settings[k] = DS[k]; }
for (const c of db.courses) for (const l of c.lessons) if (!Array.isArray(l.items)) { l.items = l.video ? [{ id: rid(), type: 'video', title: 'شرح الحصة', url: l.video }] : []; delete l.video; }
db.views = db.views || {}; db.notifs = db.notifs || [];
const GOVS = ["القاهرة", "الجيزة", "الإسكندرية", "القليوبية", "الشرقية", "الدقهلية", "البحيرة", "المنوفية", "الغربية", "كفر الشيخ", "دمياط", "بورسعيد", "الإسماعيلية", "السويس", "الفيوم", "بني سويف", "المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان", "البحر الأحمر", "الوادي الجديد", "مطروح", "شمال سيناء", "جنوب سيناء"];
const GRADES = ["الصف الثالث الإعدادي", "الصف الأول الثانوي", "الصف الثاني بكالوريا", "الصف الثالث الثانوي"];
const DEF_PMSG = 'السلام عليكم ورحمة الله\nولي أمر الطالب/ة {student}\nنفيدكم بأن الطالب/ة دخل/ت حصة «{lesson}» (كورس {course}) على منصة {platform}.\n{views}\nالوقت: {time}';
if (db.settings.parentNotify === undefined) db.settings.parentNotify = true;
if (!db.settings.parentMsg) db.settings.parentMsg = DEF_PMSG;
if (db.settings.regNoteOn === undefined) db.settings.regNoteOn = true;
const NOTIFY_URL = process.env.NOTIFY_URL || '', NOTIFY_TOKEN = process.env.NOTIFY_TOKEN || '';
const VIEW_WIN = (+process.env.VIEW_WINDOW_MIN || 120) * 60000; // الدخول المتكرر للحصة خلال هذه المدة يُحسب مشاهدة واحدة
let tm; const flush = () => { clearTimeout(tm); tm = setTimeout(save, 60); };
const save = () => { fs.writeFileSync(DBF + '.tmp', JSON.stringify(db)); fs.renameSync(DBF + '.tmp', DBF); };
save(); process.on('exit', save); ['SIGINT', 'SIGTERM'].forEach(s => process.on(s, () => process.exit(0)));

/* ---------- منطق المنصة ---------- */
const canAccess = (u, c) => !!u && (u.role === 'admin' || c.free || !!db.enroll[u.id + ':' + c.id]);
const done = (uid, l) => { const p = db.progress[uid + ':' + l.id] || {}; return (!l.quiz.length || !!p.q) && (!l.hw.length || !!p.h); };
const stats = u => { let d = 0, t = 0; const sc = []; for (const c of db.courses) if (!c.hidden && canAccess(u, c)) for (const l of c.lessons) { t++; if (done(u.id, l)) d++; const p = db.progress[u.id + ':' + l.id] || {}; for (const k of ['q', 'h']) if (p[k]) sc.push(p[k].s / p[k].t * 100); } const avg = sc.length ? Math.round(sc.reduce((a, b) => a + b) / sc.length) : 0; return { done: d, total: t, avg, level: !sc.length ? '-' : avg >= 85 ? 'ممتاز' : avg >= 65 ? 'جيد' : 'يحتاج مراجعة' }; };
const me = u => ({ id: u.id, name: u.name, phone: u.phone, role: u.role, parentPhone: u.parentPhone || '', gov: u.gov || '', school: u.school || '', grade: u.grade || '', stats: stats(u), courses: db.courses.filter(c => (!c.hidden || u.role === 'admin') && canAccess(u, c)).map(c => ({ id: c.id, title: c.title, img: c.img, total: c.lessons.length, done: c.lessons.filter(l => done(u.id, l)).length })) });
const pub = c => ({ id: c.id, title: c.title, desc: c.desc, img: c.img, price: c.price, oldPrice: c.oldPrice, free: c.free, count: c.lessons.length, sub: c.sub || '', badge: c.badge || '', start: c.start || '', end: c.end || '' });
const findL = id => { for (const c of db.courses) { const i = c.lessons.findIndex(l => l.id === id); if (i > -1) return { c, l: c.lessons[i], i }; } throw { s: 404, m: 'الحصة غير موجودة' }; };
const intl = p => { const d = String(p || '').replace(/\D/g, ''); return /^0\d{10}$/.test(d) ? '20' + d.slice(1) : d.startsWith('00') ? d.slice(2) : d; };
const validProf = (b, need) => {
  const o = {}, bad = m => { throw { s: 400, m }; };
  if (need || b.parentPhone !== undefined) { const v = S(b.parentPhone, 15); if (!/^\+?\d{8,15}$/.test(v)) bad('رقم ولي الأمر غير صحيح'); o.parentPhone = v; }
  if (need || b.gov !== undefined) { const v = S(b.gov, 30); if (!GOVS.includes(v)) bad('اختار المحافظة'); o.gov = v; }
  if (need || b.school !== undefined) { const v = S(b.school, 80); if (v.length < 2) bad('اكتب اسم المدرسة'); o.school = v; }
  if (need || b.grade !== undefined) { const v = S(b.grade, 40); if (!GRADES.includes(v)) bad('اختار السنة الدراسية'); o.grade = v; }
  return o;
};
const sendNotif = e => {
  if (!NOTIFY_URL) return;
  e.st = 'pending'; delete e.err;
  (async () => {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 10000);
    try {
      const r = await fetch(NOTIFY_URL, { method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json', ...(NOTIFY_TOKEN ? { Authorization: 'Bearer ' + NOTIFY_TOKEN } : {}) }, body: JSON.stringify({ to: e.to, text: e.text, student: e.name, lesson: e.lesson, course: e.course }) });
      e.st = r.ok ? 'sent' : 'failed'; if (!r.ok) e.err = 'HTTP ' + r.status;
    } catch (x) { e.st = 'failed'; e.err = String(x.message || x).slice(0, 120); }
    clearTimeout(t); flush();
  })();
};
const notifyParent = (u, c, l, n, max) => {
  if (db.settings.parentNotify === false || !u.parentPhone) return;
  let time; try { time = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' }); } catch { time = new Date().toISOString(); }
  const vars = { student: u.name, lesson: l.title, course: c.title, platform: db.settings.name, time, n, max: max || '', views: max ? `المشاهدة رقم ${n} من ${max}` : '' };
  const text = String(db.settings.parentMsg || DEF_PMSG).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
  const e = { id: rid(), uid: u.id, name: u.name, lesson: l.title, course: c.title, to: intl(u.parentPhone), text, at: Date.now(), st: 'pending' };
  db.notifs.unshift(e); db.notifs = db.notifs.slice(0, 500); flush(); sendNotif(e);
};
// عدّاد المشاهدات: فتح صفحة الحصة = مشاهدة (مرة واحدة كل VIEW_WIN)، الأدمن لا يُحسب عليه
const trackView = (u, c, l, count) => {
  const max = Math.max(0, +l.maxViews || 0), key = u.id + ':' + l.id, v = db.views[key] || (u.role === 'admin' ? { n: 0, last: 0 } : (db.views[key] = { n: 0, last: 0 }));
  if (u.role === 'admin') return { n: 0, max: 0, out: false };
  const now = Date.now(), inWin = v.last && now - v.last < VIEW_WIN;
  if (inWin) return { n: v.n, max, out: false };
  if (max > 0 && v.n >= max) return { n: v.n, max, out: true };
  if (!count) return { n: v.n, max, out: false };
  v.n++; v.last = now; flush(); notifyParent(u, c, l, v.n, max);
  return { n: v.n, max, out: false };
};
const unlocked = (u, c, i) => u.role === 'admin' || i === 0 || done(u.id, c.lessons[i - 1]);
const IMGRE = /^\/uploads\/[\w.-]+$/;
const qpts = x => Math.min(100, Math.max(1, Math.round(+x.pts) || 1));
const cleanQ = (a, where = '') => (Array.isArray(a) ? a : []).map((x, i) => {
  const o = (Array.isArray(x.o) ? x.o : []).map(t => S(t, 200)).slice(0, 6), img = IMGRE.test(x.img || '') ? x.img : '', q = S(x.q, 300), n = where + 'السؤال ' + (i + 1);
  if (!q && !img) throw { s: 400, m: n + ': اكتب نص السؤال أو ارفع صورة' };
  if (o.length < 2 || o.some(t => !t)) throw { s: 400, m: n + ': الاختيارات ناقصة (اختيارين على الأقل وبدون خانات فاضية)' };
  if (!Number.isInteger(+x.a) || +x.a < 0 || +x.a >= o.length) throw { s: 400, m: n + ': حدد الإجابة الصحيحة' };
  return { q, o, a: +x.a, img, pts: qpts(x), tag: S(x.tag, 40) };
});
const grade = (qs, ans) => { let s = 0, t = 0, c = 0; qs.forEach((x, j) => { const p = qpts(x); t += p; if (ans[j] === x.a) { s += p; c++; } }); return { s, t, c, n: qs.length }; };
// لو الوقت خلص والطالب مش موجود: نصحّح تلقائياً من المسودة المحفوظة
function settle(u, l) {
  const pr = db.progress[u.id + ':' + l.id]; if (!pr || !pr.st) return;
  for (const k of ['q', 'h']) { const lim = (l[k + 't'] || 0) * 60, s0 = pr.st[k]; if (!lim || !s0 || pr[k] || Date.now() - s0 < (lim + 25) * 1000) continue;
    const qs = k === 'h' ? l.hw : l.quiz, d = (pr.d && pr.d[k]) || [], ans = qs.map((x, j) => Number.isInteger(d[j]) && d[j] >= 0 && d[j] < x.o.length ? d[j] : -1);
    pr[k] = { ...grade(qs, ans), a: ans, at: s0 + lim * 1000, auto: 1 }; flush(); }
}
function session(u, devRaw) {
  const dev = crypto.createHash('sha256').update(S(devRaw, 100)).digest('hex').slice(0, 24);
  if (u.banned) throw { s: 403, m: 'تم إيقاف هذا الحساب، تواصل مع الإدارة' };
  if (u.role !== 'admin') { if (u.device && u.device !== dev) throw { s: 403, m: 'هذا الحساب مسجّل على جهاز آخر. تواصل مع الإدارة لفك الارتباط.' }; if (!u.device) { u.device = dev; flush(); } }
  return { token: sign({ uid: u.id, dev, exp: Date.now() + 30 * 864e5 }), user: me(u) };
}
function auth(req) {
  const o = unsign((req.headers.authorization || '').slice(7)); if (!o) return null;
  const u = db.users.find(x => x.id === o.uid); if (!u || u.banned) return null;
  if (u.role !== 'admin' && u.device !== o.dev) return null; // قفل الجهاز الواحد
  return u;
}

/* ---------- المسارات ---------- */
const rmn = (l, pr, k) => { const t = (l[k + 't'] || 0) * 60, s = pr.st && pr.st[k]; return t && s && !pr[k] ? Math.max(0, Math.round(t - (Date.now() - s) / 1000)) : null; };
const routes = []; const R = (m, p, a, f) => routes.push({ m, a, f, re: new RegExp('^' + p.replace(/:\w+/g, '([^/]+)') + '$') });

R('GET', '/api/public', 0, () => ({ settings: db.settings, courses: db.courses.filter(c => !c.hidden).map(pub) }));
R('POST', '/api/register', 0, ({ b, ip }) => {
  rl('r' + ip, 10, 36e5);
  const name = S(b.name, 60), phone = S(b.phone, 15), pass = S(b.pass, 100);
  if (name.length < 3) throw { s: 400, m: 'اكتب الاسم بالكامل' };
  if (!/^\+?\d{8,15}$/.test(phone)) throw { s: 400, m: 'رقم الموبايل غير صحيح' };
  if (pass.length < 6) throw { s: 400, m: 'كلمة السر لازم 6 أحرف على الأقل' };
  if (db.users.some(x => x.phone === phone)) throw { s: 409, m: 'الرقم مسجّل من قبل' };
  const pf = validProf(b, true); if (pf.parentPhone === phone) throw { s: 400, m: 'رقم ولي الأمر لازم يكون مختلف عن رقم الطالب' };
  const u = { id: rid(), name, phone, pass: hp(pass), role: 'st', device: '', at: Date.now(), ...pf }; db.users.push(u); flush();
  return session(u, b.dev);
});
R('POST', '/api/login', 0, ({ b, ip }) => {
  rl('l' + ip, 20, 3e5);
  const u = db.users.find(x => x.phone === S(b.phone, 15));
  if (!u || !cp(b.pass, u.pass)) throw { s: 401, m: 'بيانات الدخول غير صحيحة' };
  return session(u, b.dev);
});
R('GET', '/api/me', 1, ({ u }) => me(u));
R('POST', '/api/profile', 1, ({ u, b }) => {
  if (u.role === 'admin') throw { s: 400, m: 'غير متاح' };
  if (u.parentPhone) throw { s: 403, m: 'البيانات لا تُعدَّل إلا عن طريق الدعم' };
  const pf = validProf(b, true); if (pf.parentPhone === u.phone) throw { s: 400, m: 'رقم ولي الأمر لازم يكون مختلف عن رقم الطالب' };
  Object.assign(u, pf); flush(); return me(u);
});

R('GET', '/api/course/:id', 'o', ({ u, p }) => {
  const c = db.courses.find(x => x.id === p[0]); if (!c || (c.hidden && u?.role !== 'admin')) throw { s: 404, m: 'الكورس غير موجود' };
  const acc = canAccess(u, c);
  return { ...pub(c), access: acc, lessons: c.lessons.map((l, i) => { if (u) settle(u, l); const pr = db.progress[u?.id + ':' + l.id] || {}; return { id: l.id, title: l.title, info: l.info || '', hasV: l.items.length > 0, hasA: !!l.app, q: l.quiz.length, h: l.hw.length, done: acc && done(u.id, l), locked: !acc || !unlocked(u, c, i), qs: pr.q ? pr.q.s + '/' + pr.q.t : null, hs: pr.h ? pr.h.s + '/' + pr.h.t : null }; }) };
});
R('GET', '/api/lesson/:id', 1, ({ u, p, q }) => {
  const { c, l, i } = findL(p[0]);
  if (!canAccess(u, c)) throw { s: 403, m: 'لازم تشترك في الكورس الأول' };
  if (!unlocked(u, c, i)) throw { s: 403, m: 'لازم تخلّص كويز وواجب الحصة السابقة الأول 🔒' };
  settle(u, l);
  const views = trackView(u, c, l, q.get('view') === '1');
  const pr = db.progress[u.id + ':' + l.id] || {}, nx = c.lessons[i + 1];
  const view = (qs, r) => qs.map((x, j) => ({ q: x.q, o: x.o, img: x.img || '', pts: qpts(x), tag: x.tag || '', ...(r ? { a: x.a, mine: r.a[j] } : {}) })); // الإجابات الصحيحة لا تُرسل قبل التسليم
  const res = r => r && { s: r.s, t: r.t, c: r.c, n: r.n, auto: !!r.auto };
  return { id: l.id, title: l.title, courseId: c.id, info: l.info || '', app: l.app || '', views, items: l.items.filter(it => !views.out || it.type === 'file').map(it => ({ id: it.id, type: it.type, title: it.title, url: it.url })), quiz: view(l.quiz, pr.q), hw: view(l.hw, pr.h), qres: res(pr.q), hres: res(pr.h), done: done(u.id, l), next: nx ? nx.id : null, qt: l.qt || 0, ht: l.ht || 0, qrem: rmn(l, pr, 'q'), hrem: rmn(l, pr, 'h'), draft: { q: pr.q ? null : pr.d?.q || null, h: pr.h ? null : pr.d?.h || null } };
});
R('POST', '/api/lesson/:id/submit', 1, ({ u, p, b }) => {
  const { c, l, i } = findL(p[0]);
  if (!canAccess(u, c) || !unlocked(u, c, i)) throw { s: 403, m: 'غير مسموح' };
  settle(u, l);
  const k = b.kind === 'h' ? 'h' : 'q', qs = k === 'h' ? l.hw : l.quiz, a = b.answers;
  if (!Array.isArray(a) || a.length !== qs.length) throw { s: 400, m: 'بيانات غير صحيحة' };
  const key = u.id + ':' + l.id, pr = db.progress[key] = db.progress[key] || {};
  if (pr[k]) throw { s: 409, m: 'تم التسليم مسبقاً' };
  const lim = (l[k + 't'] || 0) * 60, s0 = pr.st && pr.st[k]; let ans = a.map((x, j) => Number.isInteger(x) && x >= 0 && x < qs[j].o.length ? x : -1), expired = false;
  if (lim) { if (!s0) throw { s: 400, m: 'اضغط زر ابدأ الأول' }; const el = Date.now() - s0; expired = el >= lim * 1000 - 3000; if (el > (lim + 20) * 1000) ans = ans.map(() => -1); }
  const miss = ans.filter(x => x < 0).length;
  if (miss && !expired) throw { s: 400, m: `⚠️ لم تحلّ كل الأسئلة! متبقي ${miss} سؤال بدون إجابة`, missing: miss };
  const g = grade(qs, ans); pr[k] = { ...g, a: ans, at: Date.now() }; if (pr.d) delete pr.d[k]; flush();
  return { s: g.s, t: g.t, c: g.c, n: g.n, blank: miss };
});
// حفظ مسودة الإجابات (استكمال الاختبار لاحقاً + حماية من انقطاع النت)
R('POST', '/api/lesson/:id/draft', 1, ({ u, p, b }) => {
  const { c, l, i } = findL(p[0]);
  if (!canAccess(u, c) || !unlocked(u, c, i)) throw { s: 403, m: 'غير مسموح' };
  settle(u, l);
  const k = b.kind === 'h' ? 'h' : 'q', qs = k === 'h' ? l.hw : l.quiz, a = b.answers, pr = db.progress[u.id + ':' + l.id] = db.progress[u.id + ':' + l.id] || {};
  if (!Array.isArray(a) || a.length !== qs.length) throw { s: 400, m: 'بيانات غير صحيحة' };
  if (pr[k]) throw { s: 409, m: 'تم التسليم مسبقاً' };
  const lim = (l[k + 't'] || 0) * 60;
  if (lim) { const s0 = pr.st && pr.st[k]; if (!s0) throw { s: 400, m: 'اضغط زر ابدأ الأول' }; if (Date.now() - s0 > lim * 1000 + 5000) return { ok: 0 }; }
  pr.d = pr.d || {}; pr.d[k] = a.map((x, j) => Number.isInteger(x) && x >= 0 && x < qs[j].o.length ? x : -1); flush(); return { ok: 1 };
});
R('POST', '/api/lesson/:id/start', 1, ({ u, p, b }) => {
  const { c, l, i } = findL(p[0]); if (!canAccess(u, c) || !unlocked(u, c, i)) throw { s: 403, m: 'غير مسموح' };
  const k = b.kind === 'h' ? 'h' : 'q', pr = db.progress[u.id + ':' + l.id] = db.progress[u.id + ':' + l.id] || {};
  if (pr[k]) throw { s: 409, m: 'تم التسليم مسبقاً' };
  if (l[k + 't'] > 0) { pr.st = pr.st || {}; if (!pr.st[k]) { pr.st[k] = Date.now(); flush(); } }
  return { ok: 1 };
});
R('GET', '/api/results', 1, ({ u }) => {
  const quiz = [], hw = []; let qT = 0, hT = 0, ans = 0, ok = 0;
  for (const c of db.courses) { if ((c.hidden && u.role !== 'admin') || !canAccess(u, c)) continue;
    for (const l of c.lessons) { const p = db.progress[u.id + ':' + l.id] || {};
      if (l.quiz.length) { qT++; if (p.q) quiz.push({ c: c.title, l: l.title, id: l.id, s: p.q.s, t: p.q.t, n: p.q.n ?? p.q.t, k: p.q.c ?? p.q.s, at: p.q.at }); }
      if (l.hw.length) { hT++; if (p.h) hw.push({ c: c.title, l: l.title, id: l.id, s: p.h.s, t: p.h.t, n: p.h.n ?? p.h.t, k: p.h.c ?? p.h.s, at: p.h.at }); } } }
  for (const x of [...quiz, ...hw]) { ans += x.n; ok += x.k; }
  return { quiz, hw, qT, hT, ans, ok };
});
R('POST', '/api/support', 0, ({ b, ip }) => {
  rl('s' + ip, 5, 6e4); const msg = S(b.msg, 1000); if (msg.length < 3) throw { s: 400, m: 'اكتب رسالتك' };
  db.tickets.unshift({ id: rid(), name: S(b.name, 60), phone: S(b.phone, 20), msg, at: Date.now() }); db.tickets = db.tickets.slice(0, 500); flush(); return { ok: 1 };
});

/* ---- الأدمن ---- */
R('GET', '/api/admin/data', 'a', () => { const vw = {}; for (const k in db.views) { const [uid, lid] = k.split(':'); (vw[uid] = vw[uid] || {})[lid] = db.views[k].n; } return ({ notifAuto: !!NOTIFY_URL, notifs: db.notifs.slice(0, 300), settings: db.settings, courses: db.courses, tickets: db.tickets, enroll: db.enroll, users: db.users.map(u => ({ parentPhone: u.parentPhone || '', gov: u.gov || '', school: u.school || '', grade: u.grade || '', views: vw[u.id] || {}, id: u.id, name: u.name, phone: u.phone, role: u.role, device: !!u.device, banned: !!u.banned, stats: stats(u), enrolled: db.courses.filter(c => db.enroll[u.id + ':' + c.id]).map(c => c.id) })) }); });
R('PUT', '/api/admin/settings', 'a', ({ b }) => {
  const s = db.settings; for (const k of ['name', 'teacher', 'hero', 'sub', 'whatsapp', 'phone', 'footer']) if (k in b) s[k] = S(b[k], 300);
  if (/^#[0-9a-f]{6}$/i.test(b.color)) s.color = b.color;
  if ('parentNotify' in b) s.parentNotify = b.parentNotify !== false;
  if ('regNoteOn' in b) s.regNoteOn = b.regNoteOn !== false;
  if ('parentMsg' in b) s.parentMsg = S(b.parentMsg, 800) || DEF_PMSG;
  if ('regNote' in b) s.regNote = S(b.regNote, 2500);
  if (b.social && typeof b.social === 'object') { s.social = s.social || {}; for (const k of ['facebook', 'instagram', 'tiktok', 'youtube']) s.social[k] = /^https?:\/\/\S+$/.test(S(b.social[k], 300)) ? S(b.social[k], 300) : ''; }
  if ('guideTitle' in b) s.guideTitle = S(b.guideTitle, 120);
  if ('guideUrl' in b) s.guideUrl = /^(https?:\/\/\S+|\/uploads\/[\w.-]+)$/.test(S(b.guideUrl, 500)) ? S(b.guideUrl, 500) : '';
  for (const k of ['logo', 'photo']) if (/^\/(assets|uploads)\/[\w.-]+$/.test(b[k] || '')) s[k] = b[k];
  const okI = v => typeof v === 'string' && (/^\/(assets|uploads)\/[\w.-]+$/.test(v) || (v.length > 0 && v.length <= 12));
  if (b.colors) for (const k in s.colors) if (/^#[0-9a-f]{6}$/i.test(b.colors[k])) s.colors[k] = b.colors[k];
  if (b.ui) { const u = b.ui; s.ui.radius = Math.min(40, Math.max(0, +u.radius || 0)); if (['none', 'tilt', 'glow', 'lift', 'pulse', 'shine'].includes(u.cardEffect)) s.ui.cardEffect = u.cardEffect; for (const k of ['symbols', 'reveal', 'recs', 'tops']) s.ui[k] = u[k] !== false; }
  if (b.texts && typeof b.texts === 'object') { s.texts = {}; for (const k in b.texts) if (/^\w{2,20}$/.test(k)) s.texts[k] = S(b.texts[k], 300); }
  if (b.icons && typeof b.icons === 'object') { s.icons = {}; for (const k in b.icons) if (/^\w{2,20}$/.test(k) && okI(b.icons[k])) s.icons[k] = b.icons[k]; }
  if (Array.isArray(b.features)) s.features = b.features.slice(0, 12).map(f => ({ icon: okI(f.icon) ? f.icon : '⭐', title: S(f.title, 80), text: S(f.text, 300) }));
  if (Array.isArray(b.tops)) s.tops = b.tops.slice(0, 120).map(t => ({ group: S(t.group ?? t.year, 80), name: S(t.name, 100), total: S(t.total ?? t.score, 40), subj: S(t.subj, 80), gov: S(t.gov, 60), div: S(t.div, 60), img: /^\/(assets|uploads)\/[\w.-]+$/.test(t.img || '') ? t.img : '' })).filter(t => t.name);
  if (Array.isArray(b.recIds)) s.recIds = b.recIds.filter(x => /^\w+$/.test(x)).slice(0, 12);
  if (Array.isArray(b.centers)) s.centers = b.centers.slice(0, 80).map(c => ({ year: S(c.year, 80), name: S(c.name, 80), place: S(c.place, 120), time: S(c.time, 200), phone: S(c.phone, 30), map: /^https:\/\//.test(S(c.map, 600)) ? S(c.map, 600) : '', on: c.on !== false }));
  if ('css' in b) s.css = S(b.css, 6000).replace(/</g, '');
  flush(); return s;
});
R('PUT', '/api/admin/course', 'a', ({ b }) => {
  const old = db.courses.find(x => x.id === b.id), title = S(b.title, 120); if (!title) throw { s: 400, m: 'اكتب اسم الكورس' };
  const c = { id: old?.id || rid(), title, desc: S(b.desc, 500), sub: S(b.sub, 120), badge: S(b.badge, 30), start: S(b.start, 30), end: S(b.end, 30), img: /^\/uploads\/[\w.-]+$/.test(b.img || '') ? b.img : '', price: Math.max(0, +b.price || 0), oldPrice: Math.max(0, +b.oldPrice || 0), free: !!b.free, hidden: !!b.hidden,
    lessons: (Array.isArray(b.lessons) ? b.lessons : []).slice(0, 300).map(l => { const nm = 'الحصة "' + S(l.title, 40) + '" - ';
      return { id: /^\w{4,20}$/.test(l.id || '') ? l.id : rid(), title: S(l.title, 150), info: S(l.info, 800), app: /^https:\/\//.test(S(l.app, 500)) ? S(l.app, 500) : '', qt: Math.min(600, Math.max(0, Math.round(+l.qt || 0))), ht: Math.min(600, Math.max(0, Math.round(+l.ht || 0))), maxViews: Math.min(1000, Math.max(0, Math.round(+l.maxViews || 0))),
        items: (Array.isArray(l.items) ? l.items : []).slice(0, 60).map(it => ({ id: /^\w{4,20}$/.test(it.id || '') ? it.id : rid(), type: it.type === 'file' ? 'file' : 'video', title: S(it.title, 150) || (it.type === 'file' ? 'ملف' : 'فيديو'), url: S(it.url, 500) })).filter(it => it.type === 'file' ? /^(\/uploads\/[\w.-]+|https:\/\/\S+)$/.test(it.url) : /^(\/uploads\/[\w.-]+|https?:\/\/\S+)$/.test(it.url)),
        quiz: cleanQ(l.quiz, nm + 'الامتحان - '), hw: cleanQ(l.hw, nm + 'الواجب - ') }; }) };
  old ? db.courses[db.courses.indexOf(old)] = c : db.courses.push(c); flush(); return c;
});
R('DELETE', '/api/admin/course/:id', 'a', ({ p }) => { db.courses = db.courses.filter(c => c.id !== p[0]); flush(); return { ok: 1 }; });
R('POST', '/api/admin/user', 'a', ({ b }) => {
  const name = S(b.name, 60), phone = S(b.phone, 15), pass = S(b.pass, 100); let u = b.id && db.users.find(x => x.id === b.id);
  if (u) { if (name) u.name = name; if (pass.length >= 6) u.pass = hp(pass); Object.assign(u, validProf(b, false)); }
  else { if (name.length < 3 || !/^\+?\d{8,15}$/.test(phone) || pass.length < 6) throw { s: 400, m: 'بيانات الطالب ناقصة (الاسم، موبايل صحيح، كلمة سر 6+)' }; if (db.users.some(x => x.phone === phone)) throw { s: 409, m: 'الرقم مسجّل من قبل' }; db.users.push({ id: rid(), name, phone, pass: hp(pass), role: 'st', device: '', at: Date.now(), ...validProf(b, false) }); }
  flush(); return { ok: 1 };
});
R('POST', '/api/admin/user/:id/:act', 'a', ({ p }) => {
  const u = db.users.find(x => x.id === p[0]); if (!u || u.role === 'admin') throw { s: 404, m: 'غير موجود' };
  if (p[1] === 'device') u.device = ''; else if (p[1] === 'ban') u.banned = !u.banned;
  else if (p[1] === 'progress') { for (const k of Object.keys(db.progress)) if (k.startsWith(u.id + ':')) delete db.progress[k]; }
  else if (p[1] === 'delete') { db.users = db.users.filter(x => x !== u); for (const k of Object.keys(db.enroll)) if (k.startsWith(u.id + ':')) delete db.enroll[k]; for (const k of Object.keys(db.progress)) if (k.startsWith(u.id + ':')) delete db.progress[k]; for (const k of Object.keys(db.views)) if (k.startsWith(u.id + ':')) delete db.views[k]; }
  else throw { s: 400, m: 'إجراء غير معروف' };
  flush(); return { ok: 1 };
});
R('POST', '/api/admin/enroll', 'a', ({ b }) => {
  if (!db.users.some(x => x.id === b.uid) || !db.courses.some(c => c.id === b.cid)) throw { s: 404, m: 'غير موجود' };
  b.on ? db.enroll[b.uid + ':' + b.cid] = Date.now() : delete db.enroll[b.uid + ':' + b.cid]; flush(); return { ok: 1 };
});
R('POST', '/api/admin/views', 'a', ({ b }) => {
  const u = db.users.find(x => x.id === b.uid); if (!u) throw { s: 404, m: 'غير موجود' };
  if (b.lid) { const v = db.views[u.id + ':' + S(b.lid, 30)]; if (v) { const add = Math.max(0, Math.round(+b.add || 0)); v.n = add ? Math.max(0, v.n - add) : 0; v.last = 0; } }
  else for (const k of Object.keys(db.views)) if (k.startsWith(u.id + ':')) delete db.views[k];
  flush(); return { ok: 1 };
});
R('POST', '/api/admin/notif/:id/:act', 'a', ({ p }) => {
  const e = db.notifs.find(x => x.id === p[0]); if (!e) throw { s: 404, m: 'غير موجود' };
  if (p[1] === 'done') { e.st = 'sent'; delete e.err; } else if (p[1] === 'retry') { if (!NOTIFY_URL) throw { s: 400, m: 'الإرسال الأوتوماتيك غير مفعّل (NOTIFY_URL)' }; sendNotif(e); }
  else if (p[1] === 'delete') db.notifs = db.notifs.filter(x => x !== e); else throw { s: 400, m: 'إجراء غير معروف' };
  flush(); return { ok: 1 };
});
R('POST', '/api/admin/notifs/clear', 'a', () => { db.notifs = []; flush(); return { ok: 1 }; });
R('POST', '/api/admin/upload', 'a', ({ b }) => {
  const m = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(b.data || ''); if (!m) throw { s: 400, m: 'صيغة الصورة غير مدعومة' };
  const buf = Buffer.from(m[2], 'base64'); if (buf.length > 4e6) throw { s: 413, m: 'الصورة أكبر من 4MB' };
  const n = rid() + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]); fs.writeFileSync(path.join(UP, n), buf); return { url: '/uploads/' + n };
});
const MAXV = (+process.env.MAX_VIDEO_MB || 2048) * 1048576, MAXF = (+process.env.MAX_FILE_MB || 100) * 1048576;
const rawUp = (types, max, magic) => ({ req, q }) => new Promise((ok, no) => {
  const ext = types[q.get('type')];
  if (!ext) return no({ s: 400, m: 'الصيغة غير مدعومة' });
  if ((+req.headers['content-length'] || 0) > max) return no({ s: 413, m: 'الملف أكبر من الحد المسموح' });
  const n = rid() + '.' + ext, fp = path.join(UP, n), ws = fs.createWriteStream(fp); let sz = 0, bad = 0;
  const fail = (e) => { if (bad) return; bad = 1; ws.destroy(); fs.unlink(fp, () => { }); no(e); };
  req.on('data', d => { sz += d.length; if (sz > max) { fail({ s: 413, m: 'الملف أكبر من الحد المسموح' }); req.destroy(); } });
  req.on('error', () => fail({ s: 400, m: 'انقطع الرفع' })); req.on('aborted', () => fail({ s: 400, m: 'انقطع الرفع' }));
  ws.on('error', () => fail({ s: 500, m: 'فشل حفظ الملف' }));
  ws.on('finish', () => { if (bad) return; if (magic) { const h = Buffer.alloc(5); try { const fd = fs.openSync(fp, 'r'); fs.readSync(fd, h, 0, 5, 0); fs.closeSync(fd); } catch { } if (h.toString('latin1') !== magic) return fail({ s: 400, m: 'الملف ليس PDF صالحاً' }); } ok({ url: '/uploads/' + n, size: sz }); });
  req.pipe(ws);
});
routes.push({ m: 'POST', a: 'a', raw: 1, re: /^\/api\/admin\/upload-video$/, f: rawUp({ 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' }, MAXV) });
routes.push({ m: 'POST', a: 'a', raw: 1, re: /^\/api\/admin\/upload-file$/, f: rawUp({ 'application/pdf': 'pdf' }, MAXF, '%PDF-') });
R('DELETE', '/api/admin/ticket/:id', 'a', ({ p }) => { db.tickets = db.tickets.filter(t => t.id !== p[0]); flush(); return { ok: 1 }; });

/* ---------- الخادم ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' };
const send = (res, s, o) => { const d = JSON.stringify(o); res.writeHead(s, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(d); };
const readBody = req => new Promise((ok, no) => { let n = 0; const c = []; req.on('data', d => { n += d.length; if (n > 8e6) { no({ s: 413, m: 'الحجم كبير' }); req.destroy(); } else c.push(d); }); req.on('end', () => { try { ok(c.length ? JSON.parse(Buffer.concat(c)) : {}); } catch { no({ s: 400, m: 'JSON غير صالح' }); } }); });
function serve(res, p, rg) {
  let base = PUB, f = p === '/' ? '/index.html' : p; if (f.startsWith('/uploads/')) { base = UP; f = f.slice(8); }
  let fp; try { fp = path.normalize(path.join(base, decodeURIComponent(f))); } catch { fp = ''; }
  if (!fp.startsWith(base) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { if (path.extname(p)) { res.writeHead(404); return res.end('Not found'); } fp = path.join(PUB, 'index.html'); }
  const ext = path.extname(fp), html = ext === '.html';
  const sz = fs.statSync(fp).size, hd = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': (html || /^\/assets\//.test(p)) ? 'no-cache' : 'public, max-age=86400', 'Accept-Ranges': 'bytes' };
  const m = /^bytes=(\d*)-(\d*)$/.exec(rg || '');
  if (m && (m[1] || m[2])) { let a = m[1] ? +m[1] : Math.max(0, sz - +m[2]), z = m[1] && m[2] ? Math.min(+m[2], sz - 1) : sz - 1; if (a > z || a >= sz) { res.writeHead(416, { 'Content-Range': 'bytes */' + sz }); return res.end(); } res.writeHead(206, { ...hd, 'Content-Range': `bytes ${a}-${z}/${sz}`, 'Content-Length': z - a + 1 }); return fs.createReadStream(fp, { start: a, end: z }).pipe(res); }
  res.writeHead(200, { ...hd, 'Content-Length': sz }); fs.createReadStream(fp).pipe(res);
}
const srv = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), ip = req.socket.remoteAddress;
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'SAMEORIGIN'); res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; media-src 'self' https:; frame-src 'self' https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self'");
  if (!url.pathname.startsWith('/api/')) return serve(res, url.pathname, req.headers.range);
  try {
    const r = routes.find(r => r.m === req.method && r.re.test(url.pathname)); if (!r) throw { s: 404, m: 'المسار غير موجود' };
    const u = auth(req);
    if (r.a === 'a' && (!u || u.role !== 'admin')) throw { s: u ? 403 : 401, m: 'غير مصرح' };
    if (r.a === 1 && !u) throw { s: 401, m: 'سجّل الدخول أولاً' };
    const b = r.raw || req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req);
    send(res, 200, await r.f({ u, b, ip, req, q: url.searchParams, p: url.pathname.match(r.re).slice(1) }));
  } catch (e) { send(res, e.s || 500, { error: e.m || 'خطأ في الخادم', ...(e.missing ? { missing: e.missing } : {}) }); if (!e.s) console.error(e); }
});
srv.requestTimeout = 0; srv.listen(PORT, () => console.log(`✅ المنصة شغالة: http://localhost:${PORT}\n   الأدمن: ${db.users[0].phone} / ${process.env.ADMIN_PASS || 'admin123'} (غيّرها من متغيرات البيئة قبل النشر)`));
