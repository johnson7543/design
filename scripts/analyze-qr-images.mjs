import sharp from 'sharp';

const files = [
  { path: 'image.png', left: 185, top: 129, width: 508, height: 508 },
  { path: 'image copy.png', left: 92, top: 59, width: 508, height: 508 },
];

for (const item of files) {
  const { data, info } = await sharp(item.path)
    .extract(item)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const counts = new Map();
  for (let index = 0; index < data.length; index += info.channels) {
    const key = [
      data[index],
      data[index + 1],
      data[index + 2],
      data[index + 3],
    ].join(',');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 30);
  console.log(item.path, info, top);
}
