# Emir Selahattin Şahin — v1

Temiz portfolyo sürümü. `site/index.html` ziyaretçi sitesi; `admin/index.html` ayrı yönetim panelidir. Panel ziyaretçi sitesinde bağlantı olarak görünmez ve Vercel yayınında yalnızca gizli `/admin/` yolu üzerinden açılır.

## Videolar

49 video, PPT içindeki dosyalardan birebir çıkarılmıştır: **362.940.939 bayt**. Çözünürlük, ses, kare hızı, codec ve dosya uzantıları değiştirilmemiştir. Her dosyanın SHA-256 özeti `verification/original-videos.json` içindedir. Bu özetler PPT içeriğiyle doğrulanmıştır. Kaynak PPT'nin zaten düşük çözünürlüklü videoları kendi özgün boyutundadır.

`site/videos/` tek asıl video koleksiyonudur. `dist/` otomatik üretilen yayın çıktısıdır. Sites'ın dosya sınırını aşan üç video yayın çıktısında `dist/chunks/` altında kayıpsız veri parçalarına ayrılır; bunlar video değildir ve oynatıcı bunları birebir birleştirir. Hiçbir sıkıştırma veya yeniden kodlama yapılmaz. Büyük videoda indirme ilerlemesi gösterilir. Vercel çıktısı orijinal dosyaları doğrudan kullanır.

## Yerel kullanım

`npm start` komutuyla açılır. Portfolyo: http://127.0.0.1:8766/ — ayrı panel: http://127.0.0.1:8766/admin/.

Panel değişiklikleri önce aynı tarayıcıdaki yerel taslağa kaydedilir. Portföy düzenleyicide kapak görseli ve birden fazla video dosyası içe aktarılabilir; dosyalar `IndexedDB` içinde Blob olarak, yeniden kodlanmadan saklanır. Dosya boyutu için uygulama içi MB kesintisi yoktur; gerçek kullanılabilir alan tarayıcının disk kotasına bağlıdır. Video satırlarındaki `↑` ve `↓` düğmeleri sırayı değiştirir; `×` ile mevcut videolar çıkarılabilir, yeni dosyalar aynı ekrandan eklenebilir. Supabase bağlantısı kurulduğunda senkron işlemi içerik ve medya dosyalarını ortak kayda aktarır.

Supabase ortam değişkenleri tanımlı değilse panel yerel taslak modunda çalışır. Vercel’de tanımlandığında giriş Supabase Auth ile doğrulanır, `site_content` kaydı güncellenir ve Storage’daki medya URL’leri ziyaretçi sitesine aktarılır.

## Yayın

`npm run build`: orijinalleri doğrular ve yayın çıktısını `dist/` altında hazırlar.
`npm run build:vercel`: orijinal dosyaları doğrudan kullanan Vercel çıktısı üretir.
Vercel proje kökü bu `v1` klasörüdür; `vercel.json` build/output ayarlarını içerir.

Yayın adresindeki yönetim paneli: `https://alan-adin.example/admin/`. Supabase ayarları yoksa içerik taslakları tarayıcıda tutulur; Supabase ayarlarıyla birlikte Auth, veritabanı ve Storage kullanılır.

Supabase bağlantısı için Vercel proje ayarlarında Production ve Preview ortamlarına `SUPABASE_URL` ve `SUPABASE_PUBLISHABLE_KEY` değişkenlerini ekleyip yeniden deploy et. `portfolio-media` bucket’ını oluşturduktan sonra `supabase/storage-policies.sql` ve mevcut `site_content` tablosunun API yetkileri için `supabase/fix-permissions.sql` dosyalarını SQL Editor’da çalıştır. Admin girişi Supabase Auth’ta `respongo@gmail.com` kullanıcısına bağlanır; panelde kullanıcı adı olarak `admin` yazılabilir.

`node scripts/verify.mjs` ile tüm orijinaller, proje bağlantıları ve ziyaretçi sayfasında admin bağlantısı bulunmadığı kontrol edilir.
