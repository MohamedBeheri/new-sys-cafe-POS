// ===================================================================
//  واجهة seaside — POS + مخازن + وصفات + حوكمة (ثنائي اللغة + ثيم)
// ===================================================================
const APP_BUILD = '2026-07-09.1';
console.log('seaside POS — build ' + APP_BUILD);
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const root = $('#root');
let TOKEN = localStorage.getItem('cafe_token') || null;
let ME = null, META = null, charts = {};
let LANG = localStorage.getItem('cafe_lang') || 'ar';
let THEME = localStorage.getItem('cafe_theme') || 'light';

// ---------- الترجمة (عربي → إنجليزي) ----------
const I18N = {
  'نظام نقاط البيع وإدارة المخازن': 'POS & Inventory System', 'البريد الإلكتروني': 'Email', 'كلمة المرور': 'Password', 'دخول': 'Sign in', 'تسجيل الخروج': 'Sign out',
  'حسابات تجريبية (اضغط للتعبئة):': 'Demo accounts (click to fill):', 'مدير': 'Manager', 'كاشير': 'Cashier', 'نادل': 'Waiter', 'شيف': 'Chef',
  'العمليات': 'Operations', 'المخزون والمشتريات': 'Inventory & Purchasing', 'الإدارة': 'Management',
  'نقطة البيع': 'Point of Sale', 'شاشة المطبخ': 'Kitchen Display', 'شاشة البار': 'Bar Display', 'الطلبات والفواتير': 'Orders & Invoices',
  'طلبات الشراء': 'Purchase requests', 'الإشعارات': 'Notifications', 'طلب شراء': 'Purchase request', '+ طلب شراء': '+ Purchase request',
  'المادة المطلوبة': 'Requested material', 'الكمية المطلوبة': 'Requested qty', 'إرسال الطلب': 'Send request', 'تم إرسال طلب الشراء ✅': 'Purchase request sent ✅',
  'مادة من المخزن': 'Material from stock', 'أو اكتب اسم مادة جديدة': 'or type a new material name', 'تنفيذ': 'Fulfill', 'رفض': 'Reject', 'قيد الانتظار': 'Pending', 'تم التنفيذ': 'Fulfilled', 'مرفوض': 'Rejected',
  'لا طلبات شراء': 'No purchase requests', 'لا إشعارات': 'No notifications', 'تعليم الكل كمقروء': 'Mark all read', 'الطالب': 'Requested by',
  'المخزون': 'Inventory', 'المشتريات': 'Purchases', 'التوالف والهدر': 'Waste', 'الجرد': 'Stock Count',
  'لوحة المعلومات': 'Dashboard', 'الأصناف والوصفات': 'Products & Recipes', 'المصروفات': 'Expenses', 'تقارير الحوكمة': 'Governance Reports', 'الموظفون': 'Staff', 'الإعدادات': 'Settings',
  'ملخص المبيعات': 'Sales summary', 'صافي الربح': 'Net profit', 'فئة المصروف': 'Expense category', 'قيمة المصروف': 'Amount', 'تاريخ المصروف': 'Date', '+ مصروف جديد': '+ New expense', 'تسجيل مصروف': 'Log expense', 'إجمالي المصروفات': 'Total expenses', 'لا مصروفات': 'No expenses', 'آخر ٧ أيام': 'Last 7 days', 'آخر ١٤ يوم': 'Last 14 days', 'آخر ٣٠ يوم': 'Last 30 days', 'تعديل الفاتورة (أدمن)': 'Edit invoice (admin)', 'حفظ تعديل الفاتورة': 'Save invoice edit', 'تم تعديل الفاتورة ✅': 'Invoice updated ✅',
  'حفظ': 'Save', 'إلغاء': 'Cancel', 'تعديل': 'Edit', 'حذف': 'Delete', 'إضافة': 'Add', 'عرض': 'View', 'تأكيد': 'Confirm', 'إغلاق': 'Close', 'تحديث': 'Refresh',
  'تم الحفظ ✅': 'Saved ✅', 'حُذف': 'Deleted', 'الاسم مطلوب': 'Name is required',
  // لوحة المعلومات
  'نظرة لحظية على مبيعات وأرباح اليوم': "Today's live sales & profit overview",
  'طلبات اليوم': "Today's orders", 'مبيعات اليوم': "Today's sales", 'أرباح اليوم (بعد التكلفة)': "Today's profit (after cost)", 'متوسط الفاتورة': 'Avg. ticket',
  'عن أمس': 'vs yesterday', 'مبيعات آخر ١٤ يوم': 'Sales — last 14 days', 'طرق الدفع': 'Payment methods', 'الأكثر مبيعاً': 'Top sellers',
  'الصنف': 'Item', 'الكمية': 'Qty', 'المبيعات': 'Sales', 'مواد قاربت النفاد': 'Low stock items', 'المادة': 'Material', 'المتبقي': 'Remaining', 'حد الطلب': 'Reorder pt',
  'كل المخزون في أمان ✅': 'All stock is healthy ✅', 'أحدث الطلبات': 'Latest orders', 'الفاتورة': 'Invoice', 'النوع': 'Type', 'الطاولة': 'Table',
  'الإجمالي': 'Total', 'الحالة': 'Status', 'الوقت': 'Time', '🧾 فتح الكاشير': '🧾 Open POS', 'لا بيانات': 'No data', 'لا طلبات': 'No orders',
  // POS
  '🔍 ابحث عن صنف…': '🔍 Search items…', 'الكل': 'All', '🛒 السلة فارغة': '🛒 Cart is empty', 'اضغط على الأصناف لإضافتها': 'Tap items to add them', 'لا أصناف': 'No items',
  '— الطاولة —': '— Table —', '— النادل —': '— Waiter —', 'الإجمالي الفرعي': 'Subtotal', 'خصم': 'Discount', 'ضريبة': 'Tax', 'المطلوب': 'Total due',
  '👨‍🍳 للمطبخ': '👨‍🍳 To kitchen', '💵 الدفع': '💵 Pay', '+ ملاحظة': '+ note', 'عدد الأفراد': 'Guests',
  '💵 إتمام الدفع': '💵 Complete payment', 'المبلغ المدفوع (نقداً)': 'Cash received', 'الباقي': 'Change', 'بقشيش (اختياري)': 'Tip (optional)', '✅ تأكيد الدفع والطباعة': '✅ Confirm & print',
  'أضف صنفاً واحداً على الأقل': 'Add at least one item', 'تم الدفع ✅ — ': 'Paid ✅ — ', 'أُرسل للمطبخ — ': 'Sent to kitchen — ',
  'تم الدفع وأُرسل للتحضير ✅ — ': 'Paid & sent to prep ✅ — ',
  'ملاحظة / تعديل (مثال: بدون بصل، إضافي شوت):': 'Note / modifier (e.g. no onion, extra shot):', 'قيمة الخصم:': 'Discount amount:',
  // الطلبات
  'سجل كل الطلبات مع إمكانية الفلترة': 'All orders with filtering', 'كل الحالات': 'All statuses', 'كل الأنواع': 'All types', 'مسح الفلتر': 'Clear filter', 'الدفع': 'Payment',
  'لا طلبات بهذا الفلتر': 'No orders for this filter', '🖨️ طباعة': '🖨️ Print', '💵 دفع': '💵 Pay', 'إلغاء الطلب': 'Cancel order', 'إلغاء هذا الطلب؟': 'Cancel this order?',
  'الإجمالي شامل الضريبة': 'Total incl. tax', 'أُلغي الطلب': 'Order cancelled',
  // KDS
  'الطلبات الجارية — اضغط على الصنف لتغيير حالته': 'Active orders — tap an item to advance it', '🔄 تحديث': '🔄 Refresh', 'لا طلبات في المطبخ حالياً 🎉': 'No active kitchen orders 🎉',
  // الأصناف والوصفات
  'عرّف الأصناف واربطها بمكوناتها الخام (الوصفة) لتُخصم تلقائياً عند البيع': 'Define products and link them to raw materials (recipe) for auto-deduction on sale',
  '+ صنف جديد': '+ New product', 'التصنيف': 'Category', 'السعر': 'Price', 'تكلفة المكونات': 'Ingredient cost', 'هامش الربح': 'Margin', 'خصم مخزون': 'Stock', '🧪 الوصفة': '🧪 Recipe',
  'صنف جديد': 'New product', 'تعديل صنف': 'Edit product', 'اسم الصنف': 'Product name', 'الأيقونة (إيموجي)': 'Icon (emoji)', '— بدون —': '— None —', 'سعر البيع': 'Sell price',
  'خصم المكونات من المخزن عند البيع': 'Deduct ingredients from stock on sale', 'صنف مُفعّل (يظهر في الكاشير)': 'Active (shown in POS)', 'حذف الصنف نهائياً؟': 'Delete product permanently?',
  'حدّد المكونات الخام والكمية بالوحدة الصغرى. تُخصم تلقائياً من المخزن لحظة البيع.': 'Set raw materials and quantity in the base unit. Auto-deducted from stock at sale time.',
  '+ إضافة مكوّن': '+ Add ingredient', 'تكلفة المكونات للصنف': 'Recipe cost', '💾 حفظ وتحديث التكلفة': '💾 Save & update cost', 'لا مكونات بعد — أضف مكوّناً': 'No ingredients yet — add one',
  'حُفظت الوصفة — التكلفة: ': 'Recipe saved — cost: ', 'سعر البيع': 'Sell price', 'هامش': 'margin', 'متوفر': 'in stock', '⚠️منخفض': '⚠️low',
  // المخزون
  'أرصدة المواد الخام بالوحدة الصغرى وقيمتها': 'Raw material balances and value', '📜 حركة المخزن': '📜 Stock ledger', '+ مادة خام': '+ Raw material', 'كل المخازن': 'All warehouses',
  'عدد المواد': 'Materials', 'قيمة المخزون': 'Stock value', 'مواد تحت حد الطلب': 'Below reorder pt', 'الكود': 'Code', 'المخزن': 'Warehouse', 'الرصيد': 'Balance',
  'متوسط التكلفة': 'Avg. cost', 'منخفض': 'Low', 'متوفر': 'OK', 'مادة خام جديدة': 'New raw material', 'تعديل مادة خام': 'Edit raw material', 'الوحدة الصغرى': 'Base unit',
  'الرصيد الحالي': 'Current balance', 'متوسط التكلفة (للوحدة)': 'Avg. cost (per unit)', 'حد إعادة الطلب': 'Reorder point', 'لا مواد': 'No materials',
  '📜 حركة المخزن (آخر ٢٠٠)': '📜 Stock ledger (last 200)', 'لا حركات': 'No movements',
  // المشتريات
  'استلام فواتير الموردين — يُحدّث المخزون ومتوسط التكلفة تلقائياً': 'Receive supplier invoices — auto-updates stock & moving-average cost', '+ فاتورة شراء': '+ Purchase invoice',
  'الرقم': 'No.', 'المورد': 'Supplier', 'عدد البنود': 'Lines', 'لا مشتريات بعد': 'No purchases yet', '🚚 فاتورة شراء جديدة': '🚚 New purchase invoice', 'المخزن المستلِم': 'Receiving warehouse',
  'رقم الفاتورة': 'Invoice no.', 'ضريبة الفاتورة': 'Invoice tax', 'البنود': 'Lines', '+ بند': '+ Line', 'إجمالي الفاتورة': 'Invoice total', '💾 استلام وتحديث المخزون': '💾 Receive & update stock',
  'تم الاستلام وتحديث المخزون ✅': 'Received & stock updated ✅',
  // التوالف
  'سجّل المواد التالفة لفصلها عن المبيعات وضبط الأرباح': 'Log spoiled materials to separate them from sales', '+ تسجيل تالف': '+ Log waste', 'التكلفة المهدرة': 'Wasted cost',
  'السبب': 'Reason', 'بواسطة': 'By', 'لا توالف مسجلة ✅': 'No waste logged ✅', '🗑️ تسجيل مادة تالفة': '🗑️ Log spoiled material', 'الكمية التالفة': 'Wasted qty', 'تسجيل وخصم': 'Log & deduct',
  'انتهاء صلاحية': 'Expired', 'خطأ تحضير': 'Prep error', 'كسر / سقوط': 'Breakage', 'إرجاع عميل': 'Customer return', 'أخرى': 'Other', 'سُجّل التالف — التكلفة: ': 'Waste logged — cost: ',
  // الجرد
  'طابِق الرصيد الدفتري مع الفعلي لكشف الهدر والعجز': 'Match book vs physical balance to detect variance', '+ جرد جديد': '+ New count', 'مفتوح': 'Open', 'مغلق': 'Closed',
  'إدخال الجرد': 'Enter count', 'عرض الفروقات': 'View variance', 'لا عمليات جرد': 'No counts', '🔍 بدء جرد جديد': '🔍 Start new count', 'بدء الجرد': 'Start count',
  'سيتم تجميد الرصيد الدفتري الحالي لكل مادة كمرجع للمقارنة.': 'Current book balance for each material will be frozen as reference.',
  'دفتري': 'Book', 'فعلي': 'Actual', 'الفرق': 'Diff', 'قيمة الفرق': 'Diff value', 'صافي فرق الجرد (− عجز / + فائض)': 'Net variance (− short / + over)', '💾 حفظ مؤقت': '💾 Save draft',
  '✅ إنهاء واعتماد الفروقات': '✅ Close & post variance', 'إغلاق النافذة': 'Close window', 'حُفظ مؤقتاً': 'Draft saved', 'إنهاء الجرد واعتماد الفروقات كتسويات مخزنية؟': 'Close count and post variances as adjustments?',
  'تم اعتماد الجرد ✅': 'Count posted ✅',
  // التقارير
  'الربحية والهدر وأداء الموردين': 'Profitability, waste and supplier performance', 'من': 'From', 'إلى': 'To', 'صافي الربح': 'Net profit', 'نسبة الهدر من التكلفة': 'Waste % of cost',
  '💹 المبيعات والأرباح يومياً': '💹 Daily sales & profit', '🥡 حسب نوع الطلب': '🥡 By order type', '🍽️ ربحية الأصناف': '🍽️ Product profitability', 'التكلفة': 'Cost',
  'تقرير الهدر والعجز': 'Waste & variance', 'تكلفة التوالف': 'Waste cost', 'عجز الجرد': 'Count shortage', 'فائض الجرد': 'Count surplus', '🚚 أداء الموردين': '🚚 Supplier performance',
  'الفواتير': 'Invoices', 'آخر توريد': 'Last supply', 'لا مبيعات بالفترة': 'No sales in range', 'لا هدر مسجل ✅': 'No waste logged ✅', 'لا موردين': 'No suppliers', 'كمية الهدر': 'Waste qty',
  'مبيعات': 'Sales', 'ربح': 'Profit',
  // الموظفون
  'إضافة الموظفين وتحديد أدوارهم وصلاحياتهم': 'Add staff and set their roles & permissions', '+ موظف جديد': '+ New staff', 'الاسم': 'Name', 'البريد': 'Email', 'الدور': 'Role',
  'مفعّل': 'Active', 'موقوف': 'Disabled', 'موظف جديد': 'New staff', 'تعديل موظف': 'Edit staff', 'كلمة المرور (اتركها فارغة لعدم التغيير)': 'Password (leave empty to keep)', 'PIN سريع': 'Quick PIN',
  // الإعدادات
  'بيانات الكافيه والضريبة، وكل القوائم الديناميكية': 'Cafe info, tax and all dynamic lists', '🏪 بيانات المكان والفاتورة': '🏪 Place & receipt info', 'اسم المكان': 'Place name',
  'الشعار / الوصف': 'Tagline', 'نسبة الضريبة %': 'Tax rate %', 'العملة': 'Currency', 'العنوان': 'Address', 'الهاتف': 'Phone', 'تذييل الفاتورة': 'Receipt footer', '💾 حفظ الإعدادات': '💾 Save settings',
  '🗂️ القوائم الديناميكية': '🗂️ Dynamic lists', 'حُفظت الإعدادات ✅': 'Settings saved ✅',
  '🏷️ التصنيفات': '🏷️ Categories', '🪑 الطاولات': '🪑 Tables', '💳 طرق الدفع': '💳 Payment methods', '📏 الوحدات': '📏 Units', '🏬 المخازن': '🏬 Warehouses', '🚚 الموردون': '🚚 Suppliers',
  'الاسم': 'Name', 'أيقونة': 'Icon', 'لون': 'Color', 'ترتيب': 'Order', 'مقاعد': 'Seats', 'الرمز': 'Symbol', 'هاتف': 'Phone', 'ملاحظات': 'Notes', 'مفعّل': 'Active',
  'تأكيد': 'Confirm', 'لا بيانات': 'No data',
  'حذف': 'Delete', 'تم حذف الفاتورة': 'Invoice deleted',
  '⚠️ منطقة الخطر': '⚠️ Danger Zone',
  'مسح جميع الفواتير والحركات المالية': 'Delete all invoices & financial records',
  'هذا الإجراء سيحذف جميع الطلبات والفواتير والمشتريات والمصروفات وحركات المخزون والجرد نهائياً. لن يمس المنتجات أو الأصناف أو التصنيفات أو المخزون.': 'This will permanently delete all orders, invoices, purchases, expenses, inventory transactions and stock counts. Products, categories and inventory will NOT be affected.',
  '🗑️ مسح الحركات المالية': '🗑️ Delete Financial Records',
  'تم مسح جميع الحركات المالية ✅': 'All financial records deleted ✅',
};
const loc = () => LANG === 'en' ? 'en-GB' : 'ar-EG';
const t = (s) => LANG === 'en' ? (I18N[s] ?? s) : s;
const L = (ar, en) => LANG === 'en' ? en : ar;

// ---------- API ----------
async function api(path, { method = 'GET', body } = {}) {
  const o = { method, headers: {} };
  if (TOKEN) o.headers.Authorization = 'Bearer ' + TOKEN;
  if (body) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
  const r = await fetch('/api' + path, o);
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && ME) { logout(); throw new Error('Session expired'); }
  if (!r.ok) throw new Error(d.error || 'Error');
  return d;
}

// ---------- مساعدات ----------
const esc = (s) => (s ?? '').toString().replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cur = () => (META?.settings?.currency || 'EGP');
const money = (n) => (+n || 0).toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + cur();
// هل قيمة صورة الصنف رابط صورة (لا إيموجي)؟
const isImg = (s) => !!s && (s.startsWith('http') || s.startsWith('/uploads'));
// عرض صورة الصنف: صورة أو إيموجي — cls لصنف الـ img
const prodThumb = (img, cls = '') => isImg(img) ? `<img src="${esc(img)}" class="${cls}" alt="" loading="lazy">` : `<span class="${cls}">${img || '🍽️'}</span>`;
const num = (n, d = 0) => (+n || 0).toLocaleString(loc(), { maximumFractionDigits: d });
const dt = (s) => s ? new Date(s).toLocaleString(loc(), { dateStyle: 'short', timeStyle: 'short' }) : '—';
const dDay = (s) => s ? new Date(s).toLocaleDateString(loc(), { day: '2-digit', month: 'short' }) : '—';
const ago = (s) => { const m = Math.floor((Date.now() - new Date(s)) / 60000); return m < 1 ? t('الآن') : m < 60 ? L(`منذ ${m} د`, `${m}m ago`) : L(`منذ ${Math.floor(m / 60)} س`, `${Math.floor(m / 60)}h ago`); };
const todayStr = () => new Date().toLocaleDateString('en-CA');   // تاريخ اليوم المحلي (وليس UTC)

function toast(msg, kind = 'ok') { const x = document.createElement('div'); x.className = 'toast ' + kind; x.textContent = msg; document.body.appendChild(x); setTimeout(() => x.remove(), 3200); }
function modal(html, cls = '') { const bg = document.createElement('div'); bg.className = 'modal-bg'; bg.innerHTML = `<div class="modal ${cls}">${html}</div>`; bg.addEventListener('mousedown', e => { if (e.target === bg) bg.remove(); }); document.body.appendChild(bg); return bg; }
function confirmDialog(msg, onYes, danger = true) {
  const m = modal(`<h3>${t('تأكيد')}</h3><p style="color:var(--text2);margin-bottom:8px">${esc(msg)}</p>
    <div class="modal-actions"><button class="btn btn-ghost" id="c-no">${t('إلغاء')}</button>
    <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="c-yes">${t('تأكيد')}</button></div>`);
  $('#c-no', m).onclick = () => m.remove();
  $('#c-yes', m).onclick = () => { m.remove(); onYes(); };
}
const STATUS = { open: ['🟠 فاتورة مفتوحة', '🟠 Open tab'], confirmed: ['بالمطبخ', 'In kitchen'], paid: ['مدفوع', 'Paid'], cancelled: ['ملغي', 'Cancelled'], new: ['جديد', 'New'], preparing: ['تحضير', 'Preparing'], ready: ['جاهز', 'Ready'], served: ['تم التقديم', 'Served'] };
const TYPE = { dine_in: ['🪑 صالة', '🪑 Dine-in'], takeaway: ['🥡 تيك أواي', '🥡 Takeaway'], delivery: ['🛵 توصيل', '🛵 Delivery'] };
const LL = (m, k) => m[k] ? m[k][LANG === 'en' ? 1 : 0] : k;
const stBadge = (s) => `<span class="badge-st st-${s}">${LL(STATUS, s)}</span>`;

// ---------- الهوية (اللوجو + لون الثيم + الوضع الشفاف) ----------
let BRANDING = { theme_preset: localStorage.getItem('cafe_preset') || 'seaside', theme_glass: localStorage.getItem('cafe_glass') || '0', custom_logo: localStorage.getItem('cafe_custom_logo') === '1' };
let LOGO_SRC = BRANDING.custom_logo ? '/logo-custom.png' : '/logo.jpeg';
const logoMark = (cls = '') => `<img src="${LOGO_SRC}${LOGO_SRC.includes('custom') ? '?v=' + (localStorage.getItem('cafe_logo_v') || '') : ''}" class="logo-img ${BRANDING.custom_logo ? '' : 'default-logo'} ${cls}" alt="logo">`;
function applyBranding(b) {
  if (b) BRANDING = { ...BRANDING, ...b };
  const de = document.documentElement;
  de.setAttribute('data-preset', BRANDING.theme_preset || 'seaside');
  if (BRANDING.theme_glass === '1') de.setAttribute('data-glass', '1'); else de.removeAttribute('data-glass');
  LOGO_SRC = BRANDING.custom_logo ? '/logo-custom.png' : '/logo.jpeg';
  // كاش محلي لتفادي وميض الألوان عند التحميل
  localStorage.setItem('cafe_preset', BRANDING.theme_preset || 'seaside');
  localStorage.setItem('cafe_glass', BRANDING.theme_glass || '0');
  localStorage.setItem('cafe_custom_logo', BRANDING.custom_logo ? '1' : '0');
}
async function fetchBranding() {
  try { applyBranding(await (await fetch('/api/branding')).json()); } catch { /* أوفلاين؟ يبقى الكاش */ }
}

// ---------- لغة وثيم ----------
function setLang(l) {
  LANG = l; localStorage.setItem('cafe_lang', l);
  document.documentElement.lang = l; document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  if (ME) { renderShell(); route(); } else renderLogin();
}
function setTheme(th) {
  THEME = th; localStorage.setItem('cafe_theme', th);
  document.documentElement.setAttribute('data-theme', th);
  $$('.theme-ic').forEach(b => b.textContent = th === 'dark' ? '☀️' : '🌙');
}
const langBtn = (id) => `<button class="t-btn" id="${id}" title="AR / EN">${LANG === 'en' ? 'ع' : 'EN'}</button>`;
const themeBtn = (id) => `<button class="t-btn theme-ic" id="${id}" title="theme">${THEME === 'dark' ? '☀️' : '🌙'}</button>`;

// ===================================================================
//  الدخول
// ===================================================================
function renderLogin() {
  root.innerHTML = `<div class="login-wrap"><div class="login-card">
    <div class="login-top">${langBtn('lg-lang')}${themeBtn('lg-theme')}</div>
    ${logoMark('login-logo-img')}
    <div class="sub">${t('نظام نقاط البيع وإدارة المخازن')}</div>
    <form id="lf">
      <div class="field"><label>${t('البريد الإلكتروني')}</label><input id="email" type="email" placeholder="email@example.com" autocomplete="username"></div>
      <div class="field"><label>${t('كلمة المرور')}</label><input id="pass" type="password" autocomplete="current-password"></div>
      <button class="btn btn-primary btn-block btn-lg" type="submit">${t('دخول')}</button>
      <div class="err" id="le"></div>
    </form>
    <div class="build-tag">v${APP_BUILD}</div>
  </div></div>`;
  $('#lg-lang').onclick = () => setLang(LANG === 'en' ? 'ar' : 'en');
  $('#lg-theme').onclick = () => setTheme(THEME === 'dark' ? 'light' : 'dark');
  $('#lf').onsubmit = async (e) => {
    e.preventDefault(); $('#le').textContent = '';
    try {
      const d = await api('/login', { method: 'POST', body: { email: $('#email').value.trim(), password: $('#pass').value } });
      TOKEN = d.token; localStorage.setItem('cafe_token', TOKEN); await boot();
    } catch (err) { $('#le').textContent = err.message; }
  };
}
function logout() { TOKEN = null; localStorage.removeItem('cafe_token'); ME = null; location.hash = ''; renderLogin(); }

// ===================================================================
//  التنقل والهيكل
// ===================================================================
const NAV = [
  { sec: 'الشاشة العامة' },
  { id: 'dashboard', ic: '📊', t: 'لوحة التحكم', roles: ['admin'] },
  { id: 'pos', ic: '🧾', t: 'نقطة البيع', roles: ['admin', 'cashier'] },
  { id: 'orders', ic: '📋', t: 'مراجعة الفواتير', roles: ['admin', 'cashier', 'kitchen', 'bar'] },
  { id: 'qrorders', ic: '📲', t: 'طلبات الطاولات', roles: ['admin', 'cashier'] },
  { id: 'delivery', ic: '🛵', t: 'طلبات الدليفري', roles: ['admin', 'cashier'] },
  { id: 'kds', ic: '👨‍🍳', t: 'شاشة المطبخ', roles: ['admin', 'kitchen'] },
  { id: 'bar', ic: '🍹', t: 'شاشة البار', roles: ['admin', 'bar'] },
  { sec: 'العمليات اليومية' },
  { id: 'shifts', ic: '⏱️', t: 'الورديات والعهدة', roles: ['admin', 'cashier'] },
  { id: 'tables', ic: '🪑', t: 'الطاولات و QR', roles: ['admin'] },
  { id: 'customers', ic: '👤', t: 'العملاء', roles: ['admin', 'cashier'] },
  { id: 'shop', ic: '🌐', t: 'متجر العميل أونلاين', roles: ['admin'] },
  { id: 'returns', ic: '↩️', t: 'المرتجعات', roles: ['admin'] },
  { id: 'points', ic: '⭐', t: 'نقاط الولاء', roles: ['admin'] },
  { id: 'requests', ic: '🛒', t: 'طلبات الشراء', roles: ['admin', 'kitchen', 'bar'] },
  { id: 'notifications', ic: '🔔', t: 'الإشعارات', roles: ['admin', 'cashier', 'kitchen', 'bar'] },
  { sec: 'المالية' },
  { id: 'treasury', ic: '🏦', t: 'الخزينة وطرق الدفع', roles: ['admin'] },
  { id: 'vouchers', ic: '🧾', t: 'سندات قبض وصرف', roles: ['admin'] },
  { id: 'parties', ic: '🤝', t: 'الأطراف العامة', roles: ['admin'] },
  { id: 'expenses', ic: '💸', t: 'المصروفات', roles: ['admin'] },
  { sec: 'المخزون والمشتريات' },
  { id: 'inventory', ic: '📦', t: 'المخزون', roles: ['admin'] },
  { id: 'purchases', ic: '🚚', t: 'المشتريات', roles: ['admin'] },
  { id: 'waste', ic: '🗑️', t: 'التوالف والهدر', roles: ['admin'] },
  { id: 'stockcount', ic: '🔍', t: 'الجرد', roles: ['admin'] },
  { id: 'barcodes', ic: '🏷️', t: 'طباعة باركود', roles: ['admin'] },
  { sec: 'الإدارة' },
  { id: 'products', ic: '🍽️', t: 'الأصناف والوصفات', roles: ['admin'] },
  { id: 'reports', ic: '📈', t: 'تقارير الحوكمة', roles: ['admin'] },
  { id: 'staff', ic: '👥', t: 'الموظفون', roles: ['admin'] },
  { id: 'config', ic: '⚙️', t: 'الإعدادات', roles: ['admin'] },
  { id: 'backup', ic: '💾', t: 'النسخ الاحتياطي', roles: ['admin'] },
];
// الصلاحيات: الأدمن يرى كل شيء، الباقي حسب مصفوفة صلاحيات دوره (ME.perms من السيرفر)
// fallback على roles القديمة لو الدور بلا مصفوفة (توافقاً مع بيانات قديمة)
const hasPerm = (key) => ME?.role_key === 'admin' || (ME?.perms || []).includes(key);
const can = (id) => {
  const n = NAV.find(x => x.id === id); if (!n) return false;
  if (ME.role_key === 'admin') return true;
  if (Array.isArray(ME.perms) && ME.perms.length) return ME.perms.includes(id + '.view');
  return n.roles.includes(ME.role_key);
};
const firstRoute = () => (NAV.find(n => n.id && can(n.id)) || { id: 'pos' }).id;

// أزرار الهيدر العلوي المتاحة — يُتحكم في ظهورها من الإعدادات (topbar_icons)
const TOPBAR = [
  { id: 'fullscreen', ic: '⛶', t: ['ملء الشاشة', 'Fullscreen'] },
  { id: 'pos', ic: '🧾', t: ['نقطة البيع', 'POS'], roles: ['admin', 'cashier'] },
  { id: 'orders', ic: '📋', t: ['مراجعة الفواتير', 'Invoices'], roles: ['admin', 'cashier', 'kitchen', 'bar'] },
  { id: 'qrorders', ic: '📲', t: ['طلبات الطاولات', 'QR orders'], roles: ['admin', 'cashier'], badge: true },
  { id: 'delivery', ic: '🛵', t: ['طلبات الدليفري', 'Delivery'], roles: ['admin', 'cashier'], badge: true },
  { id: 'kds', ic: '👨‍🍳', t: ['المطبخ', 'Kitchen'], roles: ['admin', 'kitchen'], badge: true },
  { id: 'menu', ic: '🌐', t: ['موقع العميل', 'Customer site'], roles: ['admin'] },
  { id: 'calc', ic: '🧮', t: ['حاسبة', 'Calculator'] },
];
const topbarEnabled = () => { try { return JSON.parse(META.settings.topbar_icons || 'null') || TOPBAR.map(x => x.id); } catch { return TOPBAR.map(x => x.id); } };
function renderShell() {
  const items = NAV.map(n => {
    if (n.sec) return `<div class="sec">${t(n.sec)}</div>`;
    if (!can(n.id)) return '';
    return `<a href="#/${n.id}" data-r="${n.id}"><span class="ic">${n.ic}</span> ${t(n.t)}<span class="badge hidden" id="badge-${n.id}"></span></a>`;
  }).join('');
  const enabled = topbarEnabled();
  const topIcons = TOPBAR.filter(x => enabled.includes(x.id) && (!x.roles || x.roles.includes(ME.role_key))).map(x =>
    `<button class="tb-btn" data-tb="${x.id}" title="${L(x.t[0], x.t[1])}"><span class="tb-ic">${x.ic}</span>${x.badge ? `<span class="tb-badge hidden" id="tbadge-${x.id}"></span>` : ''}</button>`).join('');
  root.innerHTML = `<div class="app">
    <aside class="sidebar" id="sidebar">
      <div class="sb-brand"><span class="sb-logo-pill">${logoMark('sb-logo')}</span><div class="t">${esc(META.settings.cafe_name || 'seaside')}<small>${esc(META.settings.tagline || '')}</small></div></div>
      <nav class="nav">${items}</nav>
      <div class="sb-foot">
        <div class="sb-clock" id="clock"></div>
        <a class="sb-cust-site" id="sb-menu" title="${t('موقع الطلب للعميل')}">🌐 ${t('موقع العميل')}</a>
        <div class="sb-toggles"><button id="sb-lang">${LANG === 'en' ? 'العربية' : 'English'}</button><button id="sb-theme">${THEME === 'dark' ? '☀️ Light' : '🌙 Dark'}</button></div>
        <div class="u"><div class="av">${esc((ME.full_name || '?')[0])}</div><div><div class="nm">${esc(ME.full_name)}</div><div class="rl">${esc(ME.role_name)}</div></div></div>
        <a class="logout" id="logout">↩ ${t('تسجيل الخروج')}</a>
        <div class="build-tag sb">v${APP_BUILD}</div>
      </div>
    </aside>
    <div class="sb-overlay" id="sb-overlay"></div>
    <main class="main-wrap">
      <header class="topbar">
        <button class="tb-menu" id="tb-hamburger" title="${t('القائمة')}">☰</button>
        <div class="tb-title" id="tb-title"></div>
        <div class="tb-spacer"></div>
        <div class="tb-icons">${topIcons}</div>
      </header>
      <div class="main" id="view"><div class="loading">…</div></div>
    </main></div>`;
  $('#logout').onclick = logout;
  $('#sb-lang').onclick = () => setLang(LANG === 'en' ? 'ar' : 'en');
  $('#sb-theme').onclick = () => setTheme(THEME === 'dark' ? 'light' : 'dark');
  $('#sb-menu').onclick = () => window.open('/menu', '_blank');
  const syncOverlay = () => $('#sb-overlay').classList.toggle('show', $('#sidebar').classList.contains('open'));
  $('#tb-hamburger').onclick = () => { $('#sidebar').classList.toggle('open'); syncOverlay(); };
  $('#sb-overlay').onclick = () => { $('#sidebar').classList.remove('open'); syncOverlay(); };
  $$('.nav a').forEach(a => a.onclick = () => { $('#sidebar').classList.remove('open'); syncOverlay(); });
  $$('.tb-btn').forEach(b => b.onclick = () => topbarAction(b.dataset.tb));
  startClock();
}
// تنفيذ أيقونات الهيدر
function topbarAction(id) {
  if (id === 'fullscreen') {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  } else if (id === 'menu') {
    window.open('/menu', '_blank');
  } else if (id === 'calc') {
    openCalculator();
  } else {
    location.hash = '#/' + id;
  }
}
// حاسبة سريعة
function openCalculator() {
  const m = modal(`<h3>🧮 ${t('حاسبة')}</h3>
    <input id="calc-d" class="calc-display" value="0" readonly>
    <div class="calc-pad">
      ${['C', '÷', '×', '⌫', '7', '8', '9', '−', '4', '5', '6', '+', '1', '2', '3', '=', '0', '.', ''].map(k => k === '' ? '' : `<button class="calc-k ${'÷×−+='.includes(k) ? 'op' : k === 'C' || k === '⌫' ? 'fn' : ''} ${k === '=' ? 'eq' : ''} ${k === '0' ? 'zero' : ''}" data-k="${k}">${k}</button>`).join('')}
    </div>`, 'calc-modal');
  let expr = '';
  const disp = $('#calc-d', m);
  const upd = () => disp.value = expr || '0';
  $$('.calc-k', m).forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    if (k === 'C') expr = '';
    else if (k === '⌫') expr = expr.slice(0, -1);
    else if (k === '=') { try { expr = String(eval(expr.replace(/÷/g, '/').replace(/×/g, '*').replace(/−/g, '-')) ?? ''); } catch { expr = 'خطأ'; } }
    else expr += k;
    upd();
  });
}
let clockTimer = null;
function startClock() {
  if (clockTimer) clearInterval(clockTimer);
  const tick = () => { const el = $('#clock'); if (!el) return clearInterval(clockTimer); const d = new Date();
    el.innerHTML = `<div class="tm">${d.toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>${d.toLocaleDateString(loc(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`; };
  tick(); clockTimer = setInterval(tick, 1000);
}
function setActive() {
  const cur = location.hash.split('/')[1] || '';
  $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.r === cur));
  $$('.tb-btn').forEach(b => b.classList.toggle('active', b.dataset.tb === cur));
  // عنوان الصفحة في الهيدر
  const nav = NAV.find(n => n.id === cur);
  const tt = $('#tb-title'); if (tt && nav) tt.innerHTML = `<span class="tt-ic">${nav.ic}</span> ${t(nav.t)}`;
}
const setBadge = (sel, n) => { const b = $(sel); if (b) { b.textContent = n; b.classList.toggle('hidden', !n); } };
function refreshKDSBadge() {
  if (!ME) return;
  if (can('kds')) api('/kds').then(o => { setBadge('#badge-kds', o.length); setBadge('#tbadge-kds', o.length); }).catch(() => {});
  if (can('bar')) api('/bar').then(o => setBadge('#badge-bar', o.length)).catch(() => {});
}
function refreshNotifBadge() {
  if (!ME) return;
  api('/notifications/count').then(d => { const b = $('#badge-notifications'); if (b) { b.textContent = d.count; b.classList.toggle('hidden', !d.count); } }).catch(() => {});
  if (can('requests')) api('/purchase-requests').then(rs => { const pend = rs.filter(r => r.status === 'pending').length; const rb = $('#badge-requests'); if (rb) { rb.textContent = pend; rb.classList.toggle('hidden', !pend); } }).catch(() => {});
}
// عدّاد طلبات QR المنتظرة على القائمة الجانبية + جرس تنبيه عند وصول طلب جديد
let LAST_QR_COUNT = null;
function qrDing() {
  try {
    const ac = (qrDing._ac ??= new (window.AudioContext || window.webkitAudioContext)());
    if (ac.state === 'suspended') ac.resume();
    // نغمتان متتاليتان (دينج-دونج) بدون أي ملفات صوت
    [[880, 0], [1174.7, 0.18]].forEach(([f, at]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.001, ac.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.35, ac.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + at + 0.45);
      o.connect(g); g.connect(ac.destination);
      o.start(ac.currentTime + at); o.stop(ac.currentTime + at + 0.5);
    });
  } catch { /* المتصفح مانع الصوت قبل أول تفاعل — يتجاهل بصمت */ }
}
function refreshQRBadge() {
  if (!ME || !can('qrorders')) return;
  api('/qr-orders/count').then(d => {
    // عدّادات منفصلة: طاولات ودليفري (كل شاشة لعدّادها)
    setBadge('#badge-qrorders', d.tables); setBadge('#tbadge-qrorders', d.tables);
    setBadge('#badge-delivery', d.delivery); setBadge('#tbadge-delivery', d.delivery);
    // طلب جديد وصل → جرس + توست (أول تحميل لا يرن) مع تمييز النوع
    if (LAST_QR_COUNT !== null && d.count > LAST_QR_COUNT) {
      qrDing();
      const newDel = LAST_QR_DEL !== null && d.delivery > LAST_QR_DEL;
      toast(newDel ? '🛵 ' + t('طلب دليفري جديد وصل!') : '📲 ' + t('طلب طاولة جديد وصل!'), 'warn');
    }
    LAST_QR_COUNT = d.count; LAST_QR_DEL = d.delivery;
  }).catch(() => {});
}
let LAST_QR_DEL = null;
let ALERTS = { low: [], count: 0 };
function refreshAlertsBadge() {
  if (!ME || !can('inventory')) return;
  api('/alerts').then(d => { ALERTS = d; const b = $('#badge-inventory'); if (b) { b.textContent = d.count; b.classList.toggle('hidden', !d.count); } }).catch(() => {});
}
function showAlerts() {
  const d = ALERTS;
  modal(`<h3>🔔 ${L('تنبيهات نقص المخزون', 'Low-stock alerts')} ${d.count ? `<span class="chip low">${d.count}</span>` : ''}</h3>
    ${d.low.length ? d.low.map(m => `<div style="padding:11px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;font-weight:700"><span>⚠️ ${esc(m.name_ar)}</span><span style="color:var(--red)">${num(m.qty, 1)} ${esc(m.unit || '')} / ${num(m.reorder_point, 1)}</span></div>
      ${m.products.length ? `<div style="font-size:12px;color:var(--text2);margin-top:4px">${L('يؤثر على', 'Affects')}: ${m.products.map(esc).join('، ')}</div>` : ''}
    </div>`).join('') : `<div class="empty">${L('كل المخزون في أمان ✅', 'All stock is healthy ✅')}</div>`}
    <div class="modal-actions"><button class="btn btn-ghost" onclick="this.closest('.modal-bg').remove()">${t('إغلاق')}</button>
    ${can('purchases') ? `<button class="btn btn-primary" onclick="this.closest('.modal-bg').remove();location.hash='#/purchases'">🚚 ${L('شراء', 'Purchase')}</button>` : ''}</div>`, 'wide');
}

const ROUTES = {};
async function route() {
  if (!ME) return;
  const id = location.hash.split('/')[1] || firstRoute();
  if (!can(id)) { location.hash = '#/' + firstRoute(); return; }
  setActive();
  const view = $('#view'); view.innerHTML = '<div class="loading">…</div>';
  try { await (ROUTES[id] || ROUTES.pos)(view); } catch (e) { view.innerHTML = `<div class="card"><p style="color:var(--red)">⚠️ ${esc(e.message)}</p></div>`; }
  refreshKDSBadge(); refreshAlertsBadge(); refreshNotifBadge();
}
window.addEventListener('hashchange', route);

async function boot() {
  await fetchBranding();
  ME = await api('/me'); META = await api('/meta');
  renderShell();
  if (!location.hash || !can(location.hash.split('/')[1])) location.hash = '#/' + firstRoute();
  route();
  refreshQRBadge();
  setInterval(() => { refreshKDSBadge(); refreshAlertsBadge(); refreshNotifBadge(); }, 20000);
  setInterval(refreshQRBadge, 8000);   // جرس طلبات الطاولات — استجابة أسرع
}

// ===================================================================
//  لوحة المعلومات
// ===================================================================
ROUTES.dashboard = async (view) => {
  const d = await api('/dashboard');
  const delta = (p) => p === 0 ? '' : `<div class="delta ${p > 0 ? 'up' : 'down'}">${p > 0 ? '▲' : '▼'} ${Math.abs(p)}% ${t('عن أمس')}</div>`;
  view.innerHTML = `
    <div class="page-head"><div><h2>📊 ${t('لوحة المعلومات')}</h2><div class="crumb">${t('نظرة لحظية على مبيعات وأرباح اليوم')}</div></div>
      <div class="head-actions"><button class="btn btn-primary" onclick="location.hash='#/pos'">${t('🧾 فتح الكاشير')}</button></div></div>
    <div class="kpi-grid">
      <div class="kpi"><div class="lbl">${t('طلبات اليوم')}</div><div class="val">${num(d.today.orders)}</div>${delta(d.today.ordersPct)}<span class="ic">🧾</span></div>
      <div class="kpi sand"><div class="lbl">${t('مبيعات اليوم')}</div><div class="val">${money(d.today.sales)}</div>${delta(d.today.salesPct)}<span class="ic">💰</span></div>
      <div class="kpi green"><div class="lbl">${t('أرباح اليوم (بعد التكلفة)')}</div><div class="val">${money(d.today.profit)}</div>${delta(d.today.profitPct)}<span class="ic">📈</span></div>
      <div class="kpi amber"><div class="lbl">${t('متوسط الفاتورة')}</div><div class="val">${money(d.avgOrder)}</div><span class="ic">🧮</span></div>
    </div>
    <div class="card"><h3 style="justify-content:space-between"><span>📈 ${t('ملخص المبيعات')}</span><span class="period-tabs" id="pt-sales">${periodTabs()}</span></h3><canvas id="ch-trend" height="90"></canvas></div>
    <div class="grid-2">
      <div class="card"><h3 style="justify-content:space-between"><span>💰 ${t('صافي الربح')}</span><span class="period-tabs" id="pt-net">${periodTabs()}</span></h3><canvas id="ch-net" height="120"></canvas></div>
      <div class="card"><h3>💳 ${t('طرق الدفع')}</h3><canvas id="ch-pay" height="120"></canvas></div>
    </div>
    <div class="grid-2">
      <div class="card"><h3>⭐ ${t('الأكثر مبيعاً')}</h3>
        <div class="t-wrap"><table><thead><tr><th>${t('الصنف')}</th><th>${t('الكمية')}</th><th>${t('المبيعات')}</th></tr></thead><tbody>
        ${d.topProducts.map(p => `<tr><td>${esc(p.name_ar)}</td><td class="t-num">${num(p.qty)}</td><td class="t-num">${money(p.sales)}</td></tr>`).join('') || `<tr><td colspan="3" class="empty">${t('لا بيانات')}</td></tr>`}
        </tbody></table></div></div>
      <div class="card"><h3>⚠️ ${t('مواد قاربت النفاد')} ${d.lowStockCount ? `<span class="chip low">${d.lowStockCount}</span>` : ''}</h3>
        <div class="t-wrap"><table><thead><tr><th>${t('المادة')}</th><th>${t('المتبقي')}</th><th>${t('حد الطلب')}</th></tr></thead><tbody>
        ${d.lowStock.map(m => `<tr><td>${esc(m.name_ar)}</td><td class="t-num" style="color:var(--red)">${num(m.qty, 1)}</td><td class="t-num">${num(m.reorder_point, 1)}</td></tr>`).join('') || `<tr><td colspan="3" class="empty">${t('كل المخزون في أمان ✅')}</td></tr>`}
        </tbody></table></div></div>
    </div>
    <div class="card"><h3>🕒 ${t('أحدث الطلبات')}</h3>
      <div class="t-wrap"><table><thead><tr><th>${t('الفاتورة')}</th><th>${t('النوع')}</th><th>${t('الطاولة')}</th><th>${t('الإجمالي')}</th><th>${t('الحالة')}</th><th>${t('الوقت')}</th></tr></thead><tbody>
      ${d.recent.map(o => `<tr><td>${esc(o.invoice_no || '#' + o.id)}</td><td>${LL(TYPE, o.order_type)}</td><td>${esc(o.table_name || '—')}</td><td class="t-num">${money(o.total)}</td><td>${stBadge(o.status)}</td><td style="color:var(--text3)">${ago(o.created_at)}</td></tr>`).join('') || `<tr><td colspan="6" class="empty">${t('لا طلبات')}</td></tr>`}
      </tbody></table></div></div>`;

  Object.values(charts).forEach(c => c.destroy()); charts = {};
  charts.pay = new Chart($('#ch-pay'), { type: 'doughnut', data: { labels: d.byPayment.map(p => p.name_ar), datasets: [{ data: d.byPayment.map(p => p.total), backgroundColor: ['#0FB5BA', '#F2A65A', '#18A558', '#5C7A82', '#E2563B'] }] }, options: { plugins: { legend: { position: 'bottom', labels: { font: { family: fontFam() } } } } } });
  drawSeries('sales', 14); drawSeries('net', 14);
  $$('#pt-sales button').forEach(b => b.onclick = () => { $$('#pt-sales button').forEach(x => x.classList.toggle('active', x === b)); drawSeries('sales', +b.dataset.d); });
  $$('#pt-net button').forEach(b => b.onclick = () => { $$('#pt-net button').forEach(x => x.classList.toggle('active', x === b)); drawSeries('net', +b.dataset.d); });
};
const periodTabs = () => [['7', 'آخر ٧ أيام'], ['14', 'آخر ١٤ يوم'], ['30', 'آخر ٣٠ يوم']].map(p => `<button data-d="${p[0]}" class="${p[0] === '14' ? 'active' : ''}">${L(p[1], p[0] + 'd')}</button>`).join('');
async function drawSeries(which, days) {
  const data = await api('/dashboard/series?days=' + days).catch(() => []);
  const labels = data.map(x => dDay(x.d));
  if (which === 'sales') {
    if (charts.trend) charts.trend.destroy();
    charts.trend = new Chart($('#ch-trend'), { type: 'line', data: { labels, datasets: [{ label: t('المبيعات'), data: data.map(x => x.sales), borderColor: '#0FB5BA', backgroundColor: 'rgba(15,181,186,.14)', fill: true, tension: .35, borderWidth: 2.5, pointRadius: 2 }] }, options: chOpts() });
  } else {
    if (charts.net) charts.net.destroy();
    charts.net = new Chart($('#ch-net'), { type: 'bar', data: { labels, datasets: [{ label: t('صافي الربح'), data: data.map(x => x.net), backgroundColor: data.map(x => x.net < 0 ? '#E2563B' : '#18A558') }] }, options: chOpts() });
  }
}
const fontFam = () => LANG === 'en' ? 'Inter' : 'IBM Plex Sans Arabic';
const chOpts = () => ({ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { font: { family: fontFam() } } }, x: { ticks: { font: { family: fontFam() } } } } });

// ===================================================================
//  نقطة البيع (POS)
// ===================================================================
let CART = [], POS_PRODUCTS = [], POS_CAT = null, POS_STATE = { type: 'dine_in', table_id: '', guests: 1, waiter_id: '', discount: 0, customer: null, open_order: null };
let POS_SHIFT = null;   // الوردية المفتوحة للكاشير الحالي
let POS_VIEW = localStorage.getItem('cafe_pos_view') || 'compact';   // grid | compact | list

ROUTES.pos = async (view) => {
  const [prods, shiftInfo] = await Promise.all([api('/pos/products'), api('/shifts/current').catch(() => ({ open: false }))]);
  POS_PRODUCTS = prods;
  POS_SHIFT = shiftInfo.open ? shiftInfo.shift : null;
  view.innerHTML = `<div class="pos">
    <div class="pos-menu">
      <div class="pos-search">
        <input id="pos-q" placeholder="${t('🔍 ابحث عن صنف أو امسح الباركود…')}">
        <div class="view-toggle" title="${t('طريقة العرض')}">
          <button data-v="grid" title="${t('شبكة مريحة')}">▦</button>
          <button data-v="compact" title="${t('شبكة مضغوطة')}">▤</button>
          <button data-v="list" title="${t('قائمة')}">☰</button>
        </div>
      </div>
      <div class="cat-chips" id="cat-chips"></div>
      <div class="prod-grid" id="prod-grid"></div>
    </div>
    <div class="cart" id="cart"></div>
  </div>`;
  const syncViewBtns = () => $$('.view-toggle button', view).forEach(b => b.classList.toggle('active', b.dataset.v === POS_VIEW));
  $$('.view-toggle button', view).forEach(b => b.onclick = () => { POS_VIEW = b.dataset.v; localStorage.setItem('cafe_pos_view', POS_VIEW); syncViewBtns(); renderProducts(); });
  syncViewBtns();
  renderCats(); renderProducts(); renderCart();
  const q = $('#pos-q');
  q.oninput = renderProducts;
  // مسح باركود: قارئ الباركود يرسل الكود ثم Enter → إضافة مباشرة للسلة
  q.onkeydown = (e) => {
    if (e.key !== 'Enter') return;
    const v = q.value.trim();
    const p = POS_PRODUCTS.find(x => x.barcode === v || x.sku === v);
    if (p) { addToCart(p.id); q.value = ''; renderProducts(); toast('➕ ' + p.name_ar); }
  };
  q.focus();
  // إلزام الكاشير بفتح وردية قبل البيع (قابل للتعطيل من الإعدادات)
  if (!POS_SHIFT && shiftInfo.require && ME.role_key === 'cashier') openShiftModal(true);
};
function renderCats() {
  const cats = META.categories;
  $('#cat-chips').innerHTML = `<button class="cat-chip ${POS_CAT === null ? 'active' : ''}" data-c="">${t('الكل')}</button>` +
    cats.map(c => `<button class="cat-chip ${POS_CAT === c.id ? 'active' : ''}" data-c="${c.id}">${c.icon || ''} ${esc(c.name_ar)}</button>`).join('');
  $$('#cat-chips .cat-chip').forEach(b => b.onclick = () => { POS_CAT = b.dataset.c ? +b.dataset.c : null; renderCats(); renderProducts(); });
}
function renderProducts() {
  const q = ($('#pos-q')?.value || '').trim();
  const grid = $('#prod-grid'); if (!grid) return;
  let list = POS_PRODUCTS.filter(p => (POS_CAT === null || p.category_id === POS_CAT) &&
    (!q || p.name_ar.includes(q) || (p.barcode || '').includes(q) || (p.sku || '').toUpperCase().includes(q.toUpperCase())));
  grid.className = POS_VIEW === 'list' ? 'prod-list' : 'prod-grid' + (POS_VIEW === 'compact' ? ' compact' : '');
  grid.innerHTML = (POS_VIEW === 'list'
    ? list.map(p => `<div class="prod-row" data-id="${p.id}">
        <span class="cat-dot" style="background:${p.color || 'var(--sea)'}"></span>
        <span class="emoji ${isImg(p.image) ? 'has-img' : ''}">${prodThumb(p.image)}</span>
        <span class="nm">${esc(p.name_ar)}</span>
        <span class="pr">${money(p.price)}</span>
        <span class="add">+</span></div>`).join('')
    : list.map(p => `<div class="prod-card" data-id="${p.id}">
        <span class="cat-dot" style="background:${p.color || '#0FB5BA'}"></span>
        <span class="emoji ${isImg(p.image) ? 'has-img' : ''}">${prodThumb(p.image)}</span><span class="nm">${esc(p.name_ar)}</span><span class="pr">${money(p.price)}</span></div>`).join(''))
    || `<div class="empty" style="grid-column:1/-1">${t('لا أصناف')}</div>`;
  $$('#prod-grid [data-id]').forEach(c => c.onclick = () => addToCart(+c.dataset.id));
}
function addToCart(pid) {
  const p = POS_PRODUCTS.find(x => x.id === pid);
  const line = CART.find(c => c.product_id === pid && !c.note);
  if (line) line.qty++; else CART.push({ product_id: pid, name: p.name_ar, price: p.price, cost: p.cost, image: p.image, qty: 1, note: '' });
  renderCart();
}
function cartTotals() {
  const subtotal = CART.reduce((s, c) => s + c.price * c.qty, 0);
  const discount = +POS_STATE.discount || 0;
  const taxable = Math.max(0, subtotal - discount);
  // ضرائب متعددة مفعّلة (قيمة مضافة/خدمة/...) — كلٌّ على الوعاء بعد الخصم
  const taxes = (META.taxes || []).map(tx => ({ name: tx.name_ar, rate: tx.rate, amount: taxable * tx.rate / 100 }));
  const tax = taxes.reduce((s, tx) => s + tx.amount, 0);
  return { subtotal, discount, tax, taxes, total: taxable + tax };
}
// تسمية حقل البقشيش حسب نوع الطلب: صالة → بقشيش، تيك أواي/توصيل → مصاريف توصيل
const tipLabel = (type) => type === 'dine_in' ? t('بقشيش (اختياري)') : t('🛵 مصاريف التوصيل (اختياري)');
function renderCart() {
  const tot = cartTotals();
  const isDine = POS_STATE.type === 'dine_in';
  $('#cart').innerHTML = `
    <div class="cart-head">
      <div class="type-tabs">
        ${['dine_in', 'takeaway', 'delivery'].map(k => `<button data-t="${k}" class="${POS_STATE.type === k ? 'active' : ''}">${LL(TYPE, k)}</button>`).join('')}
      </div>
      <div class="cart-meta">
        ${isDine ? `<select id="c-table"><option value="">${t('— الطاولة —')}</option>${META.tables.map(x => `<option value="${x.id}" ${POS_STATE.table_id == x.id ? 'selected' : ''}>${esc(x.name_ar)}</option>`).join('')}</select>
        <input id="c-guests" type="number" min="1" value="${POS_STATE.guests}" style="max-width:70px" title="${t('عدد الأفراد')}">` : ''}
        <select id="c-waiter"><option value="">${t('— النادل —')}</option>${META.waiters.map(w => `<option value="${w.id}" ${POS_STATE.waiter_id == w.id ? 'selected' : ''}>${esc(w.full_name)}</option>`).join('')}</select>
      </div>
      ${POS_STATE.open_order ? `<div class="open-banner">🟠 ${t('استكمال فاتورة مفتوحة')} <b>${esc(POS_STATE.open_order.invoice_no)}</b><button id="ob-x" title="${L('إلغاء الاستكمال وبدء فاتورة جديدة', 'Detach and start fresh')}">✕</button></div>` : ''}
      <div class="cust-row">
        <button class="cust-pick" id="c-cust">${POS_STATE.customer
          ? `👤 ${esc(POS_STATE.customer.name_ar)}${pointsOn() ? ` <span class="chip pts">⭐ ${num(POS_STATE.customer.points, 1)}</span>` : ''}`
          : `👤 ${t('عميل نقدي — اضغط للاختيار')}`}</button>
        ${POS_STATE.customer ? `<button class="cust-x" id="c-cust-x" title="${t('إزالة العميل')}">✕</button>` : ''}
        ${POS_SHIFT ? `<span class="chip ok" title="${t('وردية مفتوحة')}">⏱️ #${POS_SHIFT.id}</span>`
          : (['admin', 'cashier'].includes(ME.role_key) ? `<button class="chip low" id="c-shift" style="cursor:pointer;border:none">⏱️ ${t('افتح وردية')}</button>` : '')}
      </div>
    </div>
    <div class="cart-items" id="cart-items">
      ${CART.length ? CART.map((c, i) => `<div class="ci">
        <div class="ci-nm"><div class="n">${prodThumb(c.image, 'ci-thumb')} ${esc(c.name)}</div><div class="note" data-n="${i}">${c.note ? '📝 ' + esc(c.note) : t('+ ملاحظة')}</div></div>
        <div class="qtybox"><button data-m="${i}">−</button><span class="q">${c.qty}</span><button data-p="${i}">+</button></div>
        <div class="ci-pr">${money(c.price * c.qty)}</div><button class="ci-x" data-x="${i}">✕</button></div>`).join('')
      : `<div class="cart-empty">${t('🛒 السلة فارغة')}<br><small>${t('اضغط على الأصناف لإضافتها')}</small></div>`}
    </div>
    <div class="cart-foot">
      <div class="sumline"><span>${t('الإجمالي الفرعي')}</span><span class="t-num">${money(tot.subtotal)}</span></div>
      <div class="sumline"><span>${t('خصم')}</span>${hasPerm('pos.discount')
        ? `<span class="disc-wrap"><input id="c-disc-in" type="number" min="0" step="any" value="${POS_STATE.discount || ''}" placeholder="0"> ${cur()}</span>`
        : `<span class="t-num">${money(tot.discount)}</span>`}</div>
      ${tot.taxes.filter(tx => tx.amount > 0).map(tx => `<div class="sumline"><span>${esc(tx.name)} (${num(tx.rate, 1)}%)</span><span class="t-num">${money(tx.amount)}</span></div>`).join('')}
      <div class="sumline total"><span>${t('المطلوب')}</span><span class="t-num">${money(tot.total)}</span></div>
      <div class="cart-actions">
        ${isDine
          ? (hasPerm('pos.draft') ? `<button class="btn btn-ghost" id="c-draft" ${CART.length ? '' : 'disabled'}>${L('💾 حفظ مؤقت', '💾 Save open tab')}</button>` : '')
          : (hasPerm('pos.create') ? `<button class="btn btn-ghost" id="c-send" ${CART.length ? '' : 'disabled'}>${L('👨‍🍳 إرسال للتحضير', '👨‍🍳 Send to prep')}</button>` : '')}
        ${hasPerm('pos.create') ? `<button class="btn btn-primary btn-block" id="c-pay" ${CART.length ? '' : 'disabled'}>${t('💵 الدفع')}</button>` : ''}
      </div>
    </div>`;

  $$('.type-tabs button').forEach(b => b.onclick = () => { POS_STATE.type = b.dataset.t; renderCart(); });
  $$('#cart-items [data-p]').forEach(b => b.onclick = () => { CART[+b.dataset.p].qty++; renderCart(); });
  $$('#cart-items [data-m]').forEach(b => b.onclick = () => { const i = +b.dataset.m; if (--CART[i].qty <= 0) CART.splice(i, 1); renderCart(); });
  $$('#cart-items [data-x]').forEach(b => b.onclick = () => { CART.splice(+b.dataset.x, 1); renderCart(); });
  $$('#cart-items [data-n]').forEach(b => b.onclick = () => { const i = +b.dataset.n; const v = prompt(t('ملاحظة / تعديل (مثال: بدون بصل، إضافي شوت):'), CART[i].note || ''); if (v !== null) { CART[i].note = v.trim(); renderCart(); } });
  const tbl = $('#c-table'); if (tbl) tbl.onchange = () => { POS_STATE.table_id = tbl.value; checkTableOpenOrder(tbl.value); };
  const g = $('#c-guests'); if (g) g.onchange = () => POS_STATE.guests = +g.value || 1;
  const w = $('#c-waiter'); if (w) w.onchange = () => POS_STATE.waiter_id = w.value;
  $('#c-cust').onclick = () => pickCustomer(c => { POS_STATE.customer = c; renderCart(); });
  const cx = $('#c-cust-x'); if (cx) cx.onclick = (e) => { e.stopPropagation(); POS_STATE.customer = null; renderCart(); };
  const sh = $('#c-shift'); if (sh) sh.onclick = () => openShiftModal(false);
  // خانة الخصم: تحديث القيم بدون إعادة رسم كامل (حتى لا يفقد الحقل التركيز أثناء الكتابة)
  const dIn = $('#c-disc-in'); if (dIn) dIn.oninput = () => {
    POS_STATE.discount = Math.max(0, +dIn.value || 0);
    const tot2 = cartTotals();
    const totEl = $('.cart-foot .sumline.total .t-num'); if (totEl) totEl.textContent = money(tot2.total);
  };
  const sendBtn = $('#c-send'); if (sendBtn) sendBtn.onclick = sendToKitchen;
  const draftBtn = $('#c-draft'); if (draftBtn) draftBtn.onclick = saveDraft;
  const obx = $('#ob-x'); if (obx) obx.onclick = () => confirmDialog(L('إلغاء الاستكمال؟ الفاتورة المفتوحة ستبقى كما هي محفوظة، وستبدأ فاتورة جديدة فارغة.', 'Detach? The open tab stays saved; you start a fresh order.'), () => { clearCart(); }, false);
  const payBtn = $('#c-pay'); if (payBtn) payBtn.onclick = openPayment;
}
// حفظ مؤقت (فاتورة مفتوحة) — للصالة فقط: تُحفظ ببيانات الطاولة ويمكن استكمالها لاحقاً
async function saveDraft() {
  if (POS_STATE.type !== 'dine_in') return;
  if (!POS_STATE.table_id) return toast(L('اختر الطاولة أولاً — الفاتورة المفتوحة تُحفظ على الطاولة', 'Pick a table first — open tabs are saved per table'), 'warn');
  try {
    const o = await api('/orders', { method: 'POST', body: orderPayload('open') });
    toast(`🟠 ${L('حُفظت فاتورة مفتوحة', 'Open tab saved')} — ${o.invoice_no} (${o.table_name || ''})`);
    clearCart(); refreshKDSBadge();
  } catch (e) { toast(e.message, 'err'); }
}
// عند اختيار طاولة: لو عليها فاتورة مفتوحة اعرض استكمالها
async function checkTableOpenOrder(tableId) {
  if (!tableId || POS_STATE.open_order) return;
  try {
    const rows = await api(`/orders?status=open&type=dine_in&table=${tableId}`);
    const open = rows.find(o => o.source !== 'qr');
    if (!open) return;
    confirmDialog(L(`الطاولة دي عليها فاتورة مفتوحة ${open.invoice_no} بإجمالي ${money(open.total)} — تحب تستكملها؟`,
      `This table has an open tab ${open.invoice_no} (${money(open.total)}) — resume it?`),
      () => resumeOpenOrder(open.id), false);
  } catch { /* تجاهل */ }
}
// استرجاع فاتورة مفتوحة لنقطة البيع (من اختيار الطاولة أو من شاشة الفواتير)
async function resumeOpenOrder(orderId) {
  try {
    const o = await api('/orders/' + orderId);
    if (o.status !== 'open') return toast(L('الفاتورة لم تعد مفتوحة', 'Tab is no longer open'), 'warn');
    CART = o.items.map(i => ({ oi_id: i.id, product_id: i.product_id, name: i.name_ar, price: i.price, cost: i.cost,
      image: (POS_PRODUCTS.find(p => p.id === i.product_id) || {}).image || '', qty: i.qty, note: i.note || '' }));
    POS_STATE.type = 'dine_in'; POS_STATE.table_id = o.table_id || ''; POS_STATE.guests = o.guests || 1;
    POS_STATE.waiter_id = o.waiter_id || ''; POS_STATE.discount = o.discount || 0;
    POS_STATE.customer = o.customer_id ? { id: o.customer_id, name_ar: o.customer_name, points: o.customer_points || 0 } : null;
    POS_STATE.open_order = { id: o.id, invoice_no: o.invoice_no };
    if (location.hash === '#/pos') renderCart(); else location.hash = '#/pos';
    toast(`🟠 ${L('جارٍ استكمال', 'Resuming')} ${o.invoice_no}`);
  } catch (e) { toast(e.message, 'err'); }
}
function orderPayload(status) {
  return {
    items: CART.map(c => ({ product_id: c.product_id, qty: c.qty, note: c.note || null, oi_id: c.oi_id || null })),
    order_type: POS_STATE.type, table_id: POS_STATE.type === 'dine_in' ? (POS_STATE.table_id || null) : null,
    guests: POS_STATE.guests, waiter_id: POS_STATE.waiter_id || null, discount: POS_STATE.discount || 0, status,
    customer_id: POS_STATE.customer?.id || null,
    order_id: POS_STATE.open_order?.id || null,   // استكمال فاتورة مفتوحة → تحديث بدل إنشاء
  };
}
// هل نظام النقاط مفعّل؟
const pointsOn = () => META?.settings?.points_enabled === '1';
async function sendToKitchen() {
  try { const o = await api('/orders', { method: 'POST', body: orderPayload('confirmed') });
    toast(t('أُرسل للمطبخ — ') + o.invoice_no); clearCart(); refreshKDSBadge();
  } catch (e) { toast(e.message, 'err'); }
}
function clearCart() { CART = []; POS_STATE.discount = 0; POS_STATE.table_id = ''; POS_STATE.customer = null; POS_STATE.open_order = null; renderCart(); }

// نافذة الدفع — نقدي أو انستاباي (حسب طرق الدفع المفعّلة)
function payMethodsHTML(selId) {
  return `<div class="pay-methods">${META.payment_methods.map(p => `<button type="button" class="pay-m ${p.id === selId ? 'active' : ''}" data-pm="${p.id}" data-kind="${p.kind}"><span class="e">${p.icon || '💳'}</span> ${L(p.name_ar, p.name_en || p.name_ar)}</button>`).join('')}</div>`;
}
function openPayment() {
  const tot = cartTotals();
  const methods = META.payment_methods;
  let method = methods[0] || { id: null, kind: 'cash' };
  let tip = POS_STATE.type === 'delivery' ? (+META.settings.delivery_fee || 0) : 0, usePoints = 0;
  let tendered = Math.ceil(tot.total + tip);
  const cust = POS_STATE.customer;
  const s = META.settings;
  const ptValue = +s.point_value || 0, minRedeem = +s.points_min_redeem || 0, maxPct = +s.points_max_discount_pct || 100;
  const canRedeem = pointsOn() && cust && (+cust.points || 0) >= minRedeem && ptValue > 0;
  const m = modal(`<h3>${t('💵 إتمام الدفع')}</h3>
    ${cust ? `<div class="pay-cust">👤 ${esc(cust.name_ar)} ${pointsOn() ? `<span class="chip pts">⭐ ${num(cust.points, 1)} ${t('نقطة')}</span>` : ''}</div>` : ''}
    ${payMethodsHTML(method.id)}
    <div class="sumline total"><span>${t('المطلوب')}</span><span class="t-num" id="pay-due">${money(tot.total)}</span></div>
    ${canRedeem ? `<div class="points-box">
      <label><input type="checkbox" id="pt-use" style="width:auto"> ⭐ ${t('الدفع بالنقاط')} <small>(${t('قيمة النقطة')}: ${money(ptValue)})</small></label>
      <div class="row hidden" id="pt-row" style="margin-top:8px">
        <div class="field" style="margin:0"><input id="pt-qty" type="number" min="0" max="${cust.points}" value="0" placeholder="${t('عدد النقاط')}"></div>
        <button class="btn btn-ghost btn-sm" id="pt-all">${t('كل النقاط')}</button>
      </div>
      <div id="pt-info" class="pt-info"></div>
    </div>` : ''}
    <div id="pay-cash-box">
      <div class="field"><label>${t('المبلغ المدفوع (نقداً)')}</label><input id="tendered" type="number" value="${tendered}"></div>
      <div class="change-big" id="change">${t('الباقي')}: ${money(tendered - tot.total)}</div>
      <div id="credit-hint" class="credit-hint hidden"></div>
    </div>
    <div id="pay-ref-box" class="hidden"><div class="field"><label>${L('رقم مرجع التحويل (اختياري)', 'Transfer reference (optional)')}</label><input id="pay-ref" placeholder="InstaPay ref"></div></div>
    <div class="field"><label>${tipLabel(POS_STATE.type)}</label><input id="tip" type="number" value="${POS_STATE.type === 'delivery' ? (+META.settings.delivery_fee || 0) : 0}"></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="p-x">${t('إلغاء')}</button>
      <button class="btn btn-primary btn-lg" id="p-go">${t('✅ تأكيد الدفع والطباعة')}</button></div>`);
  // إجمالي مستحق بعد خصم النقاط (عرض تقريبي — الحساب النهائي من الخادم)
  const dueNow = () => {
    let disc = usePoints * ptValue;
    const cap = tot.total * (maxPct / 100);
    if (disc > cap) disc = cap;
    return Math.max(0, +(tot.total - disc + tip).toFixed(2));
  };
  const syncMethod = () => {
    const cash = method.kind === 'cash';
    $('#pay-cash-box', m).classList.toggle('hidden', !cash);
    $('#pay-ref-box', m).classList.toggle('hidden', cash);
  };
  const upd = () => {
    tendered = +$('#tendered', m).value || 0; tip = +$('#tip', m).value || 0;
    if (canRedeem) {
      usePoints = $('#pt-use', m).checked ? Math.min(+$('#pt-qty', m).value || 0, +cust.points) : 0;
      $('#pt-info', m).textContent = usePoints ? `− ${money(Math.min(usePoints * ptValue, tot.total * maxPct / 100))}` : '';
    }
    const due = dueNow();
    $('#pay-due', m).textContent = money(due);
    const ch = tendered - due;
    $('#change', m).textContent = t('الباقي') + ': ' + money(ch > 0 ? ch : 0);
    // بيع آجل/جزئي: المدفوع أقل من المطلوب
    const short = +(due - tendered).toFixed(2);
    const hint = $('#credit-hint', m);
    if (method.kind === 'cash' && short > 0) {
      hint.classList.remove('hidden');
      hint.innerHTML = cust
        ? `🕒 ${t('سيُسجّل')} <b>${money(short)}</b> ${t('آجل على العميل')} <b>${esc(cust.name_ar)}</b>`
        : `⚠️ ${t('المبلغ أقل من المطلوب — اختر عميلاً لتسجيل الباقي آجلاً')}`;
    } else hint.classList.add('hidden');
  };
  $$('.pay-m', m).forEach(b => b.onclick = () => { method = methods.find(x => x.id === +b.dataset.pm); $$('.pay-m', m).forEach(x => x.classList.toggle('active', x === b)); syncMethod(); upd(); });
  $('#tendered', m).oninput = upd; $('#tip', m).oninput = upd;
  if (canRedeem) {
    $('#pt-use', m).onchange = () => { $('#pt-row', m).classList.toggle('hidden', !$('#pt-use', m).checked); upd(); };
    $('#pt-qty', m).oninput = upd;
    $('#pt-all', m).onclick = () => { $('#pt-qty', m).value = cust.points; upd(); };
  }
  syncMethod(); upd();
  $('#p-x', m).onclick = () => m.remove();
  $('#p-go', m).onclick = async () => {
    $('#p-go', m).disabled = true;
    try {
      const cash = method.kind === 'cash';
      const ref = cash ? null : ($('#pay-ref', m).value.trim() || null);
      const due = dueNow();
      const body = { ...orderPayload('paid'), payment_method_id: method.id,
        paid_cash: cash ? tendered : due, tip, points_used: usePoints || 0,
        note: ref ? 'InstaPay: ' + ref : undefined };
      const o = await api('/orders', { method: 'POST', body });
      m.remove();
      toast(o.payment_status === 'paid' ? t('تم الدفع وأُرسل للتحضير ✅ — ') + o.invoice_no
        : `🕒 ${t('سُجّلت آجل/جزئي')} — ${o.invoice_no}`, o.payment_status === 'paid' ? 'ok' : 'warn');
      printReceipt(o); clearCart(); refreshKDSBadge();
    } catch (e) { $('#p-go', m).disabled = false; toast(e.message, 'err'); }
  };
}

// ---------- اختيار / إنشاء عميل ----------
function pickCustomer(onPick) {
  const m = modal(`<h3>👤 ${t('اختيار عميل')}</h3>
    <div class="field"><input id="cu-q" placeholder="${t('🔍 ابحث بالاسم أو الهاتف…')}" autofocus></div>
    <div id="cu-list" style="max-height:45vh;overflow:auto"></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="cu-x">${t('إلغاء')}</button>
      <button class="btn btn-sand" id="cu-new">${t('+ عميل جديد')}</button></div>`);
  let timer = null;
  const load = async () => {
    const q = $('#cu-q', m).value.trim();
    const rows = await api('/customers' + (q ? '?q=' + encodeURIComponent(q) : ''));
    $('#cu-list', m).innerHTML = rows.slice(0, 30).map(c => `<div class="cust-item" data-c="${c.id}">
      <div><b>${esc(c.name_ar)}</b><small>${esc(c.phone || '')}</small></div>
      <div class="cust-meta">${pointsOn() ? `<span class="chip pts">⭐ ${num(c.points, 1)}</span>` : ''}
      ${c.balance_due > 0 ? `<span class="chip low">${t('عليه')} ${money(c.balance_due)}</span>` : ''}</div></div>`).join('')
      || `<div class="empty">${t('لا عملاء — أضف عميلاً جديداً')}</div>`;
    $$('#cu-list [data-c]', m).forEach(el => el.onclick = () => { const c = rows.find(x => x.id === +el.dataset.c); m.remove(); onPick(c); });
  };
  $('#cu-q', m).oninput = () => { clearTimeout(timer); timer = setTimeout(load, 250); };
  $('#cu-x', m).onclick = () => m.remove();
  $('#cu-new', m).onclick = () => { m.remove(); customerForm(null, (c) => onPick(c)); };
  load();
}
// نموذج إضافة/تعديل عميل
function customerForm(c, onSaved) {
  const m = modal(`<h3>${c ? '✏️ ' + t('تعديل عميل') : '👤 ' + t('عميل جديد')}</h3>
    <div class="field"><label>${t('اسم العميل')} *</label><input id="cf-name" value="${esc(c?.name_ar || '')}"></div>
    <div class="row"><div class="field"><label>${t('رقم الهاتف')}</label><input id="cf-phone" value="${esc(c?.phone || '')}"></div>
      <div class="field"><label>${t('البريد الإلكتروني')}</label><input id="cf-email" value="${esc(c?.email || '')}"></div></div>
    <div class="field"><label>${t('العنوان')}</label><input id="cf-addr" value="${esc(c?.address || '')}"></div>
    <div class="field"><label>${t('ملاحظات')}</label><input id="cf-notes" value="${esc(c?.notes || '')}"></div>
    <div class="err" id="cf-e"></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="cf-x">${t('إلغاء')}</button><button class="btn btn-primary" id="cf-save">${t('حفظ')}</button></div>`);
  $('#cf-x', m).onclick = () => m.remove();
  $('#cf-save', m).onclick = async () => {
    const body = { name_ar: $('#cf-name', m).value.trim(), phone: $('#cf-phone', m).value.trim() || null,
      email: $('#cf-email', m).value.trim() || null, address: $('#cf-addr', m).value.trim() || null, notes: $('#cf-notes', m).value.trim() || null };
    if (!body.name_ar) return $('#cf-e', m).textContent = t('اسم العميل مطلوب');
    try {
      const r = await api(c ? '/customers/' + c.id : '/customers', { method: c ? 'PUT' : 'POST', body });
      m.remove(); toast(t('تم الحفظ ✅'));
      if (onSaved) onSaved({ id: c?.id || r.id, points: c?.points || 0, ...body });
    } catch (e) { $('#cf-e', m).textContent = e.message; }
  };
}

// ---------- فتح وردية (عهدة افتتاحية) ----------
function openShiftModal(forced) {
  const m = modal(`<h3>⏱️ ${t('فتح وردية جديدة')}</h3>
    <p style="color:var(--text2);font-size:13.5px;margin-bottom:14px">${t('أدخل العهدة الافتتاحية (النقدية الموجودة بالدرج الآن). ستُحاسب عليها عند التقفيل.')}</p>
    <div class="field"><label>💰 ${t('العهدة الافتتاحية (نقدية الدرج)')}</label><input id="sh-float" type="number" step="any" value="0" autofocus></div>
    <div class="field"><label>${t('ملاحظات')}</label><input id="sh-note"></div>
    <div class="err" id="sh-e"></div>
    <div class="modal-actions">${forced ? '' : `<button class="btn btn-ghost" id="sh-x">${t('إلغاء')}</button>`}
      <button class="btn btn-primary btn-lg" id="sh-go">${t('✅ فتح الوردية')}</button></div>`);
  const xb = $('#sh-x', m); if (xb) xb.onclick = () => m.remove();
  $('#sh-go', m).onclick = async () => {
    try {
      await api('/shifts/open', { method: 'POST', body: { opening_float: +$('#sh-float', m).value || 0, note: $('#sh-note', m).value.trim() || null } });
      m.remove(); toast(t('فُتحت الوردية ✅')); route();
    } catch (e) { $('#sh-e', m).textContent = e.message; }
  };
}

// ===================================================================
//  الفاتورة الحرارية — محتواها بالإنجليزية + لوجو seaside + نقدي
// ===================================================================
function receiptFields() {
  try { return JSON.parse(META.settings.receipt_fields || '{}'); } catch { return {}; }
}
// سطور الضرائب في الريسيت: الظاهرة (show=1) تُفصّل باسمها، والمخفية داخل الإجمالي بدون سطر
function receiptTaxRows(o, em) {
  let taxes = [];
  try { taxes = JSON.parse(o.tax_detail || '[]'); } catch {}
  if (taxes.length) return taxes.filter(tx => tx.show && tx.amount > 0)
    .map(tx => `<tr><td>${esc(tx.name_en || tx.name)} ${num(tx.rate, 1)}%</td><td style="text-align:right">${em(tx.amount)}</td></tr>`).join('');
  return o.tax ? `<tr><td>Tax</td><td style="text-align:right">${em(o.tax)}</td></tr>` : '';
}
function receiptHTML(o) {
  const s = META.settings;
  const F = receiptFields();
  const em = (n) => (+n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + cur();
  const edt = (x) => x ? new Date(x).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '';
  const ttype = { dine_in: 'Dine-in', takeaway: 'Takeaway', delivery: 'Delivery' };
  const extra = (s.receipt_extra_lines || '').split('\n').map(x => x.trim()).filter(Boolean);
  return `<div class="receipt">
    <div class="r-c">${F.logo !== 0 ? logoMark('r-logo-img') : ''}<h2>${esc(s.cafe_name || 'seaside')}</h2>
      ${F.tagline !== 0 && s.tagline ? `<div>${esc(s.tagline)}</div>` : ''}
      ${F.address && s.address ? `<div>${esc(s.address)}</div>` : ''}
      ${F.phone && s.phone ? `<div>Phone: ${esc(s.phone)}</div>` : ''}
      ${extra.map(l => `<div>${esc(l)}</div>`).join('')}</div>
    <div class="r-line"></div>
    ${F.order_no !== 0 ? `<div><b>Order ${esc(o.invoice_no)}</b>${F.datetime !== 0 ? ' &nbsp; ' + edt(o.created_at) : ''}</div>` : ''}
    ${F.token ? `<div>Token: ${o.id}</div>` : ''}
    ${F.order_type !== 0 || (F.table !== 0 && o.table_name) ? `<div>${F.order_type !== 0 ? (ttype[o.order_type] || '') : ''}${F.table !== 0 && o.table_name ? ' — ' + esc(o.table_name) : ''}</div>` : ''}
    ${F.cashier !== 0 && o.cashier_name ? `<div>Cashier: ${esc(o.cashier_name)}</div>` : ''}
    ${F.waiter && o.waiter_name ? `<div>Waiter: ${esc(o.waiter_name)}</div>` : ''}
    ${o.customer_name || o.qr_name ? `<div>Customer: ${esc(o.customer_name || o.qr_name)}</div>` : ''}
    ${o.qr_phone ? `<div>Phone: ${esc(o.qr_phone)}</div>` : ''}
    ${o.qr_address ? `<div>Address: ${esc(o.qr_address)}</div>` : ''}
    <div class="r-line"></div>
    <table><tr style="font-weight:700"><td>Qty</td><td>Item</td><td style="text-align:right">Amount</td></tr>
    ${o.items.map(i => `<tr><td>${i.qty}</td><td>${esc(i.name_ar)}${i.note ? `<br><small>↳ ${esc(i.note)}</small>` : ''}</td><td style="text-align:right">${em(i.price * i.qty)}</td></tr>`).join('')}</table>
    <div class="r-line"></div>
    <table>
      <tr><td>Subtotal</td><td style="text-align:right">${em(o.subtotal)}</td></tr>
      ${o.discount ? `<tr><td>Discount</td><td style="text-align:right">-${em(o.discount)}</td></tr>` : ''}
      ${o.points_discount ? `<tr><td>Points (${o.points_used})</td><td style="text-align:right">-${em(o.points_discount)}</td></tr>` : ''}
      ${receiptTaxRows(o, em)}
      ${o.tip ? `<tr><td>${o.order_type === 'dine_in' ? 'Tip' : 'Delivery'}</td><td style="text-align:right">${em(o.tip)}</td></tr>` : ''}
      <tr class="r-tot"><td>Total</td><td style="text-align:right">${em(o.total)}</td></tr>
      ${o.payment_status && o.payment_status !== 'paid' && o.status === 'paid' ? `
        <tr><td>Paid</td><td style="text-align:right">${em(o.paid_amount)}</td></tr>
        <tr style="font-weight:700"><td>Balance due</td><td style="text-align:right">${em(o.total - o.paid_amount)}</td></tr>` : ''}
    </table>
    <div class="r-line"></div>
    <table>
      <tr style="font-weight:700"><td>Date &amp; time</td><td>Method</td><td style="text-align:right">Amount</td></tr>
      <tr><td>${edt(o.paid_at || o.created_at)}</td><td>${esc(o.payment_name_en || o.payment_name || 'Cash')}</td><td style="text-align:right">${em(o.payment_kind === 'cash' ? (o.paid_cash || o.total) : o.total)}</td></tr>
      ${o.payment_kind === 'cash' && o.change_due ? `<tr><td>Change</td><td></td><td style="text-align:right">${em(o.change_due)}</td></tr>` : ''}
    </table>
    <div class="r-line"></div>
    ${F.barcode !== 0 ? `<div class="r-c r-barcode-wrap"><svg id="r-barcode"></svg></div>` : ''}
    <div class="r-c r-footer">${F.ref !== 0 ? `Ref: ${esc(o.invoice_no)}-${o.id}<br>` : ''}${F.footer !== 0 ? esc(s.receipt_footer || 'Thank you for your visit!') : ''}</div>
  </div>`;
}
function setPrintPage(css) { const s = $('#print-page-style'); if (s) s.textContent = css; }
function renderReceiptBarcode(o) {
  const el = document.getElementById('r-barcode');
  if (!el || typeof JsBarcode === 'undefined') return;
  try { JsBarcode(el, o.invoice_no, { format: 'CODE128', lineColor: '#000', width: 1.4, height: 34, fontSize: 11, margin: 0, textMargin: 4 }); } catch (e) { /* تجاهل لو فشلت المكتبة */ }
}
// أغلب درايفرات الطابعات الحرارية 80mm تعرض مقاسات ورق ثابتة فقط (50/60/80/100/130/150/180/200/230/250/270/297mm)
// ولا تقبل أي طول حر، فنقرّب لأقرب مقاس قياسي أكبر من ارتفاع الفاتورة بدل رقم عشوائي قد يُرفض أو يُهمَل
const THERMAL_HEIGHTS_MM = [50, 60, 80, 100, 130, 150, 180, 200, 230, 250, 270, 297, 350, 420, 500];
function roundToStandardHeight(mm) { return THERMAL_HEIGHTS_MM.find(h => h >= mm) || (Math.ceil(mm / 50) * 50); }
function printReceipt(o) {
  const pa = $('#print-area'); pa.innerHTML = receiptHTML(o); pa.classList.remove('hidden');
  renderReceiptBarcode(o);
  // المتصفح لا يدعم "auto" لطول الصفحة بشكل موثوق (يرجع لطول A4 ‎297mm‏ ويقسّم الفاتورة على عدة صفحات)،
  // لذلك نحسب ارتفاع الفاتورة الفعلي بعد رسم الباركود، ونقرّبه لأقرب مقاس قياسي يدعمه درايفر الطابعة.
  const receiptEl = pa.querySelector('.receipt');
  const heightPx = receiptEl ? receiptEl.offsetHeight : 600;
  const heightMM = roundToStandardHeight(Math.ceil(heightPx * 25.4 / 96) + 12);
  setPrintPage(`@page{size:80mm ${heightMM}mm;margin:0}`);
  const done = () => { pa.classList.add('hidden'); pa.innerHTML = ''; setPrintPage(''); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done); setTimeout(() => window.print(), 150);
}

// ===================================================================
//  الطلبات والفواتير
// ===================================================================
ROUTES.orders = async (view) => {
  view.innerHTML = `<div class="page-head"><div><h2>📋 ${t('الطلبات والفواتير')}</h2><div class="crumb">${t('سجل كل الطلبات مع إمكانية الفلترة')}</div></div></div>
    <div class="toolbar">
      <input type="search" id="o-search" placeholder="${L('🔍 بحث برقم الفاتورة أو الطاولة…', '🔍 Search by invoice no. or table…')}" style="min-width:230px">
      <label style="font-size:13px;color:var(--text2)">${L('من','From')}</label><input type="date" id="o-from" value="${todayStr()}">
      <label style="font-size:13px;color:var(--text2)">${L('إلى','To')}</label><input type="date" id="o-to" value="${todayStr()}">
      <select id="o-status"><option value="">${t('كل الحالات')}</option>${['open', 'confirmed', 'paid', 'cancelled'].map(s => `<option value="${s}">${LL(STATUS, s)}</option>`).join('')}</select>
      <select id="o-type"><option value="">${t('كل الأنواع')}</option>${Object.keys(TYPE).map(k => `<option value="${k}">${LL(TYPE, k)}</option>`).join('')}</select>
      <label class="chip" style="cursor:pointer"><input type="checkbox" id="o-due" style="width:auto;vertical-align:middle"> 🕒 ${t('الآجل فقط')}</label>
      <button class="btn btn-ghost btn-sm" id="o-clear">${t('مسح الفلتر')}</button>
    </div><div id="o-list"></div>`;
  let searchTimer = null;
  const load = async () => {
    const q = new URLSearchParams();
    const query = $('#o-search').value.trim();
    const due = $('#o-due').checked;
    if (query) q.set('q', query); else if (!due) { if ($('#o-from').value) q.set('from', $('#o-from').value); if ($('#o-to').value) q.set('to', $('#o-to').value); }
    if ($('#o-status').value) q.set('status', $('#o-status').value);
    if ($('#o-type').value) q.set('type', $('#o-type').value);
    if (due) q.set('due', '1');
    const rows = await api('/orders?' + q);
    const totDue = rows.reduce((s, o) => s + (o.remaining > 0 && o.status === 'paid' ? o.remaining : 0), 0);
    $('#o-list').innerHTML = `<div class="card">
      ${due && rows.length ? `<div class="due-banner">🕒 ${t('إجمالي المتبقي (آجل)')}: <b>${money(totDue)}</b></div>` : ''}
      <div class="t-wrap"><table><thead><tr><th>${t('الفاتورة')}</th><th>${t('العميل')}</th><th>${t('النوع')}</th><th>${t('الإجمالي')}</th><th>${t('المدفوع')}</th><th>${t('المتبقي')}</th><th>${t('السداد')}</th><th>${t('الحالة')}</th><th>${t('الوقت')}</th><th></th></tr></thead><tbody>
      ${rows.map(o => `<tr><td>${esc(o.invoice_no || '#' + o.id)}${o.source === 'qr' ? ' <span class="chip pts">📲 QR</span>' : ''}</td><td>${esc(o.customer_name || o.qr_name || '—')}</td><td>${LL(TYPE, o.order_type)}</td>
        <td class="t-num">${money(o.total)}</td><td class="t-num">${money(o.paid_amount)}</td>
        <td class="t-num" style="color:${o.remaining > 0 && o.status === 'paid' ? 'var(--red)' : 'var(--text3)'}">${o.status === 'paid' && o.remaining > 0 ? money(o.remaining) : '—'}</td>
        <td>${o.status === 'paid' ? payBadge(o.payment_status) : '—'}</td><td>${stBadge(o.status)}</td><td style="color:var(--text3)">${dt(o.created_at)}</td>
        <td style="white-space:nowrap">${o.status === 'paid' && o.remaining > 0 ? `<button class="btn btn-sand btn-sm" data-settle="${o.id}">${t('سداد')}</button> ` : ''}<button class="btn btn-ghost btn-sm" data-o="${o.id}">${t('عرض')}</button>${hasPerm('orders.delete') ? `<button class="btn btn-danger btn-sm" data-del="${o.id}" style="margin-inline-start:4px">${t('حذف')}</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="10" class="empty">${query ? L('لا نتائج لبحثك', 'No results for your search') : t('لا طلبات بهذا الفلتر')}</td></tr>`}
      </tbody></table></div></div>`;
    $$('#o-list [data-o]').forEach(b => b.onclick = () => openOrder(+b.dataset.o));
    $$('#o-list [data-settle]').forEach(b => b.onclick = async () => settleOrder(await api('/orders/' + b.dataset.settle), load));
    $$('#o-list [data-del]').forEach(b => b.onclick = () => confirmDialog(L('هل أنت متأكد من حذف هذه الفاتورة نهائياً؟','Are you sure you want to permanently delete this invoice?'), async () => { await api('/orders/' + b.dataset.del, { method: 'DELETE' }); toast(L('تم حذف الفاتورة','Invoice deleted')); load(); }));
  };
  ['o-from', 'o-to', 'o-status', 'o-type'].forEach(id => $('#' + id).onchange = load);
  $('#o-due').onchange = load;
  $('#o-search').oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(load, 280); };
  $('#o-clear').onclick = () => { $('#o-search').value = ''; $('#o-from').value = ''; $('#o-to').value = ''; $('#o-status').value = ''; $('#o-type').value = ''; $('#o-due').checked = false; load(); };
  load();
};
// شارة حالة السداد
const PAYSTATUS = { paid: ['✅ مدفوعة', 'Paid'], partial: ['⏳ جزئي', 'Partial'], credit: ['🕒 آجل', 'Credit'], unpaid: ['— غير مدفوعة', 'Unpaid'] };
const payBadge = (s) => `<span class="badge-st pay-${s}">${LL(PAYSTATUS, s)}</span>`;
// سداد المتبقي من فاتورة آجلة
function settleOrder(o, onDone) {
  const remaining = +(o.total - o.paid_amount).toFixed(2);
  const methods = META.payment_methods;
  let method = methods[0];
  const m = modal(`<h3>💰 ${t('سداد آجل')} — ${esc(o.invoice_no)}</h3>
    ${o.customer_name ? `<div class="pay-cust">👤 ${esc(o.customer_name)}</div>` : ''}
    <div class="sumline"><span>${t('الإجمالي')}</span><span class="t-num">${money(o.total)}</span></div>
    <div class="sumline"><span>${t('المدفوع سابقاً')}</span><span class="t-num">${money(o.paid_amount)}</span></div>
    <div class="sumline total"><span>${t('المتبقي')}</span><span class="t-num" style="color:var(--red)">${money(remaining)}</span></div>
    ${payMethodsHTML(method?.id)}
    <div class="field"><label>${t('المبلغ المسدد الآن')}</label><input id="st-amt" type="number" step="any" value="${remaining}"></div>
    <div class="err" id="st-e"></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="st-x">${t('إلغاء')}</button><button class="btn btn-primary" id="st-go">${t('تأكيد السداد')}</button></div>`);
  $$('.pay-m', m).forEach(b => b.onclick = () => { method = methods.find(x => x.id === +b.dataset.pm); $$('.pay-m', m).forEach(x => x.classList.toggle('active', x === b)); });
  $('#st-x', m).onclick = () => m.remove();
  $('#st-go', m).onclick = async () => {
    try {
      await api(`/orders/${o.id}/settle`, { method: 'POST', body: { amount: +$('#st-amt', m).value || 0, method_id: method?.id } });
      m.remove(); toast(t('تم السداد ✅')); if (onDone) onDone();
    } catch (e) { $('#st-e', m).textContent = e.message; }
  };
}
async function openOrder(id) {
  const o = await api('/orders/' + id);
  const remaining = +(o.total - (o.paid_amount || 0)).toFixed(2);
  const hasDue = o.status === 'paid' && remaining > 0;
  const m = modal(`<h3>🧾 ${esc(o.invoice_no)}</h3>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${stBadge(o.status)}${o.status === 'paid' ? payBadge(o.payment_status) : ''}<span class="chip">${LL(TYPE, o.order_type)}</span>${o.table_name ? `<span class="chip">${esc(o.table_name)}</span>` : ''}${o.customer_name ? `<span class="chip">👤 ${esc(o.customer_name)}</span>` : ''}<span class="chip">${dt(o.created_at)}</span></div>
    <div class="t-wrap"><table><thead><tr><th>${t('الصنف')}</th><th>${t('الكمية')}</th><th>${t('السعر')}</th><th>${t('الإجمالي')}</th></tr></thead><tbody>
      ${o.items.map(i => `<tr><td>${esc(i.name_ar)}${i.note ? `<br><small style="color:var(--sand-deep)">↳ ${esc(i.note)}</small>` : ''}</td><td class="t-num">${i.qty}</td><td class="t-num">${money(i.price)}</td><td class="t-num">${money(i.price * i.qty)}</td></tr>`).join('')}
    </tbody></table></div>
    ${o.points_discount ? `<div class="sumline" style="margin-top:8px"><span>⭐ ${t('خصم النقاط')} (${num(o.points_used, 1)})</span><span class="t-num">− ${money(o.points_discount)}</span></div>` : ''}
    <div class="cost-summary"><div>${t('الإجمالي شامل الضريبة')}</div><div class="big">${money(o.total)}</div></div>
    ${o.status === 'paid' && (o.paid_amount !== o.total || o.payments?.length) ? `
      <div class="sumline" style="margin-top:10px"><span>${t('المدفوع')}</span><span class="t-num">${money(o.paid_amount)}</span></div>
      ${hasDue ? `<div class="sumline"><span>${t('المتبقي')}</span><span class="t-num" style="color:var(--red)">${money(remaining)}</span></div>` : ''}
      ${(o.payments || []).map(p => `<div class="sumline" style="font-size:12.5px"><span>↳ ${t('دفعة')} ${dt(p.created_at)} (${esc(p.method_name || '')})</span><span class="t-num">${money(p.amount)}</span></div>`).join('')}` : ''}
    <div class="modal-actions">
      ${o.status !== 'cancelled' && (o.status !== 'paid' || ME.role_key === 'admin') && hasPerm('orders.cancel') ? `<button class="btn btn-danger" id="o-cancel">${t('إلغاء الطلب')}</button>` : ''}
      ${o.status === 'paid' && ME.role_key === 'admin' ? `<button class="btn btn-sand" id="o-edit">✏️ ${t('تعديل الفاتورة (أدمن)')}</button>` : ''}
      ${o.status === 'paid' && ME.role_key === 'admin' ? `<button class="btn btn-ghost" id="o-return">↩️ ${t('مرتجع')}</button>` : ''}
      ${hasDue && hasPerm('orders.settle') ? `<button class="btn btn-sand" id="o-settle">💰 ${t('سداد المتبقي')}</button>` : ''}
      ${o.status === 'open' && o.source !== 'qr' && o.order_type === 'dine_in' && hasPerm('pos.draft') ? `<button class="btn btn-primary" id="o-resume">▶️ ${L('استكمال في نقطة البيع', 'Resume in POS')}</button>` : ''}
      <button class="btn btn-ghost" id="o-print">${t('🖨️ طباعة')}</button>
      ${o.status !== 'paid' && o.status !== 'cancelled' && hasPerm('orders.pay') ? `<button class="btn btn-primary" id="o-pay">${t('💵 دفع')}</button>` : ''}
    </div>`, 'wide');
  $('#o-print', m).onclick = () => printReceipt(o);
  const rsb = $('#o-resume', m); if (rsb) rsb.onclick = () => { m.remove(); resumeOpenOrder(o.id); };
  const pb = $('#o-pay', m); if (pb) pb.onclick = () => { m.remove(); payExisting(o); };
  const eb = $('#o-edit', m); if (eb) eb.onclick = () => { m.remove(); editPaidOrder(o); };
  const sb = $('#o-settle', m); if (sb) sb.onclick = () => { m.remove(); settleOrder(o, route); };
  const rb = $('#o-return', m); if (rb) rb.onclick = () => { m.remove(); newSalesReturn(o); };
  const cb = $('#o-cancel', m); if (cb) cb.onclick = () => confirmDialog(t('إلغاء هذا الطلب؟'), async () => { await api(`/orders/${o.id}/cancel`, { method: 'POST', body: {} }); m.remove(); toast(t('أُلغي الطلب')); route(); });
}
// تعديل فاتورة مدفوعة — الأدمن فقط
async function editPaidOrder(o) {
  const prods = await api('/pos/products');
  let lines = o.items.map(i => ({ product_id: i.product_id, name: i.name_ar, price: i.price, qty: i.qty, note: i.note || '' }));
  let discount = o.discount || 0;
  const m = modal(`<h3>✏️ ${t('تعديل الفاتورة (أدمن)')} — ${esc(o.invoice_no)}</h3>
    <p style="color:var(--text2);font-size:13px;margin-bottom:10px">${L('عدّل الكميات أو احذف أصناف؛ النظام يصحّح المخزون تلقائياً.', 'Edit quantities or remove items; stock is corrected automatically.')}</p>
    <div id="eo-lines"></div>
    <div class="field" style="margin-top:8px"><label>${L('أضف صنف', 'Add item')}</label><select id="eo-add"><option value="">— ${t('إضافة')} —</option>${prods.map(p => `<option value="${p.id}">${esc(p.name_ar)} — ${money(p.price)}</option>`).join('')}</select></div>
    <div class="row"><div class="field"><label>${t('خصم')}</label><input id="eo-disc" type="number" value="${discount}"></div></div>
    <div class="cost-summary"><div>${t('الإجمالي')}</div><div class="big" id="eo-total">—</div></div>
    <div class="err" id="eo-e"></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="eo-x">${t('إلغاء')}</button><button class="btn btn-primary" id="eo-save">${t('حفظ تعديل الفاتورة')}</button></div>`, 'wide');
  const taxRate = (META.taxes || []).reduce((s, tx) => s + tx.rate, 0);   // مجموع نسب الضرائب المفعّلة (عرض تقريبي — الحساب النهائي من الخادم)
  const draw = () => {
    $('#eo-lines', m).innerHTML = lines.map((l, i) => `<div class="pu-line" style="grid-template-columns:1fr 70px 100px 34px">
      <div style="font-weight:600">${esc(l.name)}</div>
      <input type="number" min="0" data-q="${i}" value="${l.qty}">
      <div class="t-num" style="align-self:center">${money(l.price * l.qty)}</div>
      <button class="btn btn-danger btn-sm" data-x="${i}">✕</button></div>`).join('') || `<div class="empty">${t('لا أصناف')}</div>`;
    const sub = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const taxable = Math.max(0, sub - (+$('#eo-disc', m).value || 0));
    $('#eo-total', m).textContent = money(taxable + taxable * (taxRate / 100));
    $$('#eo-lines [data-q]', m).forEach(inp => inp.oninput = () => { lines[+inp.dataset.q].qty = +inp.value || 0; draw(); });
    $$('#eo-lines [data-x]', m).forEach(b => b.onclick = () => { lines.splice(+b.dataset.x, 1); draw(); });
  };
  draw();
  $('#eo-disc', m).oninput = draw;
  $('#eo-add', m).onchange = () => { const p = prods.find(x => x.id === +$('#eo-add', m).value); if (p) { lines.push({ product_id: p.id, name: p.name_ar, price: p.price, qty: 1, note: '' }); draw(); } $('#eo-add', m).value = ''; };
  $('#eo-x', m).onclick = () => m.remove();
  $('#eo-save', m).onclick = async () => {
    const items = lines.filter(l => l.qty > 0).map(l => ({ product_id: l.product_id, qty: l.qty, note: l.note }));
    if (!items.length) return $('#eo-e', m).textContent = t('أضف صنفاً واحداً على الأقل');
    try { await api('/orders/' + o.id, { method: 'PUT', body: { items, discount: +$('#eo-disc', m).value || 0 } }); m.remove(); toast(t('تم تعديل الفاتورة ✅')); route(); } catch (e) { $('#eo-e', m).textContent = e.message; }
  };
}
// دفع طلب قائم — نقدي أو انستاباي
function payExisting(o) {
  const methods = META.payment_methods;
  let method = methods[0] || { id: null, kind: 'cash' };
  const m = modal(`<h3>💵 ${t('💵 دفع')} ${esc(o.invoice_no)}</h3>
    ${payMethodsHTML(method.id)}
    <div class="sumline total"><span>${t('المطلوب')}</span><span>${money(o.total)}</span></div>
    <div id="pay-cash-box"><div class="field"><label>${t('المبلغ المدفوع (نقداً)')}</label><input id="tendered" type="number" value="${Math.ceil(o.total)}"></div>
      <div class="change-big" id="change"></div></div>
    <div id="pay-ref-box" class="hidden"><div class="field"><label>${L('رقم مرجع التحويل (اختياري)', 'Transfer reference (optional)')}</label><input id="pay-ref" placeholder="InstaPay ref"></div></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="x">${t('إلغاء')}</button><button class="btn btn-primary" id="go">${t('تأكيد')}</button></div>`);
  const syncMethod = () => { const cash = method.kind === 'cash'; $('#pay-cash-box', m).classList.toggle('hidden', !cash); $('#pay-ref-box', m).classList.toggle('hidden', cash); };
  const upd = () => { const ch = (+$('#tendered', m).value || 0) - o.total; $('#change', m).textContent = t('الباقي') + ': ' + money(ch > 0 ? ch : 0); };
  $$('.pay-m', m).forEach(b => b.onclick = () => { method = methods.find(x => x.id === +b.dataset.pm); $$('.pay-m', m).forEach(x => x.classList.toggle('active', x === b)); syncMethod(); });
  upd(); syncMethod(); $('#tendered', m).oninput = upd;
  $('#x', m).onclick = () => m.remove();
  $('#go', m).onclick = async () => {
    try {
      const cash = method.kind === 'cash';
      const r = await api(`/orders/${o.id}/pay`, { method: 'POST', body: { payment_method_id: method.id, paid_cash: cash ? (+$('#tendered', m).value || 0) : o.total } });
      m.remove(); toast(t('تم الدفع وأُرسل للتحضير ✅ — ') + r.invoice_no); printReceipt(r); route();
    } catch (e) { toast(e.message, 'err'); }
  };
}

// ===================================================================
//  شاشات المحطات (المطبخ + البار) — نفس النموذج
// ===================================================================
function stationScreen(view, station) {
  const isKitchen = station === 'kitchen';
  const ep = isKitchen ? '/kds' : '/bar';
  const title = isKitchen ? t('شاشة المطبخ') : t('شاشة البار');
  const icon = isKitchen ? '👨‍🍳' : '🍹';
  let tab = 'live';   // live = الجارية | done = تم التقديم (مراجعة)
  const render = async () => {
    const orders = await api(ep + (tab === 'done' ? '?done=1' : ''));
    view.innerHTML = `<div class="page-head"><div><h2>${icon} ${title}</h2><div class="crumb">${tab === 'live' ? t('الطلبات الجارية — اضغط على الصنف لتغيير حالته') : L('فواتير تم تقديمها بالكامل — للمراجعة فقط', 'Fully served orders — review only')}</div></div>
      <div class="head-actions"><button class="btn btn-sand" id="st-req">${t('+ طلب شراء')}</button><button class="btn btn-ghost" id="kds-refresh">${t('🔄 تحديث')}</button></div></div>
      <div class="cat-chips" style="margin-bottom:14px">
        <button class="cat-chip ${tab === 'live' ? 'active' : ''}" data-tab="live">🔥 ${L('الجارية', 'Active')}</button>
        <button class="cat-chip ${tab === 'done' ? 'active' : ''}" data-tab="done">✅ ${L('تم التقديم', 'Served')}</button>
      </div>
      <div class="kds-grid">${orders.map(o => `<div class="kds-card ${tab === 'done' ? 'kds-done' : ''}">
        <div class="kh"><span class="inv">${esc(o.invoice_no)} ${LL(TYPE, o.order_type)}</span><span class="ago">${esc(o.table_name || '')} • ${ago(o.created_at)}</span></div>
        ${o.items.map(i => `<div class="kds-item ${i.kds_status === 'served' || i.kds_status === 'ready' ? 'done' : ''}" ${tab === 'live' ? `data-i="${i.id}" data-s="${i.kds_status}"` : ''}>
          <div class="ki-nm">${i.qty}× ${esc(i.name_ar)}${i.note ? `<small>↳ ${esc(i.note)}</small>` : ''}</div>${stBadge(i.kds_status)}</div>`).join('')}
        </div>`).join('') || `<div class="card"><div class="empty">${tab === 'live' ? t('لا طلبات في المطبخ حالياً 🎉') : L('لا فواتير مُقدَّمة بعد', 'No served orders yet')}</div></div>`}</div>`;
    $('#kds-refresh').onclick = render;
    $('#st-req').onclick = () => openPurchaseRequest();
    $$('[data-tab]', view).forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });
    $$('.kds-item[data-i]').forEach(it => it.onclick = async () => {
      const flow = { new: 'preparing', preparing: 'ready', ready: 'served', served: 'served' };
      await api(`/order-items/${it.dataset.i}/status`, { method: 'POST', body: { status: flow[it.dataset.s] } });
      render(); refreshKDSBadge();
    });
  };
  render();
}
ROUTES.kds = (view) => stationScreen(view, 'kitchen');
ROUTES.bar = (view) => stationScreen(view, 'bar');

// نافذة طلب شراء (من المطبخ/البار/الأدمن)
async function openPurchaseRequest() {
  const materials = await api('/materials');
  const m = modal(`<h3>🛒 ${t('طلب شراء')}</h3>
    <div class="field"><label>${t('مادة من المخزن')}</label><select id="pr-mat"><option value="">— ${t('أو اكتب اسم مادة جديدة')} —</option>${materials.map(x => `<option value="${x.id}">${esc(x.name_ar)} (${x.unit || ''}) — ${num(x.qty, 1)}</option>`).join('')}</select></div>
    <div class="field"><label>${t('أو اكتب اسم مادة جديدة')}</label><input id="pr-name" placeholder="${L('مثال: أكواب ٣٦٠ مل', 'e.g. cups 360ml')}"></div>
    <div class="row"><div class="field"><label>${t('الكمية المطلوبة')}</label><input id="pr-qty" type="number" step="any" value="1"></div>
      <div class="field"><label>${t('ملاحظات')}</label><input id="pr-note"></div></div>
    <div class="err" id="pr-e"></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="pr-x">${t('إلغاء')}</button><button class="btn btn-primary" id="pr-go">${t('إرسال الطلب')}</button></div>`);
  $('#pr-x', m).onclick = () => m.remove();
  $('#pr-go', m).onclick = async () => {
    const body = { material_id: +$('#pr-mat', m).value || null, custom_name: $('#pr-name', m).value.trim(), qty: +$('#pr-qty', m).value || 1, note: $('#pr-note', m).value.trim() };
    if (!body.material_id && !body.custom_name) return $('#pr-e', m).textContent = t('حدّد المادة المطلوبة');
    try { await api('/purchase-requests', { method: 'POST', body }); m.remove(); toast(t('تم إرسال طلب الشراء ✅')); if (location.hash.includes('requests')) route(); } catch (e) { $('#pr-e', m).textContent = e.message; }
  };
}

// ===================================================================
//  شاشة طلبات الشراء
// ===================================================================
const PR_STATUS = { pending: ['قيد الانتظار', 'Pending', 'amber'], fulfilled: ['تم التنفيذ', 'Fulfilled', 'green'], rejected: ['مرفوض', 'Rejected', 'red'] };
ROUTES.requests = async (view) => {
  const isAdmin = ME.role_key === 'admin';
  const render = async () => {
    const rows = await api('/purchase-requests');
    view.innerHTML = `<div class="page-head"><div><h2>🛒 ${t('طلبات الشراء')}</h2><div class="crumb">${isAdmin ? L('طلبات المطبخ والبار — نفّذها لتحديث المخزون', 'Kitchen & bar requests — fulfill to update stock') : L('طلباتك للمخزن', 'Your stock requests')}</div></div>
      <div class="head-actions"><button class="btn btn-primary" id="pr-new">${t('+ طلب شراء')}</button></div></div>
      <div class="card"><div class="t-wrap"><table><thead><tr><th>#</th><th>${t('المادة')}</th><th>${t('الكمية')}</th><th>${L('المحطة', 'Station')}</th><th>${t('الطالب')}</th><th>${t('الحالة')}</th><th>${t('الوقت')}</th>${isAdmin ? '<th></th>' : ''}</tr></thead><tbody>
      ${rows.map(r => { const st = PR_STATUS[r.status] || PR_STATUS.pending; return `<tr>
        <td>#${r.id}</td><td><b>${esc(r.material || r.custom_name)}</b>${r.note ? `<br><small style="color:var(--text2)">${esc(r.note)}</small>` : ''}</td>
        <td class="t-num">${num(r.qty, 1)} ${esc(r.unit || '')}</td><td>${r.station === 'kitchen' ? '👨‍🍳' : r.station === 'bar' ? '🍹' : ''} ${r.station ? (r.station === 'kitchen' ? L('مطبخ', 'Kitchen') : L('بار', 'Bar')) : '—'}</td>
        <td>${esc(r.requested_name || '')}</td><td><span class="chip ${st[2] === 'green' ? 'ok' : st[2] === 'red' ? 'low' : ''}">${L(st[0], st[1])}</span></td>
        <td style="color:var(--text3)">${dt(r.created_at)}</td>
        ${isAdmin ? `<td style="white-space:nowrap">${r.status === 'pending' ? `<button class="btn btn-primary btn-sm" data-f="${r.id}">${t('تنفيذ')}</button> <button class="btn btn-ghost btn-sm" data-rj="${r.id}">${t('رفض')}</button>` : (esc(r.handled_name || '—'))}</td>` : ''}</tr>`; }).join('') || `<tr><td colspan="${isAdmin ? 8 : 7}" class="empty">${t('لا طلبات شراء')}</td></tr>`}
      </tbody></table></div></div>`;
    $('#pr-new').onclick = () => openPurchaseRequest();
    $$('#view [data-f]', view).forEach(b => b.onclick = async () => { await api(`/purchase-requests/${b.dataset.f}/fulfill`, { method: 'POST', body: {} }); toast(t('تم التنفيذ')); render(); refreshNotifBadge(); });
    $$('#view [data-rj]', view).forEach(b => b.onclick = async () => { await api(`/purchase-requests/${b.dataset.rj}/reject`, { method: 'POST', body: {} }); toast(t('مرفوض')); render(); });
  };
  render();
};

// ===================================================================
//  شاشة الإشعارات
// ===================================================================
ROUTES.notifications = async (view) => {
  const rows = await api('/notifications');
  view.innerHTML = `<div class="page-head"><div><h2>🔔 ${t('الإشعارات')}</h2><div class="crumb">${L('كل التنبيهات والعمليات على مستواك', 'All alerts and operations for your level')}</div></div>
    <div class="head-actions"><button class="btn btn-ghost" id="n-read">${t('تعليم الكل كمقروء')}</button></div></div>
    <div class="card">${rows.length ? rows.map(n => `<div class="notif ${n.is_read ? '' : 'unread'}">
      <span class="n-ic">${n.icon || '🔔'}</span>
      <div class="n-body"><div class="n-title">${esc(n.title)}</div>${n.body ? `<div class="n-text">${esc(n.body)}</div>` : ''}<div class="n-time">${dt(n.created_at)}</div></div>
      ${n.is_read ? '' : '<span class="n-dot"></span>'}</div>`).join('') : `<div class="empty">${t('لا إشعارات')}</div>`}</div>`;
  $('#n-read').onclick = async () => { await api('/notifications/read-all', { method: 'POST', body: {} }); toast(t('تم الحفظ ✅')); refreshNotifBadge(); route(); };
  api('/notifications/read-all', { method: 'POST', body: {} }).then(refreshNotifBadge);
};

// ===================================================================
//  الأصناف والوصفات
// ===================================================================
ROUTES.products = async (view) => {
  const prods = await api('/products');
  prods.forEach(p => p.margin = p.price ? ((p.price - p.cost) / p.price * 100) : 0);
  let sortKey = null, sortDir = 1, query = '';
  const COLS = [
    { k: 'name_ar', t: 'الصنف' }, { k: 'category', t: 'التصنيف' }, { k: 'price', t: 'السعر' },
    { k: 'cost', t: 'تكلفة المكونات' }, { k: 'margin', t: 'هامش الربح' }, { k: 'track_stock', t: 'خصم مخزون' },
  ];
  view.innerHTML = `<div class="page-head"><div><h2>🍽️ ${t('الأصناف والوصفات')}</h2><div class="crumb">${t('عرّف الأصناف واربطها بمكوناتها الخام (الوصفة) لتُخصم تلقائياً عند البيع')}</div></div>
    <div class="head-actions"><button class="btn btn-ghost" id="p-export">⬇ ${L('تصدير الأصناف والمكونات', 'Export items & ingredients')}</button><button class="btn btn-primary" id="p-new">${t('+ صنف جديد')}</button></div></div>
    <div class="toolbar"><input type="search" id="p-q" placeholder="${t('🔍 ابحث عن صنف…')}" style="min-width:240px"><span class="chip" id="p-count"></span></div>
    <div class="card"><div class="t-wrap"><table><thead><tr>
      ${COLS.map(c => `<th class="th-sort" data-k="${c.k}">${t(c.t)} <span class="s-ar"><span class="up">▲</span><span class="dn">▼</span></span></th>`).join('')}<th></th>
    </tr></thead><tbody id="p-body"></tbody></table></div></div>`;

  const drawBody = () => {
    let list = prods.filter(p => !query || p.name_ar.toLowerCase().includes(query) || (p.category || '').toLowerCase().includes(query));
    if (sortKey) list = [...list].sort((a, b) => {
      const va = a[sortKey] ?? '', vb = b[sortKey] ?? '';
      const cmp = (typeof va === 'number' && typeof vb === 'number') ? va - vb : String(va).localeCompare(String(vb), 'ar');
      return cmp * sortDir;
    });
    $('#p-count').textContent = num(list.length) + ' / ' + num(prods.length);
    $('#p-body').innerHTML = list.map(p => `<tr>
      <td><b><span class="prod-cell-img">${prodThumb(p.image, 'pc-thumb')}</span> ${esc(p.name_ar)}</b>${p.low_ing ? `<span class="ing-warn" title="${L('مكوّن قارب على النفاد', 'ingredient running low')}">⚠️ ${L('مكوّن منخفض', 'low ingredient')}</span>` : ''}</td>
      <td>${esc(p.category || '—')}</td><td class="t-num">${money(p.price)}</td>
      <td class="t-num">${money(p.cost)}</td><td><span class="chip ${p.margin < 40 ? 'low' : 'ok'}">${num(p.margin, 0)}%</span></td>
      <td>${p.track_stock ? '✅' : '—'}</td>
      <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-r="${p.id}">${t('🧪 الوصفة')}</button> <button class="btn btn-ghost btn-sm" data-e="${p.id}">${t('تعديل')}</button> <button class="btn btn-danger btn-sm" data-del="${p.id}" title="${t('حذف')}">🗑</button></td></tr>`).join('')
      || `<tr><td colspan="7" class="empty">${t('لا أصناف')}</td></tr>`;
    $$('#p-body [data-e]').forEach(b => b.onclick = () => editProduct(prods.find(p => p.id === +b.dataset.e)));
    $$('#p-body [data-r]').forEach(b => b.onclick = () => editRecipe(+b.dataset.r));
    $$('#p-body [data-del]').forEach(b => b.onclick = () => {
      const p = prods.find(x => x.id === +b.dataset.del);
      confirmDialog(L(`حذف «${p.name_ar}» نهائياً؟`, `Delete "${p.name_ar}" permanently?`), async () => {
        try { await api('/products/' + p.id, { method: 'DELETE' }); prods.splice(prods.indexOf(p), 1); toast(t('حُذف')); drawBody(); }
        catch (e) { toast(e.message, 'err'); }
      });
    });
  };
  const drawArrows = () => $$('.th-sort').forEach(th => {
    th.classList.toggle('asc', th.dataset.k === sortKey && sortDir === 1);
    th.classList.toggle('desc', th.dataset.k === sortKey && sortDir === -1);
  });
  $$('.th-sort').forEach(th => th.onclick = () => {
    if (sortKey === th.dataset.k) { if (sortDir === 1) sortDir = -1; else { sortKey = null; sortDir = 1; } }
    else { sortKey = th.dataset.k; sortDir = 1; }
    drawArrows(); drawBody();
  });
  $('#p-q').oninput = () => { query = $('#p-q').value.trim().toLowerCase(); drawBody(); };
  $('#p-new').onclick = () => editProduct(null);
  $('#p-export').onclick = async () => {
    const data = await api('/products-export');
    exportExcel('seaside-products-' + todayStr(), data.map(p => ({
      [L('الصنف', 'Item')]: p.name_ar,
      [L('التصنيف', 'Category')]: p.category || '',
      [L('السعر', 'Price')]: p.price,
      [L('تكلفة المكونات', 'Ingredient cost')]: p.cost,
      [L('المحطة', 'Station')]: p.station === 'kitchen' ? L('مطبخ', 'Kitchen') : L('بار', 'Bar'),
      [L('مفعّل', 'Active')]: p.is_active ? '✓' : '✗',
      [L('المكونات (الوصفة)', 'Ingredients (recipe)')]: p.recipe.map(r => `${r.name_ar} × ${num(r.qty, 2)} ${r.unit || ''}`).join(' ؛ ') || '—',
    })));
  };
  drawBody();
};
function editProduct(p) {
  const cats = META.categories;
  const curImg = p?.image || '🍽️';
  let imgData = null;   // صورة مرفوعة جديدة (base64)
  const m = modal(`<h3>${p ? t('تعديل صنف') : t('صنف جديد')}</h3>
    <div class="field"><label>${t('صورة الصنف')}</label>
      <div class="prod-img-edit">
        <span class="prod-img-preview" id="f-preview">${prodThumb(curImg)}</span>
        <div class="prod-img-ctrl">
          <input type="file" id="f-file" accept="image/png,image/jpeg,image/webp" class="hidden">
          <button type="button" class="btn btn-ghost btn-sm" id="f-upload">📷 ${t('رفع صورة')}</button>
          ${p && isImg(curImg) ? `<button type="button" class="btn btn-danger btn-sm" id="f-imgdel">🗑️ ${t('حذف الصورة')}</button>` : ''}
          <div class="prod-emoji-in"><input id="f-img" value="${isImg(curImg) ? '' : esc(curImg)}" placeholder="${t('أو إيموجي 🍕')}" maxlength="4"></div>
        </div>
      </div>
      <div class="crumb" style="margin-top:4px">${t('ارفع صورة حقيقية للصنف (تظهر للعميل)، أو اترك إيموجي. الحد 3MB.')}</div>
    </div>
    <div class="row"><div class="field"><label>${t('اسم الصنف')}</label><input id="f-name" value="${esc(p?.name_ar || '')}"></div>
      <div class="field"><label>${t('سعر البيع')}</label><input id="f-price" type="number" value="${p?.price || 0}"></div></div>
    <div class="field"><label>${t('التصنيف')}</label><select id="f-cat"><option value="">${t('— بدون —')}</option>${cats.map(c => `<option value="${c.id}" ${p?.category_id == c.id ? 'selected' : ''}>${c.icon} ${esc(c.name_ar)}</option>`).join('')}</select></div>
    <div class="field"><label>${L('محطة التحضير', 'Prep station')}</label><select id="f-station">
      <option value="bar" ${p?.station !== 'kitchen' ? 'selected' : ''}>🍹 ${L('البار', 'Bar')}</option>
      <option value="kitchen" ${p?.station === 'kitchen' ? 'selected' : ''}>👨‍🍳 ${L('المطبخ', 'Kitchen')}</option></select></div>
    <div class="row"><div class="field"><label>SKU</label><input id="f-sku" value="${esc(p?.sku || '')}" placeholder="${t('اتركه فارغاً للتوليد التلقائي')}"></div>
      <div class="field"><label>🏷️ ${t('الباركود')}</label><input id="f-barcode" value="${esc(p?.barcode || '')}" placeholder="${t('اتركه فارغاً للتوليد التلقائي')}" dir="ltr"></div></div>
    <div class="field"><label><input type="checkbox" id="f-track" ${p?.track_stock !== 0 ? 'checked' : ''} style="width:auto"> ${t('خصم المكونات من المخزن عند البيع')}</label></div>
    <div class="r-line" style="border-top:1px dashed var(--border);margin:12px 0"></div>
    <div style="font-weight:700;font-size:13px;color:var(--sea-deep);margin-bottom:8px">🌐 ${t('عرضه في متجر العميل أونلاين')}</div>
    <div class="row" style="gap:8px">
      <div class="field" style="margin:0"><label><input type="checkbox" id="f-online" ${p?.show_online !== 0 ? 'checked' : ''} style="width:auto"> 👁️ ${t('معروض')}</label></div>
      <div class="field" style="margin:0"><label><input type="checkbox" id="f-new" ${p?.is_new ? 'checked' : ''} style="width:auto"> 🆕 ${t('جديد')}</label></div>
      <div class="field" style="margin:0"><label><input type="checkbox" id="f-feat" ${p?.is_featured ? 'checked' : ''} style="width:auto"> ⭐ ${t('مميّز')}</label></div>
    </div>
    ${p ? `<div class="field" style="margin-top:10px"><label><input type="checkbox" id="f-active" ${p.is_active ? 'checked' : ''} style="width:auto"> ${t('صنف مُفعّل (يظهر في الكاشير)')}</label></div>` : ''}
    <div class="err" id="pe"></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="f-x">${t('إلغاء')}</button><button class="btn btn-primary" id="f-save">${t('حفظ')}</button></div>`);
  $('#f-x', m).onclick = () => m.remove();
  // رفع الصورة: قراءة الملف base64 + معاينة فورية
  $('#f-upload', m).onclick = () => $('#f-file', m).click();
  $('#f-file', m).onchange = () => {
    const file = $('#f-file', m).files[0]; if (!file) return;
    if (file.size > 3 * 1024 * 1024) return $('#pe', m).textContent = t('الحد الأقصى لحجم الصورة 3MB');
    const rd = new FileReader();
    rd.onload = () => { imgData = rd.result; $('#f-preview', m).innerHTML = `<img src="${imgData}" alt="">`; $('#f-img', m).value = ''; $('#pe', m).textContent = ''; };
    rd.readAsDataURL(file);
  };
  const imgDel = $('#f-imgdel', m);
  if (imgDel) imgDel.onclick = () => confirmDialog(t('حذف صورة الصنف والرجوع لإيموجي؟'), async () => {
    await api('/products/' + p.id + '/image', { method: 'DELETE' }); toast(t('حُذفت الصورة')); m.remove(); route();
  });
  $('#f-save', m).onclick = async () => {
    const emoji = $('#f-img', m).value.trim();
    // الصورة: لو رُفعت جديدة نُبقي القيمة الحالية مؤقتاً (يحدّثها رفع الصورة)، وإلا الإيموجي المكتوب أو الحالي
    const imageVal = imgData ? curImg : (emoji || (isImg(curImg) ? curImg : '🍽️'));
    const body = { name_ar: $('#f-name', m).value.trim(), image: imageVal, category_id: +$('#f-cat', m).value || null, price: +$('#f-price', m).value || 0, station: $('#f-station', m).value, track_stock: $('#f-track', m).checked ? 1 : 0,
      sku: $('#f-sku', m).value.trim() || null, barcode: $('#f-barcode', m).value.trim() || null,
      show_online: $('#f-online', m).checked ? 1 : 0, is_new: $('#f-new', m).checked ? 1 : 0, is_featured: $('#f-feat', m).checked ? 1 : 0 };
    if (p) body.is_active = $('#f-active', m).checked ? 1 : 0;
    if (!body.name_ar) return $('#pe', m).textContent = t('الاسم مطلوب');
    try {
      const r = await api(p ? '/products/' + p.id : '/products', { method: p ? 'PUT' : 'POST', body });
      const pid = p ? p.id : r.id;
      if (imgData) await api('/products/' + pid + '/image', { method: 'POST', body: { data: imgData } });
      m.remove(); toast(t('تم الحفظ ✅')); route();
    } catch (e) { $('#pe', m).textContent = e.message; }
  };
}
async function editRecipe(pid) {
  const [p, materials] = await Promise.all([api('/products/' + pid), api('/materials')]);
  let lines = p.recipe.map(r => ({ material_id: r.material_id, qty: r.qty }));
  const m = modal(`<h3>🧪 ${L('وصفة', 'Recipe')}: ${esc(p.name_ar)}</h3>
    <p style="color:var(--text2);font-size:13px;margin-bottom:14px">${t('حدّد المكونات الخام والكمية بالوحدة الصغرى. تُخصم تلقائياً من المخزن لحظة البيع.')}</p>
    <div id="rl"></div>
    <button class="btn btn-ghost btn-sm" id="r-add">${t('+ إضافة مكوّن')}</button>
    <div class="cost-summary"><div>${t('تكلفة المكونات للصنف')}<div class="profit-tag" id="r-margin"></div></div><div class="big" id="r-cost">—</div></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="r-x">${t('إلغاء')}</button><button class="btn btn-primary" id="r-save">${t('💾 حفظ وتحديث التكلفة')}</button></div>`, 'wide');
  const matOpts = (sel) => materials.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.name_ar)} (${x.unit || ''})</option>`).join('');
  const draw = () => {
    $('#rl', m).innerHTML = lines.map((l, i) => {
      const mat = materials.find(x => x.id === l.material_id) || materials[0];
      const lineCost = (mat?.avg_cost || 0) * l.qty;
      return `<div class="recipe-line">
        <select data-mi="${i}">${matOpts(l.material_id)}</select>
        <input type="number" step="any" data-qi="${i}" value="${l.qty}" placeholder="${t('الكمية')}">
        <div class="rl-cost">${money(lineCost)}<br><small>${mat?.unit || ''} • ${mat?.low ? t('⚠️منخفض') : t('متوفر')}</small></div>
        <button class="btn btn-danger btn-sm" data-di="${i}">✕</button></div>`;
    }).join('') || `<div class="empty">${t('لا مكونات بعد — أضف مكوّناً')}</div>`;
    const cost = lines.reduce((s, l) => { const mat = materials.find(x => x.id === l.material_id); return s + (mat?.avg_cost || 0) * l.qty; }, 0);
    $('#r-cost', m).textContent = money(cost);
    const margin = p.price ? ((p.price - cost) / p.price * 100) : 0;
    $('#r-margin', m).textContent = `${t('سعر البيع')} ${money(p.price)} • ${t('هامش')} ${num(margin, 0)}%`;
    $$('#rl [data-mi]', m).forEach(s => s.onchange = () => { lines[+s.dataset.mi].material_id = +s.value; draw(); });
    $$('#rl [data-qi]', m).forEach(inp => inp.oninput = () => { lines[+inp.dataset.qi].qty = +inp.value || 0; draw(); });
    $$('#rl [data-di]', m).forEach(b => b.onclick = () => { lines.splice(+b.dataset.di, 1); draw(); });
  };
  draw();
  $('#r-add', m).onclick = () => { lines.push({ material_id: materials[0]?.id, qty: 1 }); draw(); };
  $('#r-x', m).onclick = () => m.remove();
  $('#r-save', m).onclick = async () => { try { const r = await api(`/products/${pid}/recipe`, { method: 'PUT', body: { recipe: lines } }); m.remove(); toast(t('حُفظت الوصفة — التكلفة: ') + money(r.cost)); route(); } catch (e) { toast(e.message, 'err'); } };
}

// ===================================================================
//  المخزون
// ===================================================================
ROUTES.inventory = async (view) => {
  view.innerHTML = `<div class="page-head"><div><h2>📦 ${t('المخزون')}</h2><div class="crumb">${t('أرصدة المواد الخام بالوحدة الصغرى وقيمتها')}</div></div>
    <div class="head-actions"><button class="btn btn-ghost" id="inv-alerts">🔔 ${L('تنبيهات', 'Alerts')}</button><button class="btn btn-ghost" id="inv-units">📏 ${L('الوحدات', 'Units')}</button>${can('purchases') ? `<button class="btn btn-ghost" id="inv-tx">${t('📜 حركة المخزن')}</button>` : ''}<button class="btn btn-primary" id="inv-mat">${t('+ مادة خام')}</button></div></div>
    <div class="toolbar"><select id="inv-wh"><option value="">${t('كل المخازن')}</option>${META.warehouses.map(w => `<option value="${w.id}">${esc(w.name_ar)}</option>`).join('')}</select></div>
    <div class="kpi-grid" id="inv-kpi"></div>
    <div class="card"><div class="t-wrap"><table><thead><tr><th>${t('الكود')}</th><th>${t('المادة')}</th><th>${t('المخزن')}</th><th>${t('الرصيد')}</th><th>${t('متوسط التكلفة')}</th><th>${t('قيمة المخزون')}</th><th>${t('الحالة')}</th><th></th></tr></thead><tbody id="inv-body"></tbody></table></div></div>`;
  const load = async () => {
    const w = $('#inv-wh').value;
    const d = await api('/inventory' + (w ? '?warehouse=' + w : ''));
    $('#inv-kpi').innerHTML = `
      <div class="kpi"><div class="lbl">${t('عدد المواد')}</div><div class="val">${num(d.rows.length)}</div><span class="ic">📦</span></div>
      <div class="kpi green"><div class="lbl">${t('قيمة المخزون')}</div><div class="val">${money(d.totalValue)}</div><span class="ic">💰</span></div>
      <div class="kpi amber"><div class="lbl">${t('مواد تحت حد الطلب')}</div><div class="val">${num(d.lowCount)}</div><span class="ic">⚠️</span></div>`;
    $('#inv-body').innerHTML = d.rows.map(mm => {
      const ratio = mm.reorder_point ? Math.min(100, mm.qty / (mm.reorder_point * 2) * 100) : 100;
      const cls = mm.low ? 'low' : (ratio < 60 ? 'mid' : '');
      return `<tr><td style="color:var(--text3)">${esc(mm.code || '')}</td><td><b>${esc(mm.name_ar)}</b><div class="bar"><span class="${cls}" style="width:${ratio}%"></span></div></td>
        <td>${esc(mm.warehouse || '—')}</td><td class="t-num">${num(mm.qty, 1)} ${esc(mm.unit || '')}</td><td class="t-num">${money(mm.avg_cost)}</td>
        <td class="t-num">${money(mm.value)}</td><td>${mm.low ? `<span class="chip low">${t('منخفض')}</span>` : `<span class="chip ok">${t('متوفر')}</span>`}</td>
        <td><button class="btn btn-ghost btn-sm" data-m='${mm.id}'>${t('تعديل')}</button></td></tr>`;
    }).join('') || `<tr><td colspan="8" class="empty">${t('لا مواد')}</td></tr>`;
    $$('#inv-body [data-m]', view).forEach(b => b.onclick = () => editMaterial(d.rows.find(x => x.id === +b.dataset.m)));
  };
  $('#inv-wh').onchange = load;
  $('#inv-mat').onclick = () => editMaterial(null);
  $('#inv-alerts').onclick = showAlerts;
  $('#inv-units').onclick = manageUnits;
  const txBtn = $('#inv-tx'); if (txBtn) txBtn.onclick = showTransactions;
  load();
};
async function manageUnits() {
  const m = modal(`<h3>📏 ${L('إدارة الوحدات', 'Manage units')}</h3>
    <p style="color:var(--text2);font-size:13px;margin-bottom:12px">${L('الوحدات الصغرى المستخدمة لقياس المواد الخام (جرام، مليلتر، حبة...).', 'Base units for measuring raw materials (gram, ml, piece...).')}</p>
    <div id="um-body"></div>
    <div class="row" style="margin-top:12px;align-items:end">
      <div class="field" style="margin:0"><label>${L('وحدة جديدة', 'New unit')}</label><input id="nu-name" placeholder="${L('الاسم', 'Name')}"></div>
      <div class="field" style="margin:0;max-width:100px"><label>${L('الرمز', 'Symbol')}</label><input id="nu-sym"></div>
      <button class="btn btn-primary" id="nu-add">${t('إضافة')}</button>
    </div>
    <div class="modal-actions"><button class="btn btn-ghost" id="um-x">${t('إغلاق')}</button></div>`, 'wide');
  const render = async () => {
    const units = await api('/admin/units');
    $('#um-body', m).innerHTML = `<div class="t-wrap"><table><thead><tr><th>${L('الاسم', 'Name')}</th><th>${L('الرمز', 'Symbol')}</th><th>${L('مفعّل', 'Active')}</th><th></th></tr></thead><tbody>
      ${units.map(u => `<tr>
        <td><input data-n="${u.id}" value="${esc(u.name_ar)}" style="width:100%;padding:6px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text)"></td>
        <td><input data-s="${u.id}" value="${esc(u.symbol)}" style="width:70px;padding:6px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text)"></td>
        <td><input type="checkbox" data-a="${u.id}" ${u.is_active ? 'checked' : ''}></td>
        <td><button class="btn btn-ghost btn-sm" data-save="${u.id}">${t('حفظ')}</button></td></tr>`).join('')}
    </tbody></table></div>`;
    $$('#um-body [data-save]', m).forEach(b => b.onclick = async () => {
      const id = b.dataset.save;
      await api('/admin/units/' + id, { method: 'PUT', body: { name_ar: $(`[data-n="${id}"]`, m).value, symbol: $(`[data-s="${id}"]`, m).value, is_active: $(`[data-a="${id}"]`, m).checked ? 1 : 0 } });
      toast(t('تم الحفظ ✅')); META = await api('/meta');
    });
  };
  $('#um-x', m).onclick = () => m.remove();
  $('#nu-add', m).onclick = async () => {
    const name = $('#nu-name', m).value.trim(); if (!name) return;
    await api('/admin/units', { method: 'POST', body: { name_ar: name, symbol: $('#nu-sym', m).value.trim() || name, is_active: 1 } });
    $('#nu-name', m).value = ''; $('#nu-sym', m).value = ''; META = await api('/meta'); render();
  };
  render();
};
function editMaterial(mat) {
  const m = modal(`<h3>${mat ? t('تعديل مادة خام') : t('مادة خام جديدة')}</h3>
    <div class="row"><div class="field"><label>${L('اسم المادة', 'Material name')}</label><input id="m-name" value="${esc(mat?.name_ar || '')}"></div>
      <div class="field"><label>${t('الكود')}</label><input id="m-code" value="${esc(mat?.code || '')}"></div></div>
    <div class="row"><div class="field"><label>${t('الوحدة الصغرى')}</label><select id="m-unit">${META.units.map(u => `<option value="${u.id}" ${mat?.unit_id == u.id ? 'selected' : ''}>${esc(u.name_ar)} (${u.symbol})</option>`).join('')}</select></div>
      <div class="field"><label>${t('المخزن')}</label><select id="m-wh">${META.warehouses.map(w => `<option value="${w.id}" ${mat?.warehouse_id == w.id ? 'selected' : ''}>${esc(w.name_ar)}</option>`).join('')}</select></div></div>
    <div class="row" style="background:var(--sea-light);padding:10px;border-radius:10px">
      <div class="field" style="margin:0"><label>${L('وحدة الشراء', 'Purchase unit')}</label><select id="m-punit">${META.units.map(u => `<option value="${u.id}" ${(mat?.purchase_unit_id || mat?.unit_id) == u.id ? 'selected' : ''}>${esc(u.name_ar)} (${u.symbol})</option>`).join('')}</select></div>
      <div class="field" style="margin:0"><label>${L('الوحدة الصغرى داخل وحدة الشراء', 'Base units per purchase unit')}</label><input id="m-pfactor" type="number" step="any" value="${mat?.purchase_factor ?? 1}"></div></div>
    <div style="font-size:12px;color:var(--text2);margin:-4px 0 8px">${L('مثال: لو الشراء بالكيلو والوحدة الصغرى جرام → اكتب 1000', 'e.g. buy by kilo, base unit gram → enter 1000')}</div>
    <div class="row"><div class="field"><label>${t('الرصيد الحالي')}</label><input id="m-qty" type="number" step="any" value="${mat?.qty ?? 0}"></div>
      <div class="field"><label>${t('متوسط التكلفة (للوحدة)')}</label><input id="m-cost" type="number" step="any" value="${mat?.avg_cost ?? 0}"></div>
      <div class="field"><label>${t('حد إعادة الطلب')}</label><input id="m-re" type="number" step="any" value="${mat?.reorder_point ?? 0}"></div></div>
    <div class="err" id="me"></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="m-x">${t('إلغاء')}</button><button class="btn btn-primary" id="m-save">${t('حفظ')}</button></div>`, 'wide');
  $('#m-x', m).onclick = () => m.remove();
  $('#m-save', m).onclick = async () => {
    const body = { name_ar: $('#m-name', m).value.trim(), code: $('#m-code', m).value.trim(), unit_id: +$('#m-unit', m).value, warehouse_id: +$('#m-wh', m).value, qty: +$('#m-qty', m).value || 0, avg_cost: +$('#m-cost', m).value || 0, reorder_point: +$('#m-re', m).value || 0, purchase_unit_id: +$('#m-punit', m).value, purchase_factor: +$('#m-pfactor', m).value || 1 };
    if (!body.name_ar) return $('#me', m).textContent = t('الاسم مطلوب');
    try { await api(mat ? '/materials/' + mat.id : '/materials', { method: mat ? 'PUT' : 'POST', body }); m.remove(); toast(t('تم الحفظ ✅')); route(); } catch (e) { $('#me', m).textContent = e.message; }
  };
}
async function showTransactions() {
  const rows = await api('/inventory/transactions');
  const TX = { purchase: ['🟢 ' + L('شراء', 'Purchase'), 'var(--green)'], sale: ['🔵 ' + L('بيع', 'Sale'), 'var(--sea-deep)'], waste: ['🔴 ' + L('تالف', 'Waste'), 'var(--red)'], adjust: ['🟡 ' + L('تسوية', 'Adjust'), 'var(--amber)'], count: ['🟣 ' + L('جرد', 'Count'), '#9b59b6'] };
  modal(`<h3>${t('📜 حركة المخزن (آخر ٢٠٠)')}</h3><div class="t-wrap" style="max-height:60vh;overflow:auto"><table><thead><tr><th>${t('المادة')}</th><th>${t('النوع')}</th><th>${t('الكمية')}</th><th>${t('الرصيد')}</th><th>${L('المرجع', 'Ref')}</th><th>${t('الوقت')}</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${esc(r.material)}</td><td style="color:${(TX[r.type] || [])[1]}">${(TX[r.type] || [r.type])[0]}</td>
      <td class="t-num" style="color:${r.qty < 0 ? 'var(--red)' : 'var(--green)'}">${r.qty > 0 ? '+' : ''}${num(r.qty, 1)} ${esc(r.unit || '')}</td>
      <td class="t-num">${num(r.balance, 1)}</td><td style="font-size:12px;color:var(--text2)">${esc(r.note || '')}</td><td style="color:var(--text3);font-size:12px">${dt(r.created_at)}</td></tr>`).join('') || `<tr><td colspan="6" class="empty">${t('لا حركات')}</td></tr>`}
  </tbody></table></div><div class="modal-actions"><button class="btn btn-ghost" onclick="this.closest('.modal-bg').remove()">${t('إغلاق')}</button></div>`, 'xwide');
}

// ===================================================================
//  المشتريات
// ===================================================================
ROUTES.purchases = async (view) => {
  const rows = await api('/purchases');
  const totDue = rows.reduce((s, p) => s + (p.remaining > 0 ? p.remaining : 0), 0);
  view.innerHTML = `<div class="page-head"><div><h2>🚚 ${t('المشتريات')}</h2><div class="crumb">${t('استلام فواتير الموردين — يُحدّث المخزون ومتوسط التكلفة تلقائياً')}</div></div>
    <div class="head-actions"><button class="btn btn-ghost" id="pu-stmt">📄 ${t('كشف حساب مورد')}</button><button class="btn btn-primary" id="pu-new">${t('+ فاتورة شراء')}</button></div></div>
    ${totDue > 0 ? `<div class="kpi-grid"><div class="kpi amber"><div class="lbl">${t('مستحق للموردين (آجل)')}</div><div class="val">${money(totDue)}</div><span class="ic">🕒</span></div></div>` : ''}
    <div class="card"><div class="t-wrap"><table><thead><tr><th>${t('الرقم')}</th><th>${t('المورد')}</th><th>${t('المخزن')}</th><th>${t('عدد البنود')}</th><th>${t('الإجمالي')}</th><th>${t('المدفوع')}</th><th>${t('المتبقي')}</th><th>${t('السداد')}</th><th>${t('الوقت')}</th><th></th></tr></thead><tbody>
    ${rows.map(p => `<tr><td>${esc(p.ref || '#' + p.id)}</td><td>${esc(p.supplier || '—')}</td><td>${esc(p.warehouse || '—')}</td><td class="t-num">${p.lines}</td>
      <td class="t-num">${money(p.total)}</td><td class="t-num">${money(p.paid_amount)}</td>
      <td class="t-num" style="color:${p.remaining > 0 ? 'var(--red)' : 'var(--text3)'}">${p.remaining > 0 ? money(p.remaining) : '—'}</td>
      <td>${payBadge(p.payment_status)}</td><td style="color:var(--text3)">${dt(p.created_at)}</td>
      <td>${p.remaining > 0 ? `<button class="btn btn-sand btn-sm" data-st="${p.id}">${t('سداد')}</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="10" class="empty">${t('لا مشتريات بعد')}</td></tr>`}
    </tbody></table></div></div>`;
  $('#pu-new').onclick = newPurchase;
  $$('#view [data-st]').forEach(b => b.onclick = () => settlePurchase(rows.find(p => p.id === +b.dataset.st)));
  $('#pu-stmt').onclick = async () => {
    const sups = await api('/admin/suppliers');
    const m = modal(`<h3>📄 ${t('كشف حساب مورد')}</h3>
      <div class="field"><select id="ss-sup">${sups.map(s => `<option value="${s.id}">${esc(s.name_ar)}</option>`).join('')}</select></div>
      <div id="ss-body"></div>
      <div class="modal-actions"><button class="btn btn-ghost" id="ss-x">${t('إغلاق النافذة')}</button></div>`, 'wide');
    const loadS = async () => {
      const d = await api(`/suppliers/${$('#ss-sup', m).value}/statement`);
      $('#ss-body', m).innerHTML = `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">
          <span class="chip">${t('إجمالي الفواتير')}: ${money(d.totalInvoices)}</span>
          <span class="chip ${d.totalDue > 0 ? 'low' : 'ok'}">${t('المستحق له')}: ${money(d.totalDue)}</span></div>
        <div class="t-wrap" style="max-height:40vh;overflow:auto"><table><thead><tr><th>${t('الفاتورة')}</th><th>${t('الإجمالي')}</th><th>${t('المدفوع')}</th><th>${t('المتبقي')}</th><th>${t('السداد')}</th><th>${t('الوقت')}</th></tr></thead><tbody>
        ${d.invoices.map(i => `<tr><td>${esc(i.ref || '#' + i.id)}</td><td class="t-num">${money(i.total)}</td><td class="t-num">${money(i.paid_amount)}</td>
          <td class="t-num" style="color:${i.remaining > 0 ? 'var(--red)' : 'var(--text3)'}">${i.remaining > 0 ? money(i.remaining) : '—'}</td>
          <td>${payBadge(i.payment_status)}</td><td style="color:var(--text3)">${dDay(i.created_at)}</td></tr>`).join('') || `<tr><td colspan="6" class="empty">${t('لا فواتير')}</td></tr>`}
        </tbody></table></div>`;
    };
    $('#ss-sup', m).onchange = loadS;
    $('#ss-x', m).onclick = () => m.remove();
    loadS();
  };
};
// سداد مستحق مورد
function settlePurchase(p) {
  const methods = META.payment_methods;
  let method = methods[0];
  const m = modal(`<h3>💰 ${t('سداد مشتريات')} — ${esc(p.ref || '#' + p.id)}</h3>
    <div class="sumline"><span>${t('المورد')}</span><b>${esc(p.supplier || '—')}</b></div>
    <div class="sumline total"><span>${t('المتبقي')}</span><span class="t-num" style="color:var(--red)">${money(p.remaining)}</span></div>
    ${payMethodsHTML(method?.id)}
    <div class="field"><label>${t('المبلغ المسدد الآن')}</label><input id="sp-amt" type="number" step="any" value="${p.remaining}"></div>
    <div class="err" id="sp-e"></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="sp-x">${t('إلغاء')}</button><button class="btn btn-primary" id="sp-go">${t('تأكيد السداد')}</button></div>`);
  $$('.pay-m', m).forEach(b => b.onclick = () => { method = methods.find(x => x.id === +b.dataset.pm); $$('.pay-m', m).forEach(x => x.classList.toggle('active', x === b)); });
  $('#sp-x', m).onclick = () => m.remove();
  $('#sp-go', m).onclick = async () => {
    try { await api(`/purchases/${p.id}/settle`, { method: 'POST', body: { amount: +$('#sp-amt', m).value || 0, method_id: method?.id } });
      m.remove(); toast(t('تم السداد ✅')); route(); } catch (e) { $('#sp-e', m).textContent = e.message; }
  };
}
async function newPurchase() {
  const [materials, suppliers] = await Promise.all([api('/materials'), api('/admin/suppliers')]);
  const matById = (id) => materials.find(x => x.id === id) || {};
  const defCost = (mat, unit) => unit === 'purchase' ? +((mat.avg_cost || 0) * (mat.purchase_factor || 1)).toFixed(3) : (mat.avg_cost || 0);
  const newLine = (id) => { const mt = matById(id); const unit = (mt.purchase_factor > 1) ? 'purchase' : 'base'; return { material_id: id, unit, qty: 1, unit_cost: defCost(mt, unit) }; };
  let items = [newLine(materials[0]?.id)];
  const m = modal(`<h3>${t('🚚 فاتورة شراء جديدة')}</h3>
    <div class="row"><div class="field"><label>${t('المورد')}</label><select id="pu-sup"><option value="">${t('— بدون —')}</option>${suppliers.map(s => `<option value="${s.id}">${esc(s.name_ar)}</option>`).join('')}</select></div>
      <div class="field"><label>${t('المخزن المستلِم')}</label><select id="pu-wh">${META.warehouses.map(w => `<option value="${w.id}">${esc(w.name_ar)}</option>`).join('')}</select></div></div>
    <div class="row"><div class="field"><label>${t('رقم الفاتورة')}</label><input id="pu-ref"></div><div class="field"><label>${t('ضريبة الفاتورة')}</label><input id="pu-tax" type="number" value="0"></div></div>
    <div class="row"><div class="field"><label>${t('السداد')}</label><select id="pu-paystatus">
        <option value="paid">✅ ${t('مدفوعة بالكامل')}</option><option value="partial">⏳ ${t('دفعة جزئية')}</option><option value="credit">🕒 ${t('آجل بالكامل')}</option></select></div>
      <div class="field"><label>${t('الدفع من')}</label><select id="pu-method">${META.payment_methods.map(p => `<option value="${p.id}">${p.icon || ''} ${esc(p.name_ar)}</option>`).join('')}</select></div>
      <div class="field hidden" id="pu-paid-box"><label>${t('المبلغ المدفوع الآن')}</label><input id="pu-paid" type="number" step="any" value="0"></div></div>
    <div style="font-weight:700;margin:6px 0;color:var(--sea-deep)">${t('البنود')} <span style="font-weight:400;font-size:12px;color:var(--text2)">${L('اختر وحدة الشراء — النظام يحوّلها تلقائياً للمخزن', 'pick purchase unit — auto-converted to stock')}</span></div><div id="pu-lines"></div>
    <button class="btn btn-ghost btn-sm" id="pu-add">${t('+ بند')}</button>
    <div class="cost-summary"><div>${t('إجمالي الفاتورة')}</div><div class="big" id="pu-total">—</div></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="pu-x">${t('إلغاء')}</button><button class="btn btn-primary" id="pu-save">${t('💾 استلام وتحديث المخزون')}</button></div>`, 'wide');
  const opts = (sel) => materials.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.name_ar)}</option>`).join('');
  const total = () => money(items.reduce((s, l) => s + l.qty * l.unit_cost, 0) + (+$('#pu-tax', m).value || 0));
  const draw = () => {
    $('#pu-lines', m).innerHTML = items.map((l, i) => {
      const mt = matById(l.material_id); const factor = mt.purchase_factor || 1;
      const baseQty = l.unit === 'purchase' ? l.qty * factor : l.qty;
      const baseCost = l.unit === 'purchase' ? (l.unit_cost / (factor || 1)) : l.unit_cost;
      const conv = l.unit === 'purchase' && factor > 1 ? `<div class="pu-conv">= ${num(baseQty, 1)} ${esc(mt.unit || '')} • ${money(baseCost)}/${esc(mt.unit || '')}</div>` : '';
      return `<div class="pu-line">
        <select data-mi="${i}">${opts(l.material_id)}</select>
        <select data-ui="${i}"><option value="purchase" ${l.unit === 'purchase' ? 'selected' : ''}>${esc(mt.purchase_unit || mt.unit || '')}</option><option value="base" ${l.unit === 'base' ? 'selected' : ''}>${esc(mt.unit || '')}</option></select>
        <input type="number" step="any" data-qi="${i}" value="${l.qty}" placeholder="${t('الكمية')}">
        <input type="number" step="any" data-ci="${i}" value="${l.unit_cost}" placeholder="${L('سعر الوحدة', 'unit price')}">
        <button class="btn btn-danger btn-sm" data-di="${i}">✕</button>${conv}</div>`;
    }).join('');
    $('#pu-total', m).textContent = total();
    $$('#pu-lines [data-mi]', m).forEach(s => s.onchange = () => { const i = +s.dataset.mi; items[i] = newLine(+s.value); draw(); });
    $$('#pu-lines [data-ui]', m).forEach(s => s.onchange = () => { const i = +s.dataset.ui; items[i].unit = s.value; items[i].unit_cost = defCost(matById(items[i].material_id), s.value); draw(); });
    $$('#pu-lines [data-qi]', m).forEach(inp => inp.oninput = () => { items[+inp.dataset.qi].qty = +inp.value || 0; draw(); });
    $$('#pu-lines [data-ci]', m).forEach(inp => inp.oninput = () => { items[+inp.dataset.ci].unit_cost = +inp.value || 0; $('#pu-total', m).textContent = total(); });
    $$('#pu-lines [data-di]', m).forEach(b => b.onclick = () => { items.splice(+b.dataset.di, 1); draw(); });
  };
  draw();
  $('#pu-tax', m).oninput = () => $('#pu-total', m).textContent = total();
  $('#pu-add', m).onclick = () => { items.push(newLine(materials[0]?.id)); draw(); };
  $('#pu-paystatus', m).onchange = () => $('#pu-paid-box', m).classList.toggle('hidden', $('#pu-paystatus', m).value !== 'partial');
  $('#pu-x', m).onclick = () => m.remove();
  $('#pu-save', m).onclick = async () => {
    try {
      const ps = $('#pu-paystatus', m).value;
      const grand = items.reduce((s, l) => s + l.qty * l.unit_cost, 0) + (+$('#pu-tax', m).value || 0);
      const paid = ps === 'paid' ? undefined : (ps === 'partial' ? (+$('#pu-paid', m).value || 0) : 0);
      await api('/purchases', { method: 'POST', body: { supplier_id: +$('#pu-sup', m).value || null, warehouse_id: +$('#pu-wh', m).value,
        ref: $('#pu-ref', m).value.trim(), tax: +$('#pu-tax', m).value || 0, items,
        payment_method_id: +$('#pu-method', m).value || null, ...(paid !== undefined ? { paid_amount: paid } : {}) } });
      m.remove(); toast(t('تم الاستلام وتحديث المخزون ✅')); route(); } catch (e) { toast(e.message, 'err'); }
  };
}

// ===================================================================
//  التوالف والهدر
// ===================================================================
ROUTES.waste = async (view) => {
  const [rows, materials] = await Promise.all([api('/waste'), api('/materials')]);
  view.innerHTML = `<div class="page-head"><div><h2>🗑️ ${t('التوالف والهدر')}</h2><div class="crumb">${t('سجّل المواد التالفة لفصلها عن المبيعات وضبط الأرباح')}</div></div>
    <div class="head-actions"><button class="btn btn-sand" id="w-new">${t('+ تسجيل تالف')}</button></div></div>
    <div class="card"><div class="t-wrap"><table><thead><tr><th>${t('المادة')}</th><th>${t('الكمية')}</th><th>${t('التكلفة المهدرة')}</th><th>${t('السبب')}</th><th>${t('بواسطة')}</th><th>${t('الوقت')}</th></tr></thead><tbody>
    ${rows.map(w => `<tr><td>${esc(w.material)}</td><td class="t-num">${num(w.qty, 1)} ${esc(w.unit || '')}</td><td class="t-num" style="color:var(--red)">${money(w.cost)}</td><td>${esc(w.reason || '')}</td><td>${esc(w.by_name || '')}</td><td style="color:var(--text3)">${dt(w.created_at)}</td></tr>`).join('') || `<tr><td colspan="6" class="empty">${t('لا توالف مسجلة ✅')}</td></tr>`}
    </tbody></table></div></div>`;
  $('#w-new').onclick = () => {
    const reasons = ['انتهاء صلاحية', 'خطأ تحضير', 'كسر / سقوط', 'إرجاع عميل', 'أخرى'];
    const m = modal(`<h3>${t('🗑️ تسجيل مادة تالفة')}</h3>
      <div class="field"><label>${t('المادة')}</label><select id="w-mat">${materials.map(x => `<option value="${x.id}">${esc(x.name_ar)} (${x.unit || ''}) — ${num(x.qty, 1)}</option>`).join('')}</select></div>
      <div class="row"><div class="field"><label>${t('الكمية التالفة')}</label><input id="w-qty" type="number" step="any" value="1"></div>
        <div class="field"><label>${t('السبب')}</label><select id="w-reason">${reasons.map(r => `<option value="${r}">${t(r)}</option>`).join('')}</select></div></div>
      <div class="err" id="we"></div>
      <div class="modal-actions"><button class="btn btn-ghost" id="w-x">${t('إلغاء')}</button><button class="btn btn-sand" id="w-save">${t('تسجيل وخصم')}</button></div>`);
    $('#w-x', m).onclick = () => m.remove();
    $('#w-save', m).onclick = async () => { try { const r = await api('/waste', { method: 'POST', body: { material_id: +$('#w-mat', m).value, qty: +$('#w-qty', m).value, reason: $('#w-reason', m).value } }); m.remove(); toast(t('سُجّل التالف — التكلفة: ') + money(r.cost), 'warn'); route(); } catch (e) { $('#we', m).textContent = e.message; } };
  };
};

// ===================================================================
//  الجرد (Variance)
// ===================================================================
ROUTES.stockcount = async (view) => {
  const rows = await api('/stock-counts');
  view.innerHTML = `<div class="page-head"><div><h2>🔍 ${t('الجرد')}</h2><div class="crumb">${t('طابِق الرصيد الدفتري مع الفعلي لكشف الهدر والعجز')}</div></div>
    <div class="head-actions"><button class="btn btn-primary" id="sc-new">${t('+ جرد جديد')}</button></div></div>
    <div class="card"><div class="t-wrap"><table><thead><tr><th>#</th><th>${t('المخزن')}</th><th>${t('الحالة')}</th><th>${t('عدد المواد')}</th><th>${t('بواسطة')}</th><th>${t('الوقت')}</th><th></th></tr></thead><tbody>
    ${rows.map(s => `<tr><td>#${s.id}</td><td>${esc(s.warehouse || t('الكل'))}</td><td>${s.status === 'open' ? `<span class="chip">${t('مفتوح')}</span>` : `<span class="chip ok">${t('مغلق')}</span>`}</td><td class="t-num">${s.lines}</td><td>${esc(s.by_name || '')}</td><td style="color:var(--text3)">${dt(s.created_at)}</td>
      <td><button class="btn btn-ghost btn-sm" data-s="${s.id}">${s.status === 'open' ? t('إدخال الجرد') : t('عرض الفروقات')}</button></td></tr>`).join('') || `<tr><td colspan="7" class="empty">${t('لا عمليات جرد')}</td></tr>`}
    </tbody></table></div></div>`;
  $('#sc-new').onclick = () => {
    const m = modal(`<h3>${t('🔍 بدء جرد جديد')}</h3>
      <div class="field"><label>${t('المخزن')}</label><select id="sc-wh"><option value="">${t('كل المخازن')}</option>${META.warehouses.map(w => `<option value="${w.id}">${esc(w.name_ar)}</option>`).join('')}</select></div>
      <p style="color:var(--text2);font-size:13px">${t('سيتم تجميد الرصيد الدفتري الحالي لكل مادة كمرجع للمقارنة.')}</p>
      <div class="modal-actions"><button class="btn btn-ghost" id="sc-x">${t('إلغاء')}</button><button class="btn btn-primary" id="sc-go">${t('بدء الجرد')}</button></div>`);
    $('#sc-x', m).onclick = () => m.remove();
    $('#sc-go', m).onclick = async () => { const r = await api('/stock-counts', { method: 'POST', body: { warehouse_id: +$('#sc-wh', m).value || null } }); m.remove(); openCount(r.id); };
  };
  $$('#view [data-s]', view).forEach(b => b.onclick = () => openCount(+b.dataset.s));
};
async function openCount(id) {
  const sc = await api('/stock-counts/' + id);
  const closed = sc.status === 'closed';
  const m = modal(`<h3>🔍 ${L('جرد', 'Count')} #${sc.id} — ${esc(sc.warehouse || t('كل المخازن'))} ${closed ? `<span class="chip ok">${t('مغلق')}</span>` : `<span class="chip">${t('مفتوح')}</span>`}</h3>
    ${closed ? '' : `<input id="sc-q" placeholder="${L('🔍 ابحث عن مادة…', '🔍 Search material…')}" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface2);color:var(--text);margin-bottom:8px">
    <div style="font-size:13px;color:var(--text2);margin-bottom:8px">${L('أدخل الكمية الفعلية الموجودة بالمخزن. المواد غير المُدخلة تبقى كما هي.', 'Enter the actual quantity in stock. Un-entered materials stay unchanged.')} <b id="sc-prog"></b></div>`}
    <div class="t-wrap" style="max-height:50vh;overflow:auto"><table><thead><tr><th>${t('المادة')}</th><th>${t('دفتري')}</th><th>${t('فعلي')}</th><th>${t('الفرق')}</th><th>${t('قيمة الفرق')}</th></tr></thead><tbody id="sc-body"></tbody></table></div>
    <div class="cost-summary"><div>${t('صافي فرق الجرد (− عجز / + فائض)')}</div><div class="big" id="sc-net">—</div></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="sc-cx">${t('إغلاق النافذة')}</button>
      ${closed ? '' : `<button class="btn btn-ghost" id="sc-save">${t('💾 حفظ مؤقت')}</button><button class="btn btn-primary" id="sc-close">${t('✅ إنهاء واعتماد الفروقات')}</button>`}</div>`, 'xwide');
  const rowHTML = (i) => {
    const actual = i.actual_qty;
    const diff = actual === null || actual === undefined ? null : +(actual - i.book_qty).toFixed(3);
    const val = diff === null ? 0 : diff * i.unit_cost;
    return `<td>${esc(i.name_ar)}</td><td class="t-num">${num(i.book_qty, 1)} ${esc(i.unit || '')}</td>
      <td>${closed ? num(actual, 1) : `<input type="number" step="any" data-i="${i.id}" value="${actual ?? ''}" style="width:90px;padding:6px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text)">`}</td>
      <td class="t-num diff" style="color:${diff === null ? 'var(--text3)' : diff < 0 ? 'var(--red)' : diff > 0 ? 'var(--green)' : 'var(--text2)'}">${diff === null ? '—' : (diff > 0 ? '+' : '') + num(diff, 1)}</td>
      <td class="t-num dval">${diff === null ? '—' : money(val)}</td>`;
  };
  const recalc = () => {
    let net = 0, counted = 0;
    sc.items.forEach(i => { if (i.actual_qty !== null && i.actual_qty !== undefined) { counted++; net += (i.actual_qty - i.book_qty) * i.unit_cost; } });
    $('#sc-net', m).textContent = money(net); $('#sc-net', m).style.color = net < 0 ? 'var(--red)' : net > 0 ? 'var(--green)' : 'var(--text)';
    const pg = $('#sc-prog', m); if (pg) pg.textContent = `(${counted}/${sc.items.length})`;
  };
  // رسم الصفوف مرة واحدة (بدون إعادة بناء عند الكتابة → لا يضيع التركيز)
  $('#sc-body', m).innerHTML = sc.items.map(i => `<tr data-row="${i.id}">${rowHTML(i)}</tr>`).join('');
  recalc();
  $$('#sc-body [data-i]', m).forEach(inp => inp.oninput = () => {
    const it = sc.items.find(x => x.id === +inp.dataset.i);
    it.actual_qty = inp.value === '' ? null : +inp.value;
    const tr = inp.closest('tr'); const diff = it.actual_qty === null ? null : +(it.actual_qty - it.book_qty).toFixed(3);
    const dc = $('.diff', tr), vc = $('.dval', tr);
    dc.textContent = diff === null ? '—' : (diff > 0 ? '+' : '') + num(diff, 1);
    dc.style.color = diff === null ? 'var(--text3)' : diff < 0 ? 'var(--red)' : diff > 0 ? 'var(--green)' : 'var(--text2)';
    vc.textContent = diff === null ? '—' : money(diff * it.unit_cost);
    recalc();
  });
  const sq = $('#sc-q', m); if (sq) sq.oninput = () => { const q = sq.value.trim(); $$('#sc-body tr', m).forEach(tr => { const it = sc.items.find(x => x.id === +tr.dataset.row); tr.style.display = (!q || it.name_ar.includes(q)) ? '' : 'none'; }); };
  $('#sc-cx', m).onclick = () => m.remove();
  const save = async () => api('/stock-counts/' + id, { method: 'PUT', body: { items: sc.items.map(i => ({ id: i.id, actual_qty: i.actual_qty })) } });
  if (!closed) {
    $('#sc-save', m).onclick = async () => { await save(); toast(t('حُفظ مؤقتاً')); };
    $('#sc-close', m).onclick = () => confirmDialog(t('إنهاء الجرد واعتماد الفروقات كتسويات مخزنية؟'), async () => { await save(); await api(`/stock-counts/${id}/close`, { method: 'POST', body: {} }); m.remove(); toast(t('تم اعتماد الجرد ✅')); route(); }, false);
  }
}

// ===================================================================
//  المصروفات
// ===================================================================
ROUTES.expenses = async (view) => {
  const cats = await api('/expense-cats');
  const from = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  view.innerHTML = `<div class="page-head"><div><h2>💸 ${t('المصروفات')}</h2><div class="crumb">${L('سجّل المصروفات (إيجار، كهرباء…) لتُخصم من صافي الربح', 'Log expenses (rent, electricity…) deducted from net profit')}</div></div>
    <div class="head-actions"><button class="btn btn-primary" id="ex-new">${t('+ مصروف جديد')}</button></div></div>
    <div class="toolbar">${t('من')} <input type="date" id="ex-from" value="${from}"> ${t('إلى')} <input type="date" id="ex-to" value="${todayStr()}"></div>
    <div id="ex-body"><div class="loading">…</div></div>`;
  const load = async () => {
    const d = await api(`/expenses?from=${$('#ex-from').value}&to=${$('#ex-to').value}`);
    $('#ex-body').innerHTML = `
      <div class="kpi-grid">
        <div class="kpi amber"><div class="lbl">${t('إجمالي المصروفات')}</div><div class="val">${money(d.total)}</div><span class="ic">💸</span></div>
        ${d.byCat.slice(0, 3).map(c => `<div class="kpi"><div class="lbl">${c.icon || ''} ${esc(c.name_ar || '—')}</div><div class="val">${money(c.total)}</div></div>`).join('')}
      </div>
      <div class="card"><div class="t-wrap"><table><thead><tr><th>${t('تاريخ المصروف')}</th><th>${t('فئة المصروف')}</th><th>${t('قيمة المصروف')}</th><th>${t('ملاحظات')}</th><th>${t('بواسطة')}</th><th></th></tr></thead><tbody>
        ${d.rows.map(e => `<tr><td>${esc(e.spent_at || dDay(e.created_at))}</td><td>${e.icon || ''} ${esc(e.category || '—')}</td><td class="t-num" style="color:var(--amber)">${money(e.amount)}</td><td>${esc(e.note || '')}</td><td>${esc(e.by_name || '')}</td><td><button class="btn btn-ghost btn-sm" data-del="${e.id}">${t('حذف')}</button></td></tr>`).join('') || `<tr><td colspan="6" class="empty">${t('لا مصروفات')}</td></tr>`}
      </tbody></table></div></div>`;
    $$('#ex-body [data-del]').forEach(b => b.onclick = () => confirmDialog(L('حذف هذا المصروف؟', 'Delete this expense?'), async () => { await api('/expenses/' + b.dataset.del, { method: 'DELETE' }); toast(t('حُذف')); load(); }));
  };
  $('#ex-from').onchange = load; $('#ex-to').onchange = load;
  $('#ex-new').onclick = () => {
    const m = modal(`<h3>💸 ${t('تسجيل مصروف')}</h3>
      <div class="row"><div class="field"><label>${t('فئة المصروف')}</label><select id="x-cat">${cats.map(c => `<option value="${c.id}">${c.icon || ''} ${esc(c.name_ar)}</option>`).join('')}</select></div>
        <div class="field"><label>${t('قيمة المصروف')}</label><input id="x-amt" type="number" step="any"></div></div>
      <div class="row"><div class="field"><label>${t('تاريخ المصروف')}</label><input id="x-date" type="date" value="${todayStr()}"></div>
        <div class="field"><label>${t('يُصرف من (الخزنة)')}</label><select id="x-method"><option value="">${t('— بدون خصم من خزنة —')}</option>${META.payment_methods.map(p => `<option value="${p.id}">${p.icon || ''} ${esc(p.name_ar)}</option>`).join('')}</select></div></div>
      <div class="field"><label>${t('ملاحظات')}</label><input id="x-note"></div>
      <div class="err" id="x-e"></div>
      <div class="modal-actions"><button class="btn btn-ghost" id="x-x">${t('إلغاء')}</button><button class="btn btn-primary" id="x-save">${t('حفظ')}</button></div>`);
    $('#x-x', m).onclick = () => m.remove();
    $('#x-save', m).onclick = async () => {
      const body = { category_id: +$('#x-cat', m).value, amount: +$('#x-amt', m).value || 0, spent_at: $('#x-date', m).value, note: $('#x-note', m).value.trim(), method_id: +$('#x-method', m).value || null };
      if (!(body.amount > 0)) return $('#x-e', m).textContent = L('أدخل قيمة المصروف', 'Enter amount');
      try { await api('/expenses', { method: 'POST', body }); m.remove(); toast(t('تم الحفظ ✅')); load(); } catch (e) { $('#x-e', m).textContent = e.message; }
    };
  };
  load();
};

// ===================================================================
//  تقارير الحوكمة
// ===================================================================
function exportExcel(filename, rows) {
  if (!rows || !rows.length) return toast(L('لا بيانات للتصدير', 'No data to export'), 'warn');
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, filename + '.xlsx');
}
function exportPDF(title, columns, rows, kpis) {
  const head = `<div class="rd-head">${logoMark('rd-logo')}<div class="rd-title"><h1>${esc(META.settings.cafe_name || 'seaside')}</h1><div>${esc(title)}</div><small>${new Date().toLocaleString('en-GB')}</small></div></div>`;
  const kpisHTML = kpis && kpis.length ? `<div class="rd-kpis">${kpis.map(k => `<div><span>${esc(k.lbl)}</span><b>${esc(k.val)}</b></div>`).join('')}</div>` : '';
  const table = `<table class="rd-table"><thead><tr>${columns.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${columns.map(c => `<td>${esc(r[c.key] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const pa = $('#print-area'); pa.innerHTML = `<div class="report-doc">${head}${kpisHTML}${table}</div>`; pa.classList.remove('hidden');
  setPrintPage('@page{size:A4;margin:14mm}');
  const done = () => { pa.classList.add('hidden'); pa.innerHTML = ''; setPrintPage(''); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done); setTimeout(() => window.print(), 150);
}

// ---------- قائمة الدخل الشاملة (P&L) ----------
// تصنيف الألوان: أدنى=أفضل (تكلفة/هدر) أو أعلى=أفضل (هامش ربح)
const rLow = (v, good, warn) => v <= good ? 'good' : v <= warn ? 'warn' : 'bad';
const rHigh = (v, good, warn) => v >= good ? 'good' : v >= warn ? 'warn' : 'bad';
function pnlHTML(d) {
  const r = d.revenue, c = d.cogs, o = d.opex;
  const line = (label, val, cls = '') => `<div class="pnl-line ${cls}"><span>${label}</span><b>${money(val)}</b></div>`;
  return `<div class="pnl-grid">
    <div class="card">
      <div class="pnl-sec-h">💰 ${t('الإيرادات')}</div>
      ${line(t('إجمالي المبيعات (قبل الخصم)'), r.grossSales)}
      ${r.discount ? line('(−) ' + t('خصومات المبيعات'), -r.discount, 'neg') : ''}
      ${r.salesReturns ? line('(−) ' + t('مرتجعات المبيعات'), -r.salesReturns, 'neg') : ''}
      ${line('= ' + t('صافي المبيعات'), r.netSales, 'sub')}
      ${r.otherRevenue ? line('(+) ' + t('إيرادات أخرى (توصيل/بقشيش محصّل)'), r.otherRevenue) : ''}
      ${line(t('إجمالي الإيرادات'), r.totalRevenue, 'total')}

      <div class="pnl-sec-h">📦 ${t('تكلفة البضاعة المباعة')} (COGS)</div>
      ${line(t('تكلفة مكوّنات المبيعات (حسب الوصفات)'), c.ingredientsCost)}
      ${c.returnedCost ? line('(−) ' + t('عكس تكلفة مرتجعات أُعيدت للمخزون'), -c.returnedCost, 'neg') : ''}
      ${c.wasteCost ? line('(+) ' + t('توالف وهدر'), c.wasteCost) : ''}
      ${c.countShortage ? line('(+) ' + t('عجز الجرد'), c.countShortage) : ''}
      ${c.countSurplus ? line('(−) ' + t('فائض الجرد'), -c.countSurplus, 'neg') : ''}
      ${line(t('إجمالي تكلفة البضاعة'), c.total, 'total')}

      <div class="pnl-line grand"><span>${t('إجمالي الربح')} (Gross Profit)</span><b>${money(d.grossProfit)}</b><small>${t('هامش إجمالي')} ${num(d.grossMarginPct, 1)}%</small></div>

      <div class="pnl-sec-h">💸 ${t('المصروفات التشغيلية')}</div>
      ${o.byCategory.length ? o.byCategory.map(x => line((x.icon || '') + ' ' + (x.name_ar || t('غير مصنّف')), x.total)).join('') : `<div class="pnl-line" style="color:var(--text3)">${t('لا مصروفات مسجّلة في هذه الفترة')}</div>`}
      ${line(t('إجمالي المصروفات'), o.total, 'total')}

      <div class="pnl-line grand final"><span>🏆 ${t('صافي الربح')} (Net Profit)</span><b>${money(d.netProfit)}</b><small>${t('هامش صافي')} ${num(d.netMarginPct, 1)}%</small></div>
    </div>
    <div>
      <div class="pnl-side-card"><h4>📊 ${t('مؤشرات محاسبية')}</h4>
        <div class="pnl-ratio"><span>${t('نسبة تكلفة البضاعة (Food Cost)')}</span><b class="${rLow(d.cogsPctOfSales, 30, 40)}">${num(d.cogsPctOfSales, 1)}%</b></div>
        <div class="pnl-ratio"><span>${t('هامش الربح الإجمالي')}</span><b class="${rHigh(d.grossMarginPct, 60, 45)}">${num(d.grossMarginPct, 1)}%</b></div>
        <div class="pnl-ratio"><span>${t('هامش الربح الصافي')}</span><b class="${rHigh(d.netMarginPct, 15, 5)}">${num(d.netMarginPct, 1)}%</b></div>
        <div class="pnl-ratio"><span>${t('الهدر من تكلفة البضاعة')}</span><b class="${rLow(d.wastePctOfCogs, 3, 7)}">${num(d.wastePctOfCogs, 1)}%</b></div>
        <div class="pnl-ratio"><span>${t('الهدر من صافي المبيعات')}</span><b>${num(d.wastePctOfSales, 1)}%</b></div>
        <div class="pnl-ratio"><span>${t('متوسط قيمة الفاتورة')}</span><b>${money(r.avgOrderValue)}</b></div>
        <div class="pnl-ratio"><span>${t('عدد الفواتير المدفوعة')}</span><b>${num(r.ordersCount)}</b></div>
      </div>
      <div class="pnl-side-card"><h4>🚚 ${t('المشتريات والذمم')}</h4>
        <div class="pnl-ratio"><span>${t('مشتريات الفترة')}</span><b>${money(d.purchases.total)}</b></div>
        <div class="pnl-ratio"><span>${t('المدفوع منها')}</span><b>${money(d.purchases.paid)}</b></div>
        ${d.purchaseReturns.total ? `<div class="pnl-ratio"><span>${t('مرتجعات مشتريات الفترة')}</span><b>${money(d.purchaseReturns.total)}</b></div>` : ''}
        <div class="pnl-ratio"><span>${t('مستحق للموردين (كل الوقت)')}</span><b class="${d.payables.value > 0 ? 'warn' : 'good'}">${money(d.payables.value)}</b></div>
        <div class="pnl-ratio"><span>${t('مستحق لنا من العملاء (كل الوقت)')}</span><b class="${d.receivables.value > 0 ? 'warn' : 'good'}">${money(d.receivables.value)}</b></div>
        <div class="pnl-note">${t('الذمم أرقام لحظية (كل الفواتير الآجلة/الجزئية غير المسدَّدة) وليست محصورة بالفترة المحددة أعلاه')}</div>
      </div>
      <div class="pnl-side-card"><h4>📦 ${t('المخزون الحالي')} <small style="font-weight:400;color:var(--text3)">(${t('لحظي')})</small></h4>
        <div class="pnl-ratio"><span>${t('قيمة المخزون بالتكلفة')}</span><b>${money(d.inventory.value)}</b></div>
        <div class="pnl-ratio"><span>${t('عدد الأصناف الخام')}</span><b>${num(d.inventory.itemsCount)}</b></div>
        <div class="pnl-ratio"><span>${t('أصناف تحت حد إعادة الطلب')}</span><b class="${d.inventory.lowStockCount ? 'bad' : 'good'}">${num(d.inventory.lowStockCount)}</b></div>
        <div class="pnl-note">${t('قيمة المخزون رقم لحظي حتى الآن — لا يُحسب تاريخياً بنهاية الفترة المحددة أعلاه لأن النظام لا يحتفظ بصور تاريخية للمخزون')}</div>
      </div>
    </div>
  </div>`;
}
// تسطيح التقرير لصفوف Excel (بند/قيمة) مع فواصل أقسام
function pnlRows(d) {
  const r = d.revenue, c = d.cogs, o = d.opex, K = 'البند', V = 'القيمة';
  const sec = (s) => ({ [K]: '— ' + s + ' —', [V]: '' });
  const row = (l, v) => ({ [K]: l, [V]: v });
  return [
    sec('الإيرادات'), row('إجمالي المبيعات', r.grossSales), row('خصومات المبيعات', -r.discount),
    row('مرتجعات المبيعات', -r.salesReturns), row('صافي المبيعات', r.netSales), row('إيرادات أخرى', r.otherRevenue),
    row('إجمالي الإيرادات', r.totalRevenue),
    sec('تكلفة البضاعة المباعة'), row('تكلفة المكوّنات', c.ingredientsCost), row('عكس تكلفة مرتجعات', -c.returnedCost),
    row('توالف وهدر', c.wasteCost), row('عجز الجرد', c.countShortage), row('فائض الجرد', -c.countSurplus),
    row('إجمالي تكلفة البضاعة', c.total), row('إجمالي الربح (Gross Profit)', d.grossProfit),
    sec('المصروفات التشغيلية'), ...o.byCategory.map(x => row(x.name_ar || 'غير مصنّف', x.total)),
    row('إجمالي المصروفات', o.total), row('صافي الربح (Net Profit)', d.netProfit),
    sec('مؤشرات'), row('نسبة تكلفة البضاعة %', d.cogsPctOfSales), row('هامش الربح الإجمالي %', d.grossMarginPct),
    row('هامش الربح الصافي %', d.netMarginPct), row('الهدر من تكلفة البضاعة %', d.wastePctOfCogs),
    sec('المشتريات والذمم'), row('مشتريات الفترة', d.purchases.total), row('المدفوع منها', d.purchases.paid),
    row('مستحق للموردين', d.payables.value), row('مستحق من العملاء', d.receivables.value),
    sec('المخزون الحالي (لحظي)'), row('قيمة المخزون', d.inventory.value), row('عدد الأصناف الخام', d.inventory.itemsCount),
  ];
}
function printPnL(d) {
  const head = `<div class="rd-head">${logoMark('rd-logo')}<div class="rd-title"><h1>${esc(META.settings.cafe_name || 'seaside')}</h1><div>${t('الأرباح والخسائر الشاملة')}</div><small>${dDay(d.from)} ← ${dDay(d.to.replace('￿', ''))} · ${new Date().toLocaleString('en-GB')}</small></div></div>`;
  const pa = $('#print-area'); pa.innerHTML = `<div class="report-doc">${head}${pnlHTML(d)}</div>`; pa.classList.remove('hidden');
  setPrintPage('@page{size:A4;margin:14mm}');
  const done = () => { pa.classList.add('hidden'); pa.innerHTML = ''; setPrintPage(''); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done); setTimeout(() => window.print(), 150);
}

const REPORTS = [
  { sec: ['التقرير الشامل', 'Overview'] },
  { k: 'pnl', ic: '🧮', t: ['الأرباح والخسائر الشاملة', 'Full P&L statement'] },
  { sec: ['المبيعات', 'Sales'] },
  { k: 'sales', ic: '📊', t: ['ملخص المبيعات', 'Sales summary'] },
  { k: 'sales_type', ic: '🍽️', t: ['المبيعات حسب النوع', 'Sales by type'] },
  { k: 'products', ic: '📦', t: ['الأصناف', 'Products'] },
  { k: 'categories', ic: '🏷️', t: ['الفئات', 'Categories'] },
  { k: 'cashiers', ic: '👤', t: ['أداء الكاشير', 'Cashier performance'] },
  { k: 'cancelled', ic: '❌', t: ['الطلبات الملغاة', 'Cancelled orders'] },
  { sec: ['المالية', 'Finance'] },
  { k: 'journal', ic: '📒', t: ['اليومية المالية', 'Daily journal'] },
  { k: 'treasury', ic: '🏦', t: ['حركة الخزينة', 'Treasury movements'], meth: true },
  { k: 'payments', ic: '💳', t: ['طرق الدفع', 'Payment methods'] },
  { k: 'vouchers', ic: '🧾', t: ['السندات', 'Vouchers'] },
  { k: 'due', ic: '🕒', t: ['المستحقات والآجل', 'Dues & credit'] },
  { k: 'expenses', ic: '💸', t: ['المصروفات', 'Expenses'] },
  { k: 'shifts', ic: '⏱️', t: ['الورديات', 'Shifts'] },
  { sec: ['العملاء والولاء', 'Customers'] },
  { k: 'customers', ic: '👥', t: ['كشف العملاء', 'Customers'] },
  { k: 'points', ic: '⭐', t: ['نقاط الولاء', 'Loyalty points'] },
  { sec: ['المخزون والمشتريات', 'Inventory'] },
  { k: 'inventory_moves', ic: '🔄', t: ['حركة المخزون', 'Inventory moves'], mat: true },
  { k: 'purchases', ic: '🚚', t: ['المشتريات', 'Purchases'], mat: true },
  { k: 'returns', ic: '↩️', t: ['المرتجعات', 'Returns'] },
  { k: 'variance', ic: '🔍', t: ['الهدر والعجز', 'Waste & variance'] },
  { k: 'suppliers', ic: '🏭', t: ['أداء الموردين', 'Suppliers'] },
];
const TXLABEL = { purchase: ['شراء', 'Purchase'], sale: ['بيع', 'Sale'], waste: ['تالف', 'Waste'], adjust: ['تسوية', 'Adjust'], count: ['جرد', 'Count'] };
const JLABEL = { sale: ['🧾 مبيعات', 'Sale'], voucher_in: ['💰 سند قبض', 'Receipt'], voucher_out: ['💸 سند صرف', 'Payment'], expense: ['💸 مصروف', 'Expense'], purchase: ['🚚 مشتريات', 'Purchase'] };

ROUTES.reports = async (view) => {
  const from = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  let curR = 'sales';
  const [materials, meta] = await Promise.all([api('/materials').catch(() => []), Promise.resolve(META)]);
  const methods = meta.payment_methods || [];
  view.innerHTML = `<div class="page-head"><div><h2>📈 ${t('تقارير الحوكمة')}</h2><div class="crumb">${L('تقارير شاملة لكل العمليات — صدّرها PDF أو Excel', 'Comprehensive reports — export to PDF or Excel')}</div></div></div>
    <div class="rep-layout">
      <div class="rep-main">
        <div class="toolbar">${t('من')} <input type="date" id="r-from" value="${from}"> ${t('إلى')} <input type="date" id="r-to" value="${todayStr()}">
          <select id="r-material" class="hidden"><option value="">${L('كل المواد', 'All materials')}</option>${materials.map(x => `<option value="${x.id}">${esc(x.name_ar)}</option>`).join('')}</select>
          <select id="r-method" class="hidden"><option value="">${t('كل الطرق')}</option>${methods.map(x => `<option value="${x.id}">${x.icon || ''} ${esc(x.name_ar)}</option>`).join('')}</select>
          <button class="btn btn-primary btn-sm" id="r-go">${t('تحديث')}</button>
          <span style="flex:1;min-width:10px"></span>
          <button class="btn btn-ghost btn-sm" id="r-xls">⬇ Excel</button>
          <button class="btn btn-ghost btn-sm" id="r-pdf">🖨️ PDF</button>
        </div>
        <div id="r-body"><div class="loading">…</div></div>
      </div>
      <div class="rep-list" id="rep-list">${REPORTS.map(r => r.sec ? `<div class="rep-list-h">${L(r.sec[0], r.sec[1])}</div>` : `<button class="rep-item ${r.k === curR ? 'active' : ''}" data-r="${r.k}">${r.ic} ${L(r.t[0], r.t[1])}</button>`).join('')}</div>
    </div>`;
  let current = { title: '', columns: [], rows: [], kpis: [] };
  const load = async () => {
    const rep = REPORTS.find(r => r.k === curR); const title = L(rep.t[0], rep.t[1]);
    $('#r-material').classList.toggle('hidden', !rep.mat);
    $('#r-method').classList.toggle('hidden', !rep.meth);
    const mat = rep.mat && $('#r-material').value ? '&material=' + $('#r-material').value : '';
    const meth = rep.meth && $('#r-method').value ? '&method=' + $('#r-method').value : '';
    const f = $('#r-from').value, tt = $('#r-to').value, qs = `?from=${f}&to=${tt}${mat}${meth}`;
    const body = $('#r-body'); body.innerHTML = '<div class="loading">…</div>';
    let kpis = [], columns = [], rows = [];
    try {
      if (curR === 'pnl') {
        const d = await api('/reports/pnl' + qs);
        current = { title, pnl: d };
        body.innerHTML = pnlHTML(d);
        return;
      } else if (curR === 'sales') {
        const d = await api('/reports/sales' + qs); const s = d.summary;
        kpis = [{ lbl: t('المبيعات'), val: money(s.sales) }, { lbl: t('تكلفة المكونات'), val: money(s.cost) }, { lbl: t('صافي الربح'), val: money(s.profit) }, { lbl: L('عدد الطلبات', 'Orders'), val: num(s.orders) },
          { lbl: t('المحصَّل'), val: money(s.collected) }, { lbl: t('آجل غير محصَّل'), val: money(s.due) }, { lbl: t('الخصومات'), val: money(s.discount) }, { lbl: t('التوصيل'), val: money(s.tip_delivery) }];
        columns = [{ key: 'd', label: t('الوقت') }, { key: 'orders', label: L('عدد الطلبات', 'Orders') }, { key: 'sales', label: t('المبيعات') }, { key: 'cost', label: t('التكلفة') }, { key: 'profit', label: t('صافي الربح') }];
        rows = d.byDay.map(x => ({ d: dDay(x.d), orders: num(x.orders), sales: money(x.sales), cost: money(x.cost), profit: money(x.profit) }));
      } else if (curR === 'sales_type') {
        const d = await api('/reports/sales' + qs);
        kpis = d.byType.map(x => ({ lbl: LL(TYPE, x.order_type), val: money(x.total) }));
        columns = [{ key: 'type', label: t('نوع الطلب') }, { key: 'cnt', label: L('عدد الطلبات', 'Orders') }, { key: 'total', label: t('المبيعات') }, { key: 'cost', label: t('التكلفة') }, { key: 'tip', label: t('التوصيل') }, { key: 'profit', label: t('صافي الربح') }];
        rows = d.byType.map(x => ({ type: LL(TYPE, x.order_type), cnt: num(x.cnt), total: money(x.total), cost: money(x.cost), tip: money(x.tip_delivery), profit: money(x.profit) }));
        // أضف تفصيل المصدر تحت الجدول (POS/QR/دليفري)
        rows.push({ type: '— ' + t('حسب المصدر') + ' —', cnt: '', total: '', cost: '', tip: '', profit: '' });
        d.bySource.forEach(x => rows.push({ type: (x.source === 'qr' ? '📲 ' : '🖥️ ') + (x.source === 'qr' ? t('طلب أونلاين/QR') : t('كاشير')) + ' — ' + LL(TYPE, x.order_type), cnt: num(x.cnt), total: money(x.total), cost: '', tip: '', profit: '' }));
      } else if (curR === 'cashiers') {
        const d = await api('/reports/sales' + qs);
        columns = [{ key: 'name', label: t('الكاشير') }, { key: 'cnt', label: L('عدد الطلبات', 'Orders') }, { key: 'total', label: t('المبيعات') }, { key: 'collected', label: t('المحصَّل') }];
        rows = d.byCashier.map(x => ({ name: x.full_name || '—', cnt: num(x.cnt), total: money(x.total), collected: money(x.collected) }));
      } else if (curR === 'products') {
        const d = await api('/reports/sales' + qs);
        columns = [{ key: 'name', label: t('الصنف') }, { key: 'qty', label: t('الكمية') }, { key: 'sales', label: t('المبيعات') }, { key: 'cost', label: t('التكلفة') }, { key: 'margin', label: t('هامش الربح') }];
        rows = d.byProduct.map(p => ({ name: p.name_ar, qty: num(p.qty), sales: money(p.sales), cost: money(p.cost), margin: money(p.margin) }));
      } else if (curR === 'categories') {
        const d = await api('/reports/categories' + qs);
        columns = [{ key: 'name', label: L('الفئة', 'Category') }, { key: 'qty', label: t('الكمية') }, { key: 'sales', label: t('المبيعات') }, { key: 'cost', label: t('التكلفة') }];
        rows = d.map(c => ({ name: (c.icon || '') + ' ' + c.name_ar, qty: num(c.qty), sales: money(c.sales), cost: money(c.cost) }));
      } else if (curR === 'payments') {
        const d = await api('/reports/payments' + qs);
        columns = [{ key: 'name', label: L('طريقة الدفع', 'Method') }, { key: 'cnt', label: L('عدد الطلبات', 'Orders') }, { key: 'total', label: t('الإجمالي') }];
        rows = d.map(p => ({ name: (p.icon || '') + ' ' + p.name_ar, cnt: num(p.cnt), total: money(p.total) }));
      } else if (curR === 'journal') {
        const d = await api('/reports/journal' + qs);
        kpis = [{ lbl: t('إجمالي الوارد'), val: money(d.inflow) }, { lbl: t('إجمالي المنصرف'), val: money(d.outflow) }, { lbl: t('صافي الحركة'), val: money(d.net) }, { lbl: L('عدد الحركات', 'Entries'), val: num(d.items.length) }];
        columns = [{ key: 'date', label: t('الوقت') }, { key: 'type', label: t('النوع') }, { key: 'ref', label: t('المرجع') }, { key: 'party', label: t('الطرف') }, { key: 'method', label: t('الطريقة') }, { key: 'amount', label: t('المبلغ') }, { key: 'by', label: t('بواسطة') }];
        rows = d.items.map(i => ({ date: dt(i.date), type: LL(JLABEL, i.type), ref: i.ref, party: i.party || '—', method: i.method || '—', amount: (i.amount > 0 ? '+' : '') + money(i.amount), by: i.by_name || '—' }));
      } else if (curR === 'treasury') {
        const d = await api('/reports/treasury' + qs);
        kpis = [{ lbl: t('الوارد'), val: money(d.inflow) }, { lbl: t('المنصرف'), val: money(d.outflow) }, { lbl: t('الصافي'), val: money(d.net) }];
        columns = [{ key: 'date', label: t('الوقت') }, { key: 'method', label: t('الطريقة') }, { key: 'type', label: t('النوع') }, { key: 'note', label: t('البيان') }, { key: 'amount', label: t('المبلغ') }, { key: 'by', label: t('بواسطة') }];
        rows = d.rows.map(r => ({ date: dt(r.created_at), method: r.method, type: LL(MMLABEL, r.ref_type), note: r.note || '—', amount: (r.amount > 0 ? '+' : '') + money(r.amount), by: r.by_name || '—' }));
      } else if (curR === 'vouchers') {
        const d = await api('/reports/vouchers' + qs);
        kpis = [{ lbl: t('إجمالي القبض'), val: money(d.receipts) }, { lbl: t('إجمالي الصرف'), val: money(d.payments) }, { lbl: t('الصافي'), val: money(d.net) }];
        columns = [{ key: 'no', label: t('رقم السند') }, { key: 'kind', label: t('النوع') }, { key: 'party', label: t('الطرف') }, { key: 'amount', label: t('المبلغ') }, { key: 'method', label: t('الطريقة') }, { key: 'note', label: t('البيان') }, { key: 'date', label: t('الوقت') }, { key: 'by', label: t('بواسطة') }];
        rows = d.rows.map(v => ({ no: v.voucher_no, kind: v.kind === 'receipt' ? '💰 ' + t('قبض') : '💸 ' + t('صرف'), party: v.party_name, amount: (v.kind === 'receipt' ? '+' : '−') + money(v.amount), method: v.method || '—', note: v.note || '—', date: dt(v.created_at), by: v.by_name || '—' }));
      } else if (curR === 'due') {
        const d = await api('/reports/due' + qs);
        kpis = [{ lbl: t('إجمالي المستحق (آجل)'), val: money(d.totalDue) }, { lbl: L('عدد الفواتير', 'Invoices'), val: num(d.rows.length) }, { lbl: L('عدد العملاء', 'Customers'), val: num(d.byCustomer.length) }];
        columns = [{ key: 'inv', label: t('الفاتورة') }, { key: 'customer', label: t('العميل') }, { key: 'phone', label: t('الهاتف') }, { key: 'total', label: t('الإجمالي') }, { key: 'paid', label: t('المدفوع') }, { key: 'rem', label: t('المتبقي') }, { key: 'date', label: t('الوقت') }];
        rows = d.rows.map(o => ({ inv: o.invoice_no, customer: o.customer || '—', phone: o.phone || '—', total: money(o.total), paid: money(o.paid_amount), rem: money(o.remaining), date: dDay(o.created_at) }));
      } else if (curR === 'expenses') {
        const d = await api('/reports/expenses' + qs);
        kpis = [{ lbl: t('إجمالي المصروفات'), val: money(d.total) }, ...d.byCategory.slice(0, 3).map(c => ({ lbl: (c.icon || '') + ' ' + (c.name_ar || '—'), val: money(c.total) }))];
        columns = [{ key: 'date', label: t('التاريخ') }, { key: 'cat', label: t('الفئة') }, { key: 'amount', label: t('المبلغ') }, { key: 'method', label: t('من الخزنة') }, { key: 'note', label: t('البيان') }, { key: 'by', label: t('بواسطة') }];
        rows = d.rows.map(e => ({ date: e.spent_at || '—', cat: (e.icon || '') + ' ' + (e.category || '—'), amount: money(e.amount), method: e.method || '—', note: e.note || '—', by: e.by_name || '—' }));
      } else if (curR === 'shifts') {
        const d = await api('/reports/shifts' + qs);
        kpis = [{ lbl: t('عجز التقفيل'), val: money(d.shortage) }, { lbl: t('زيادة التقفيل'), val: money(d.surplus) }, { lbl: t('صافي الفروقات'), val: money(d.variance) }, { lbl: L('عدد الورديات', 'Shifts'), val: num(d.rows.length) }];
        columns = [{ key: 'id', label: '#' }, { key: 'user', label: t('الكاشير') }, { key: 'float', label: t('العهدة') }, { key: 'expected', label: t('المتوقع') }, { key: 'counted', label: t('المعدود') }, { key: 'variance', label: t('العجز/الزيادة') }, { key: 'opened', label: t('فُتحت') }, { key: 'closed', label: t('قُفّلت') }];
        rows = d.rows.map(s => ({ id: '#' + s.id, user: s.user_name, float: money(s.opening_float), expected: s.expected_cash != null ? money(s.expected_cash) : '—', counted: s.counted_cash != null ? money(s.counted_cash) : '—', variance: s.variance != null ? (s.variance > 0 ? '+' : '') + money(s.variance) : '—', opened: dt(s.opened_at), closed: s.closed_at ? dt(s.closed_at) : t('مفتوحة') }));
      } else if (curR === 'customers') {
        const d = await api('/reports/customers');
        kpis = [{ lbl: L('عدد العملاء', 'Customers'), val: num(d.totalCustomers) }, { lbl: t('إجمالي المبيعات'), val: money(d.totalSales) }, { lbl: t('إجمالي الآجل'), val: money(d.totalDue) }, { lbl: t('إجمالي النقاط'), val: num(d.totalPoints, 1) }];
        columns = [{ key: 'name', label: t('العميل') }, { key: 'phone', label: t('الهاتف') }, { key: 'orders', label: L('الفواتير', 'Orders') }, { key: 'sales', label: t('المشتريات') }, { key: 'due', label: t('المتبقي عليه') }, { key: 'points', label: t('النقاط') }];
        rows = d.rows.map(c => ({ name: c.name_ar, phone: c.phone || '—', orders: num(c.orders_count), sales: money(c.total_sales), due: money(c.balance_due), points: num(c.points, 1) }));
      } else if (curR === 'points') {
        const d = await api('/reports/points' + qs);
        kpis = [{ lbl: t('نقاط مكتسبة'), val: num(d.earned, 1) }, { lbl: t('نقاط مستبدلة'), val: num(d.redeemed, 1) }, { lbl: t('رصيد النقاط الحالي'), val: num(d.totalPoints, 1) }, { lbl: t('عملاء لديهم نقاط'), val: num(d.activeCustomers) }];
        columns = [{ key: 'customer', label: t('العميل') }, { key: 'points', label: t('النقاط') }, { key: 'kind', label: t('النوع') }, { key: 'note', label: t('البيان') }, { key: 'date', label: t('الوقت') }];
        const PK = { earn: t('اكتساب'), redeem: t('استبدال'), manual_add: t('إضافة يدوية'), manual_remove: t('خصم يدوي') };
        rows = d.rows.map(p => ({ customer: p.customer, points: (p.points > 0 ? '+' : '') + num(p.points, 1), kind: PK[p.kind] || p.kind, note: p.note || '—', date: dt(p.created_at) }));
      } else if (curR === 'returns') {
        const d = await api('/reports/returns' + qs);
        kpis = [{ lbl: t('مرتجعات المبيعات'), val: money(d.salesTotal) }, { lbl: t('مرتجعات المشتريات'), val: money(d.purchasesTotal) }];
        columns = [{ key: 'no', label: t('رقم المرتجع') }, { key: 'kind', label: t('النوع') }, { key: 'orig', label: t('الأصل') }, { key: 'party', label: t('الطرف') }, { key: 'total', label: t('القيمة') }, { key: 'reason', label: t('السبب') }, { key: 'date', label: t('الوقت') }];
        rows = [...d.sales.map(r => ({ no: r.return_no, kind: '🛒 ' + t('مبيعات'), orig: r.orig || '—', party: r.customer || '—', total: money(r.total), reason: r.reason || '—', date: dt(r.created_at) })),
          ...d.purchases.map(r => ({ no: r.return_no, kind: '🚚 ' + t('مشتريات'), orig: r.orig || '—', party: r.supplier || '—', total: money(r.total), reason: r.reason || '—', date: dt(r.created_at) }))];
      } else if (curR === 'cancelled') {
        const d = await api('/reports/cancelled' + qs);
        columns = [{ key: 'inv', label: t('الفاتورة') }, { key: 'total', label: t('الإجمالي') }, { key: 'table', label: t('الطاولة') }, { key: 'by', label: t('بواسطة') }, { key: 'note', label: L('السبب', 'Reason') }, { key: 'date', label: t('الوقت') }];
        rows = d.map(o => ({ inv: o.invoice_no, total: money(o.total), table: o.table_name || '—', by: o.by_name || '—', note: o.note || '—', date: dt(o.created_at) }));
      } else if (curR === 'inventory_moves') {
        const d = await api('/reports/inventory-moves' + qs);
        columns = [{ key: 'date', label: t('الوقت') }, { key: 'material', label: t('المادة') }, { key: 'type', label: t('النوع') }, { key: 'qty', label: t('الكمية') }, { key: 'balance', label: t('الرصيد') }, { key: 'note', label: L('المرجع', 'Ref') }];
        rows = d.map(r => ({ date: dt(r.created_at), material: r.material, type: LL(TXLABEL, r.type), qty: (r.qty > 0 ? '+' : '') + num(r.qty, 1) + ' ' + (r.unit || ''), balance: num(r.balance, 1), note: r.note || '—' }));
      } else if (curR === 'purchases') {
        const d = await api('/reports/purchases' + qs);
        const tot = d.reduce((s, r) => s + r.total, 0);
        kpis = [{ lbl: L('عدد البنود', 'Lines'), val: num(d.length) }, { lbl: t('الإجمالي'), val: money(tot) }];
        columns = [{ key: 'date', label: t('الوقت') }, { key: 'ref', label: t('رقم الفاتورة') }, { key: 'supplier', label: t('المورد') }, { key: 'material', label: t('المادة') }, { key: 'qty', label: t('الكمية') }, { key: 'cost', label: L('سعر الوحدة', 'Unit cost') }, { key: 'total', label: t('الإجمالي') }];
        rows = d.map(r => ({ date: dDay(r.created_at), ref: r.ref || '—', supplier: r.supplier || '—', material: r.material, qty: num(r.qty, 1) + ' ' + (r.unit || ''), cost: money(r.unit_cost), total: money(r.total) }));
      } else if (curR === 'variance') {
        const d = await api('/reports/variance' + qs);
        kpis = [{ lbl: t('تكلفة التوالف'), val: money(d.wasteTotal) }, { lbl: t('عجز الجرد'), val: money(d.shortage) }, { lbl: t('فائض الجرد'), val: money(d.surplus) }, { lbl: t('نسبة الهدر من التكلفة'), val: num(d.wastePct, 1) + '%' }];
        columns = [{ key: 'name', label: t('المادة') }, { key: 'qty', label: t('كمية الهدر') }, { key: 'cost', label: t('التكلفة') }];
        rows = d.waste.map(w => ({ name: w.name_ar, qty: num(w.qty, 1), cost: money(w.cost) }));
      } else if (curR === 'suppliers') {
        const d = await api('/reports/suppliers');
        columns = [{ key: 'name', label: t('المورد') }, { key: 'inv', label: t('الفواتير') }, { key: 'total', label: t('الإجمالي') }, { key: 'last', label: t('آخر توريد') }];
        rows = d.map(s => ({ name: s.name_ar, inv: num(s.invoices), total: money(s.total), last: s.last ? dDay(s.last) : '—' }));
      }
    } catch (e) { body.innerHTML = `<div class="card"><p style="color:var(--red)">⚠️ ${esc(e.message)}</p></div>`; return; }
    current = { title, columns, rows, kpis };
    body.innerHTML = `
      ${kpis.length ? `<div class="kpi-grid">${kpis.map((k, i) => `<div class="kpi ${['', 'sand', 'green', 'amber'][i % 4]}"><div class="lbl">${esc(k.lbl)}</div><div class="val">${esc(k.val)}</div></div>`).join('')}</div>` : ''}
      <div class="card"><h3>${esc(title)} <span class="chip">${rows.length}</span></h3>
        <div class="t-wrap"><table><thead><tr>${columns.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>
          ${rows.length ? rows.map(r => `<tr>${columns.map(c => `<td class="${/\d/.test(String(r[c.key])) ? 't-num' : ''}">${esc(r[c.key])}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${columns.length}" class="empty">${t('لا بيانات')}</td></tr>`}
        </tbody></table></div></div>`;
  };
  $('#r-go').onclick = load;
  $('#r-material').onchange = load;
  $('#r-xls').onclick = () => {
    if (curR === 'pnl') return current.pnl ? exportExcel('seaside-pnl-' + todayStr(), pnlRows(current.pnl)) : toast(L('لا بيانات للتصدير', 'No data to export'), 'warn');
    const out = current.rows.map(r => { const o = {}; current.columns.forEach(c => o[c.label] = r[c.key]); return o; }); exportExcel('seaside-' + curR + '-' + todayStr(), out);
  };
  $('#r-pdf').onclick = () => {
    if (curR === 'pnl') return current.pnl ? printPnL(current.pnl) : toast(L('لا بيانات للتصدير', 'No data to export'), 'warn');
    return current.rows.length ? exportPDF(current.title, current.columns, current.rows, current.kpis) : toast(L('لا بيانات للتصدير', 'No data to export'), 'warn');
  };
  $$('#rep-list .rep-item').forEach(b => b.onclick = () => { curR = b.dataset.r; $$('#rep-list .rep-item').forEach(x => x.classList.toggle('active', x === b)); load(); });
  load();
};

// ===================================================================
//  الموظفون
// ===================================================================
// ===================================================================
//  كتالوج الصلاحيات — مجمّع بالشاشات، لكل شاشة "عرض" + إجراءات دقيقة
// ===================================================================
const PERM_CATALOG = [
  { g: 'نقطة البيع', ge: 'Point of Sale', perms: [['pos.view', 'عرض الشاشة', 'View'], ['pos.create', 'إنشاء فاتورة', 'Create invoice'], ['pos.draft', 'حفظ مؤقت (فاتورة مفتوحة)', 'Save open tab'], ['pos.discount', 'تطبيق خصم', 'Apply discount'], ['pos.pay_credit', 'بيع آجل / جزئي', 'Credit / partial sale']] },
  { g: 'مراجعة الفواتير', ge: 'Orders', perms: [['orders.view', 'عرض الفواتير', 'View'], ['orders.pay', 'تحصيل فاتورة', 'Collect payment'], ['orders.cancel', 'إلغاء فاتورة', 'Cancel invoice'], ['orders.settle', 'سداد آجل', 'Settle credit'], ['orders.delete', 'حذف فاتورة', 'Delete invoice']] },
  { g: 'طلبات الطاولات والدليفري', ge: 'QR & Delivery', perms: [['qrorders.view', 'عرض طلبات الطاولات', 'View table orders'], ['qrorders.accept', 'قبول/رفض طلبات الطاولات', 'Accept/reject'], ['delivery.view', 'عرض طلبات الدليفري', 'View delivery'], ['delivery.accept', 'قبول/رفض الدليفري', 'Accept/reject delivery']] },
  { g: 'المطبخ والبار', ge: 'Kitchen & Bar', perms: [['kds.view', 'شاشة المطبخ', 'Kitchen display'], ['bar.view', 'شاشة البار', 'Bar display']] },
  { g: 'الورديات والعملاء', ge: 'Shifts & Customers', perms: [['shifts.view', 'الورديات والعهدة', 'Shifts'], ['shifts.close', 'تقفيل وردية', 'Close shift'], ['customers.view', 'عرض العملاء', 'View customers'], ['customers.edit', 'إضافة/تعديل عميل', 'Edit customers']] },
  { g: 'المخزون والمشتريات', ge: 'Inventory & Purchasing', perms: [['inventory.view', 'المخزون', 'Inventory'], ['purchases.view', 'المشتريات', 'Purchases'], ['waste.view', 'التوالف والهدر', 'Waste'], ['stockcount.view', 'الجرد', 'Stock count'], ['requests.view', 'طلبات الشراء', 'Purchase requests'], ['requests.create', 'إنشاء طلب شراء', 'Create request'], ['barcodes.view', 'طباعة باركود', 'Barcodes']] },
  { g: 'المالية', ge: 'Finance', perms: [['treasury.view', 'الخزينة', 'Treasury'], ['vouchers.view', 'سندات قبض وصرف', 'Vouchers'], ['parties.view', 'الأطراف العامة', 'Parties'], ['expenses.view', 'المصروفات', 'Expenses'], ['returns.view', 'المرتجعات', 'Returns'], ['points.view', 'نقاط الولاء', 'Points']] },
  { g: 'الإدارة والتقارير', ge: 'Management', perms: [['dashboard.view', 'لوحة التحكم', 'Dashboard'], ['products.view', 'الأصناف والوصفات', 'Products'], ['reports.view', 'التقارير', 'Reports'], ['tables.view', 'الطاولات و QR', 'Tables & QR'], ['shop.view', 'متجر العميل أونلاين', 'Online shop'], ['notifications.view', 'الإشعارات', 'Notifications'], ['staff.view', 'الموظفون', 'Staff'], ['config.view', 'الإعدادات', 'Settings'], ['backup.view', 'النسخ الاحتياطي', 'Backup']] },
];
// محرّر مصفوفة صلاحيات الأدوار (أدمن فقط)
async function editRolePermissions() {
  const roles = (await api('/roles')).filter(r => r.key !== 'admin');
  let cur = roles[0];
  const parse = (r) => { try { return new Set(JSON.parse(r.permissions || '[]')); } catch { return new Set(); } };
  let sel = parse(cur);
  const m = modal(`<h3>🛡️ ${L('صلاحيات الأدوار', 'Role permissions')}</h3>
    <p style="color:var(--text2);font-size:13px;margin-bottom:10px">${L('حدّد بالـ ✓ ما يستطيع كل دور رؤيته وفعله. الأدمن يملك كل الصلاحيات دائماً.', 'Tick what each role can see and do. Admin always has everything.')}</p>
    <div class="cat-chips" id="rp-tabs">${roles.map((r, i) => `<button class="cat-chip ${i === 0 ? 'active' : ''}" data-r="${r.id}">${esc(r.name_ar)}</button>`).join('')}</div>
    <div id="rp-body" style="max-height:55vh;overflow:auto;margin-top:8px"></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="rp-x">${t('إغلاق')}</button><button class="btn btn-primary" id="rp-save">${t('💾 حفظ الصلاحيات')}</button></div>`, 'wide');
  const draw = () => {
    $('#rp-body', m).innerHTML = PERM_CATALOG.map(gr => `<div class="perm-group">
      <div class="pg-head"><label><input type="checkbox" class="pg-all" data-g="${esc(gr.g)}" ${gr.perms.every(p => sel.has(p[0])) ? 'checked' : ''}> <b>${L(gr.g, gr.ge)}</b></label></div>
      <div class="pg-perms">${gr.perms.map(p => `<label class="rfield"><input type="checkbox" data-p="${p[0]}" ${sel.has(p[0]) ? 'checked' : ''}> ${L(p[1], p[2])}</label>`).join('')}</div>
    </div>`).join('');
    $$('#rp-body [data-p]', m).forEach(c => c.onchange = () => { c.checked ? sel.add(c.dataset.p) : sel.delete(c.dataset.p); draw(); });
    $$('#rp-body .pg-all', m).forEach(c => c.onchange = () => {
      const gr = PERM_CATALOG.find(x => x.g === c.dataset.g);
      gr.perms.forEach(p => c.checked ? sel.add(p[0]) : sel.delete(p[0]));
      draw();
    });
  };
  draw();
  $$('#rp-tabs .cat-chip', m).forEach(b => b.onclick = () => {
    cur.permissions = JSON.stringify([...sel]);   // احتفظ بالتعديل غير المحفوظ محلياً عند التنقل
    cur = roles.find(r => r.id === +b.dataset.r); sel = parse(cur);
    $$('#rp-tabs .cat-chip', m).forEach(x => x.classList.toggle('active', x === b)); draw();
  });
  $('#rp-x', m).onclick = () => m.remove();
  $('#rp-save', m).onclick = async () => {
    cur.permissions = JSON.stringify([...sel]);
    try {
      for (const r of roles) await api(`/roles/${r.id}/permissions`, { method: 'PUT', body: { permissions: JSON.parse(r.permissions || '[]') } });
      m.remove(); toast(L('حُفظت الصلاحيات ✅ — تسري عند تسجيل الدخول التالي للمستخدمين', 'Permissions saved ✅ — apply on users\' next login'));
    } catch (e) { toast(e.message, 'err'); }
  };
}

ROUTES.staff = async (view) => {
  const [staff, roles] = await Promise.all([api('/staff'), api('/roles')]);
  view.innerHTML = `<div class="page-head"><div><h2>👥 ${t('الموظفون')}</h2><div class="crumb">${t('إضافة الموظفين وتحديد أدوارهم وصلاحياتهم')}</div></div>
    <div class="head-actions"><button class="btn btn-sand" id="s-perms">🛡️ ${L('صلاحيات الأدوار', 'Role permissions')}</button><button class="btn btn-sand" id="s-newrole">+ ${L('دور جديد', 'New role')}</button><button class="btn btn-primary" id="s-new">${t('+ موظف جديد')}</button></div></div>
    <div class="card"><div class="t-wrap"><table><thead><tr><th>${t('الاسم')}</th><th>${t('البريد')}</th><th>${t('الدور')}</th><th>PIN</th><th>${t('الحالة')}</th><th></th></tr></thead><tbody>
    ${staff.map(u => `<tr><td><b>${esc(u.full_name)}</b></td><td style="color:var(--text2)">${esc(u.email)}</td><td><span class="chip">${esc(u.role_name)}</span></td><td>${esc(u.pin || '—')}</td><td>${u.is_active ? `<span class="chip ok">${t('مفعّل')}</span>` : `<span class="chip low">${t('موقوف')}</span>`}</td><td><button class="btn btn-ghost btn-sm" data-u="${u.id}">${t('تعديل')}</button></td></tr>`).join('')}
    </tbody></table></div></div>`;
  const form = (u) => {
    const m = modal(`<h3>${u ? t('تعديل موظف') : t('موظف جديد')}</h3>
      <div class="field"><label>${t('الاسم')}</label><input id="u-name" value="${esc(u?.full_name || '')}"></div>
      <div class="row"><div class="field"><label>${t('البريد')}</label><input id="u-email" value="${esc(u?.email || '')}" ${u ? 'disabled' : ''}></div>
        <div class="field"><label>${t('الدور')}</label><select id="u-role">${roles.map(r => `<option value="${r.id}" ${u?.role_key === r.key ? 'selected' : ''}>${esc(r.name_ar)}</option>`).join('')}</select></div></div>
      <div class="row"><div class="field"><label>${u ? t('كلمة المرور (اتركها فارغة لعدم التغيير)') : t('كلمة المرور')}</label><input id="u-pass" type="text"></div>
        <div class="field"><label>${t('PIN سريع')}</label><input id="u-pin" value="${esc(u?.pin || '')}"></div></div>
      ${u ? `<div class="field"><label><input type="checkbox" id="u-active" ${u.is_active ? 'checked' : ''} style="width:auto"> ${t('مفعّل')}</label></div>` : ''}
      <div class="err" id="ue"></div>
      <div class="modal-actions"><button class="btn btn-ghost" id="u-x">${t('إلغاء')}</button><button class="btn btn-primary" id="u-save">${t('حفظ')}</button></div>`);
    $('#u-x', m).onclick = () => m.remove();
    $('#u-save', m).onclick = async () => {
      const body = { full_name: $('#u-name', m).value.trim(), role_id: +$('#u-role', m).value, pin: $('#u-pin', m).value.trim() };
      if (!u) { body.email = $('#u-email', m).value.trim(); body.password = $('#u-pass', m).value; }
      else { if ($('#u-pass', m).value) body.password = $('#u-pass', m).value; body.is_active = $('#u-active', m).checked ? 1 : 0; }
      try { await api(u ? '/staff/' + u.id : '/staff', { method: u ? 'PUT' : 'POST', body }); m.remove(); toast(t('تم الحفظ ✅')); route(); } catch (e) { $('#ue', m).textContent = e.message; }
    };
  };
  $('#s-new').onclick = () => form(null);
  $('#s-perms').onclick = editRolePermissions;
  $('#s-newrole').onclick = () => {
    const m = modal(`<h3>${L('دور جديد', 'New role')}</h3>
      <div class="field"><label>${L('اسم الدور', 'Role name')}</label><input id="nr-name" placeholder="${L('مثلاً: مشرف', 'e.g. Supervisor')}"></div>
      <div class="field"><label>${L('المفتاح (بالإنجليزية)', 'Key (English)')}</label><input id="nr-key" placeholder="${L('مثلاً: supervisor', 'e.g. supervisor')}"></div>
      <div class="err" id="nr-e"></div>
      <div class="modal-actions"><button class="btn btn-ghost" id="nr-x">${t('إلغاء')}</button><button class="btn btn-primary" id="nr-save">${t('حفظ')}</button></div>`);
    $('#nr-name', m).oninput = () => { if (!$('#nr-key', m).dataset.manual) $('#nr-key', m).value = $('#nr-name', m).value.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, ''); };
    $('#nr-key', m).oninput = () => { $('#nr-key', m).dataset.manual = '1'; };
    $('#nr-x', m).onclick = () => m.remove();
    $('#nr-save', m).onclick = async () => {
      const name_ar = $('#nr-name', m).value.trim(), key = $('#nr-key', m).value.trim().toLowerCase();
      if (!name_ar || !key) { $('#nr-e', m).textContent = L('الاسم والمفتاح مطلوبان', 'Name and key are required'); return; }
      try { await api('/roles', { method: 'POST', body: { name_ar, key } }); m.remove(); toast(L('تم إنشاء الدور ✅', 'Role created ✅')); route(); } catch (e) { $('#nr-e', m).textContent = e.message; }
    };
  };
  $$('#view [data-u]', view).forEach(b => b.onclick = () => form(staff.find(u => u.id === +b.dataset.u)));
};

// ===================================================================
//  الإعدادات (عامة + جداول ديناميكية)
// ===================================================================
// ملحوظة: الطاولات تُدار من شاشة «الطاولات و QR»، وطرق الدفع من شاشة «الخزينة» — بلا تكرار
const ADMIN_TABS = [
  { k: 'categories', t: '🏷️ التصنيفات', cols: [['name_ar', 'الاسم', 'text'], ['icon', 'أيقونة', 'text'], ['color', 'لون', 'color'], ['sort_order', 'ترتيب', 'number'], ['is_active', 'مفعّل', 'bool']] },
  { k: 'units', t: '📏 الوحدات', cols: [['name_ar', 'الاسم', 'text'], ['symbol', 'الرمز', 'text'], ['is_active', 'مفعّل', 'bool']] },
  { k: 'warehouses', t: '🏬 المخازن', cols: [['name_ar', 'الاسم', 'text'], ['kind', 'النوع', 'text'], ['sort_order', 'ترتيب', 'number'], ['is_active', 'مفعّل', 'bool']] },
  { k: 'suppliers', t: '🚚 الموردون', cols: [['name_ar', 'الاسم', 'text'], ['phone', 'هاتف', 'text'], ['notes', 'ملاحظات', 'text'], ['is_active', 'مفعّل', 'bool']] },
  { k: 'expense-categories', t: '💸 فئات المصروفات', cols: [['name_ar', 'الاسم', 'text'], ['icon', 'أيقونة', 'text'], ['sort_order', 'ترتيب', 'number'], ['is_active', 'مفعّل', 'bool']] },
];
ROUTES.config = async (view) => {
  const s = await api('/settings');
  view.innerHTML = `<div class="page-head"><div><h2>⚙️ ${t('الإعدادات')}</h2><div class="crumb">${t('بيانات الكافيه والضريبة، وكل القوائم الديناميكية')}</div></div></div>
    <div class="card"><h3>${t('🏪 بيانات المكان والفاتورة')}</h3>
      <div class="row"><div class="field"><label>${t('اسم المكان')}</label><input id="st-cafe_name" value="${esc(s.cafe_name || '')}"></div><div class="field"><label>${t('الشعار / الوصف')}</label><input id="st-tagline" value="${esc(s.tagline || '')}"></div></div>
      <div class="row"><div class="field"><label>${t('العملة')}</label><input id="st-currency" value="${esc(s.currency || '')}"></div><div class="field"><label>${t('الهاتف')}</label><input id="st-phone" value="${esc(s.phone || '')}"></div></div>
      <div class="field"><label>${t('العنوان')}</label><input id="st-address" value="${esc(s.address || '')}"></div>
      <div class="field"><label>${t('تذييل الفاتورة')}</label><input id="st-receipt_footer" value="${esc(s.receipt_footer || '')}"></div>
      <button class="btn btn-primary" id="st-save">${t('💾 حفظ الإعدادات')}</button>
    </div>
    <div class="card"><h3>🎨 ${t('الثيم والهوية')}</h3>
      <p class="crumb" style="margin-bottom:12px">${t('اختر لون النظام — يُطبق على كل الشاشات ولكل المستخدمين فوراً')}</p>
      <div class="preset-grid" id="preset-grid">
        ${[['seaside', 'سي سايد', '#0FB5BA', '#0C8B93'], ['berry', 'نبيتي', '#E91E63', '#8E1240'], ['ocean', 'أزرق محيطي', '#1E88E5', '#0D47A1'],
           ['forest', 'أخضر غابات', '#2E9E5B', '#1B6B3C'], ['royal', 'بنفسجي ملكي', '#7C4DFF', '#4527A0'], ['sunset', 'برتقالي غروب', '#F4511E', '#BF360C']]
          .map(p => `<button class="preset-swatch ${(s.theme_preset || 'seaside') === p[0] ? 'active' : ''}" data-preset="${p[0]}">
            <span class="sw" style="background:linear-gradient(135deg,${p[2]},${p[3]})"></span><span>${t(p[1])}</span></button>`).join('')}
      </div>
      <div class="row" style="margin-top:14px;align-items:center">
        <div class="field" style="margin:0"><label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="th-glass" ${s.theme_glass === '1' ? 'checked' : ''} style="width:auto"> 🫧 ${t('الوضع الشفاف (زجاجي)')}</label>
          <small style="color:var(--text3)">${t('خلفية متدرجة وبطاقات شبه شفافة — الفاتح/الداكن من زر القائمة الجانبية')}</small></div>
      </div>
      <div class="r-line" style="border-top:1px dashed var(--border);margin:16px 0"></div>
      <h3 style="font-size:15px">🖼️ ${t('لوجو البرنامج')} <small style="font-weight:400;color:var(--text3)">(${t('يظهر في الدخول والقائمة والفاتورة المطبوعة')})</small></h3>
      <div class="logo-row">
        <span class="logo-preview">${logoMark('cfg-logo')}</span>
        <input type="file" id="lg-file" accept="image/png,image/jpeg,image/webp" class="hidden">
        <button class="btn btn-ghost" id="lg-up">⬆️ ${t('رفع لوجو مخصص')}</button>
        ${BRANDING.custom_logo ? `<button class="btn btn-danger" id="lg-del">🗑️ ${t('حذف والرجوع للأصلي')}</button>` : ''}
      </div>
      <div class="err" id="lg-e"></div>
    </div>
    <div class="card"><h3>💰 ${t('الضرائب والرسوم')}</h3>
      <p class="crumb" style="margin-bottom:12px">${t('أضف أي عدد من الضرائب (قيمة مضافة، خدمة…) — «مطبقة» تعني تُحسب على الطلبات الجديدة، و«تظهر في الريسيت» تعني تُطبع سطراً مستقلاً. يمكنك إضافة ضريبة وتركها غير مطبقة لحين الحاجة.')}</p>
      <div id="tax-list"></div>
      <button class="btn btn-ghost btn-sm" id="tax-add">${t('+ إضافة ضريبة')}</button>
    </div>
    <div class="card"><h3>🌐 ${t('موقع الطلب أونلاين (دليفري)')}</h3>
      <p class="crumb" style="margin-bottom:12px">${t('نفس موقع منيو الـQR — بدون رمز طاولة يتحول لوضع التوصيل: العميل يدخل اسمه وعنوانه ويطلب من بيته')}</p>
      <div class="row" style="align-items:flex-end">
        <div class="field"><label><input type="checkbox" id="ol-on" ${s.online_ordering === '1' ? 'checked' : ''} style="width:auto"> ${t('تفعيل استقبال طلبات الدليفري أونلاين')}</label></div>
        <div class="field"><label>🛵 ${t('مصاريف التوصيل')}</label><input id="ol-fee" type="number" step="any" value="${esc(s.delivery_fee || '0')}"></div>
      </div>
      <div class="field"><label>${t('رابط موقع العميل (انشره على صفحاتك)')}</label>
        <div style="display:flex;gap:8px"><input id="ol-url" readonly value="${location.origin}/menu" dir="ltr" style="flex:1">
        <button class="btn btn-ghost" id="ol-copy">📋</button></div></div>
      <button class="btn btn-primary" id="ol-save">${t('💾 حفظ إعدادات الأونلاين')}</button>
    </div>
    <div class="card"><h3>⬆️ ${t('أيقونات الهيدر العلوي')}</h3>
      <p class="crumb" style="margin-bottom:12px">${t('اختر الأزرار السريعة اللي تظهر في الشريط العلوي فوق كل شاشة')}</p>
      <div class="rfields" id="tb-fields"></div>
      <button class="btn btn-primary" id="tb-save" style="margin-top:14px">${t('💾 حفظ أيقونات الهيدر')}</button>
    </div>
    <div class="card"><h3>🧾 ${L('عناصر الفاتورة — تحكّم ديناميكي', 'Receipt elements — dynamic')}</h3>
      <p class="crumb" style="margin-bottom:12px">${L('فعّل/ألغِ العناصر اللي تظهر في الفاتورة المطبوعة (اللوجو دائماً متاح).', 'Toggle which elements appear on the printed receipt.')}</p>
      <div class="rfields" id="rfields"></div>
      <div class="field" style="margin-top:14px"><label>${L('أسطر إضافية في الفاتورة (سطر لكل عنصر — مثل: واي فاي، إنستجرام)', 'Extra receipt lines (one per line — e.g. Wifi, Instagram)')}</label>
        <textarea id="st-extra" rows="3" style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface2);color:var(--text)">${esc(s.receipt_extra_lines || '')}</textarea></div>
      <button class="btn btn-primary" id="rf-save">${L('💾 حفظ الفاتورة', '💾 Save receipt')}</button>
    </div>
    <div class="card"><h3>${t('🗂️ القوائم الديناميكية')}</h3>
      <div class="cat-chips" id="adm-tabs">${ADMIN_TABS.map((a, i) => `<button class="cat-chip ${i === 0 ? 'active' : ''}" data-k="${a.k}">${t(a.t)}</button>`).join('')}</div>
      <div id="adm-body"></div></div>
    <div class="card" style="border:2px solid #e53935">
      <h3 style="color:#e53935">${t('⚠️ منطقة الخطر')}</h3>
      <p style="margin-bottom:12px">${t('هذا الإجراء سيحذف جميع الطلبات والفواتير والمشتريات والمصروفات وحركات المخزون والجرد نهائياً. لن يمس المنتجات أو الأصناف أو التصنيفات أو المخزون.')}</p>
      <button class="btn" id="btn-reset-fin" style="background:#e53935;color:#fff">${t('🗑️ مسح الحركات المالية')}</button>
    </div>`;
  $('#st-save').onclick = async () => {
    const body = {}; ['cafe_name', 'tagline', 'currency', 'address', 'phone', 'receipt_footer'].forEach(k => body[k] = $('#st-' + k).value);
    await api('/settings', { method: 'PUT', body }); META = await api('/meta'); toast(t('حُفظت الإعدادات ✅')); renderShell(); route();
  };
  // ---- الضرائب والرسوم ----
  const loadTaxes = async () => {
    const taxes = await api('/admin/taxes');
    $('#tax-list').innerHTML = `<div class="t-wrap" style="margin-bottom:10px"><table><thead><tr><th>${t('الاسم')}</th><th>${t('النسبة %')}</th><th>${t('مطبقة')}</th><th>${t('تظهر في الريسيت')}</th><th></th></tr></thead><tbody>
      ${taxes.map(tx => `<tr>
        <td><b>${esc(tx.name_ar)}</b>${tx.name_en ? `<br><small style="color:var(--text3)">${esc(tx.name_en)}</small>` : ''}</td>
        <td style="max-width:110px"><input type="number" step="any" value="${tx.rate}" data-tx-rate="${tx.id}" style="width:90px;padding:7px;border:1.5px solid var(--border);border-radius:9px;background:var(--surface2);color:var(--text)"></td>
        <td><label class="tgl"><input type="checkbox" data-tx-act="${tx.id}" ${tx.is_active ? 'checked' : ''}> ${tx.is_active ? `<span class="chip ok">${t('مطبقة')}</span>` : `<span class="chip">${t('موقوفة')}</span>`}</label></td>
        <td><label class="tgl"><input type="checkbox" data-tx-show="${tx.id}" ${tx.show_on_receipt ? 'checked' : ''}> ${tx.show_on_receipt ? '👁️' : '🙈'}</label></td>
        <td><button class="btn btn-danger btn-sm" data-tx-del="${tx.id}">🗑️</button></td></tr>`).join('') || `<tr><td colspan="5" class="empty">${t('لا ضرائب — أضف أول ضريبة')}</td></tr>`}
      </tbody></table></div>`;
    const save = async (id, body) => { await api('/admin/taxes/' + id, { method: 'PUT', body }); META = await api('/meta'); toast(t('تم الحفظ ✅')); loadTaxes(); };
    $$('#tax-list [data-tx-rate]').forEach(i => i.onchange = () => save(+i.dataset.txRate, { rate: +i.value || 0 }));
    $$('#tax-list [data-tx-act]').forEach(i => i.onchange = () => save(+i.dataset.txAct, { is_active: i.checked ? 1 : 0 }));
    $$('#tax-list [data-tx-show]').forEach(i => i.onchange = () => save(+i.dataset.txShow, { show_on_receipt: i.checked ? 1 : 0 }));
    $$('#tax-list [data-tx-del]').forEach(b => b.onclick = () => confirmDialog(t('حذف هذه الضريبة؟ (الفواتير القديمة تحتفظ بنسختها)'), async () => {
      await api('/admin/taxes/' + b.dataset.txDel, { method: 'DELETE' }); META = await api('/meta'); toast(t('حُذفت')); loadTaxes();
    }));
  };
  $('#tax-add').onclick = () => {
    const m = modal(`<h3>💰 ${t('إضافة ضريبة / رسم')}</h3>
      <div class="row"><div class="field"><label>${t('الاسم')} *</label><input id="tx-name" placeholder="${t('مثال: ضريبة الخدمة')}"></div>
        <div class="field"><label>${t('الاسم بالإنجليزية (للريسيت)')}</label><input id="tx-name-en" placeholder="Service"></div></div>
      <div class="field"><label>${t('النسبة %')}</label><input id="tx-rate" type="number" step="any" value="0"></div>
      <div class="field"><label><input type="checkbox" id="tx-act" style="width:auto"> ${t('مطبقة على الطلبات الجديدة فوراً')}</label></div>
      <div class="field"><label><input type="checkbox" id="tx-show" checked style="width:auto"> ${t('تظهر سطراً في الريسيت')}</label></div>
      <div class="modal-actions"><button class="btn btn-ghost" id="tx-x">${t('إلغاء')}</button><button class="btn btn-primary" id="tx-go">${t('حفظ')}</button></div>`);
    $('#tx-x', m).onclick = () => m.remove();
    $('#tx-go', m).onclick = async () => {
      const name = $('#tx-name', m).value.trim(); if (!name) return;
      await api('/admin/taxes', { method: 'POST', body: { name_ar: name, name_en: $('#tx-name-en', m).value.trim(),
        rate: +$('#tx-rate', m).value || 0, is_active: $('#tx-act', m).checked ? 1 : 0,
        show_on_receipt: $('#tx-show', m).checked ? 1 : 0, sort_order: 9 } });
      m.remove(); META = await api('/meta'); toast(t('أُضيفت الضريبة ✅')); loadTaxes();
    };
  };
  loadTaxes();
  // ---- أيقونات الهيدر العلوي ----
  const tbEnabled = topbarEnabled();
  $('#tb-fields').innerHTML = TOPBAR.map(x => `<label class="rfield"><input type="checkbox" data-tb="${x.id}" ${tbEnabled.includes(x.id) ? 'checked' : ''}> ${x.ic} ${L(x.t[0], x.t[1])}</label>`).join('');
  $('#tb-save').onclick = async () => {
    const on = $$('#tb-fields [data-tb]').filter(c => c.checked).map(c => c.dataset.tb);
    await api('/settings', { method: 'PUT', body: { topbar_icons: JSON.stringify(on) } });
    META = await api('/meta'); toast(t('حُفظت أيقونات الهيدر ✅')); renderShell(); route();
  };
  // ---- موقع الطلب أونلاين ----
  $('#ol-copy').onclick = async () => { await navigator.clipboard.writeText($('#ol-url').value); toast(t('اتنسخ الرابط 📋')); };
  $('#ol-save').onclick = async () => {
    await api('/settings', { method: 'PUT', body: { online_ordering: $('#ol-on').checked ? '1' : '0', delivery_fee: $('#ol-fee').value || '0' } });
    META = await api('/meta'); toast(t('حُفظت إعدادات الأونلاين ✅'));
  };
  // ---- الثيم والهوية ----
  $$('#preset-grid .preset-swatch').forEach(b => b.onclick = async () => {
    $$('#preset-grid .preset-swatch').forEach(x => x.classList.toggle('active', x === b));
    await api('/settings', { method: 'PUT', body: { theme_preset: b.dataset.preset } });
    applyBranding({ theme_preset: b.dataset.preset });
    toast(t('تم تغيير لون الثيم ✅'));
  });
  $('#th-glass').onchange = async () => {
    const v = $('#th-glass').checked ? '1' : '0';
    await api('/settings', { method: 'PUT', body: { theme_glass: v } });
    applyBranding({ theme_glass: v });
    toast(v === '1' ? t('تم تفعيل الوضع الشفاف 🫧') : t('أُلغي الوضع الشفاف'));
  };
  $('#lg-up').onclick = () => $('#lg-file').click();
  $('#lg-file').onchange = () => {
    const f = $('#lg-file').files[0]; if (!f) return;
    if (f.size > 4 * 1024 * 1024) return $('#lg-e').textContent = t('الحد الأقصى لحجم اللوجو 4MB');
    const rd = new FileReader();
    rd.onload = async () => {
      try {
        await api('/branding/logo', { method: 'POST', body: { data: rd.result } });
        localStorage.setItem('cafe_logo_v', Date.now().toString(36));
        applyBranding({ custom_logo: true });
        toast(t('تم رفع اللوجو ✅')); renderShell(); route();
      } catch (e) { $('#lg-e').textContent = e.message; }
    };
    rd.readAsDataURL(f);
  };
  const lgDel = $('#lg-del'); if (lgDel) lgDel.onclick = () => confirmDialog(t('حذف اللوجو المخصص والرجوع للّوجو الأصلي؟'), async () => {
    await api('/branding/logo', { method: 'DELETE' });
    applyBranding({ custom_logo: false });
    toast(t('رجعنا للّوجو الأصلي')); renderShell(); route();
  });
  // ---- بناء الفاتورة الديناميكي ----
  const RFIELDS = [['logo', 'اللوجو', 'Logo'], ['tagline', 'الوصف', 'Tagline'], ['address', 'العنوان', 'Address'], ['phone', 'الهاتف', 'Phone'], ['datetime', 'التاريخ والوقت', 'Date & time'], ['order_no', 'رقم الطلب', 'Order no.'], ['token', 'رقم التوكن', 'Token'], ['order_type', 'نوع الطلب', 'Order type'], ['table', 'الطاولة', 'Table'], ['cashier', 'الكاشير', 'Cashier'], ['waiter', 'النادل', 'Waiter'], ['barcode', 'الباركود', 'Barcode'], ['footer', 'تذييل الفاتورة', 'Footer'], ['ref', 'مرجع الفاتورة', 'Ref']];
  let RF = {}; try { RF = JSON.parse(s.receipt_fields || '{}'); } catch { RF = {}; }
  $('#rfields').innerHTML = RFIELDS.map(f => `<label class="rfield"><input type="checkbox" data-rf="${f[0]}" ${RF[f[0]] !== 0 ? 'checked' : ''}> ${L(f[1], f[2])}</label>`).join('');
  $('#rf-save').onclick = async () => {
    const fields = {}; $$('#rfields [data-rf]').forEach(c => fields[c.dataset.rf] = c.checked ? 1 : 0);
    await api('/settings', { method: 'PUT', body: { receipt_fields: JSON.stringify(fields), receipt_extra_lines: $('#st-extra').value } });
    META = await api('/meta'); toast(L('حُفظت إعدادات الفاتورة ✅', 'Receipt settings saved ✅'));
  };
  $('#btn-reset-fin').onclick = async () => {
    const msg = L('هذا الإجراء لا يمكن التراجع عنه!\nسيحذف كل الفواتير والمشتريات والمصروفات والحركات المالية.\nالمنتجات والتصنيفات والمخزون لن تتأثر.\n\nاكتب "مسح" للتأكيد:', 'This cannot be undone!\nAll orders, purchases, expenses and financial records will be deleted.\nProducts, categories and inventory will NOT be affected.\n\nType "delete" to confirm:');
    const ans = prompt(msg);
    if (ans !== 'مسح' && ans !== 'delete') return;
    if (!confirm(L('⚠️ تأكيد نهائي: هل أنت متأكد من مسح جميع الحركات المالية؟', '⚠️ Final confirmation: Are you sure you want to delete all financial records?'))) return;
    await api('/admin/reset-financials', { method: 'POST', body: { confirm: 'DELETE_FINANCIALS' } });
    toast(t('تم مسح جميع الحركات المالية ✅'));
  };
  let curK = ADMIN_TABS[0].k;
  const loadTab = async () => {
    const tab = ADMIN_TABS.find(a => a.k === curK);
    const rows = await api('/admin/' + curK);
    $('#adm-body').innerHTML = `<div style="text-align:end;margin-bottom:10px"><button class="btn btn-primary btn-sm" id="adm-add">${t('إضافة')}</button></div>
      <div class="t-wrap"><table><thead><tr>${tab.cols.map(c => `<th>${t(c[1])}</th>`).join('')}<th></th></tr></thead><tbody>
      ${rows.map(r => `<tr>${tab.cols.map(c => `<td>${c[2] === 'bool' ? (r[c[0]] ? '✅' : '—') : c[2] === 'color' ? `<span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:${esc(r[c[0]])};vertical-align:middle"></span> ${esc(r[c[0]])}` : esc(r[c[0]] ?? '')}</td>`).join('')}<td><button class="btn btn-ghost btn-sm" data-id="${r.id}">${t('تعديل')}</button></td></tr>`).join('') || `<tr><td colspan="${tab.cols.length + 1}" class="empty">${t('لا بيانات')}</td></tr>`}
      </tbody></table></div>`;
    $('#adm-add').onclick = () => admForm(tab, null);
    $$('#adm-body [data-id]').forEach(b => b.onclick = () => admForm(tab, rows.find(r => r.id === +b.dataset.id)));
  };
  const admForm = (tab, row) => {
    const m = modal(`<h3>${t(tab.t)} — ${row ? t('تعديل') : t('إضافة')}</h3>
      ${tab.cols.map(c => c[2] === 'bool'
        ? `<div class="field"><label><input type="checkbox" id="a-${c[0]}" ${(row ? row[c[0]] : 1) ? 'checked' : ''} style="width:auto"> ${t(c[1])}</label></div>`
        : `<div class="field"><label>${t(c[1])}</label><input id="a-${c[0]}" type="${c[2] === 'number' ? 'number' : c[2] === 'color' ? 'color' : 'text'}" value="${esc(row ? (row[c[0]] ?? '') : (c[2] === 'color' ? '#0FB5BA' : ''))}"></div>`).join('')}
      <div class="modal-actions"><button class="btn btn-ghost" id="a-x">${t('إلغاء')}</button><button class="btn btn-primary" id="a-save">${t('حفظ')}</button></div>`);
    $('#a-x', m).onclick = () => m.remove();
    $('#a-save', m).onclick = async () => {
      const body = {}; tab.cols.forEach(c => body[c[0]] = c[2] === 'bool' ? ($('#a-' + c[0], m).checked ? 1 : 0) : c[2] === 'number' ? +$('#a-' + c[0], m).value || 0 : $('#a-' + c[0], m).value);
      await api(row ? `/admin/${tab.k}/${row.id}` : '/admin/' + tab.k, { method: row ? 'PUT' : 'POST', body });
      m.remove(); META = await api('/meta'); toast(t('تم الحفظ ✅')); loadTab();
    };
  };
  $$('#adm-tabs .cat-chip').forEach(b => b.onclick = () => { curK = b.dataset.k; $$('#adm-tabs .cat-chip').forEach(x => x.classList.toggle('active', x === b)); loadTab(); });
  loadTab();
};

// ===================================================================
//  العملاء
// ===================================================================
ROUTES.customers = async (view) => {
  view.innerHTML = `<div class="page-head"><div><h2>👤 ${t('العملاء')}</h2><div class="crumb">${t('سجل العملاء — الآجل والنقاط وتاريخ الفواتير')}</div></div>
    <div class="head-actions"><button class="btn btn-primary" id="cu-new">${t('+ عميل جديد')}</button></div></div>
    <div class="toolbar"><input type="search" id="cu-search" placeholder="${t('🔍 ابحث بالاسم أو الهاتف…')}" style="min-width:240px"></div>
    <div id="cu-body"><div class="loading">…</div></div>`;
  let timer = null;
  const load = async () => {
    const q = $('#cu-search').value.trim();
    const rows = await api('/customers' + (q ? '?q=' + encodeURIComponent(q) : ''));
    const totDue = rows.reduce((s, c) => s + (c.balance_due || 0), 0);
    $('#cu-body').innerHTML = `
      <div class="kpi-grid">
        <div class="kpi"><div class="lbl">${t('عدد العملاء')}</div><div class="val">${num(rows.length)}</div><span class="ic">👥</span></div>
        <div class="kpi amber"><div class="lbl">${t('إجمالي الآجل المستحق')}</div><div class="val">${money(totDue)}</div><span class="ic">🕒</span></div>
        ${pointsOn() ? `<div class="kpi sand"><div class="lbl">${t('إجمالي النقاط')}</div><div class="val">${num(rows.reduce((s, c) => s + (c.points || 0), 0), 1)}</div><span class="ic">⭐</span></div>` : ''}
      </div>
      <div class="card"><div class="t-wrap"><table><thead><tr><th>${t('الاسم')}</th><th>${t('الهاتف')}</th><th>${t('عدد الفواتير')}</th><th>${t('إجمالي المشتريات')}</th><th>${t('المتبقي عليه')}</th>${pointsOn() ? `<th>⭐ ${t('النقاط')}</th>` : ''}<th></th></tr></thead><tbody>
      ${rows.map(c => `<tr><td><b>${esc(c.name_ar)}</b></td><td dir="ltr">${esc(c.phone || '—')}</td><td class="t-num">${num(c.orders_count)}</td>
        <td class="t-num">${money(c.total_sales)}</td>
        <td class="t-num" style="color:${c.balance_due > 0 ? 'var(--red)' : 'var(--text3)'}">${c.balance_due > 0 ? money(c.balance_due) : '—'}</td>
        ${pointsOn() ? `<td class="t-num">${num(c.points, 1)}</td>` : ''}
        <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-view="${c.id}">${t('كشف حساب')}</button>
        <button class="btn btn-ghost btn-sm" data-edit="${c.id}">✏️</button>
        <button class="btn btn-danger btn-sm" data-del="${c.id}">🗑️</button></td></tr>`).join('') || `<tr><td colspan="8" class="empty">${t('لا عملاء بعد')}</td></tr>`}
      </tbody></table></div></div>`;
    $$('#cu-body [data-view]').forEach(b => b.onclick = () => openCustomer(+b.dataset.view));
    $$('#cu-body [data-edit]').forEach(b => b.onclick = async () => customerForm(rows.find(c => c.id === +b.dataset.edit), load));
    $$('#cu-body [data-del]').forEach(b => b.onclick = () => confirmDialog(t('حذف هذا العميل؟ (سجله التاريخي يبقى محفوظاً)'), async () => { await api('/customers/' + b.dataset.del, { method: 'DELETE' }); toast(t('حُذف')); load(); }));
  };
  $('#cu-search').oninput = () => { clearTimeout(timer); timer = setTimeout(load, 280); };
  $('#cu-new').onclick = () => customerForm(null, load);
  load();
};
// كشف حساب عميل
async function openCustomer(id) {
  const c = await api('/customers/' + id);
  const m = modal(`<h3>👤 ${esc(c.name_ar)} <span class="chip">${esc(c.phone || '')}</span>
    ${pointsOn() ? `<span class="chip pts">⭐ ${num(c.points, 1)}</span>` : ''}
    ${c.balance_due > 0 ? `<span class="chip low">${t('عليه')} ${money(c.balance_due)}</span>` : `<span class="chip ok">${t('لا مستحقات')}</span>`}</h3>
    <h4 style="margin:10px 0 8px;color:var(--sea-deep)">🧾 ${t('الفواتير')}</h4>
    <div class="t-wrap" style="max-height:34vh;overflow:auto"><table><thead><tr><th>${t('الفاتورة')}</th><th>${t('الإجمالي')}</th><th>${t('المدفوع')}</th><th>${t('المتبقي')}</th><th>${t('السداد')}</th><th>${t('الوقت')}</th><th></th></tr></thead><tbody>
      ${c.orders.map(o => `<tr><td>${esc(o.invoice_no)}</td><td class="t-num">${money(o.total)}</td><td class="t-num">${money(o.paid_amount)}</td>
        <td class="t-num" style="color:${o.remaining > 0 ? 'var(--red)' : 'var(--text3)'}">${o.remaining > 0 ? money(o.remaining) : '—'}</td>
        <td>${payBadge(o.payment_status)}</td><td style="color:var(--text3)">${dDay(o.created_at)}</td>
        <td>${o.remaining > 0 ? `<button class="btn btn-sand btn-sm" data-st="${o.id}">${t('سداد')}</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="7" class="empty">${t('لا فواتير')}</td></tr>`}
    </tbody></table></div>
    ${pointsOn() && c.points_log.length ? `<h4 style="margin:14px 0 8px;color:var(--sea-deep)">⭐ ${t('سجل النقاط')}</h4>
    <div class="t-wrap" style="max-height:22vh;overflow:auto"><table><tbody>
      ${c.points_log.map(p => `<tr><td style="color:${p.points > 0 ? 'var(--green)' : 'var(--red)'};font-weight:700">${p.points > 0 ? '+' : ''}${num(p.points, 1)}</td><td>${esc(p.note || p.kind)}</td><td style="color:var(--text3)">${dt(p.created_at)}</td></tr>`).join('')}
    </tbody></table></div>` : ''}
    <div class="modal-actions"><button class="btn btn-ghost" id="cd-x">${t('إغلاق النافذة')}</button></div>`, 'wide');
  $('#cd-x', m).onclick = () => m.remove();
  $$('[data-st]', m).forEach(b => b.onclick = async () => { const o = await api('/orders/' + b.dataset.st); m.remove(); settleOrder(o, () => openCustomer(id)); });
}

// ===================================================================
//  الخزينة وطرق الدفع
// ===================================================================
const MMLABEL = { order: ['🧾 تحصيل فاتورة', 'Order'], invoice_payment: ['💰 سداد آجل', 'Settlement'], purchase: ['🚚 مشتريات', 'Purchase'], voucher: ['🧾 سند', 'Voucher'], expense: ['💸 مصروف', 'Expense'], sales_return: ['↩️ مرتجع بيع', 'Sales return'], purchase_return: ['↩️ مرتجع شراء', 'Purchase return'], adjust: ['⚖️ تسوية', 'Adjust'], shift: ['⏱️ وردية', 'Shift'] };
ROUTES.treasury = async (view) => {
  const d = await api('/treasury');
  const activeMethods = d.methods.filter(m => m.is_active);
  const inactiveMethods = d.methods.filter(m => !m.is_active);
  const totalIn = d.methods.reduce((s, m) => s + m.inflow, 0);
  const totalOut = d.methods.reduce((s, m) => s + m.outflow, 0);
  const cashTotal = d.methods.filter(m => m.kind === 'cash' && m.is_active).reduce((s, m) => s + m.balance, 0);
  const bankTotal = d.methods.filter(m => m.kind !== 'cash' && m.is_active).reduce((s, m) => s + m.balance, 0);
  const cardHTML = (mt) => `<div class="treasury-card ${mt.is_active ? '' : 'inactive'} ${mt.kind === 'cash' ? 'cash' : 'bank'}">
      <div class="tc-top">
        <span class="tc-ic">${mt.icon || '💳'}</span>
        <div class="tc-name"><b>${esc(mt.name_ar)}</b><small>${mt.kind === 'cash' ? '💰 ' + t('نقدي') : '📱 ' + t('تحويل / محفظة')}${mt.account_no ? ' • ' + esc(mt.account_no) : ''}</small></div>
        ${mt.is_active ? '' : `<span class="chip">${t('موقوفة')}</span>`}
      </div>
      <div class="tc-balance ${mt.balance > 0 ? 'pos' : mt.balance < 0 ? 'neg' : 'zero'}">${money(mt.balance)}</div>
      <div class="tc-flow">
        <div class="tc-flow-item in"><span>↓ ${t('وارد')}</span><b>${money(mt.inflow)}</b></div>
        <div class="tc-flow-item out"><span>↑ ${t('منصرف')}</span><b>${money(mt.outflow)}</b></div>
        <div class="tc-flow-item"><span>🔄 ${t('حركات')}</span><b>${num(mt.moves)}</b></div>
      </div>
      ${mt.last_move ? `<div class="tc-last">🕒 ${esc((mt.last_move.note || '').slice(0, 38))} • ${ago(mt.last_move.created_at)}</div>` : `<div class="tc-last">${t('لا حركات بعد')}</div>`}
      <div class="tc-actions">
        <button class="btn btn-primary btn-sm" data-stmt="${mt.id}">📄 ${t('كشف حساب')}</button>
        <button class="btn btn-ghost btn-sm" data-adj-one="${mt.id}">⚖️ ${t('تسوية')}</button>
        <button class="btn btn-ghost btn-sm" data-pm-edit="${mt.id}">✏️</button>
        <button class="btn btn-danger btn-sm" data-pm-del="${mt.id}">🗑️</button>
      </div>
    </div>`;
  view.innerHTML = `<div class="page-head"><div><h2>🏦 ${t('الخزينة وطرق الدفع')}</h2><div class="crumb">${t('أرصدة كل خزنة لحظياً — كشف حساب وتسوية وإدارة كاملة')}</div></div>
    <div class="head-actions"><button class="btn btn-primary" id="tr-new">➕ ${t('طريقة دفع')}</button></div></div>
    <div class="kpi-grid">
      <div class="kpi green"><div class="lbl">${t('إجمالي الأرصدة')}</div><div class="val">${money(d.total)}</div><span class="ic">🏦</span></div>
      <div class="kpi"><div class="lbl">💰 ${t('النقدية بالأدراج')}</div><div class="val">${money(cashTotal)}</div><span class="ic">💵</span></div>
      <div class="kpi sand"><div class="lbl">📱 ${t('المحافظ والبنوك')}</div><div class="val">${money(bankTotal)}</div><span class="ic">🏧</span></div>
      <div class="kpi amber"><div class="lbl">${t('إجمالي الحركة')}</div><div class="val" style="font-size:19px">↓${money(totalIn)}<br>↑${money(totalOut)}</div></div>
    </div>
    <div class="treasury-grid">${activeMethods.map(cardHTML).join('')}</div>
    ${inactiveMethods.length ? `<div class="sec-divider">${t('طرق موقوفة')}</div><div class="treasury-grid">${inactiveMethods.map(cardHTML).join('')}</div>` : ''}`;
  $$('#view [data-stmt]').forEach(b => b.onclick = () => openStatement(+b.dataset.stmt));
  $$('#view [data-adj-one]').forEach(b => b.onclick = () => adjustMethod(d.methods.find(x => x.id === +b.dataset.adjOne)));
  // إدارة طرق الدفع كاملة من هنا (أُزيلت من الإعدادات منعاً للتكرار)
  const pmForm = (pm) => {
    const m = modal(`<h3>💳 ${pm ? t('تعديل طريقة دفع') : t('طريقة دفع جديدة')}</h3>
      <div class="row"><div class="field"><label>${t('الاسم')} *</label><input id="pm-name" value="${esc(pm?.name_ar || '')}" placeholder="${t('مثال: فودافون كاش')}"></div>
        <div class="field"><label>${t('الاسم بالإنجليزية (للفاتورة)')}</label><input id="pm-name-en" value="${esc(pm?.name_en || '')}"></div></div>
      <div class="row"><div class="field"><label>${t('أيقونة (إيموجي)')}</label><input id="pm-icon" value="${esc(pm?.icon || '💳')}" style="max-width:90px"></div>
        <div class="field"><label>${t('النوع')}</label><select id="pm-kind">
          <option value="cash" ${pm?.kind !== 'transfer' ? 'selected' : ''}>💰 ${t('نقدي (درج — يحسب الباقي)')}</option>
          <option value="transfer" ${pm?.kind === 'transfer' ? 'selected' : ''}>📱 ${t('تحويل / محفظة / بنك')}</option></select></div></div>
      <div class="row"><div class="field"><label>${t('رقم الحساب / المحفظة')}</label><input id="pm-acc" value="${esc(pm?.account_no || '')}" dir="ltr"></div>
        <div class="field"><label>${t('اسم صاحب الحساب')}</label><input id="pm-acc-name" value="${esc(pm?.account_name || '')}"></div></div>
      <div class="row"><div class="field"><label>${t('رصيد افتتاحي')}</label><input id="pm-open" type="number" step="any" value="${pm?.opening_balance ?? 0}"></div>
        <div class="field"><label>${t('ترتيب العرض')}</label><input id="pm-sort" type="number" value="${pm?.sort_order ?? 0}"></div></div>
      <div class="field"><label><input type="checkbox" id="pm-pos" ${(pm ? pm.show_in_pos : 1) ? 'checked' : ''} style="width:auto"> ${t('تظهر في شاشة الدفع بالكاشير')}</label></div>
      <div class="field"><label><input type="checkbox" id="pm-active" ${(pm ? pm.is_active : 1) ? 'checked' : ''} style="width:auto"> ${t('مفعّلة')}</label></div>
      <div class="err" id="pm-e"></div>
      <div class="modal-actions"><button class="btn btn-ghost" id="pm-x">${t('إلغاء')}</button><button class="btn btn-primary" id="pm-save">${t('حفظ')}</button></div>`);
    $('#pm-x', m).onclick = () => m.remove();
    $('#pm-save', m).onclick = async () => {
      const body = { name_ar: $('#pm-name', m).value.trim(), name_en: $('#pm-name-en', m).value.trim(),
        icon: $('#pm-icon', m).value.trim() || '💳', kind: $('#pm-kind', m).value,
        account_no: $('#pm-acc', m).value.trim(), account_name: $('#pm-acc-name', m).value.trim(),
        opening_balance: +$('#pm-open', m).value || 0, sort_order: +$('#pm-sort', m).value || 0,
        show_in_pos: $('#pm-pos', m).checked ? 1 : 0, is_active: $('#pm-active', m).checked ? 1 : 0 };
      if (!body.name_ar) return $('#pm-e', m).textContent = t('الاسم مطلوب');
      try {
        await api(pm ? '/admin/payment-methods/' + pm.id : '/admin/payment-methods', { method: pm ? 'PUT' : 'POST', body });
        m.remove(); META = await api('/meta'); toast(t('تم الحفظ ✅')); route();
      } catch (e) { $('#pm-e', m).textContent = e.message; }
    };
  };
  $('#tr-new').onclick = () => pmForm(null);
  $$('#view [data-pm-edit]').forEach(b => b.onclick = () => pmForm(d.methods.find(x => x.id === +b.dataset.pmEdit)));
  $$('#view [data-pm-del]').forEach(b => b.onclick = () => {
    const mt = d.methods.find(x => x.id === +b.dataset.pmDel);
    confirmDialog(L(`هل أنت متأكد من حذف طريقة الدفع "${mt.name_ar}"؟`, `Delete payment method "${mt.name_ar}"?`), async () => {
      try { await api('/admin/payment-methods/' + mt.id, { method: 'DELETE' }); META = await api('/meta'); toast(L('تم الحذف ✅','Deleted ✅')); route(); }
      catch (e) { toast(e.message, 'err'); }
    });
  });
};
// تسوية رصيد خزنة (إيداع/صرف يدوي)
function adjustMethod(mt) {
  const m = modal(`<h3>⚖️ ${t('تسوية رصيد')} — ${mt.icon || ''} ${esc(mt.name_ar)}</h3>
    <div class="sumline total"><span>${t('الرصيد الحالي')}</span><span class="t-num">${money(mt.balance)}</span></div>
    <div class="field"><label>${t('المبلغ (+ إيداع / − صرف)')}</label><input id="ta-amt" type="number" step="any" autofocus></div>
    <div class="field"><label>${t('السبب')}</label><input id="ta-note" placeholder="${t('مثال: إيداع عهدة، سحب نقدية…')}"></div>
    <div class="err" id="ta-e"></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="ta-x">${t('إلغاء')}</button><button class="btn btn-primary" id="ta-go">${t('حفظ التسوية')}</button></div>`);
  $('#ta-x', m).onclick = () => m.remove();
  $('#ta-go', m).onclick = async () => {
    try { await api('/treasury/adjust', { method: 'POST', body: { method_id: mt.id, amount: +$('#ta-amt', m).value || 0, note: $('#ta-note', m).value.trim() } });
      m.remove(); toast(t('تمت التسوية ✅')); route(); } catch (e) { $('#ta-e', m).textContent = e.message; }
  };
}
// كشف حساب طريقة دفع
async function openStatement(methodId) {
  const from = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const m = modal(`<h3>📄 ${t('كشف حساب')}</h3>
    <div class="toolbar">${t('من')} <input type="date" id="sm-from" value="${from}"> ${t('إلى')} <input type="date" id="sm-to" value="${todayStr()}">
      <button class="btn btn-primary btn-sm" id="sm-go">${t('عرض')}</button></div>
    <div id="sm-body"><div class="loading">…</div></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="sm-x">${t('إغلاق النافذة')}</button></div>`, 'xwide');
  const load = async () => {
    const d = await api(`/treasury/${methodId}/statement?from=${$('#sm-from', m).value}&to=${$('#sm-to', m).value + 'T23:59'}`);
    $('#sm-body', m).innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">
        <span class="chip">${d.method.icon || ''} ${esc(d.method.name_ar)}</span>
        <span class="chip">${t('رصيد أول المدة')}: ${money(d.opening)}</span>
        <span class="chip ok">${t('رصيد آخر المدة')}: ${money(d.closing)}</span>
      </div>
      <div class="t-wrap" style="max-height:52vh;overflow:auto"><table><thead><tr><th>${t('الوقت')}</th><th>${t('النوع')}</th><th>${t('البيان')}</th><th>${t('المبلغ')}</th><th>${t('الرصيد بعد')}</th><th>${t('بواسطة')}</th></tr></thead><tbody>
      ${d.rows.map(r => `<tr><td style="color:var(--text3)">${dt(r.created_at)}</td><td>${LL(MMLABEL, r.ref_type)}</td><td>${esc(r.note || '—')}</td>
        <td class="t-num" style="color:${r.amount > 0 ? 'var(--green)' : 'var(--red)'};font-weight:700">${r.amount > 0 ? '+' : ''}${money(r.amount)}</td>
        <td class="t-num">${money(r.balance)}</td><td>${esc(r.by_name || '—')}</td></tr>`).join('') || `<tr><td colspan="6" class="empty">${t('لا حركات في هذه المدة')}</td></tr>`}
      </tbody></table></div>`;
  };
  $('#sm-go', m).onclick = load;
  $('#sm-x', m).onclick = () => m.remove();
  load();
}

// ===================================================================
//  سندات القبض والصرف
// ===================================================================
ROUTES.vouchers = async (view) => {
  let kind = 'receipt';
  view.innerHTML = `<div class="page-head"><div><h2>🧾 ${t('سندات القبض والصرف')}</h2><div class="crumb">${t('قبض وصرف نقدية من وإلى العملاء والموردين والأطراف — تنعكس على الخزينة فوراً')}</div></div>
    <div class="head-actions"><button class="btn btn-primary" id="v-new-r">${t('+ سند قبض')}</button><button class="btn btn-sand" id="v-new-p">${t('+ سند صرف')}</button></div></div>
    <div class="type-tabs" style="max-width:400px;margin-bottom:14px">
      <button data-k="receipt" class="active">💰 ${t('سندات القبض')}</button>
      <button data-k="payment">💸 ${t('سندات الصرف')}</button></div>
    <div id="v-body"><div class="loading">…</div></div>`;
  const load = async () => {
    const rows = await api('/vouchers?kind=' + kind);
    $('#v-body').innerHTML = `<div class="card"><div class="t-wrap"><table><thead><tr><th>${t('رقم السند')}</th><th>${t('الطرف')}</th><th>${t('المبلغ')}</th><th>${t('طريقة الدفع')}</th><th>${t('البيان')}</th><th>${t('الحالة')}</th><th>${t('بواسطة')}</th><th>${t('الوقت')}</th><th></th></tr></thead><tbody>
      ${rows.map(v => `<tr class="${v.status === 'cancelled' ? 'row-cancelled' : ''}"><td><b>${esc(v.voucher_no)}</b></td><td>${esc(v.party_name)}</td>
        <td class="t-num" style="color:${v.kind === 'receipt' ? 'var(--green)' : 'var(--red)'};font-weight:700">${v.kind === 'receipt' ? '+' : '−'}${money(v.amount)}</td>
        <td>${esc(v.method_name || '—')}</td><td>${esc(v.note || '—')}</td>
        <td>${v.status === 'done' ? `<span class="chip ok">${t('منفّذ')}</span>` : `<span class="chip low">${t('ملغي')}</span>`}</td>
        <td>${esc(v.by_name || '—')}</td><td style="color:var(--text3)">${dt(v.created_at)}</td>
        <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-pr="${v.id}">🖨️</button>
        ${v.status === 'done' && ME.role_key === 'admin' ? `<button class="btn btn-danger btn-sm" data-cx="${v.id}">${t('إلغاء')}</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="9" class="empty">${t('لا سندات بعد')}</td></tr>`}
      </tbody></table></div></div>`;
    $$('#v-body [data-cx]').forEach(b => b.onclick = () => confirmDialog(t('إلغاء هذا السند وعكس أثره المالي؟'), async () => { await api(`/vouchers/${b.dataset.cx}/cancel`, { method: 'POST', body: {} }); toast(t('أُلغي السند')); load(); }));
    $$('#v-body [data-pr]').forEach(b => b.onclick = () => printVoucher(rows.find(v => v.id === +b.dataset.pr)));
  };
  $$('.type-tabs button', view).forEach(b => b.onclick = () => { kind = b.dataset.k; $$('.type-tabs button', view).forEach(x => x.classList.toggle('active', x === b)); load(); });
  $('#v-new-r').onclick = () => voucherForm('receipt', load);
  $('#v-new-p').onclick = () => voucherForm('payment', load);
  load();
};
async function voucherForm(kind, onDone) {
  const isR = kind === 'receipt';
  const m = modal(`<h3>${isR ? '💰 ' + t('سند قبض جديد') : '💸 ' + t('سند صرف جديد')}</h3>
    <div class="row"><div class="field"><label>${t('نوع الطرف')}</label><select id="vf-pk">
      <option value="other">${t('اسم حر')}</option><option value="customer">${t('عميل')}</option>
      <option value="supplier">${t('مورد')}</option><option value="party">${t('طرف عام')}</option></select></div>
      <div class="field"><label>${t('الطرف')}</label><span id="vf-party-box"><input id="vf-pname" placeholder="${t('اسم الطرف')}"></span></div></div>
    <div class="row"><div class="field"><label>${t('المبلغ')} *</label><input id="vf-amt" type="number" step="any"></div>
      <div class="field"><label>${t('طريقة الدفع')}</label><select id="vf-m">${META.payment_methods.map(p => `<option value="${p.id}">${p.icon || ''} ${esc(p.name_ar)}</option>`).join('')}</select></div></div>
    <div class="field"><label>${t('البيان / السبب')}</label><input id="vf-note"></div>
    <div class="err" id="vf-e"></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="vf-x">${t('إلغاء')}</button><button class="btn ${isR ? 'btn-primary' : 'btn-sand'}" id="vf-go">${t('حفظ وتنفيذ')}</button></div>`);
  let partyId = null;
  $('#vf-pk', m).onchange = async () => {
    const pk = $('#vf-pk', m).value; partyId = null;
    const box = $('#vf-party-box', m);
    if (pk === 'other') { box.innerHTML = `<input id="vf-pname" placeholder="${t('اسم الطرف')}">`; return; }
    const ep = pk === 'customer' ? '/customers' : pk === 'supplier' ? '/admin/suppliers' : '/parties';
    const rows = await api(ep);
    box.innerHTML = `<select id="vf-pid"><option value="">— ${t('اختر')} —</option>${rows.map(r => `<option value="${r.id}">${esc(r.name_ar)}</option>`).join('')}</select>`;
    $('#vf-pid', m).onchange = () => partyId = +$('#vf-pid', m).value || null;
  };
  $('#vf-x', m).onclick = () => m.remove();
  $('#vf-go', m).onclick = async () => {
    try {
      const pk = $('#vf-pk', m).value;
      const r = await api('/vouchers', { method: 'POST', body: { kind, party_kind: pk, party_id: partyId,
        party_name: pk === 'other' ? $('#vf-pname', m).value.trim() : null,
        amount: +$('#vf-amt', m).value || 0, method_id: +$('#vf-m', m).value, note: $('#vf-note', m).value.trim() || null } });
      m.remove(); toast(`${t('حُفظ السند')} ${r.voucher_no} ✅`); if (onDone) onDone();
    } catch (e) { $('#vf-e', m).textContent = e.message; }
  };
}
// طباعة سند حراري
function printVoucher(v) {
  const s = META.settings;
  const isR = v.kind === 'receipt';
  const pa = $('#print-area');
  pa.innerHTML = `<div class="receipt">
    <div class="r-c">${logoMark('r-logo-img')}<h2>${esc(s.cafe_name || 'seaside')}</h2>
      <div style="font-weight:700;font-size:15px;margin-top:4px">${isR ? 'Receipt Voucher — سند قبض' : 'Payment Voucher — سند صرف'}</div></div>
    <div class="r-line"></div>
    <table>
      <tr><td>No.</td><td style="text-align:right"><b>${esc(v.voucher_no)}</b></td></tr>
      <tr><td>Date</td><td style="text-align:right">${new Date(v.created_at).toLocaleString('en-GB')}</td></tr>
      <tr><td>${isR ? 'Received from' : 'Paid to'}</td><td style="text-align:right">${esc(v.party_name)}</td></tr>
      <tr><td>Method</td><td style="text-align:right">${esc(v.method_name || 'Cash')}</td></tr>
      ${v.note ? `<tr><td>For</td><td style="text-align:right">${esc(v.note)}</td></tr>` : ''}
      <tr class="r-tot"><td>Amount</td><td style="text-align:right">${(+v.amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })} ${cur()}</td></tr>
    </table>
    <div class="r-line"></div>
    <table><tr><td>Cashier signature</td><td style="text-align:right">${isR ? 'Payer' : 'Receiver'} signature</td></tr>
    <tr><td style="padding-top:24px">___________</td><td style="text-align:right;padding-top:24px">___________</td></tr></table>
  </div>`;
  pa.classList.remove('hidden');
  setPrintPage('@page{size:80mm 130mm;margin:0}');
  const done = () => { pa.classList.add('hidden'); pa.innerHTML = ''; setPrintPage(''); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done); setTimeout(() => window.print(), 150);
}

// ===================================================================
//  الأطراف العامة
// ===================================================================
ROUTES.parties = async (view) => {
  view.innerHTML = `<div class="page-head"><div><h2>🤝 ${t('الأطراف العامة')}</h2><div class="crumb">${t('جهات تتعامل معها مالياً خارج العملاء والموردين (جمعية، صديق، شركة…)')}</div></div>
    <div class="head-actions"><button class="btn btn-primary" id="pa-new">${t('+ طرف جديد')}</button></div></div>
    <div class="toolbar"><input type="search" id="pa-q" placeholder="${t('🔍 بحث…')}" style="min-width:220px"></div>
    <div id="pa-body"><div class="loading">…</div></div>`;
  let timer = null;
  const load = async () => {
    const q = $('#pa-q').value.trim();
    const rows = await api('/parties' + (q ? '?q=' + encodeURIComponent(q) : ''));
    $('#pa-body').innerHTML = `<div class="card"><div class="t-wrap"><table><thead><tr><th>${t('الاسم')}</th><th>${t('الهاتف')}</th><th>${t('ملاحظات')}</th><th>${t('المقبوضات')}</th><th>${t('المصروفات')}</th><th>${t('الرصيد')}</th><th></th></tr></thead><tbody>
      ${rows.map(p => `<tr><td><b>${esc(p.name_ar)}</b></td><td dir="ltr">${esc(p.phone || '—')}</td><td>${esc(p.notes || '—')}</td>
        <td class="t-num" style="color:var(--green)">${money(p.receipts)}</td><td class="t-num" style="color:var(--red)">${money(p.payments)}</td>
        <td class="t-num" style="font-weight:700;color:${p.balance > 0 ? 'var(--green)' : p.balance < 0 ? 'var(--red)' : 'var(--text3)'}">${money(p.balance)}</td>
        <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-edit="${p.id}">✏️</button>
        <button class="btn btn-danger btn-sm" data-del="${p.id}">🗑️</button></td></tr>`).join('') || `<tr><td colspan="7" class="empty">${t('لا أطراف بعد')}</td></tr>`}
      </tbody></table></div></div>`;
    $$('#pa-body [data-edit]').forEach(b => b.onclick = () => partyForm(rows.find(p => p.id === +b.dataset.edit), load));
    $$('#pa-body [data-del]').forEach(b => b.onclick = () => confirmDialog(t('حذف هذا الطرف؟'), async () => { await api('/parties/' + b.dataset.del, { method: 'DELETE' }); toast(t('حُذف')); load(); }));
  };
  const partyForm = (p, onDone) => {
    const m = modal(`<h3>${p ? '✏️ ' + t('تعديل طرف') : '🤝 ' + t('طرف جديد')}</h3>
      <div class="field"><label>${t('الاسم')} *</label><input id="pf-name" value="${esc(p?.name_ar || '')}" placeholder="${t('مثال: صديق — جمعية — شركة')}"></div>
      <div class="row"><div class="field"><label>${t('الهاتف')}</label><input id="pf-phone" value="${esc(p?.phone || '')}"></div>
        <div class="field"><label>${t('العنوان')}</label><input id="pf-addr" value="${esc(p?.address || '')}"></div></div>
      <div class="field"><label>${t('ملاحظات')}</label><input id="pf-notes" value="${esc(p?.notes || '')}"></div>
      <div class="err" id="pf-e"></div>
      <div class="modal-actions"><button class="btn btn-ghost" id="pf-x">${t('إلغاء')}</button><button class="btn btn-primary" id="pf-save">${t('حفظ')}</button></div>`);
    $('#pf-x', m).onclick = () => m.remove();
    $('#pf-save', m).onclick = async () => {
      const body = { name_ar: $('#pf-name', m).value.trim(), phone: $('#pf-phone', m).value.trim() || null,
        address: $('#pf-addr', m).value.trim() || null, notes: $('#pf-notes', m).value.trim() || null };
      if (!body.name_ar) return $('#pf-e', m).textContent = t('اسم الطرف مطلوب');
      try { await api(p ? '/parties/' + p.id : '/parties', { method: p ? 'PUT' : 'POST', body }); m.remove(); toast(t('تم الحفظ ✅')); onDone(); }
      catch (e) { $('#pf-e', m).textContent = e.message; }
    };
  };
  $('#pa-q').oninput = () => { clearTimeout(timer); timer = setTimeout(load, 280); };
  $('#pa-new').onclick = () => partyForm(null, load);
  load();
};

// ===================================================================
//  المرتجعات (مبيعات + مشتريات)
// ===================================================================
ROUTES.returns = async (view) => {
  let tab = 'sales';
  view.innerHTML = `<div class="page-head"><div><h2>↩️ ${t('المرتجعات')}</h2><div class="crumb">${t('مرتجع مبيعات (يرجع المكونات للمخزن ويرد المبلغ) ومرتجع مشتريات (يخصم من المخزن)')}</div></div>
    <div class="head-actions"><button class="btn btn-primary" id="rt-new-s">${t('+ مرتجع مبيعات')}</button><button class="btn btn-sand" id="rt-new-p">${t('+ مرتجع مشتريات')}</button></div></div>
    <div class="type-tabs" style="max-width:420px;margin-bottom:14px">
      <button data-k="sales" class="active">🛒 ${t('مرتجعات المبيعات')}</button>
      <button data-k="purchases" class="active2">🚚 ${t('مرتجعات المشتريات')}</button></div>
    <div id="rt-body"><div class="loading">…</div></div>`;
  const load = async () => {
    const rows = await api('/returns/' + tab);
    $('#rt-body').innerHTML = tab === 'sales'
      ? `<div class="card"><div class="t-wrap"><table><thead><tr><th>${t('رقم المرتجع')}</th><th>${t('الفاتورة الأصلية')}</th><th>${t('العميل')}</th><th>${t('عدد البنود')}</th><th>${t('الإجمالي')}</th><th>${t('السبب')}</th><th>${t('بواسطة')}</th><th>${t('الوقت')}</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td><b>${esc(r.return_no)}</b></td><td>${esc(r.invoice_no || '—')}</td><td>${esc(r.customer_name || '—')}</td>
          <td class="t-num">${r.lines}</td><td class="t-num" style="color:var(--red)">${money(r.total)}</td><td>${esc(r.reason || '—')}</td>
          <td>${esc(r.by_name || '—')}</td><td style="color:var(--text3)">${dt(r.created_at)}</td></tr>`).join('') || `<tr><td colspan="8" class="empty">${t('لا مرتجعات مبيعات')}</td></tr>`}
        </tbody></table></div></div>`
      : `<div class="card"><div class="t-wrap"><table><thead><tr><th>${t('رقم المرتجع')}</th><th>${t('فاتورة الشراء')}</th><th>${t('المورد')}</th><th>${t('عدد البنود')}</th><th>${t('الإجمالي')}</th><th>${t('السبب')}</th><th>${t('بواسطة')}</th><th>${t('الوقت')}</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td><b>${esc(r.return_no)}</b></td><td>${esc(r.purchase_ref || '—')}</td><td>${esc(r.supplier || '—')}</td>
          <td class="t-num">${r.lines}</td><td class="t-num" style="color:var(--green)">${money(r.total)}</td><td>${esc(r.reason || '—')}</td>
          <td>${esc(r.by_name || '—')}</td><td style="color:var(--text3)">${dt(r.created_at)}</td></tr>`).join('') || `<tr><td colspan="8" class="empty">${t('لا مرتجعات مشتريات')}</td></tr>`}
        </tbody></table></div></div>`;
  };
  $$('.type-tabs button', view).forEach(b => b.onclick = () => { tab = b.dataset.k; $$('.type-tabs button', view).forEach(x => x.classList.toggle('active', x === b)); load(); });
  $('#rt-new-s').onclick = () => {
    const m = modal(`<h3>↩️ ${t('مرتجع مبيعات — اختر الفاتورة')}</h3>
      <div class="field"><input id="rs-q" placeholder="${t('🔍 رقم الفاتورة…')}" autofocus></div>
      <div id="rs-list" style="max-height:45vh;overflow:auto"></div>
      <div class="modal-actions"><button class="btn btn-ghost" id="rs-x">${t('إلغاء')}</button></div>`);
    let timer = null;
    const search = async () => {
      const q = $('#rs-q', m).value.trim();
      const rows = await api('/orders?status=paid' + (q ? '&q=' + encodeURIComponent(q) : ''));
      $('#rs-list', m).innerHTML = rows.slice(0, 20).map(o => `<div class="cust-item" data-o="${o.id}">
        <div><b>${esc(o.invoice_no)}</b><small>${esc(o.customer_name || '')} • ${dDay(o.created_at)}</small></div>
        <div class="t-num">${money(o.total)}</div></div>`).join('') || `<div class="empty">${t('لا فواتير')}</div>`;
      $$('#rs-list [data-o]', m).forEach(el => el.onclick = async () => { const o = await api('/orders/' + el.dataset.o); m.remove(); newSalesReturn(o, load); });
    };
    $('#rs-q', m).oninput = () => { clearTimeout(timer); timer = setTimeout(search, 280); };
    $('#rs-x', m).onclick = () => m.remove();
    search();
  };
  $('#rt-new-p').onclick = () => newPurchaseReturn(load);
  load();
};
// مرتجع مبيعات من فاتورة
function newSalesReturn(o, onDone) {
  const lines = o.items.map(i => ({ ...i, ret: 0 }));
  const m = modal(`<h3>↩️ ${t('مرتجع مبيعات')} — ${esc(o.invoice_no)}</h3>
    <div class="t-wrap"><table><thead><tr><th>${t('الصنف')}</th><th>${t('المباع')}</th><th>${t('يُرجع')}</th><th>${t('القيمة')}</th></tr></thead><tbody>
      ${lines.map((l, i) => `<tr><td>${esc(l.name_ar)}</td><td class="t-num">${l.qty}</td>
        <td><input type="number" min="0" max="${l.qty}" value="0" data-r="${i}" style="width:80px;padding:6px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text)"></td>
        <td class="t-num ret-val">—</td></tr>`).join('')}
    </tbody></table></div>
    <div class="row" style="margin-top:12px">
      <div class="field"><label>${t('رد المبلغ من')}</label><select id="sr-m"><option value="">${t('— بدون رد مبلغ —')}</option>${META.payment_methods.map(p => `<option value="${p.id}">${p.icon || ''} ${esc(p.name_ar)}</option>`).join('')}</select></div>
      <div class="field"><label>${t('السبب')}</label><input id="sr-reason"></div></div>
    <div class="field"><label><input type="checkbox" id="sr-restock" checked style="width:auto"> ${t('إرجاع المكونات للمخزن')}</label></div>
    <div class="cost-summary"><div>${t('إجمالي المرتجع')}</div><div class="big" id="sr-total">${money(0)}</div></div>
    <div class="err" id="sr-e"></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="sr-x">${t('إلغاء')}</button><button class="btn btn-danger" id="sr-go">${t('تنفيذ المرتجع')}</button></div>`, 'wide');
  const recalc = () => {
    let tot = 0;
    $$('[data-r]', m).forEach(inp => {
      const l = lines[+inp.dataset.r];
      l.ret = Math.min(Math.max(0, +inp.value || 0), l.qty);
      const v = l.ret * l.price; tot += v;
      inp.closest('tr').querySelector('.ret-val').textContent = l.ret ? money(v) : '—';
    });
    $('#sr-total', m).textContent = money(tot);
  };
  $$('[data-r]', m).forEach(inp => inp.oninput = recalc);
  $('#sr-x', m).onclick = () => m.remove();
  $('#sr-go', m).onclick = async () => {
    const items = lines.filter(l => l.ret > 0).map(l => ({ order_item_id: l.id, qty: l.ret }));
    if (!items.length) return $('#sr-e', m).textContent = t('حدد كمية مرتجعة لصنف واحد على الأقل');
    try {
      const r = await api('/returns/sales', { method: 'POST', body: { order_id: o.id, items,
        method_id: +$('#sr-m', m).value || null, reason: $('#sr-reason', m).value.trim() || null,
        restock: $('#sr-restock', m).checked ? 1 : 0 } });
      m.remove(); toast(`↩️ ${t('نُفّذ المرتجع')} ${r.return_no} — ${money(r.total)}`, 'warn');
      if (onDone) onDone(); else route();
    } catch (e) { $('#sr-e', m).textContent = e.message; }
  };
}
// مرتجع مشتريات
async function newPurchaseReturn(onDone) {
  const [materials, suppliers] = await Promise.all([api('/materials'), api('/admin/suppliers')]);
  let items = [{ material_id: materials[0]?.id, qty: 1, unit_cost: materials[0]?.avg_cost || 0 }];
  const m = modal(`<h3>↩️ ${t('مرتجع مشتريات')}</h3>
    <div class="row"><div class="field"><label>${t('المورد')}</label><select id="pr-sup"><option value="">${t('— بدون —')}</option>${suppliers.map(s => `<option value="${s.id}">${esc(s.name_ar)}</option>`).join('')}</select></div>
      <div class="field"><label>${t('استرداد المبلغ إلى')}</label><select id="pr-m"><option value="">${t('— بدون —')}</option>${META.payment_methods.map(p => `<option value="${p.id}">${p.icon || ''} ${esc(p.name_ar)}</option>`).join('')}</select></div></div>
    <div id="pr-lines"></div>
    <button class="btn btn-ghost btn-sm" id="pr-add">${t('+ بند')}</button>
    <div class="field" style="margin-top:10px"><label>${t('السبب')}</label><input id="pr-reason"></div>
    <div class="cost-summary"><div>${t('إجمالي المرتجع')}</div><div class="big" id="pr-total">—</div></div>
    <div class="err" id="pr-e"></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="pr-x">${t('إلغاء')}</button><button class="btn btn-sand" id="pr-go">${t('تنفيذ المرتجع')}</button></div>`, 'wide');
  const opts = (sel) => materials.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.name_ar)} (${num(x.qty, 1)} ${esc(x.unit || '')})</option>`).join('');
  const total = () => money(items.reduce((s, l) => s + l.qty * l.unit_cost, 0));
  const draw = () => {
    $('#pr-lines', m).innerHTML = items.map((l, i) => `<div class="pu-line" style="grid-template-columns:1fr 90px 110px 34px">
      <select data-mi="${i}">${opts(l.material_id)}</select>
      <input type="number" step="any" data-qi="${i}" value="${l.qty}" placeholder="${t('الكمية')}">
      <input type="number" step="any" data-ci="${i}" value="${l.unit_cost}" placeholder="${L('سعر الوحدة', 'unit price')}">
      <button class="btn btn-danger btn-sm" data-di="${i}">✕</button></div>`).join('');
    $('#pr-total', m).textContent = total();
    $$('#pr-lines [data-mi]', m).forEach(s => s.onchange = () => { const i = +s.dataset.mi; const mt = materials.find(x => x.id === +s.value); items[i] = { material_id: mt.id, qty: 1, unit_cost: mt.avg_cost || 0 }; draw(); });
    $$('#pr-lines [data-qi]', m).forEach(inp => inp.oninput = () => { items[+inp.dataset.qi].qty = +inp.value || 0; $('#pr-total', m).textContent = total(); });
    $$('#pr-lines [data-ci]', m).forEach(inp => inp.oninput = () => { items[+inp.dataset.ci].unit_cost = +inp.value || 0; $('#pr-total', m).textContent = total(); });
    $$('#pr-lines [data-di]', m).forEach(b => b.onclick = () => { items.splice(+b.dataset.di, 1); draw(); });
  };
  draw();
  $('#pr-add', m).onclick = () => { items.push({ material_id: materials[0]?.id, qty: 1, unit_cost: materials[0]?.avg_cost || 0 }); draw(); };
  $('#pr-x', m).onclick = () => m.remove();
  $('#pr-go', m).onclick = async () => {
    try {
      const r = await api('/returns/purchases', { method: 'POST', body: { supplier_id: +$('#pr-sup', m).value || null,
        method_id: +$('#pr-m', m).value || null, reason: $('#pr-reason', m).value.trim() || null, items } });
      m.remove(); toast(`↩️ ${t('نُفّذ المرتجع')} ${r.return_no} — ${money(r.total)}`, 'warn'); if (onDone) onDone();
    } catch (e) { $('#pr-e', m).textContent = e.message; }
  };
}

// ===================================================================
//  نقاط الولاء
// ===================================================================
ROUTES.points = async (view) => {
  const s = await api('/settings');
  view.innerHTML = `<div class="page-head"><div><h2>⭐ ${t('نقاط الولاء')}</h2><div class="crumb">${t('كسب واستبدال النقاط تلقائياً من نقطة البيع — مع تحكم كامل')}</div></div></div>
    <div class="grid-2">
    <div>
      <div class="card"><h3>⚙️ ${t('إعدادات النظام')}</h3>
        <div class="field"><label><input type="checkbox" id="pt-on" ${s.points_enabled === '1' ? 'checked' : ''} style="width:auto"> ${t('تفعيل نظام النقاط')}</label></div>
        <div class="row"><div class="field"><label>⭐ ${t('نقاط لكل 1 من العملة')}</label><input id="pt-per" type="number" step="any" value="${esc(s.points_per_currency || '1')}"></div>
          <div class="field"><label>💰 ${t('قيمة النقطة عند الاستبدال')}</label><input id="pt-val" type="number" step="any" value="${esc(s.point_value || '0.10')}"></div></div>
        <div class="row"><div class="field"><label>🔢 ${t('أقل نقاط للاستبدال')}</label><input id="pt-min" type="number" value="${esc(s.points_min_redeem || '10')}"></div>
          <div class="field"><label>📊 ${t('أقصى خصم من الفاتورة %')}</label><input id="pt-max" type="number" value="${esc(s.points_max_discount_pct || '50')}"></div></div>
        <button class="btn btn-primary" id="pt-save">${t('💾 حفظ الإعدادات')}</button>
      </div>
      <div class="card"><h3>➕ ${t('إضافة / خصم نقاط يدوياً')}</h3>
        <div class="field"><label>${t('العميل')}</label><button class="cust-pick" id="pt-cust">👤 ${t('اضغط للاختيار')}</button></div>
        <div class="row"><div class="field"><label>${t('النقاط (+ إضافة / − خصم)')}</label><input id="pt-pts" type="number" step="any"></div>
          <div class="field"><label>${t('السبب')}</label><input id="pt-note"></div></div>
        <div class="err" id="pt-e"></div>
        <button class="btn btn-sand" id="pt-go">${t('تنفيذ')}</button>
      </div>
    </div>
    <div class="card"><h3>📜 ${t('سجل النقاط')}</h3><div id="pt-log" style="max-height:64vh;overflow:auto"><div class="loading">…</div></div></div>
    </div>`;
  let cust = null;
  const loadLog = async () => {
    const rows = await api('/points/log');
    $('#pt-log').innerHTML = `<div class="t-wrap"><table><thead><tr><th>${t('العميل')}</th><th>${t('النقاط')}</th><th>${t('البيان')}</th><th>${t('بواسطة')}</th><th>${t('الوقت')}</th></tr></thead><tbody>
      ${rows.map(p => `<tr><td>${esc(p.customer_name)}</td>
        <td class="t-num" style="color:${p.points > 0 ? 'var(--green)' : 'var(--red)'};font-weight:700">${p.points > 0 ? '+' : ''}${num(p.points, 1)}</td>
        <td>${esc(p.note || p.kind)}</td><td>${esc(p.by_name || '—')}</td><td style="color:var(--text3)">${dt(p.created_at)}</td></tr>`).join('') || `<tr><td colspan="5" class="empty">${t('لا حركات نقاط بعد')}</td></tr>`}
      </tbody></table></div>`;
  };
  $('#pt-save').onclick = async () => {
    await api('/settings', { method: 'PUT', body: { points_enabled: $('#pt-on').checked ? '1' : '0',
      points_per_currency: $('#pt-per').value, point_value: $('#pt-val').value,
      points_min_redeem: $('#pt-min').value, points_max_discount_pct: $('#pt-max').value } });
    META = await api('/meta'); toast(t('حُفظت الإعدادات ✅'));
  };
  $('#pt-cust').onclick = () => pickCustomer(c => { cust = c; $('#pt-cust').innerHTML = `👤 ${esc(c.name_ar)} <span class="chip pts">⭐ ${num(c.points, 1)}</span>`; });
  $('#pt-go').onclick = async () => {
    if (!cust) return $('#pt-e').textContent = t('اختر عميلاً');
    try {
      const r = await api('/points/manual', { method: 'POST', body: { customer_id: cust.id, points: +$('#pt-pts').value || 0, note: $('#pt-note').value.trim() || null } });
      cust.points = r.points; $('#pt-cust').innerHTML = `👤 ${esc(cust.name_ar)} <span class="chip pts">⭐ ${num(r.points, 1)}</span>`;
      $('#pt-e').textContent = ''; $('#pt-pts').value = ''; toast(t('تم ✅')); loadLog();
    } catch (e) { $('#pt-e').textContent = e.message; }
  };
  loadLog();
};

// ===================================================================
//  الورديات وتقفيل العهدة
// ===================================================================
ROUTES.shifts = async (view) => {
  const [cur, history] = await Promise.all([api('/shifts/current'), api('/shifts')]);
  const s = cur.open ? cur.shift : null;
  const sum = cur.open ? cur.summary : null;
  view.innerHTML = `<div class="page-head"><div><h2>⏱️ ${t('الورديات والعهدة')}</h2><div class="crumb">${t('افتح وردية بعهدة افتتاحية، وقفّلها بجرد الدرج — يُحسب العجز/الزيادة تلقائياً')}</div></div>
    <div class="head-actions">${s ? `<button class="btn btn-danger" id="sh-close">🔒 ${t('تقفيل الوردية وتسليم العهدة')}</button>` : `<button class="btn btn-primary" id="sh-open">▶️ ${t('فتح وردية جديدة')}</button>`}</div></div>
    ${s ? `
    <div class="kpi-grid">
      <div class="kpi"><div class="lbl">${t('الوردية الحالية')}</div><div class="val">#${s.id}</div><div class="delta">${t('فُتحت')} ${ago(s.opened_at)}</div><span class="ic">⏱️</span></div>
      <div class="kpi sand"><div class="lbl">${t('العهدة الافتتاحية')}</div><div class="val">${money(s.opening_float)}</div><span class="ic">💰</span></div>
      <div class="kpi green"><div class="lbl">${t('مبيعات الوردية')}</div><div class="val">${money(sum.orders.sales)}</div><div class="delta up">${num(sum.orders.cnt)} ${t('طلب')}</div><span class="ic">🧾</span></div>
      <div class="kpi amber"><div class="lbl">${t('النقدية المتوقعة بالدرج')}</div><div class="val">${money(sum.expected_cash)}</div><span class="ic">🏦</span></div>
    </div>
    <div class="grid-2">
      <div class="card"><h3>💳 ${t('التحصيل حسب طريقة الدفع')}</h3>
        <div class="t-wrap"><table><thead><tr><th>${t('الطريقة')}</th><th>${t('وارد')}</th><th>${t('منصرف')}</th><th>${t('الصافي')}</th></tr></thead><tbody>
        ${sum.methods.map(mt => `<tr><td>${esc(mt.name)}</td><td class="t-num" style="color:var(--green)">${money(mt.inflow)}</td>
          <td class="t-num" style="color:var(--red)">${money(mt.outflow)}</td><td class="t-num" style="font-weight:700">${money(mt.net)}</td></tr>`).join('') || `<tr><td colspan="4" class="empty">${t('لا حركات بعد')}</td></tr>`}
        </tbody></table></div></div>
      <div class="card"><h3>📊 ${t('ملخص الوردية')}</h3>
        <div class="sumline"><span>🧾 ${t('عدد الطلبات')}</span><b>${num(sum.orders.cnt)}</b></div>
        <div class="sumline"><span>💵 ${t('المحصَّل فعلاً')}</span><b>${money(sum.orders.collected)}</b></div>
        <div class="sumline"><span>🕒 ${t('بيع آجل (غير محصَّل)')}</span><b style="color:var(--amber)">${money(sum.orders.credit)}</b></div>
        <div class="sumline"><span>↩️ ${t('مرتجعات')}</span><b style="color:var(--red)">${money(sum.returns.total)} (${num(sum.returns.cnt)})</b></div>
        <div class="sumline"><span>❌ ${t('طلبات ملغاة')}</span><b>${num(sum.cancelled)}</b></div>
        ${sum.vouchers.map(v => `<div class="sumline"><span>${v.kind === 'receipt' ? '💰 ' + t('سندات قبض') : '💸 ' + t('سندات صرف')}</span><b>${money(v.total)} (${num(v.cnt)})</b></div>`).join('')}
      </div>
    </div>` : `<div class="card"><div class="empty">🔓 ${t('لا توجد وردية مفتوحة حالياً — افتح وردية لبدء البيع بعهدة معلومة')}</div></div>`}
    <div class="card"><h3>📜 ${t('سجل الورديات')}</h3>
      <div class="t-wrap"><table><thead><tr><th>#</th><th>${t('الكاشير')}</th><th>${t('العهدة')}</th><th>${t('المتوقع')}</th><th>${t('المعدود')}</th><th>${t('العجز / الزيادة')}</th><th>${t('فُتحت')}</th><th>${t('قُفّلت')}</th><th></th></tr></thead><tbody>
      ${history.map(h => `<tr><td>#${h.id} ${h.status === 'open' ? `<span class="chip">${t('مفتوحة')}</span>` : ''}</td><td>${esc(h.user_name)}</td>
        <td class="t-num">${money(h.opening_float)}</td>
        <td class="t-num">${h.expected_cash !== null ? money(h.expected_cash) : '—'}</td>
        <td class="t-num">${h.counted_cash !== null ? money(h.counted_cash) : '—'}</td>
        <td class="t-num" style="font-weight:700;color:${h.variance > 0 ? 'var(--green)' : h.variance < 0 ? 'var(--red)' : 'var(--text3)'}">${h.variance !== null ? (h.variance > 0 ? '+' : '') + money(h.variance) : '—'}</td>
        <td style="color:var(--text3)">${dt(h.opened_at)}</td><td style="color:var(--text3)">${h.closed_at ? dt(h.closed_at) : '—'}</td>
        <td><button class="btn btn-ghost btn-sm" data-z="${h.id}">Z 🖨️</button></td></tr>`).join('') || `<tr><td colspan="9" class="empty">${t('لا ورديات بعد')}</td></tr>`}
      </tbody></table></div></div>`;
  const ob = $('#sh-open'); if (ob) ob.onclick = () => openShiftModal(false);
  const cb = $('#sh-close'); if (cb) cb.onclick = () => closeShiftModal(s, sum);
  $$('#view [data-z]').forEach(b => b.onclick = async () => { const d = await api('/shifts/' + b.dataset.z); printZReport(d.shift, d.summary); });
};
// تقفيل الوردية: جرد الدرج + عجز/زيادة + طباعة Z
function closeShiftModal(s, sum) {
  const m = modal(`<h3>🔒 ${t('تقفيل الوردية وتسليم العهدة')} — #${s.id}</h3>
    <div class="sumline"><span>💰 ${t('العهدة الافتتاحية')}</span><b>${money(s.opening_float)}</b></div>
    <div class="sumline"><span>💵 ${t('صافي النقدية خلال الوردية')}</span><b>${money(sum.cash_net)}</b></div>
    <div class="sumline total"><span>🏦 ${t('النقدية المتوقعة بالدرج')}</span><b>${money(sum.expected_cash)}</b></div>
    <div class="field" style="margin-top:14px"><label>🔢 ${t('النقدية المعدودة فعلياً بالدرج')} *</label><input id="cl-counted" type="number" step="any" value="${sum.expected_cash}" autofocus></div>
    <div class="change-big" id="cl-var"></div>
    <div class="field"><label>${t('ملاحظات التقفيل')}</label><input id="cl-note"></div>
    <div class="err" id="cl-e"></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="cl-x">${t('إلغاء')}</button>
      <button class="btn btn-danger btn-lg" id="cl-go">🔒 ${t('تقفيل نهائي وطباعة تقرير Z')}</button></div>`);
  const upd = () => {
    const v = +( (+$('#cl-counted', m).value || 0) - sum.expected_cash ).toFixed(2);
    const el = $('#cl-var', m);
    el.textContent = v === 0 ? '✅ ' + t('مطابق تماماً') : v > 0 ? `▲ ${t('زيادة')}: ${money(v)}` : `▼ ${t('عجز')}: ${money(Math.abs(v))}`;
    el.style.color = v === 0 ? 'var(--green)' : v > 0 ? 'var(--amber)' : 'var(--red)';
  };
  $('#cl-counted', m).oninput = upd; upd();
  $('#cl-x', m).onclick = () => m.remove();
  $('#cl-go', m).onclick = () => confirmDialog(t('تقفيل الوردية نهائياً؟ لا يمكن التراجع.'), async () => {
    try {
      await api(`/shifts/${s.id}/close`, { method: 'POST', body: { counted_cash: +$('#cl-counted', m).value || 0, close_note: $('#cl-note', m).value.trim() || null } });
      m.remove(); toast(t('قُفّلت الوردية ✅'));
      const d = await api('/shifts/' + s.id);
      printZReport(d.shift, d.summary);
      route();
    } catch (e) { $('#cl-e', m).textContent = e.message; }
  });
}
// تقرير Z (تقفيل وردية) — طباعة حرارية
function printZReport(s, sum) {
  const st = META.settings;
  const em = (n) => (+n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 }) + ' ' + cur();
  const edt = (x) => x ? new Date(x).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const pa = $('#print-area');
  pa.innerHTML = `<div class="receipt">
    <div class="r-c">${logoMark('r-logo-img')}<h2>${esc(st.cafe_name || 'seaside')}</h2>
      <div style="font-weight:700;font-size:15px;margin-top:4px">Z REPORT — Shift #${s.id}</div></div>
    <div class="r-line"></div>
    <table>
      <tr><td>Cashier</td><td style="text-align:right">${esc(s.user_name || '')}</td></tr>
      <tr><td>Opened</td><td style="text-align:right">${edt(s.opened_at)}</td></tr>
      <tr><td>Closed</td><td style="text-align:right">${edt(s.closed_at)}</td></tr>
    </table>
    <div class="r-line"></div>
    <table>
      <tr><td>Orders</td><td style="text-align:right">${sum.orders.cnt}</td></tr>
      <tr><td>Sales total</td><td style="text-align:right">${em(sum.orders.sales)}</td></tr>
      <tr><td>Collected</td><td style="text-align:right">${em(sum.orders.collected)}</td></tr>
      <tr><td>Credit (unpaid)</td><td style="text-align:right">${em(sum.orders.credit)}</td></tr>
      <tr><td>Returns</td><td style="text-align:right">${em(sum.returns.total)}</td></tr>
      <tr><td>Cancelled</td><td style="text-align:right">${sum.cancelled}</td></tr>
    </table>
    <div class="r-line"></div>
    <table><tr style="font-weight:700"><td>Method</td><td style="text-align:right">In</td><td style="text-align:right">Out</td></tr>
    ${sum.methods.map(mt => `<tr><td>${esc(mt.name)}</td><td style="text-align:right">${em(mt.inflow)}</td><td style="text-align:right">${em(mt.outflow)}</td></tr>`).join('')}</table>
    <div class="r-line"></div>
    <table>
      <tr><td>Opening float</td><td style="text-align:right">${em(s.opening_float)}</td></tr>
      <tr><td>Expected cash</td><td style="text-align:right">${em(s.expected_cash ?? sum.expected_cash)}</td></tr>
      <tr><td>Counted cash</td><td style="text-align:right">${em(s.counted_cash ?? 0)}</td></tr>
      <tr class="r-tot"><td>Variance</td><td style="text-align:right">${s.variance > 0 ? '+' : ''}${em(s.variance ?? 0)}</td></tr>
    </table>
    ${s.close_note ? `<div class="r-line"></div><div>Note: ${esc(s.close_note)}</div>` : ''}
    <div class="r-line"></div>
    <table><tr><td>Cashier sig.</td><td style="text-align:right">Manager sig.</td></tr>
    <tr><td style="padding-top:22px">___________</td><td style="text-align:right;padding-top:22px">___________</td></tr></table>
  </div>`;
  pa.classList.remove('hidden');
  const receiptEl = pa.querySelector('.receipt');
  const heightMM = roundToStandardHeight(Math.ceil((receiptEl?.offsetHeight || 700) * 25.4 / 96) + 12);
  setPrintPage(`@page{size:80mm ${heightMM}mm;margin:0}`);
  const done = () => { pa.classList.add('hidden'); pa.innerHTML = ''; setPrintPage(''); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done); setTimeout(() => window.print(), 150);
}

// ===================================================================
//  طباعة باركود المنتجات
// ===================================================================
ROUTES.barcodes = async (view) => {
  const prods = await api('/pos/products');
  const s = META.settings;
  let lines = [];
  view.innerHTML = `<div class="page-head"><div><h2>🏷️ ${t('طباعة باركود')}</h2><div class="crumb">${t('اختر الأصناف والعدد ثم اطبع ملصقات الباركود')}</div></div></div>
    <div class="grid-2">
      <div class="card"><h3>${t('الأصناف')}</h3>
        <div class="row"><div class="field" style="flex:2"><select id="bc-p">${prods.map(p => `<option value="${p.id}">${esc(p.name_ar)} — ${esc(p.barcode || '')}</option>`).join('')}</select></div>
          <div class="field"><input id="bc-n" type="number" min="1" value="2" placeholder="${t('العدد')}"></div>
          <button class="btn btn-primary" id="bc-add" style="align-self:flex-start">${t('إضافة')}</button></div>
        <div id="bc-list"></div>
        <div class="row" style="margin-top:14px">
          <div class="field"><label>${t('عرض الملصق (مم)')}</label><input id="bc-w" type="number" value="${esc(s.barcode_w_mm || '38')}"></div>
          <div class="field"><label>${t('ارتفاع الملصق (مم)')}</label><input id="bc-h" type="number" value="${esc(s.barcode_h_mm || '25')}"></div>
          <div class="field"><label>${t('في الصف')}</label><select id="bc-row">${[1, 2, 3, 4].map(n => `<option value="${n}" ${String(n) === (s.barcode_per_row || '2') ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        </div>
        <button class="btn btn-primary btn-lg btn-block" id="bc-print">🖨️ ${t('طباعة الباركود')}</button>
      </div>
      <div class="card"><h3>${t('معاينة')}</h3><div id="bc-preview" class="bc-preview"></div></div>
    </div>`;
  const drawList = () => {
    $('#bc-list').innerHTML = lines.map((l, i) => `<div class="sumline"><span>${esc(l.p.name_ar)} <span class="chip">${esc(l.p.barcode)}</span></span>
      <span>×${l.n} <button class="ci-x" data-x="${i}">✕</button></span></div>`).join('') || `<div class="empty">${t('أضف أصنافاً للطباعة')}</div>`;
    $$('#bc-list [data-x]').forEach(b => b.onclick = () => { lines.splice(+b.dataset.x, 1); drawList(); preview(); });
  };
  const labelHTML = (p) => `<div class="bc-label"><div class="bc-nm">${esc(p.name_ar)}</div><svg data-code="${esc(p.barcode)}"></svg><div class="bc-pr">${money(p.price)}</div></div>`;
  const preview = () => {
    const el = $('#bc-preview');
    el.innerHTML = lines.slice(0, 2).map(l => labelHTML(l.p)).join('') || `<div class="empty">${t('لا معاينة')}</div>`;
    $$('#bc-preview svg[data-code]').forEach(svg => { try { JsBarcode(svg, svg.dataset.code, { format: 'CODE128', width: 1.3, height: 34, fontSize: 11, margin: 0 }); } catch {} });
  };
  $('#bc-add').onclick = () => {
    const p = prods.find(x => x.id === +$('#bc-p').value);
    if (!p || !p.barcode) return toast(t('هذا الصنف بدون باركود'), 'warn');
    const ex = lines.find(l => l.p.id === p.id);
    if (ex) ex.n += +$('#bc-n').value || 1; else lines.push({ p, n: +$('#bc-n').value || 1 });
    drawList(); preview();
  };
  $('#bc-print').onclick = async () => {
    if (!lines.length) return toast(t('أضف أصنافاً للطباعة'), 'warn');
    const w = +$('#bc-w').value || 38, h = +$('#bc-h').value || 25, perRow = +$('#bc-row').value || 2;
    await api('/settings', { method: 'PUT', body: { barcode_w_mm: String(w), barcode_h_mm: String(h), barcode_per_row: String(perRow) } }).catch(() => {});
    const pa = $('#print-area');
    const labels = lines.flatMap(l => Array.from({ length: l.n }, () => labelHTML(l.p)));
    pa.innerHTML = `<div class="bc-sheet" style="grid-template-columns:repeat(${perRow},${w}mm)">${labels.join('')}</div>`;
    pa.classList.remove('hidden');
    $$('#print-area svg[data-code]').forEach(svg => { try { JsBarcode(svg, svg.dataset.code, { format: 'CODE128', width: 1.3, height: Math.max(18, h * 1.6), fontSize: 10, margin: 0 }); } catch {} });
    setPrintPage(`@page{size:auto;margin:4mm} .bc-sheet .bc-label{width:${w}mm;height:${h}mm}`);
    const done = () => { pa.classList.add('hidden'); pa.innerHTML = ''; setPrintPage(''); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done); setTimeout(() => window.print(), 200);
  };
  drawList(); preview();
};

// ===================================================================
//  النسخ الاحتياطي
// ===================================================================
ROUTES.backup = async (view) => {
  view.innerHTML = `<div class="page-head"><div><h2>💾 ${t('النسخ الاحتياطي')}</h2><div class="crumb">${t('أنشئ نسخة من قاعدة البيانات، حمّلها، أو استرجعها عند الحاجة')}</div></div>
    <div class="head-actions"><button class="btn btn-primary" id="bk-new">➕ ${t('إنشاء نسخة الآن')}</button></div></div>
    <div id="bk-body"><div class="loading">…</div></div>`;
  const fmtSize = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB';
  const load = async () => {
    const rows = await api('/backup/list');
    $('#bk-body').innerHTML = `<div class="card"><div class="t-wrap"><table><thead><tr><th>${t('اسم النسخة')}</th><th>${t('الحجم')}</th><th>${t('التاريخ')}</th><th></th></tr></thead><tbody>
      ${rows.map(b => `<tr><td><b>${esc(b.name)}</b></td><td class="t-num">${fmtSize(b.size)}</td><td style="color:var(--text3)">${dt(b.created_at)}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-ghost btn-sm" data-dl="${esc(b.name)}">⬇ ${t('تحميل')}</button>
          <button class="btn btn-sand btn-sm" data-rs="${esc(b.name)}">↩️ ${t('استرجاع')}</button>
          <button class="btn btn-danger btn-sm" data-del="${esc(b.name)}">🗑️</button>
        </td></tr>`).join('') || `<tr><td colspan="4" class="empty">${t('لا نسخ احتياطية بعد — أنشئ أول نسخة')}</td></tr>`}
      </tbody></table></div></div>`;
    $$('#bk-body [data-dl]').forEach(b => b.onclick = async () => {
      const res = await fetch('/api/backup/download/' + encodeURIComponent(b.dataset.dl), { headers: { Authorization: 'Bearer ' + TOKEN } });
      const blob = await res.blob(); const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = b.dataset.dl; a.click(); URL.revokeObjectURL(a.href);
    });
    $$('#bk-body [data-rs]').forEach(b => b.onclick = () => confirmDialog(t('استرجاع هذه النسخة؟ سيستبدل البيانات الحالية (تُؤخذ نسخة أمان تلقائياً أولاً).'), async () => {
      await api('/backup/restore', { method: 'POST', body: { name: b.dataset.rs } });
      toast(t('تم الاسترجاع ✅ — أعد تحميل الصفحة')); setTimeout(() => location.reload(), 1200);
    }));
    $$('#bk-body [data-del]').forEach(b => b.onclick = () => confirmDialog(t('حذف هذه النسخة؟'), async () => { await api('/backup/' + encodeURIComponent(b.dataset.del), { method: 'DELETE' }); toast(t('حُذفت')); load(); }));
  };
  $('#bk-new').onclick = async () => { const r = await api('/backup/create', { method: 'POST', body: {} }); toast(`💾 ${t('أُنشئت النسخة')}: ${r.name}`); load(); };
  load();
};

// ===================================================================
//  طلبات الطاولات QR (موافقة الكاشير)
// ===================================================================
// ===================================================================
//  داشبورد متجر العميل أونلاين (إدارة كاملة)
// ===================================================================
ROUTES.shop = async (view) => {
  const [s, d] = await Promise.all([api('/settings'), api('/shop-admin/overview')]);
  const st = d.stats;
  view.innerHTML = `<div class="page-head"><div><h2>🌐 ${t('متجر العميل أونلاين')}</h2><div class="crumb">${t('إدارة موقع الطلب أونلاين — الحالة، الواتساب، العملاء، والمنتجات المعروضة')}</div></div>
    <div class="head-actions"><button class="btn btn-primary" id="sh-open">🔗 ${t('فتح المتجر')}</button></div></div>
    <div class="kpi-grid">
      <div class="kpi"><div class="lbl">${t('عملاء مسجّلين')}</div><div class="val">${num(st.customers)}</div><span class="ic">👥</span></div>
      <div class="kpi green"><div class="lbl">${t('مبيعات أونلاين')}</div><div class="val">${money(st.onlineSales)}</div><span class="ic">💰</span></div>
      <div class="kpi sand"><div class="lbl">${t('طلبات دليفري اليوم')}</div><div class="val">${num(st.onlineOrdersToday)}</div><span class="ic">🛵</span></div>
      <div class="kpi amber"><div class="lbl">${t('بانتظار القبول')}</div><div class="val">${num(st.pendingOnline)}</div><span class="ic">⏳</span></div>
    </div>
    <div class="grid-2">
      <div>
        <div class="card"><h3>⚙️ ${t('حالة المتجر')}</h3>
          <div class="field"><label><input type="checkbox" id="sh-on" ${s.online_ordering === '1' ? 'checked' : ''} style="width:auto"> ${t('استقبال طلبات أونلاين (دليفري)')}</label></div>
          <div class="field"><label><input type="checkbox" id="sh-login" ${s.shop_require_login === '1' ? 'checked' : ''} style="width:auto"> 🔒 ${t('إلزام العميل بتسجيل الدخول (تأكيد الرقم) قبل الطلب')}</label></div>
          <div class="row"><div class="field"><label>🛵 ${t('مصاريف التوصيل')}</label><input id="sh-fee" type="number" step="any" value="${esc(s.delivery_fee || '0')}"></div>
            <div class="field"><label>🌍 ${t('كود دولة الواتساب')}</label><input id="sh-country" value="${esc(s.wa_country || '20')}" dir="ltr"></div></div>
          <div class="field"><label>📢 ${t('عنوان البانر الرئيسي')}</label><input id="sh-hero" value="${esc(s.shop_hero_title || '')}"></div>
          <div class="field"><label>${t('وصف البانر')}</label><input id="sh-herosub" value="${esc(s.shop_hero_sub || '')}"></div>
          <div class="field"><label>${t('رابط المتجر')}</label><div style="display:flex;gap:8px"><input id="sh-url" readonly value="${d.base_url}/menu" dir="ltr" style="flex:1"><button class="btn btn-ghost" id="sh-copy">📋</button></div></div>
          <button class="btn btn-primary" id="sh-save">💾 ${t('حفظ إعدادات المتجر')}</button>
        </div>
        <div class="card"><h3>📲 ${t('الواتساب (تأكيد الرقم والإشعارات)')}</h3>
          ${d.wa_connected
            ? `<div class="chip ok" style="margin-bottom:10px">✅ ${t('متصل — الرسائل تُرسل فعلياً عبر WhatsApp Business API')}</div>`
            : `<div class="chip low" style="margin-bottom:10px">💻 ${t('وضع تجريبي — الأكواد تظهر للعميل على الشاشة')}</div>
               <p class="crumb" style="line-height:1.9">${t('لتفعيل الإرسال الحقيقي على الواتساب: احصل على حساب WhatsApp Business API من Meta، ثم شغّل الخادم بمتغيّرات البيئة:')}
               <br><code style="direction:ltr;display:inline-block;background:var(--surface2);padding:3px 8px;border-radius:6px;margin-top:4px">WA_TOKEN=... WA_PHONE_ID=... npm start</code></p>`}
          ${d.wa_dev_last ? `<div class="crumb">${t('آخر كود تجريبي')}: <b dir="ltr">${esc(d.wa_dev_last.phone)} → ${esc(d.wa_dev_last.code)}</b></div>` : ''}
        </div>
      </div>
      <div class="card"><h3>👥 ${t('عملاء المتجر')} <span class="chip">${d.customers.length}</span></h3>
        <div class="t-wrap" style="max-height:64vh;overflow:auto"><table><thead><tr><th>${t('الاسم')}</th><th>${t('الهاتف')}</th><th>${t('طلبات')}</th><th>${t('أنفق')}</th><th>⭐</th></tr></thead><tbody>
        ${d.customers.map(c => `<tr><td><b>${esc(c.name_ar)}</b></td><td dir="ltr">${esc(c.phone)}</td><td class="t-num">${num(c.orders_count)}</td><td class="t-num">${money(c.total_spent)}</td><td class="t-num">${num(c.points, 1)}</td></tr>`).join('') || `<tr><td colspan="5" class="empty">${t('لا عملاء مسجّلين بعد')}</td></tr>`}
        </tbody></table></div></div>
    </div>
    <div class="card"><h3>🏷️ ${t('المنتجات المعروضة أونلاين')} <span class="crumb" style="font-weight:400">${t('حدّد الجديد والمميّز وما يظهر في المتجر')}</span></h3>
      <input type="search" id="sp-q" placeholder="${t('🔍 بحث عن منتج…')}" style="width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:11px;background:var(--surface2);color:var(--text);margin-bottom:12px">
      <div class="t-wrap" style="max-height:52vh;overflow:auto"><table><thead><tr><th>${t('المنتج')}</th><th>${t('الفئة')}</th><th>${t('السعر')}</th><th>🆕 ${t('جديد')}</th><th>⭐ ${t('مميّز')}</th><th>👁️ ${t('معروض')}</th></tr></thead><tbody id="sp-body"></tbody></table></div>
    </div>`;
  $('#sh-open').onclick = () => window.open('/menu', '_blank');
  $('#sh-copy').onclick = async () => { await navigator.clipboard.writeText($('#sh-url').value); toast(t('اتنسخ الرابط 📋')); };
  $('#sh-save').onclick = async () => {
    await api('/settings', { method: 'PUT', body: {
      online_ordering: $('#sh-on').checked ? '1' : '0', shop_require_login: $('#sh-login').checked ? '1' : '0',
      delivery_fee: $('#sh-fee').value || '0', wa_country: $('#sh-country').value.trim() || '20',
      shop_hero_title: $('#sh-hero').value, shop_hero_sub: $('#sh-herosub').value } });
    META = await api('/meta'); toast(t('حُفظت إعدادات المتجر ✅'));
  };
  // جدول المنتجات المعروضة + تبديل العلامات
  const prods = await api('/shop-admin/products');
  const drawProds = (q = '') => {
    const list = prods.filter(p => !q || p.name_ar.includes(q));
    $('#sp-body').innerHTML = list.map(p => `<tr>
      <td><b><span class="prod-cell-img">${prodThumb(p.image, 'pc-thumb')}</span> ${esc(p.name_ar)}</b></td>
      <td>${esc(p.category || '—')}</td><td class="t-num">${money(p.price)}</td>
      <td><input type="checkbox" data-flag="is_new" data-id="${p.id}" ${p.is_new ? 'checked' : ''}></td>
      <td><input type="checkbox" data-flag="is_featured" data-id="${p.id}" ${p.is_featured ? 'checked' : ''}></td>
      <td><input type="checkbox" data-flag="show_online" data-id="${p.id}" ${p.show_online ? 'checked' : ''}></td></tr>`).join('') || `<tr><td colspan="6" class="empty">${t('لا منتجات')}</td></tr>`;
    $$('#sp-body [data-flag]').forEach(c => c.onchange = async () => {
      await api(`/shop-admin/products/${c.dataset.id}/flag`, { method: 'POST', body: { flag: c.dataset.flag, value: c.checked ? 1 : 0 } });
      const p = prods.find(x => x.id === +c.dataset.id); if (p) p[c.dataset.flag] = c.checked ? 1 : 0;
      toast(t('تم ✅'));
    });
  };
  drawProds();
  let spt; $('#sp-q').oninput = () => { clearTimeout(spt); spt = setTimeout(() => drawProds($('#sp-q').value.trim()), 200); };
};

// شاشة طلبات أونلاين موحّدة — kind: 'tables' (طاولات) أو 'delivery' (دليفري)
function qrOrdersScreen(view, kind) {
  const isDel = kind === 'delivery';
  const title = isDel ? '🛵 ' + t('طلبات الدليفري') : '📲 ' + t('طلبات الطاولات');
  const crumb = isDel ? t('طلبات التوصيل من موقع العميل أونلاين — اقبلها لتجهيزها وتوصيلها') : t('طلبات الزبائن من الطاولة عبر QR — اقبلها لترسل للمطبخ');
  const render = async () => {
    if (!location.hash.includes(kind === 'delivery' ? 'delivery' : 'qrorders')) return;
    const rows = await api('/qr-orders?kind=' + kind);
    const pending = rows.filter(o => o.status === 'open');
    const rest = rows.filter(o => o.status !== 'open').slice(0, 30);
    view.innerHTML = `<div class="page-head"><div><h2>${title}</h2><div class="crumb">${crumb}</div></div>
      <div class="head-actions">${pending.length ? `<span class="chip low" style="align-self:center">${pending.length} ${t('بانتظار القبول')}</span>` : ''}<button class="btn btn-ghost" id="qr-refresh">${t('🔄 تحديث')}</button></div></div>
      ${pending.length ? `<div class="kds-grid" style="margin-bottom:20px">${pending.map(o => `
        <div class="kds-card qr-pending ${isDel ? 'qr-del' : ''}">
          <div class="kh"><span class="inv">${isDel ? '🛵 ' + t('دليفري') : '🪑 ' + esc(o.table_name || '—')} — ${esc(o.invoice_no)}</span><span class="ago">${ago(o.created_at)}</span></div>
          ${o.qr_name || o.qr_phone ? `<div class="qr-guest">👤 ${esc(o.qr_name || '')} ${o.qr_phone ? `<a href="tel:${esc(o.qr_phone)}" dir="ltr" style="color:var(--sea-deep)">${esc(o.qr_phone)}</a>` : ''}</div>` : ''}
          ${o.qr_address ? `<div class="qr-guest">📍 ${esc(o.qr_address)}</div>` : ''}
          ${o.tip ? `<div class="qr-guest">🛵 ${t('مصاريف التوصيل')}: <b>${money(o.tip)}</b></div>` : ''}
          ${o.items.map(i => `<div class="kds-item" style="cursor:default"><div class="ki-nm">${i.qty}× ${esc(i.name_ar)}${i.note ? `<small>↳ ${esc(i.note)}</small>` : ''}</div><b class="t-num">${money(i.price * i.qty)}</b></div>`).join('')}
          ${o.note ? `<div class="qr-guest">📝 ${esc(o.note)}</div>` : ''}
          <div class="qr-actions">
            <div class="qr-total">${money(o.total)}</div>
            <button class="btn btn-danger btn-sm" data-rej="${o.id}">✕ ${t('رفض')}</button>
            <button class="btn btn-primary" data-acc="${o.id}">✅ ${isDel ? t('قبول الطلب') : t('قبول وإرسال للتحضير')}</button>
          </div>
        </div>`).join('')}</div>`
      : `<div class="card"><div class="empty">📭 ${isDel ? t('لا طلبات دليفري جديدة في الانتظار') : t('لا طلبات طاولات جديدة في الانتظار')}</div></div>`}
      <div class="card"><h3>📜 ${t('آخر الطلبات')}</h3>
        <div class="t-wrap"><table><thead><tr><th>${t('الفاتورة')}</th><th>${isDel ? t('العميل') : t('الطاولة')}</th>${isDel ? `<th>${t('الهاتف')}</th>` : ''}<th>${t('الإجمالي')}</th><th>${t('الحالة')}</th><th>${t('الوقت')}</th><th></th></tr></thead><tbody>
        ${rest.map(o => `<tr><td>${esc(o.invoice_no)}</td><td>${isDel ? esc(o.qr_name || '—') : esc(o.table_name || '—')}</td>${isDel ? `<td dir="ltr">${esc(o.qr_phone || '—')}</td>` : ''}
          <td class="t-num">${money(o.total)}</td><td>${stBadge(o.status)}</td><td style="color:var(--text3)">${dt(o.created_at)}</td>
          <td><button class="btn btn-ghost btn-sm" data-o="${o.id}">${t('عرض')}</button></td></tr>`).join('') || `<tr><td colspan="${isDel ? 7 : 6}" class="empty">${t('لا طلبات بعد')}</td></tr>`}
        </tbody></table></div></div>`;
    $('#qr-refresh').onclick = render;
    $$('#view [data-acc]').forEach(b => b.onclick = async () => {
      await api(`/qr-orders/${b.dataset.acc}/accept`, { method: 'POST', body: {} });
      toast(isDel ? t('اتقبل طلب الدليفري ✅') : t('اتقبل الطلب وراح للتحضير ✅')); refreshKDSBadge(); refreshQRBadge(); render();
    });
    $$('#view [data-rej]').forEach(b => b.onclick = () => confirmDialog(t('رفض هذا الطلب؟'), async () => {
      await api(`/qr-orders/${b.dataset.rej}/reject`, { method: 'POST', body: {} });
      toast(t('اترفض الطلب')); refreshQRBadge(); render();
    }));
    $$('#view [data-o]').forEach(b => b.onclick = () => openOrder(+b.dataset.o));
  };
  render();
  const hashKey = isDel ? 'delivery' : 'qrorders';
  const timer = setInterval(() => { if (location.hash.includes(hashKey)) render(); else clearInterval(timer); }, 12000);
}
ROUTES.qrorders = (view) => qrOrdersScreen(view, 'tables');
ROUTES.delivery = (view) => qrOrdersScreen(view, 'delivery');

// ===================================================================
//  الطاولات و QR (إدارة وطباعة الأكواد)
// ===================================================================
// رسم QR على كانفس (مكتبة qrcode-generator المحلية — تعمل أوفلاين)
function qrInto(cv, text, size = 170, dark = '#143B44') {
  try {
    const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
    const n = qr.getModuleCount(); const cell = Math.max(2, Math.floor((size * 2) / n)); const pad = cell * 2;
    cv.width = cv.height = n * cell + pad * 2;                 // دقة مضاعفة لطباعة حادة
    cv.style.width = cv.style.height = size + 'px';
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = dark;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(pad + c * cell, pad + r * cell, cell, cell);
  } catch { /* لا يحدث مع روابط بهذا الطول */ }
}
ROUTES.tables = async (view) => {
  const rows = await api('/tables-qr');
  view.innerHTML = `<div class="page-head"><div><h2>🪑 ${t('الطاولات و QR')}</h2><div class="crumb">${t('كود QR خاص بكل طاولة — العميل يمسحه ويطلب من موبايله مباشرة')}</div></div>
    <div class="head-actions"><button class="btn btn-ghost" id="tq-add">${t('+ إضافة طاولة')}</button><button class="btn btn-primary" id="tq-print-all">🖨️ ${t('طباعة كل الأكواد')}</button></div></div>
    <div class="grid-3" id="tq-grid">
    ${rows.map(tb => `<div class="card qr-card ${tb.is_active ? '' : 'inactive'}">
      <div class="qr-card-head"><b>🪑 ${esc(tb.name_ar)}</b><span class="chip">${tb.seats} ${t('مقاعد')}</span>
        ${tb.pending ? `<span class="chip low">📲 ${tb.pending}</span>` : ''}</div>
      <div class="qr-box"><canvas data-qr="${esc(tb.url)}"></canvas></div>
      <div class="qr-url" dir="ltr" title="${esc(tb.url)}">${esc(tb.url)}</div>
      <div class="qr-card-actions">
        <button class="btn btn-ghost btn-sm" data-copy="${esc(tb.url)}">📋 ${t('نسخ الرابط')}</button>
        <button class="btn btn-ghost btn-sm" data-print="${tb.id}">🖨️ ${t('طباعة')}</button>
        <button class="btn btn-ghost btn-sm" data-edit="${tb.id}">✏️ ${t('تعديل')}</button>
        <button class="btn btn-danger btn-sm" data-regen="${tb.id}" title="${t('يبطل الكود المطبوع القديم')}">♻️ ${t('كود جديد')}</button>
      </div>
    </div>`).join('') || `<div class="card"><div class="empty">${t('لا طاولات — أضف طاولات من الإعدادات')}</div></div>`}
    </div>`;
  // رسم أكواد QR
  $$('#tq-grid [data-qr]').forEach(cv => qrInto(cv, cv.dataset.qr, 170));
  $$('#tq-grid [data-copy]').forEach(b => b.onclick = async () => { await navigator.clipboard.writeText(b.dataset.copy); toast(t('اتنسخ الرابط 📋')); });
  $$('#tq-grid [data-regen]').forEach(b => b.onclick = () => confirmDialog(t('توليد كود جديد؟ الكود المطبوع القديم لن يعمل بعدها.'), async () => {
    await api(`/tables-qr/${b.dataset.regen}/regenerate`, { method: 'POST', body: {} }); toast(t('اتولّد كود جديد ♻️')); route();
  }));
  const printCards = async (list) => {
    const pa = $('#print-area');
    // بطاقة أنيقة لكل طاولة: الاسم + QR + إرشاد
    pa.innerHTML = `<div class="qr-sheet">${list.map(tb => `
      <div class="qr-print-card">
        <div class="qp-name">${esc(META.settings.cafe_name || 'seaside')}</div>
        <div class="qp-table">🪑 ${esc(tb.name_ar)}</div>
        <canvas data-qr="${esc(tb.url)}"></canvas>
        <div class="qp-hint">امسح الكود واطلب من موبايلك 📲<br><small>Scan to order from your phone</small></div>
      </div>`).join('')}</div>`;
    pa.classList.remove('hidden');
    $$('#print-area [data-qr]').forEach(cv => qrInto(cv, cv.dataset.qr, 210, '#000'));
    setPrintPage('@page{size:A4;margin:10mm}');
    const done = () => { pa.classList.add('hidden'); pa.innerHTML = ''; setPrintPage(''); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done); setTimeout(() => window.print(), 250);
  };
  $$('#tq-grid [data-print]').forEach(b => b.onclick = () => printCards(rows.filter(x => x.id === +b.dataset.print)));
  $('#tq-print-all').onclick = () => printCards(rows.filter(x => x.is_active));
  // نموذج إضافة/تعديل طاولة (الإدارة الكاملة هنا — لا شيء في الإعدادات)
  const tableForm = (tb) => {
    const m = modal(`<h3>🪑 ${tb ? t('تعديل طاولة') : t('إضافة طاولة')}</h3>
      <div class="row"><div class="field"><label>${t('اسم الطاولة')}</label><input id="tb-name" value="${esc(tb?.name_ar || '')}" placeholder="${t('مثال: تراس 5')}"></div>
        <div class="field"><label>${t('المقاعد')}</label><input id="tb-seats" type="number" value="${tb?.seats ?? 4}"></div></div>
      ${tb ? `<div class="field"><label><input type="checkbox" id="tb-active" ${tb.is_active ? 'checked' : ''} style="width:auto"> ${t('مفعّلة (تظهر في الكاشير ويعمل كودها)')}</label></div>` : ''}
      <div class="modal-actions"><button class="btn btn-ghost" id="tb-x">${t('إلغاء')}</button><button class="btn btn-primary" id="tb-go">${t('حفظ')}</button></div>`);
    $('#tb-x', m).onclick = () => m.remove();
    $('#tb-go', m).onclick = async () => {
      const name = $('#tb-name', m).value.trim(); if (!name) return;
      const body = { name_ar: name, seats: +$('#tb-seats', m).value || 4 };
      if (tb) body.is_active = $('#tb-active', m).checked ? 1 : 0; else { body.is_active = 1; body.sort_order = 99; }
      await api(tb ? '/admin/tables/' + tb.id : '/admin/tables', { method: tb ? 'PUT' : 'POST', body });
      m.remove(); META = await api('/meta'); toast(t('تم الحفظ ✅')); route();
    };
  };
  $('#tq-add').onclick = () => tableForm(null);
  $$('#tq-grid [data-edit]').forEach(b => b.onclick = () => tableForm(rows.find(x => x.id === +b.dataset.edit)));
};

// ---------- إقلاع ----------
applyBranding();   // من الكاش المحلي فوراً (بدون وميض)
if (TOKEN) boot().catch(() => renderLogin()); else { fetchBranding().then(renderLogin); renderLogin(); }
