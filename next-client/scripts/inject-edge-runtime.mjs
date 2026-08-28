// scripts/inject-edge-runtime.mjs
//
// Mục đích: inject `export const runtime = 'edge'` vào các Server Component page
// trước khi chạy `npx @cloudflare/next-on-pages`.
//
// Chỉ chạy trong CI/CD Cloudflare Pages — KHÔNG ảnh hưởng `next dev` local.
// Các file source KHÔNG chứa dòng này → local luôn dùng Node runtime, không lỗi.

import { readFileSync, writeFileSync } from 'fs';

const EDGE_LINE = `export const runtime = 'edge';`;

// Thêm tất cả dynamic route (ƒ) từ build output vào đây
// Xem trong build log phần "Route (app)" — cột ƒ (Dynamic)
const TARGET_FILES = [
  'src/app/page.tsx', // /index
  'src/app/bai-viet/page.tsx', // /bai-viet
  'src/app/bai-viet/[slug]/page.tsx', // /bai-viet/[slug]
  'src/app/vr/page.tsx' // /vr
];

let injected = 0;
let skipped = 0;

for (const filePath of TARGET_FILES) {
  try {
    const content = readFileSync(filePath, 'utf-8');

    // Đã có → bỏ qua
    if (content.includes(EDGE_LINE)) {
      console.log(`⏭  Already done:  ${filePath}`);
      skipped++;
      continue;
    }

    // Client Component → không inject (edge runtime chỉ áp dụng cho Server Component)
    const firstLine = content.trimStart().slice(0, 12);
    if (firstLine.includes('use client')) {
      console.log(`⏭  Client comp, skip: ${filePath}`);
      skipped++;
      continue;
    }

    // Inject ngay trước dòng import đầu tiên
    const importIndex = content.indexOf('\nimport ');
    if (importIndex === -1) {
      // Không tìm thấy import → inject đầu file
      writeFileSync(filePath, EDGE_LINE + '\n\n' + content, 'utf-8');
    } else {
      const before = content.slice(0, importIndex + 1); // giữ newline trước import
      const after = content.slice(importIndex + 1);
      writeFileSync(filePath, before + EDGE_LINE + '\n' + after, 'utf-8');
    }

    console.log(`✅ Injected:       ${filePath}`);
    injected++;
  } catch (err) {
    console.error(`❌ Failed: ${filePath} — ${err.message}`);
    process.exit(1);
  }
}

console.log(`\n⚡ Done. Injected: ${injected}, Skipped: ${skipped}`);
