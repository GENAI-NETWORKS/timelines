const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orderId = "cmtwso0at000118wign52no1q";
  console.log(`Updating order ${orderId} to include canvas JSON...`);

  const items = await prisma.tailoringOrderItem.findMany({ where: { orderId } });
  
  for (const item of items) {
    if (item.itemType === 'DESIGN_BLOUSE' || item.itemType === 'CUSTOM_ITEM') {
      let subs = JSON.parse(item.subItems);
      const img = (id) => `https://picsum.photos/seed/${id}/400/400`;

      subs = subs.map(sub => {
        const seedPrefix = `db${sub.number}`;
        return {
          ...sub,
          frontCanvasDataUrl: img(`${seedPrefix}df`),
          frontCanvasJSON: JSON.stringify({ version: "5.3.0", objects: [{ type: "circle", left: 150, top: 150, radius: 50, fill: "transparent", stroke: "#eab308", strokeWidth: 5 }] }),
          backCanvasDataUrl: img(`${seedPrefix}db`),
          backCanvasJSON: JSON.stringify({ version: "5.3.0", objects: [{ type: "rect", left: 100, top: 100, width: 100, height: 100, fill: "transparent", stroke: "#ec4899", strokeWidth: 5 }] }),
          sleeveCanvasDataUrl: img(`${seedPrefix}ds`),
          sleeveCanvasJSON: JSON.stringify({ version: "5.3.0", objects: [{ type: "textbox", left: 100, top: 100, text: "Sleeve Details", fill: "#3b82f6", fontSize: 24 }] }),
        };
      });

      await prisma.tailoringOrderItem.update({
        where: { id: item.id },
        data: { subItems: JSON.stringify(subs) }
      });
      console.log(`Updated item ${item.id}`);
    }
  }
  
  console.log('Update complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
