Windows/PowerShell commands for this project:
- List files: Get-ChildItem -Force
- Show tree recursively: Get-ChildItem -Recurse
- Quick file contents: Get-Content <path> -Encoding UTF8
- Install dependencies: npm install
- Build extension to dist: npm run build
- Watch build output: npm run dev
- Load extension: chrome://extensions -> Load unpacked -> dist