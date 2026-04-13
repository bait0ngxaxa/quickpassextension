# Quick Pass Copy (Browser Extension)

ส่วนเสริมสำหรับเก็บข้อมูลล็อกอิน, API Key และ Secret ตามโดเมน และเรียกก๊อปปี้/เติมค่าได้ทันทีบนหน้าเว็บ โดยไม่ต้องสลับไป Notepad

## Tech
- Popup: Svelte + Vite
- Background/Content: Vanilla JavaScript (MV3)
- Security: Master Password + AES-GCM encryption

## เริ่มต้นใช้งาน
1. ติดตั้ง dependencies
   - `npm install`
2. build ไฟล์ extension
   - `npm run build`

## วิธีใช้งาน
1. เปิด `chrome://extensions`
2. เปิด Developer mode
3. กด Load unpacked แล้วเลือกโฟลเดอร์ `dist`
4. เปิด popup ครั้งแรก แล้วตั้ง `Master Password`
5. เพิ่มข้อมูล โดยเลือกประเภทได้ทั้ง `บัญชีล็อกอิน` หรือ `API Key / Secret`
6. เวลาอยู่หน้าเว็บที่ต้องกรอกฟอร์ม กด `Ctrl + Shift + C`
7. จะมีแผงลัดขึ้นมาให้เลือก
   - สำหรับบัญชีล็อกอิน: `คัดลอกผู้ใช้`, `คัดลอกรหัส`, `เติมผู้ใช้`, `เติมรหัส`
   - สำหรับ API/Secret: `คัดลอกชื่อคีย์`, `คัดลอกค่า Secret`, `เติมชื่อคีย์`, `เติมค่า Secret`
8. เมื่อข้อมูลเยอะ ใช้ตัวช่วยค้นหาได้ทั้งใน popup และแผงลัด:
   - Search แบบเรียลไทม์
   - แท็บ `ทั้งหมด / บัญชีล็อกอิน / API/Secret`
   - Filter `ทุกโดเมน / โดเมนนี้ / ข้ามโดเมน / ปักหมุด`

## หมายเหตุความปลอดภัย
- ข้อมูล credential ถูกเข้ารหัสก่อนเก็บใน `chrome.storage.local`
- คีย์ถอดรหัสอยู่ใน `chrome.storage.session` หลังปลดล็อก และถูกลบเมื่อกด `ล็อก Vault`

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
- `src/popup/vaultService.js` service สำหรับ auth/session/persistence
- `src/popup/vault.js` helper จัดการ encrypt/decrypt credential
- `src/shared/crypto.js` helper คริปโตพื้นฐาน (PBKDF2/AES-GCM)
- `scripts/copy-extension-files.mjs` คัดลอกไฟล์ static ไป `dist` หลัง build
