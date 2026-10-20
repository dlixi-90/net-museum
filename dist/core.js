export function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

export function filterArtworks(artworks, {query = '', category = 'all', era = 'all', maxSize = '', sort = 'curated'} = {}) {
  const tokens = normalize(query).trim().split(/\s+/).filter(Boolean);
  const result = artworks.filter(a => {
    const searchable = normalize(a.title);
    return tokens.every(t => searchable.includes(t)) && (category === 'all' || a.category === category)
      && (era === 'all' || (era === 'early' ? a.year < 1400 : a.year >= 1400))
      && (maxSize === '' || a.sizeBytes <= Number(maxSize) * 1024 * 1024);
  });
  if (sort === 'name') result.sort((a, b) => a.title.localeCompare(b.title, 'vi'));
  if (sort === 'oldest') result.sort((a, b) => a.year - b.year);
  return result;
}

// Joint RGB histogram: 4 bins/channel, 64 dimensions, L1 normalization.
// All pixels are included. Museum backgrounds therefore affect the result.
export function colorHistogram(pixels) {
  const vector = new Array(64).fill(0);
  let count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    vector[(pixels[i] >> 6) * 16 + (pixels[i + 1] >> 6) * 4 + (pixels[i + 2] >> 6)]++;
    count++;
  }
  return vector.map(v => count ? v / count : 0);
}

export function cosineSimilarity(a, b) {
  if (a.length !== b.length) throw new Error('Vectors must have the same dimension');
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {dot += a[i] * b[i]; normA += a[i] ** 2; normB += b[i] ** 2;}
  return normA && normB ? Math.max(0, Math.min(1, dot / Math.sqrt(normA * normB))) : 0;
}
