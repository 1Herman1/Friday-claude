import sharp from 'sharp';

await sharp('/home/user/hb_landing/public/media/hero/germes.jpg')
  .resize(676, null, { withoutEnlargement: true })
  .webp({ quality: 80 })
  .toFile('/home/user/hb_landing/public/media/hero/germes.webp');

console.log('✓ germes.webp created');
