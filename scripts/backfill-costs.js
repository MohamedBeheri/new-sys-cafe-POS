// ===================================================================
//  تصليح تكاليف المبيعات التاريخية — يعمل على ملف نسخة احتياطية محلي فقط
//  المشكلة: مبيعات 9→18 يوليو 2026 سُجّلت بتكلفة صفر/ناقصة لأن الوصفات
//  وتكاليف المواد أُدخلت تدريجياً بعد البيع. اللقطة (order_items.cost)
//  ثابتة، فالتقارير تُظهر ربحاً مضخّماً.
//  العلاج: تحديث اللقطات القديمة بتكلفة المنتج الحالية ثم إعادة حساب
//  orders.cost_total (نفس معادلة البيع: مجموع كمية×تكلفة).
//
//  الاستخدام:
//    node scripts/backfill-costs.js <ملف.db>            ← معاينة فقط (لا يكتب شيئاً)
//    node scripts/backfill-costs.js <ملف.db> --apply    ← تنفيذ فعلي
//    اختياري: --cutoff=2026-07-19  (السطور قبل هذا التاريخ فقط)
// ===================================================================
import { DatabaseSync } from 'node:sqlite';

const dbPath = process.argv[2];
const APPLY = process.argv.includes('--apply');
const cutoff = (process.argv.find(a => a.startsWith('--cutoff=')) || '--cutoff=2026-07-19').split('=')[1];
if (!dbPath) { console.error('الاستخدام: node scripts/backfill-costs.js <ملف.db> [--apply] [--cutoff=YYYY-MM-DD]'); process.exit(1); }

const db = new DatabaseSync(dbPath, { readOnly: !APPLY });
const all = (q, ...p) => db.prepare(q).all(...p);
const get = (q, ...p) => db.prepare(q).get(...p);
const run = (q, ...p) => db.prepare(q).run(...p);

// السطور المستهدفة: قبل تاريخ القطع، للمنتج تكلفة حالية، واللقطة أقل من 90% منها
// (شرط الـ 90% يستثني اللقطات الصحيحة أصلاً ولو اختلفت هوامش بسيطة)
const targets = all(`
  SELECT oi.id oi_id, oi.order_id, oi.name_ar, oi.qty, oi.cost old_cost, p.cost new_cost
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN products p ON p.id = oi.product_id
  WHERE o.created_at < ? AND p.cost > 0 AND oi.cost < p.cost * 0.9
  ORDER BY oi.order_id`, cutoff);

const addedCost = targets.reduce((s, r) => s + r.qty * (r.new_cost - r.old_cost), 0);
const orderIds = [...new Set(targets.map(r => r.order_id))];

console.log(APPLY ? '== تنفيذ فعلي ==' : '== معاينة فقط (أضف --apply للتنفيذ) ==');
console.log('تاريخ القطع:', cutoff);
console.log('سطور بيع ستُحدَّث:', targets.length);
console.log('فواتير سيُعاد حساب تكلفتها:', orderIds.length);
console.log('تكلفة ستُضاف للتقارير: EGP', addedCost.toFixed(2));

// عيّنة للمراجعة
console.log('\nعيّنة (أول 10):');
targets.slice(0, 10).forEach(r =>
  console.log(`  ${r.name_ar} ×${r.qty}: ${r.old_cost} → ${r.new_cost}`));

if (!APPLY) process.exit(0);

db.exec('BEGIN');
try {
  const upItem = db.prepare('UPDATE order_items SET cost=? WHERE id=?');
  for (const r of targets) upItem.run(r.new_cost, r.oi_id);
  // إعادة حساب إجمالي التكلفة لكل فاتورة متأثرة — نفس معادلة البيع
  const upOrder = db.prepare(`UPDATE orders SET cost_total =
    (SELECT COALESCE(SUM(qty*cost),0) FROM order_items WHERE order_id=orders.id) WHERE id=?`);
  for (const oid of orderIds) upOrder.run(oid);
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  console.error('فشل — تم التراجع عن كل شيء:', e.message);
  process.exit(1);
}

// تحقق بعد التنفيذ
const left = get(`SELECT COUNT(*) c FROM order_items oi JOIN orders o ON o.id=oi.order_id
  JOIN products p ON p.id=oi.product_id WHERE o.created_at < ? AND p.cost > 0 AND oi.cost < p.cost*0.9`, cutoff);
const mismatch = get(`SELECT COUNT(*) c FROM orders o WHERE ABS(o.cost_total -
  (SELECT COALESCE(SUM(qty*cost),0) FROM order_items WHERE order_id=o.id)) > 0.01 AND o.status='paid'`);
console.log('\n✅ تم. سطور متبقية بتكلفة ناقصة:', left.c, '| فواتير غير متطابقة التكلفة:', mismatch.c);
