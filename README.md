# Quick Pass Copy (Browser Extension)

ส่วนเสริมสำหรับเก็บข้อมูลล็อกอิน, API Key และ Secret ตามโดเมน และเรียกก๊อปปี้/เติมค่าได้ทันทีบนหน้าเว็บ โดยไม่ต้องสลับไป Notepad

## Tech
- Popup: Svelte + Vite
- Background/Content: Vanilla JavaScript (MV3)
- Security: Master Password + AES-GCM encryption

## เริ่มต้นใช้งาน
1. ติดตั้ง dependencies
   - `npm install`
2. สร้างไฟล์ `.env` จาก [\.env.example](C:\Users\Bait0ng\Desktop\pass_extension\.env.example)
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. build ไฟล์ extension
   - `npm run build`

## Supabase Setup (Step 1)
1. เปิด Supabase `SQL Editor`
2. รันไฟล์ [001_vault_items.sql](C:\Users\Bait0ng\Desktop\pass_extension\supabase\001_vault_items.sql)
3. รันไฟล์ [002_vault_security_profiles.sql](C:\Users\Bait0ng\Desktop\pass_extension\supabase\002_vault_security_profiles.sql)
4. ต้องเห็นตาราง `public.vault_items` และ `public.vault_security_profiles` พร้อม policy ครบ

## Supabase Setup (Step 2)
1. ตั้งค่า `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ในไฟล์ `.env`
2. รัน `npm run build` ใหม่ทุกครั้งหลังแก้ `.env`
3. เปิด popup ของ extension แล้วล็อกอินด้วย OAuth ของ Supabase Auth
4. ต้องเห็นสถานะ `Login อยู่: <email>`

### OAuth เพิ่มเติม
1. ไปที่ Supabase `Authentication > Providers` แล้วเปิด provider ที่ต้องการ (เช่น Google/GitHub)
2. ในช่อง Redirect URLs ของ provider ให้เพิ่มค่า:
   - `https://<EXTENSION_ID>.chromiumapp.org/`
3. กลับมาที่ popup แล้วเลือก provider และกด `ล็อกอินด้วย OAuth`

## Cloud-First
1. ข้อมูลรายการทั้งหมดอ่าน/เขียนที่ Supabase เป็นหลัก
2. popup และ quick panel (`Ctrl + Shift + C`) จะโหลดข้อมูลจาก DB โดยตรง
3. local `credentials` ใช้แค่ migration ครั้งเดียวจากเวอร์ชันเก่า แล้วจะถูกลบทิ้ง
4. local ที่ยังคงอยู่มีเฉพาะ metadata ที่จำเป็นต่อการใช้งาน:
   - Supabase auth session
   - verifier ของ Master Password
   - session key หลังปลดล็อก

## วิธีใช้งาน
1. เปิด `chrome://extensions`
2. เปิด Developer mode
3. กด Load unpacked แล้วเลือกโฟลเดอร์ `dist`
4. เปิด popup แล้วตั้ง `Master Password`
5. ล็อกอิน Supabase ด้วย OAuth
6. เพิ่มข้อมูล โดยเลือกประเภทได้ทั้ง `บัญชีล็อกอิน` หรือ `API Key / Secret`
7. เวลาอยู่หน้าเว็บที่ต้องกรอกฟอร์ม กด `Ctrl + Shift + C`
8. จะมีแผงลัดขึ้นมาให้เลือก
   - สำหรับบัญชีล็อกอิน: `คัดลอกผู้ใช้`, `คัดลอกรหัส`, `เติมผู้ใช้`, `เติมรหัส`
   - สำหรับ API/Secret: `คัดลอกชื่อคีย์`, `คัดลอกค่า Secret`, `เติมชื่อคีย์`, `เติมค่า Secret`
9. เมื่อข้อมูลเยอะ ใช้ตัวช่วยค้นหาได้ทั้งใน popup และแผงลัด:
   - Search แบบเรียลไทม์
   - แท็บ `ทั้งหมด / บัญชีล็อกอิน / API/Secret`
   - Filter `ทุกโดเมน / โดเมนนี้ / ข้ามโดเมน / ปักหมุด`

## หมายเหตุความปลอดภัย
- ข้อมูลรายการถูกเข้ารหัสฝั่ง client ก่อนเก็บลง Supabase
- คีย์ถอดรหัสอยู่ใน `chrome.storage.session` หลังปลดล็อก และถูกลบเมื่อกด `ล็อก Vault`
- verifier/security profile ถูก sync ไปที่ `vault_security_profiles` บน Supabase ด้วย
- ค่า `Supabase URL` และ `Anon Key` ถูกฝังจาก `.env` ตอน build ไม่ได้กรอกใน UI

## โครงสร้าง
- `manifest.json` ตั้งค่า Extension (MV3)
- `src/background.js` ตัว orchestrator ของ background
- `src/background/*` โมดูล service สำหรับ tab/action/credential
- `src/content.js` ตัว orchestrator ของแผงลัดบนหน้าเว็บ
- `src/content/*` โมดูลแยก concerns (`api`, `render`, `state`, `utils`, `messages`)
- `src/popup/App.svelte` หน้า popup แบบ Svelte
- `src/popup/main.js` จุดเริ่มต้น popup
- `src/popup/constants.js` ค่าคงที่สำหรับ type/tab/filter
- `src/popup/form.js` helper สำหรับ form/payload/view model
- `src/popup/listing.js` helper สำหรับ filter/sort/group รายการ
- `src/popup/vaultService.js` service สำหรับ auth/session/local security mirror
- `src/popup/vault.js` helper จัดการ encrypt/decrypt credential
- `src/shared/crypto.js` helper คริปโตพื้นฐาน (PBKDF2/AES-GCM)
- `src/supabase/vaultStore.js` service สำหรับอ่าน/เขียน vault items กับ Supabase
- `src/supabase/securityStore.js` service สำหรับอ่าน/เขียน security profile กับ Supabase
- `scripts/copy-extension-files.mjs` คัดลอกไฟล์ static ไป `dist` หลัง build
