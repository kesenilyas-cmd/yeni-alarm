# Kilitliyken bildirim: kurulum (bir kerelik, ~10 dk)

## A. Cloudflare (ücretsiz)
1. cloudflare.com'da ücretsiz hesap aç.
2. **Workers & Pages > Create > Create Worker**. Adı: `hatirlatici`. **Deploy**'a bas.
3. **Edit code**'a gir, içindekini sil, `worker.js` dosyasının tamamını yapıştır, **Deploy**.
4. **Storage & Databases > KV > Create** ile `HAT` adında bir namespace oluştur.
5. Worker'a dön: **Settings > Bindings > Add > KV namespace**. Variable name: `HAT`, namespace: `HAT`. Kaydet.
6. **Settings > Triggers > Cron Triggers > Add**: `* * * * *` (her dakika). Kaydet.
7. Worker adresini kopyala (https://hatirlatici.XXXX.workers.dev).

## B. GitHub
`index.html`, `sw.js`, `manifest.json`, `icon.png` dosyalarını GitHub deposuna yükle (eskileri değiştir). Pages açık kalsın.

## C. iPhone (iOS 16.4+)
1. Safari'de sayfayı aç > **Paylaş > Ana Ekrana Ekle**.
2. Ana ekrandaki **Hatırlat** simgesinden aç (Safari'den değil).
3. ⚙︎ > sunucu adresini yapıştır > **Aç** > bildirim iznini ver > **Test**.

Artık hatırlatma zamanı gelince telefon kilitliyken de bildirim gelir.
