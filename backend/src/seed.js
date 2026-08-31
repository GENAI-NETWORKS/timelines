require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const GARMENT_TEMPLATES = [
  {
    garmentType: 'Blouse',
    fields: [
      { name: 'shoulder', label: 'Shoulder', unit: 'inches', required: true, order: 1 },
      { name: 'chest', label: 'Chest / Bust', unit: 'inches', required: true, order: 2 },
      { name: 'waist', label: 'Waist', unit: 'inches', required: true, order: 3 },
      { name: 'blouseLength', label: 'Blouse Length', unit: 'inches', required: true, order: 4 },
      { name: 'sleeveLength', label: 'Sleeve Length', unit: 'inches', required: false, order: 5 },
      { name: 'sleeveRound', label: 'Sleeve Round', unit: 'inches', required: false, order: 6 },
      { name: 'armhole', label: 'Armhole', unit: 'inches', required: false, order: 7 },
      { name: 'neckDepthFront', label: 'Neck Depth (Front)', unit: 'inches', required: false, order: 8 },
      { name: 'neckDepthBack', label: 'Neck Depth (Back)', unit: 'inches', required: false, order: 9 },
      { name: 'crossFront', label: 'Cross Front', unit: 'inches', required: false, order: 10 },
      { name: 'crossBack', label: 'Cross Back', unit: 'inches', required: false, order: 11 },
    ],
  },
  {
    garmentType: 'Frock',
    fields: [
      { name: 'shoulder', label: 'Shoulder', unit: 'inches', required: true, order: 1 },
      { name: 'chest', label: 'Chest / Bust', unit: 'inches', required: true, order: 2 },
      { name: 'waist', label: 'Waist', unit: 'inches', required: true, order: 3 },
      { name: 'hip', label: 'Hip', unit: 'inches', required: true, order: 4 },
      { name: 'frockLength', label: 'Frock Length', unit: 'inches', required: true, order: 5 },
      { name: 'sleeveLength', label: 'Sleeve Length', unit: 'inches', required: false, order: 6 },
      { name: 'sleeveRound', label: 'Sleeve Round', unit: 'inches', required: false, order: 7 },
      { name: 'armhole', label: 'Armhole', unit: 'inches', required: false, order: 8 },
      { name: 'neckDepthFront', label: 'Neck Depth (Front)', unit: 'inches', required: false, order: 9 },
      { name: 'neckDepthBack', label: 'Neck Depth (Back)', unit: 'inches', required: false, order: 10 },
    ],
  },
  {
    garmentType: 'Chudi',
    fields: [
      { name: 'shoulder', label: 'Shoulder', unit: 'inches', required: true, order: 1 },
      { name: 'chest', label: 'Chest / Bust', unit: 'inches', required: true, order: 2 },
      { name: 'waist', label: 'Waist', unit: 'inches', required: true, order: 3 },
      { name: 'hip', label: 'Hip', unit: 'inches', required: true, order: 4 },
      { name: 'chudiLength', label: 'Chudi Length', unit: 'inches', required: true, order: 5 },
      { name: 'sleeveLength', label: 'Sleeve Length', unit: 'inches', required: false, order: 6 },
      { name: 'sleeveRound', label: 'Sleeve Round', unit: 'inches', required: false, order: 7 },
      { name: 'bottomRound', label: 'Bottom Round', unit: 'inches', required: false, order: 8 },
      { name: 'neckDepthFront', label: 'Neck Depth (Front)', unit: 'inches', required: false, order: 9 },
    ],
  },
  {
    garmentType: 'Saree Fall',
    fields: [
      { name: 'waist', label: 'Waist', unit: 'inches', required: true, order: 1 },
      { name: 'hip', label: 'Hip', unit: 'inches', required: true, order: 2 },
      { name: 'waistToAnkle', label: 'Waist to Ankle', unit: 'inches', required: true, order: 3 },
      { name: 'waistToKnee', label: 'Waist to Knee', unit: 'inches', required: false, order: 4 },
      { name: 'petticoatLength', label: 'Petticoat Length', unit: 'inches', required: false, order: 5 },
    ],
  },
  {
    garmentType: 'Lehenga',
    fields: [
      { name: 'shoulder', label: 'Shoulder', unit: 'inches', required: true, order: 1 },
      { name: 'chest', label: 'Chest / Bust', unit: 'inches', required: true, order: 2 },
      { name: 'waist', label: 'Waist', unit: 'inches', required: true, order: 3 },
      { name: 'hip', label: 'Hip', unit: 'inches', required: true, order: 4 },
      { name: 'lehengaLength', label: 'Lehenga Length', unit: 'inches', required: true, order: 5 },
      { name: 'blouseLength', label: 'Blouse Length', unit: 'inches', required: false, order: 6 },
      { name: 'sleeveLength', label: 'Sleeve Length', unit: 'inches', required: false, order: 7 },
      { name: 'neckDepthFront', label: 'Neck Depth (Front)', unit: 'inches', required: false, order: 8 },
      { name: 'neckDepthBack', label: 'Neck Depth (Back)', unit: 'inches', required: false, order: 9 },
    ],
  },
  {
    garmentType: 'Kurta',
    fields: [
      { name: 'shoulder', label: 'Shoulder', unit: 'inches', required: true, order: 1 },
      { name: 'chest', label: 'Chest / Bust', unit: 'inches', required: true, order: 2 },
      { name: 'waist', label: 'Waist', unit: 'inches', required: true, order: 3 },
      { name: 'hip', label: 'Hip', unit: 'inches', required: true, order: 4 },
      { name: 'kurtaLength', label: 'Kurta Length', unit: 'inches', required: true, order: 5 },
      { name: 'sleeveLength', label: 'Sleeve Length', unit: 'inches', required: false, order: 6 },
      { name: 'sleeveRound', label: 'Sleeve Round', unit: 'inches', required: false, order: 7 },
      { name: 'neckDepthFront', label: 'Neck Depth (Front)', unit: 'inches', required: false, order: 8 },
    ],
  },
];

async function seed() {
  console.log('🌱 Seeding Hostinger MySQL database...');
  try {
    // Clear in dependency order
    await prisma.auditLog.deleteMany({});
    await prisma.salary.deleteMany({});
    await prisma.designOrder.deleteMany({});
    await prisma.garmentTemplate.deleteMany({});
    await prisma.customer.deleteMany({});
    await prisma.employee.deleteMany({});
    await prisma.user.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Garment Templates
    for (const tpl of GARMENT_TEMPLATES) {
      await prisma.garmentTemplate.create({ data: tpl });
    }
    console.log(`👗 Created ${GARMENT_TEMPLATES.length} garment templates`);

    // Employees
    const emp1 = await prisma.employee.create({ data: { employeeId: 'EMP-0001', name: 'Ravi Kumar', role: 'Tailor', phone: '9876543210', email: 'ravi@timelines.in', joiningDate: new Date('2022-01-15') } });
    const emp2 = await prisma.employee.create({ data: { employeeId: 'EMP-0002', name: 'Meena Devi', role: 'Designer', phone: '9876543211', email: 'meena@timelines.in', joiningDate: new Date('2021-06-01') } });
    const emp3 = await prisma.employee.create({ data: { employeeId: 'EMP-0003', name: 'Sundar Raja', role: 'Tailor', phone: '9876543212', joiningDate: new Date('2023-03-10') } });
    const emp4 = await prisma.employee.create({ data: { employeeId: 'EMP-0004', name: 'Lakshmi S', role: 'Helper', phone: '9876543213', joiningDate: new Date('2023-08-01') } });
    console.log('👷 Created 4 employees');

    // Users (hash passwords)
    const adminHash = await bcrypt.hash('admin123', 12);
    const staffHash = await bcrypt.hash('staff123', 12);
    const admin = await prisma.user.create({ data: { name: 'Admin User', email: 'admin@timelines.in', password: adminHash, role: 'admin' } });
    await prisma.user.create({ data: { name: 'Ravi Kumar', email: 'ravi@timelines.in', password: staffHash, role: 'staff', employeeRef: emp1.employeeId } });
    console.log('🔐 Created admin and staff users');
    console.log('   Admin: admin@timelines.in / admin123');
    console.log('   Staff: ravi@timelines.in  / staff123');

    // Customers
    const cust1 = await prisma.customer.create({ data: { customerId: 'TC-2026-0001', name: 'Priya Sharma', phone: '9900112233', address: '12 MG Road, Coimbatore', email: 'priya@gmail.com', notes: 'Regular customer, prefers silk blouses' } });
    const cust2 = await prisma.customer.create({ data: { customerId: 'TC-2026-0002', name: 'Anitha Reddy', phone: '9900112234', address: '45 Anna Nagar, Chennai', email: 'anitha@gmail.com' } });
    const cust3 = await prisma.customer.create({ data: { customerId: 'TC-2026-0003', name: 'Kavitha Nair', phone: '9900112235', address: '78 Brigade Road, Bangalore' } });
    console.log('👥 Created 3 sample customers');

    // Design Orders
    await prisma.designOrder.create({
      data: {
        orderId: 'ORD-0001', customerId: cust1.customerId, garmentType: 'Blouse',
        measurements: { shoulder: '14', chest: '36', waist: '32', blouseLength: '15', sleeveLength: '6', sleeveRound: '13', neckDepthFront: '5', neckDepthBack: '3' },
        fabricNotes: 'Kanjivaram silk, deep maroon',
        specialInstructions: 'Puff sleeves, round neck, embroidery border on sleeves',
        assignedTailorId: emp1.employeeId, status: 'In Progress',
        orderDate: new Date('2026-08-01'), deliveryDate: new Date('2026-08-20'),
        createdById: admin.id,
      },
    });
    await prisma.designOrder.create({
      data: {
        orderId: 'ORD-0002', customerId: cust2.customerId, garmentType: 'Lehenga',
        measurements: { shoulder: '13.5', chest: '34', waist: '28', hip: '38', lehengaLength: '42', blouseLength: '14', neckDepthFront: '6', neckDepthBack: '2' },
        fabricNotes: 'Banarasi silk lehenga, golden zari work',
        specialInstructions: 'For wedding function, heavy work blouse',
        assignedTailorId: emp1.employeeId, status: 'Pending',
        orderDate: new Date('2026-08-15'), deliveryDate: new Date('2026-09-10'),
        createdById: admin.id,
      },
    });
    await prisma.designOrder.create({
      data: {
        orderId: 'ORD-0003', customerId: cust3.customerId, garmentType: 'Frock',
        measurements: { shoulder: '13', chest: '33', waist: '27', hip: '36', frockLength: '52' },
        fabricNotes: 'Cotton georgette, powder blue',
        status: 'Ready',
        orderDate: new Date('2026-07-20'), deliveryDate: new Date('2026-08-05'),
        createdById: admin.id,
      },
    });
    console.log('📋 Created 3 sample design orders');

    // Salary records
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    await prisma.salary.create({ data: { employeeId: emp1.employeeId, month, year, baseSalary: 18000, advances: 2000, deductions: 0, bonus: 500, netPaid: 16500, paidStatus: 'paid', paymentHistory: [{ amount: 16500, note: 'Monthly salary', paidAt: now.toISOString() }] } });
    await prisma.salary.create({ data: { employeeId: emp2.employeeId, month, year, baseSalary: 22000, advances: 0, deductions: 0, bonus: 1000, netPaid: 23000, paidStatus: 'unpaid' } });
    await prisma.salary.create({ data: { employeeId: emp3.employeeId, month, year, baseSalary: 15000, advances: 1000, deductions: 0, bonus: 0, netPaid: 14000, paidStatus: 'partial' } });
    console.log('💰 Created salary records');

    console.log('\n✅ Database seeded successfully on Hostinger MySQL!');
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch(() => process.exit(1));
