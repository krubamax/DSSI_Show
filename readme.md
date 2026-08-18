📁 ไฟล์ทั้งหมดที่สร้างไว้
C:\Users\bghuo\Desktop\DSSI_Show\
│
├── server.js          ← Backend (Node.js + WebSocket)
├── package.json       ← Dependencies
│
└── public\
    ├── style.css      ← Design ทุกหน้า
    ├── warp.html      ← หน้าฟอร์มส่งรูป (/warp)
    ├── admin.html     ← หน้าแอดมิน (/admin)
    ├── display.html   ← หน้าจอใหญ่ (/display)
    └── wall.html      ← Wall mode (/wall)
▶️ วิธีรัน (ทุกครั้งก่อนงาน)
เปิด 2 PowerShell พร้อมกัน:

หน้าต่างที่ 1 — รัน Server
powershell
cd C:\Users\bghuo\Desktop\DSSI_Show
node server.js
หน้าต่างที่ 2 — รัน Cloudflare Tunnel (URL ออนไลน์)
powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel run --protocol http2 --token eyJhIjoiMWExNWY2NTJkMmRjNWI4YmQ4YjI3ZWFlZTcwYzc2ZjEiLCJ0IjoiYzgzMmU3ZTktZmIzZS00NjA4LTg0NjgtMTc4OGExYmQ3OTY4IiwicyI6IlpETm1PRGcyWXpZdFpXTTJOaTAwWVRNM0xXRmtOekF0WVRVeE1EWTNaV0poT0ROaSJ9
🌐 URL ที่ใช้งาน
หน้า	URL สำหรับคนในงาน (Cloudflare)	URL ภายในเครื่อง
📝 ฟอร์ม	https://scholarship-vocals-tags-fragrance.trycloudflare.com/warp	localhost:3000/warp
🛡 Admin	https://xxx.cfargotunnel.com/admin	localhost:3000/admin
📺 จอใหญ่	localhost:3000/display	localhost:3000/display
🖼 Wall	localhost:3000/wall	localhost:3000/wall
💡 จอใหญ่/โปรเจคเตอร์ใช้ localhost ได้เลย ไม่ต้องผ่าน internet

⚠️ อย่าปิด 2 PowerShell นั้น ตลอดช่วงงาน ถ้าปิดระบบจะหยุดทำงาน

ฟอร์ม: https://franchise-disable-circus-span.trycloudflare.com/warp #เปลี่ยน url ทุกครั้งที่รัน Quick Tunnel ใหม่
Admin: https://franchise-disable-circus-span.trycloudflare.com/admin