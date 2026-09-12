# Emir Selahattin Şahin — v1

Temiz portfolyo sürümü. `site/index.html` ziyaretçi sitesi; `admin/index.html` ayrı yerel yönetim panelidir. Yönetim paneli yayın paketine dahil edilmez ve ziyaretçi sitesinde bağlantısı yoktur.

## Videolar

49 video, PPT içindeki dosyalardan birebir çıkarılmıştır: **362.940.939 bayt**. Çözünürlük, ses, kare hızı, codec ve dosya uzantıları değiştirilmemiştir. Her dosyanın SHA-256 özeti `verification/original-videos.json` içindedir. Bu özetler PPT içeriğiyle doğrulanmıştır. Kaynak PPT'nin zaten düşük çözünürlüklü videoları kendi özgün boyutundadır.

`site/videos/` tek asıl video koleksiyonudur. `dist/` otomatik üretilen yayın çıktısıdır. Sites'ın dosya sınırını aşan üç video yayın çıktısında `dist/chunks/` altında kayıpsız veri parçalarına ayrılır; bunlar video değildir ve oynatıcı bunları birebir birleştirir. Hiçbir sıkıştırma veya yeniden kodlama yapılmaz. Büyük videoda indirme ilerlemesi gösterilir. Vercel çıktısı orijinal dosyaları doğrudan kullanır.

## Yerel kullanım

`npm start` komutuyla açılır. Portfolyo: http://127.0.0.1:8766/ — ayrı panel: http://127.0.0.1:8766/admin/.

Panel değişiklikleri aynı tarayıcıdaki yerel taslaktır. Portföy düzenleyicide kapak görseli ve birden fazla video dosyası içe aktarılabilir; dosyalar `IndexedDB` içinde Blob olarak, yeniden kodlanmadan saklanır. Dosya boyutu için uygulama içi MB kesintisi yoktur; gerçek kullanılabilir alan tarayıcının disk kotasına bağlıdır. Video satırlarının yanındaki `×` ile mevcut videolar çıkarılabilir, yeni dosyalar aynı ekrandan eklenebilir. İçe aktarılan içerikler aynı tarayıcıdaki ziyaretçi sayfasında da çalışır.

Bu yerel taslak canlı ziyaretçilere otomatik yayımlanmaz; Supabase ve yetkili kullanıcı kurulumu tamamlanmış değildir. Sunucu kimlik doğrulaması olmadan paneli internete açmayın. Bu sürüm yalnızca ziyaretçi sitesini yayımlar.

## Yayın

`npm run build`: orijinalleri doğrular ve Sites çıktısını `dist/` altında hazırlar.
`npm run build:vercel`: orijinal dosyaları doğrudan kullanan Vercel çıktısı üretir.
Vercel proje kökü bu `v1` klasörüdür; `vercel.json` build/output ayarlarını içerir.

`node scripts/verify.mjs` ile tüm orijinaller, proje bağlantıları ve yönetim panelinin yayın dışında kaldığı kontrol edilir.
