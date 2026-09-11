const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding an ultra-complete order with ALL items...');

  // 1. Create a Customer
  const cust = await prisma.customer.create({
    data: {
      customerId: `CM-TWP-${Date.now()}`,
      name: 'Priya Sharma (Ultimate Demo)',
      phone: '9876543210',
      email: 'priya.demo@example.com',
      address: '123 Fashion Street, Mumbai'
    }
  });

  // 2. Create the Order
  const order = await prisma.tailoringOrder.create({
    data: {
      customerId: cust.customerId,
      orderDate: new Date(),
      deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'In Progress',
      notes: 'Ultimate Demo Order: Contains every item type and multi-sub-items.',
      bagNo: 'B-999',
      bagName: 'Mega Demo Bag'
    }
  });

  // Helper to generate a reliable image URL (Picsum provides fast, reliable random images)
  const img = (id) => `https://picsum.photos/seed/${id}/400/400`;

  // Base sub-item template for Blouse types
  const baseBlouseSubItem = (num, seedPrefix) => ({
    number: num,
    price: `${1500 + num * 200}`,
    meter: '1.2',
    source: 'CUSTOMER',
    sourcePrice: '0',
    description: `Sub-item ${num}: Fabric provided by customer. Cut exactly to fit.`,
    liningSource: 'SHOP',
    liningMeter: '1',
    liningPrice: '150',
    
    // measurements
    measurement_SL: '10', measurement_SA: '12', measurement_ARM: '14',
    measurement_BACK_L: '15', measurement_HIP: '32', measurement_PAKKA: '3',
    measurement_SHOULDER: '14', measurement_BACKNECK: '9', measurement_CHEST: '36',
    measurement_FRONT_NECK: '7', measurement_FRONT_LEN: '14',

    blouseMode: num === 1 ? 'sample' : 'measurement',
    sampleBlouseDescription: num === 1 ? 'Use this sample for fitting, but increase back neck.' : '',
    sampleBlouseImageUrl: num === 1 ? img(`${seedPrefix}sample`) : null,

    // design notes
    frontDesignNotes: `Front design for item ${num}`,
    backDesignNotes: `Back design for item ${num}`,
    sleeveDesignNotes: `Sleeve design for item ${num}`,

    // design refs
    referenceImageUrl: img(`${seedPrefix}ref`),
    frontDesignImageUrl: img(`${seedPrefix}f`),
    backDesignImageUrl: img(`${seedPrefix}b`),
    sleeveDesignImageUrl: img(`${seedPrefix}s`),

    // drawn canvas mock data
    frontCanvasDataUrl: img(`${seedPrefix}df`),
    frontCanvasJSON: JSON.stringify({ version: "5.3.0", objects: [{ type: "circle", left: 150, top: 150, radius: 50, fill: "transparent", stroke: "#eab308", strokeWidth: 5 }] }),
    backCanvasDataUrl: img(`${seedPrefix}db`),
    backCanvasJSON: JSON.stringify({ version: "5.3.0", objects: [{ type: "rect", left: 100, top: 100, width: 100, height: 100, fill: "transparent", stroke: "#ec4899", strokeWidth: 5 }] }),
    sleeveCanvasDataUrl: img(`${seedPrefix}ds`),
    sleeveCanvasJSON: JSON.stringify({ version: "5.3.0", objects: [{ type: "textbox", left: 100, top: 100, text: "Sleeve Details", fill: "#3b82f6", fontSize: 24 }] }),

    // Aari work
    aryaWorkNotes: '',
    aryaWorkPrice: ''
  });

  // ITEM 1: DESIGN BLOUSE (Quantity: 3 to show Item 1, Item 2, Item 3 tabs)
  await prisma.tailoringOrderItem.create({
    data: {
      orderId: order.id,
      itemType: 'DESIGN_BLOUSE',
      quantity: 3,
      sortOrder: 0,
      details: JSON.stringify({ notes: 'Main bridal blouses' }),
      subItems: JSON.stringify([
        baseBlouseSubItem(1, 'db1'),
        baseBlouseSubItem(2, 'db2'),
        baseBlouseSubItem(3, 'db3')
      ])
    }
  });

  // ITEM 2: LINING BLOUSE (Quantity: 1)
  await prisma.tailoringOrderItem.create({
    data: {
      orderId: order.id,
      itemType: 'LINING_BLOUSE',
      quantity: 1,
      sortOrder: 1,
      details: JSON.stringify({}),
      subItems: JSON.stringify([baseBlouseSubItem(1, 'lb1')])
    }
  });

  // ITEM 3: ARYA WORK BLOUSE (Quantity: 1)
  const aariSub = baseBlouseSubItem(1, 'aari');
  aariSub.aryaWorkNotes = 'Heavy golden zardosi work.';
  aariSub.aryaWorkPrice = '4500';
  await prisma.tailoringOrderItem.create({
    data: {
      orderId: order.id,
      itemType: 'ARYA_WORK_BLOUSE',
      quantity: 1,
      sortOrder: 2,
      details: JSON.stringify({}),
      subItems: JSON.stringify([aariSub])
    }
  });

  // ITEM 4: SAREE FALLS (Quantity: 1)
  await prisma.tailoringOrderItem.create({
    data: {
      orderId: order.id,
      itemType: 'SAREE_FALLS',
      quantity: 1,
      sortOrder: 3,
      details: JSON.stringify({}),
      subItems: JSON.stringify([{
        number: 1,
        numberOfSarees: '2',
        numberOfFalls: '2',
        sareeColour: 'Pink & Green',
        fallsSource: 'SHOP',
        price: '300',
        referenceImageUrl: img('falls1')
      }])
    }
  });

  // ITEM 5: SAREE BORDER / OORAM (Quantity: 1)
  await prisma.tailoringOrderItem.create({
    data: {
      orderId: order.id,
      itemType: 'SAREE_BORDER',
      quantity: 1,
      sortOrder: 4,
      details: JSON.stringify({}),
      subItems: JSON.stringify([{
        number: 1,
        numberOfSarees: '1',
        description: 'Stitch standard golden border on the saree pallu.',
        price: '150',
        referenceImageUrl: img('border1')
      }])
    }
  });

  // ITEM 6: CUSTOM ITEM (Quantity: 1)
  await prisma.tailoringOrderItem.create({
    data: {
      orderId: order.id,
      itemType: 'CUSTOM_ITEM',
      quantity: 1,
      sortOrder: 5,
      details: JSON.stringify({
        customConfig: {
          itemName: 'Lehenga Choli',
          hasMeasurements: true,
          hasNotes: true,
          hasReferenceImage: true,
          hasDesign: true
        }
      }),
      subItems: JSON.stringify([{
        number: 1,
        price: '3500',
        description: 'Custom Lehenga Choli with heavy tassels.',
        measurement_HIP: '34',
        measurement_FRONT_LEN: '40',
        referenceImageUrl: img('custom1'),
        frontDesignImageUrl: img('custom_f'),
        backDesignImageUrl: img('custom_b'),
        sleeveDesignImageUrl: img('custom_s'),
        frontCanvasDataUrl: img('custom_df'),
        frontCanvasJSON: JSON.stringify({ version: "5.3.0", objects: [{ type: "circle", left: 150, top: 150, radius: 50, fill: "transparent", stroke: "#eab308", strokeWidth: 5 }] }),
        backCanvasDataUrl: img('custom_db'),
        backCanvasJSON: JSON.stringify({ version: "5.3.0", objects: [{ type: "rect", left: 100, top: 100, width: 100, height: 100, fill: "transparent", stroke: "#ec4899", strokeWidth: 5 }] }),
        sleeveCanvasDataUrl: img('custom_ds'),
        sleeveCanvasJSON: JSON.stringify({ version: "5.3.0", objects: [{ type: "textbox", left: 100, top: 100, text: "Sleeve Details", fill: "#3b82f6", fontSize: 24 }] })
      }])
    }
  });

  console.log(`Success! Order created: ${order.id}`);
  console.log('Customer:', cust.name);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
