# DDC VS Code Activity Extension

Extension lokal untuk mengirim status **aktif** dan **sedang mengetik** dari VS Code
ke backend DDC Desktop (`http://127.0.0.1:5123`).

## Build
```powershell
cd ddc-desktop\vscode-extension
npm install
npm run build
```

## Jalankan (dev)
1. Buka folder `ddc-desktop/vscode-extension` di VS Code.
2. Tekan `F5` untuk menjalankan Extension Development Host.
3. Backend DDC harus aktif agar event terkirim.

## Konfigurasi
Di VS Code Settings:
- `ddcDesktop.backendUrl`
- `ddcDesktop.typingDebounceMs`
- `ddcDesktop.activeHeartbeatSeconds`
