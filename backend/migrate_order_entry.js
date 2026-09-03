/**
 * migrate_order_entry.js
 * 
 * Run ONCE after deploying the new schema to:
 * 1. Upsert the 4 paper-form garment templates (Blouse, Chudi, Frock, Pavadai Sattai)
 *    with exact paper-form abbreviation keys and labels
 * 2. Create a full sample ORD-0100 order with all new fields populated
 *    (uses existing customer TC-2026-0001 if present)
 *
 * Usage: node migrate_order_entry.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── Paper-form garment templates with exact abbreviation keys ─────────────
const PAPER_FORM_TEMPLATES = [
  {
    garmentType: 'Blouse',
    fields: [
      { name: 'SL',          label: 'SL (Sleeve Length)',   unit: 'inches', required: true,  order: 1  },
      { name: 'SA',          label: 'SA (Sleeve Around)',   unit: 'inches', required: true,  order: 2  },
      { name: 'ARM',         label: 'ARM (Armhole)',        unit: 'inches', required: true,  order: 3  },
      { name: 'BACK_L',     label: 'BACK L',               unit: 'inches', required: true,  order: 4  },
      { name: 'HIP',         label: 'HIP',                 unit: 'inches', required: true,  order: 5  },
      { name: 'PAKKA',       label: 'PAKKA',               unit: 'inches', required: false, order: 6  },
      { name: 'SHOULDER',    label: 'SHOULDER',            unit: 'inches', required: true,  order: 7  },
      { name: 'BACK_NECK',  label: 'BACK NECK',           unit: 'inches', required: true,  order: 8  },
      { name: 'CHEST',       label: 'CHEST',               unit: 'inches', required: true,  order: 9  },
      { name: 'FRONT_NECK', label: 'FRONT NECK',          unit: 'inches', required: true,  order: 10 },
      { name: 'FRONT_LEN',  label: 'FRONT LEN',           unit: 'inches', required: true,  order: 11 },
    ],
    isActive: true,
  },
  {
    garmentType: 'Chudi',
    fields: [
      { name: 'TOP_L',          label: 'TOP L',                 unit: 'inches', required: true,  order: 1  },
      { name: 'PAKKA_KALU',     label: 'PAKKA KALU',           unit: 'inches', required: false, order: 2  },
      { name: 'SHOULDER',       label: 'SHOULDER',              unit: 'inches', required: true,  order: 3  },
      { name: 'BACK_NECK',      label: 'BACK NECK',             unit: 'inches', required: true,  order: 4  },
      { name: 'FRONT_NECK',     label: 'FRONT NECK',            unit: 'inches', required: true,  order: 5  },
      { name: 'UPPER_CHEST',    label: 'UPPER CHEST',           unit: 'inches', required: true,  order: 6  },
      { name: 'CHEST',          label: 'CHEST',                 unit: 'inches', required: true,  order: 7  },
      { name: 'HIP',            label: 'HIP',                   unit: 'inches', required: true,  order: 8  },
      { name: 'OPEN',           label: 'OPEN',                  unit: 'inches', required: false, order: 9  },
      { name: 'SEAT',           label: 'SEAT',                  unit: 'inches', required: false, order: 10 },
      { name: 'ARM',            label: 'ARM',                   unit: 'inches', required: true,  order: 11 },
      { name: 'SLEEVE_LENGTH',  label: 'SLEEVE LENGTH',         unit: 'inches', required: true,  order: 12 },
      { name: 'SLEEVE_AROUND',  label: 'SLEEVE AROUND',         unit: 'inches', required: false, order: 13 },
      { name: 'PANT_LENGTH',    label: 'PANT LENGTH',           unit: 'inches', required: true,  order: 14 },
      { name: 'PANT_LEG_AROUND',label: 'PANT LEG AROUND',      unit: 'inches', required: false, order: 15 },
      { name: 'PANT_SEAT',      label: 'PANT SEAT',             unit: 'inches', required: false, order: 16 },
    ],
    isActive: true,
  },
  {
    garmentType: 'Frock',
    fields: [
      { name: 'FRONT_FL',      label: 'FRONT F L',        unit: 'inches', required: true,  order: 1  },
      { name: 'FRONT_H',       label: 'FRONT H',          unit: 'inches', required: false, order: 2  },
      { name: 'FRONT_LOOSE',   label: 'FRONT LOOSE',      unit: 'inches', required: false, order: 3  },
      { name: 'CHEST',         label: 'CHEST',            unit: 'inches', required: true,  order: 4  },
      { name: 'BACK_NECK',     label: 'BACK NECK',        unit: 'inches', required: true,  order: 5  },
      { name: 'FRONT_NECK',    label: 'FRONT NECK',       unit: 'inches', required: true,  order: 6  },
      { name: 'ARM',           label: 'ARM',              unit: 'inches', required: true,  order: 7  },
      { name: 'SLEEVE_LENGTH', label: 'SLEEVE LENGTH',    unit: 'inches', required: true,  order: 8  },
      { name: 'SLEEVE_LOOSE',  label: 'SLEEVE LOOSE',     unit: 'inches', required: false, order: 9  },
      { name: 'PK',            label: 'PK (Pakka)',       unit: 'inches', required: false, order: 10 },
    ],
    isActive: true,
  },
  {
    garmentType: 'Pavadai Sattai',
    fields: [
      { name: 'PAVADAI_FULL_LE',  label: 'PAVADAI FULL LE',    unit: 'inches', required: true,  order: 1  },
      { name: 'HIP_LOOSE',        label: 'HIP LOOSE',          unit: 'inches', required: false, order: 2  },
      { name: 'BODY_PAVADAI_LE',  label: 'BODY PAVADAI LE',    unit: 'inches', required: true,  order: 3  },
      { name: 'SATTAI_HEIGHT',    label: 'SATTAI HEIGHT',      unit: 'inches', required: true,  order: 4  },
      { name: 'SATTAI_LOOSE',     label: 'SATTAI LOOSE',       unit: 'inches', required: false, order: 5  },
      { name: 'HIP',              label: 'HIP',                unit: 'inches', required: true,  order: 6  },
      { name: 'CHEST',            label: 'CHEST',              unit: 'inches', required: true,  order: 7  },
      { name: 'BACK_N',           label: 'BACK N',             unit: 'inches', required: true,  order: 8  },
      { name: 'FRONT_N',          label: 'FRONT N',            unit: 'inches', required: true,  order: 9  },
      { name: 'ARM',              label: 'ARM',                unit: 'inches', required: true,  order: 10 },
      { name: 'SLEEVE_LENGTH',    label: 'SLEEVE LENGTH',      unit: 'inches', required: true,  order: 11 },
      { name: 'SLEEVE_LOOSE',     label: 'SLEEVE LOOSE',       unit: 'inches', required: false, order: 12 },
      { name: 'PK',               label: 'PK (Pakka)',         unit: 'inches', required: false, order: 13 },
    ],
    isActive: true,
  },
];

async function main() {
  console.log('🔄 Running Order Entry migration...\n');

  // 1. Upsert paper-form garment templates
  console.log('📐 Upserting paper-form garment templates...');
  for (const tpl of PAPER_FORM_TEMPLATES) {
    const existing = await prisma.garmentTemplate.findFirst({
      where: { garmentType: tpl.garmentType },
    });
    if (existing) {
      await prisma.garmentTemplate.update({
        where: { id: existing.id },
        data: { fields: tpl.fields, isActive: tpl.isActive },
      });
      console.log(`  ✅ Updated: ${tpl.garmentType} (${tpl.fields.length} fields)`);
    } else {
      await prisma.garmentTemplate.create({ data: tpl });
      console.log(`  ✅ Created: ${tpl.garmentType} (${tpl.fields.length} fields)`);
    }
  }

  // 2. Create a full sample order (ORD-0100) for testing
  console.log('\n📋 Creating full sample order ORD-0100...');
  
  // Find or use first customer
  let customer = await prisma.customer.findUnique({ where: { customerId: 'TC-2026-0001' } });
  if (!customer) {
    customer = await prisma.customer.findFirst({ orderBy: { createdAt: 'asc' } });
  }

  if (!customer) {
    console.log('  ⚠️  No customers found — skipping sample order. Run seed.js first.');
  } else {
    // Check if ORD-0100 already exists
    const existing = await prisma.designOrder.findUnique({ where: { orderId: 'ORD-0100' } });
    if (existing) {
      console.log('  ℹ️  ORD-0100 already exists — skipping.');
    } else {
      const tailor = await prisma.employee.findFirst({
        where: { role: 'Tailor', status: 'active' },
      });

      const order = await prisma.designOrder.create({
        data: {
          orderId: 'ORD-0100',
          customerId: customer.customerId,
          garmentType: 'Blouse',
          measurements: {
            SL: '6',
            SA: '13',
            ARM: '14.5',
            BACK_L: '15',
            HIP: '38',
            PAKKA: '38',
            SHOULDER: '14',
            BACK_NECK: '2.5',
            CHEST: '36',
            FRONT_NECK: '5',
            FRONT_LEN: '15',
          },
          fabricNotes: 'Kanjivaram silk, deep maroon',
          specialInstructions: 'Puff sleeves, round neck, embroidery border on sleeves',
          assignedTailorId: tailor?.employeeId || null,
          status: 'In Progress',
          orderDate: new Date('2026-08-01'),
          deliveryDate: new Date('2026-08-20'),
          bagRef: 'BAG-042',
          isSample: false,
          baseDescription: 'Maroon Kanjivaram — gold zari border',
          threadColors: 'Gold #1, Maroon #3',
          buttonsNeeded: '6 hook-and-eye, gold finish',
          particulars: {
            create: [
              { itemName: 'Aari work only', qty: '1', notes: 'Front panel, 3-inch border', sortOrder: 0 },
              { itemName: 'Aari stitching', qty: '1', notes: 'Sleeve edges', sortOrder: 1 },
              { itemName: 'Lining',          qty: '1', notes: 'Full inner lining, nude color', sortOrder: 2 },
              { itemName: 'Hand Hemming',    qty: '1', notes: 'Bottom hem', sortOrder: 3 },
            ],
          },
          designSections: {
            create: [
              {
                sectionType: 'back_neck',
                notes: 'Deep U-back, 4.5 inch depth, smooth finish',
              },
              {
                sectionType: 'sleeve',
                notes: 'Puff sleeve, 3-inch puff, gathered at shoulder seam',
              },
              {
                sectionType: 'front_neck',
                notes: 'Round neck, 5-inch front depth, piping border',
              },
            ],
          },
        },
      });
      console.log(`  ✅ Created: ${order.orderId} for ${customer.name}`);
    }
  }

  console.log('\n✅ Migration complete!');
}

main()
  .catch((e) => { console.error('❌ Migration failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
