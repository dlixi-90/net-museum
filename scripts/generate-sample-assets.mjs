/**
 * Real, reproducible supplementary files for the seven museum objects.
 * node scripts/generate-sample-assets.mjs --prepare
 * docker build -f scripts/neural-tts.Dockerfile -t net-museum-neural-tts:local scripts
 * Generate WAV narration with the neural TTS container before rendering media.
 * docker build -f scripts/sample-assets.Dockerfile -t net-museum-sample-media:local .
 * docker run --rm --mount type=bind,source=<absolute dist/assets/samples>,target=/samples net-museum-sample-media:local
 * node scripts/generate-sample-assets.mjs --finalize
 * Requires installed project dependencies, Docker Desktop and an Arial/DejaVu font.
 * The original collection images and object records are never modified.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { zipSync, strToU8 } from 'fflate';
import ffprobePath from 'ffprobe-static';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const samples = path.join(root, 'dist/assets/samples');
const artworks = JSON.parse(await fs.readFile(path.join(root, 'dist/assets/artworks.json'), 'utf8'));
const voicePeriods = { '37557': 'thế kỷ mười lăm', '37451': 'thế kỷ mười lăm', '37563': 'thế kỷ mười lăm đến mười sáu', '38546': 'thế kỷ mười lăm đến mười sáu', '37450': 'thế kỷ mười bốn', '75915': 'khoảng thế kỷ mười ba', '37449': 'thế kỷ mười một đến mười hai' };
const narrationVoice='Minh Đức';
const escapeXml = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const paragraphs = (a) => [
  `BẢO TÀNG SỐ NÉT — ${a.title}`,
  `Mã hiện vật: ${a.id}. Niên đại: ${a.period}. Xuất xứ: ${a.origin}.`,
  a.description,
  `Tác giả hiện vật: ${a.author}. Chất liệu theo nguồn gốc: ${a.material}.`,
  `Thuyết minh tiếng Việt và video trong bộ tài nguyên này do Bảo tàng số Nét biên soạn cho mục đích học tập. Giọng đọc AI ${narrationVoice}, tiếng Việt miền Bắc, được tạo bằng VieNeu-TTS; video là minh họa tĩnh từ ảnh hiện vật, không phải phim tư liệu lịch sử.`,
  `Nguồn ảnh và thông tin hiện vật: The Metropolitan Museum of Art. ${a.source}`,
  `Quyền sử dụng ảnh: ${a.license}. Nội dung thuyết minh bổ sung: CC BY 4.0, Bảo tàng số Nét.`,
];
const narration = (a) => `Chào mừng bạn đến với Bảo tàng số Nét. Bạn đang khám phá hiện vật ${a.title}, có niên đại ${voicePeriods[a.id]}, xuất xứ Việt Nam. ${a.description.replace(/\bcobalt\b/gi,'cô ban')} Bạn có thể mở ảnh chi tiết để quan sát bề mặt men và các đường nét của hiện vật. Đây là bản thuyết minh tiếng Việt bằng giọng đọc tổng hợp, phục vụ việc tham quan và học tập.`;

async function loadFont() {
  const candidates = [process.env.SAMPLE_ASSET_FONT, 'C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'].filter(Boolean);
  for (const f of candidates) { try { return await fs.readFile(f); } catch {} }
  throw new Error('Set SAMPLE_ASSET_FONT to an Arial or DejaVu TTF supporting Vietnamese.');
}

function wrap(text, font, size, maxWidth) {
  const lines = []; let line = '';
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(test, size) > maxWidth) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

async function createPdf(a, fontBytes) {
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  pdf.setTitle(`Hồ sơ hiện vật — ${a.title}`); pdf.setAuthor('Bảo tàng số Nét'); pdf.setSubject('Tài liệu học tập bằng tiếng Việt');
  let page = pdf.addPage([595, 842]); let y = 790;
  for (const [index, para] of paragraphs(a).entries()) {
    const size = index === 0 ? 17 : 11;
    for (const line of wrap(para, font, size, 495)) {
      if (y < 60) { page = pdf.addPage([595, 842]); y = 790; }
      page.drawText(line, { x: 50, y, size, font, color: rgb(.15, .15, .15) }); y -= size * 1.5;
    }
    y -= 12;
  }
  await fs.writeFile(path.join(samples, `${a.id}-document.pdf`), await pdf.save());
  return pdf.getPageCount();
}

function createDocx(a) {
  const body = paragraphs(a).map(p => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(p)}</w:t></w:r></w:p>`).join('');
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;
  return zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': strToU8(document),
  });
}

async function prepare() {
  await fs.mkdir(samples, { recursive: true });
  const fontBytes = await loadFont(); const stats = {};
  const commands = ['#!/bin/sh', 'set -eu', 'cd /samples'];
  for (const a of artworks) {
    const image = await fs.readFile(path.join(root, 'dist', a.image));
    const meta = await sharp(image).metadata();
    const cropW = Math.max(1, Math.round(meta.width * .58)), cropH = Math.max(1, Math.round(meta.height * .58));
    const crop = await sharp(image).extract({ left: Math.floor((meta.width-cropW)/2), top: Math.floor((meta.height-cropH)/2), width: cropW, height: cropH }).resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
    await fs.writeFile(path.join(samples, `${a.id}-detail.jpg`), crop);
    await fs.writeFile(path.join(samples, `${a.id}-video-source.jpg`), image);
    await fs.writeFile(path.join(samples, `${a.id}-transcript.txt`), narration(a) + '\n', 'utf8');
    await fs.writeFile(path.join(samples, `${a.id}-document.txt`), paragraphs(a).join('\n\n') + '\n', 'utf8');
    await fs.writeFile(path.join(samples, `${a.id}-document.docx`), createDocx(a));
    stats[a.id] = { pageCount: await createPdf(a, fontBytes) };
    await fs.writeFile(path.join(samples, `${a.id}-video-title.txt`), `${a.title}\nMINH HỌA TỪ ẢNH HIỆN VẬT · THUYẾT MINH TIẾNG VIỆT`, 'utf8');
    commands.push(
      `test -s ${a.id}-audio.wav`,
      `ffmpeg -hide_banner -loglevel error -y -i ${a.id}-audio.wav -af loudnorm=I=-16:TP=-1.5:LRA=11 -ar 48000 -ac 1 -codec:a libmp3lame -b:a 128k ${a.id}-audio.mp3`,
      `ffmpeg -hide_banner -loglevel error -y -loop 1 -i ${a.id}-video-source.jpg -i ${a.id}-audio.mp3 -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x151310,drawbox=x=0:y=620:w=iw:h=100:color=black@0.8:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=${a.id}-video-title.txt:fontcolor=white:fontsize=22:line_spacing=8:x=32:y=640" -r 15 -c:v libx264 -preset fast -tune stillimage -crf 26 -pix_fmt yuv420p -c:a aac -b:a 96k -shortest -movflags +faststart ${a.id}-video.mp4`,
      `ffmpeg -hide_banner -loglevel error -i ${a.id}-audio.mp3 -f null -`,
      `ffmpeg -hide_banner -loglevel error -i ${a.id}-video.mp4 -f null -`,
    );
  }
  commands.push('sha256sum '+artworks.flatMap(a=>[`${a.id}-audio.wav`,`${a.id}-audio.mp3`,`${a.id}-video.mp4`]).join(' ')+' > rendered-media.sha256');
  await fs.writeFile(path.join(samples, 'render-media.sh'), commands.join('\n') + '\n', 'utf8');
  await fs.writeFile(path.join(samples, 'document-stats.json'), JSON.stringify(stats, null, 2));
  console.log(`Prepared ${artworks.length} sets of Vietnamese text, PDF, DOCX and detail images. Render media with the Docker command in the script header.`);
}

function probe(file) {
  const result = spawnSync(ffprobePath.path, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Cannot decode ${path.basename(file)}: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

async function finalize() {
  const stats = JSON.parse(await fs.readFile(path.join(samples, 'document-stats.json'), 'utf8'));
  const profile=JSON.parse(await fs.readFile(path.join(samples,'narration-profile.json'),'utf8'));
  if(profile.voice!==narrationVoice||profile.language!=='vi-VN')throw new Error('Generate the configured Vietnamese narration voice first.');
  const rendered=new Map((await fs.readFile(path.join(samples,'rendered-media.sha256'),'utf8')).trim().split(/\r?\n/).map(line=>{const match=/^([a-f0-9]{64})\s+\*?(.+)$/.exec(line);if(!match)throw new Error('Invalid render checksum');return [match[2],match[1]];}));
  const resources = [];
  for (const a of artworks) {
    const input=await fs.readFile(path.join(samples,`${a.id}-transcript.txt`)),wave=await fs.readFile(path.join(samples,`${a.id}-audio.wav`));
    const voice=profile.items[a.id],inputHash=createHash('sha256').update(input).digest('hex'),waveHash=createHash('sha256').update(wave).digest('hex');
    if(voice?.voice!==narrationVoice||voice.precision!==profile.precision||voice.sdkVersion!==profile.sdkVersion||voice.inputSha256!==inputHash||voice.wavSha256!==waveHash||rendered.get(`${a.id}-audio.wav`)!==waveHash)throw new Error('Narration or rendered media is stale: '+a.id);
    const formats = [
      ['detail', 'jpg', 'image', 'image/jpeg', `Ảnh chi tiết — ${a.title}`],
      ['audio', 'mp3', 'audio', 'audio/mpeg', `Thuyết minh tiếng Việt — ${a.title}`],
      ['video', 'mp4', 'video', 'video/mp4', `Video minh họa — ${a.title}`],
      ['document', 'pdf', 'document', 'application/pdf', `Hồ sơ PDF — ${a.title}`],
      ['document', 'txt', 'text', 'text/plain', `Hồ sơ TXT — ${a.title}`],
      ['document', 'docx', 'document', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', `Hồ sơ DOCX — ${a.title}`],
    ];
    for (const [suffix, ext, kind, mimeType, title] of formats) {
      const filename = `${a.id}-${suffix}.${ext}`; const file = path.join(samples, filename); const stat = await fs.stat(file);
      const record = { artifactId: a.id, id: `sample-${a.id}-${suffix}-${ext}`, kind, mimeType, url: `/assets/samples/${filename}`, sizeBytes: stat.size, sha256: createHash('sha256').update(await fs.readFile(file)).digest('hex'), title,
        author: kind === 'image' ? a.author : kind === 'audio' || kind === 'video' ? 'Nét — thuyết minh tổng hợp' : 'Bảo tàng số Nét', source: a.source,
        license: kind === 'image' ? a.license : '',
        topic: a.categoryLabel, tags: [...a.tags, 'tài nguyên học tập', ...(kind === 'audio' || kind === 'video' ? ['tiếng Việt', 'giọng tổng hợp'] : [])],
        description: kind === 'image' ? '' : kind === 'video' ? `Video minh họa hiện vật, thuyết minh bằng giọng AI ${narrationVoice}, tiếng Việt miền Bắc. Không phải phim tư liệu lịch sử.` : kind === 'audio' ? `Thuyết minh tiếng Việt bằng giọng ${narrationVoice}, nam miền Bắc; giọng đọc AI phục vụ tham quan và học tập.` : 'Tài liệu tiếng Việt về hiện vật, kèm nguồn và thông tin quyền sử dụng.',
        language: 'vi-VN', content: kind === 'image' ? a.description : paragraphs(a).join('\n\n'),
      };
      if (kind === 'audio' || kind === 'video') {
        if(rendered.get(filename)!==record.sha256)throw new Error('Rendered media checksum mismatch: '+filename);
        const metadata = probe(file); const video = metadata.streams.find(s => s.codec_type === 'video');
        if (!metadata.streams.some(s => s.codec_type === 'audio')) throw new Error(`${filename} has no audio track`);
        record.duration = Number(metadata.format.duration); record.transcript = narration(a);
        record.content = narration(a); if (video) { record.width = video.width; record.height = video.height; }
      }
      if (kind === 'image') { const m = await sharp(file).metadata(); record.width = m.width; record.height = m.height; }
      if (ext === 'pdf') record.pageCount = stats[a.id].pageCount;
      resources.push(record);
    }
  }
  await fs.writeFile(path.join(samples, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), narration:{engine:profile.engine,voice:profile.voice,language:profile.language,sdkVersion:profile.sdkVersion}, provenance: 'Nội dung thuyết minh tiếng Việt do Bảo tàng số Nét biên soạn; giọng AI Minh Đức (VieNeu-TTS). Video minh họa tĩnh, không phải tư liệu lịch sử.', resources }, null, 2) + '\n');
  console.log(`Verified ${resources.length} real resources; wrote ${path.join(samples, 'manifest.json')}`);
}

if (process.argv.includes('--finalize')) await finalize();
else await prepare();
