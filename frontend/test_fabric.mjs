import * as fabric from 'fabric';
fabric.FabricImage.fromURL('https://picsum.photos/200').then(img => {
  console.log('Got image', img.width, img.height);
  img.scaleToWidth(400);
  console.log('Scaled height:', typeof img.getScaledHeight === 'function' ? img.getScaledHeight() : 'Missing function!');
}).catch(e => console.error(e));
