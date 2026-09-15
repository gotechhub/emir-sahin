@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================================
echo   Emir Web Sitesi - Bilgisayari GitHub'a baglama (tek seferlik)
echo ================================================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo HATA: Git kurulu degil.
  echo Once https://git-scm.com/download/win adresinden Git'i kur, sonra bu dosyayi tekrar calistir.
  echo.
  pause
  exit /b 1
)

echo [1/5] Windows giris-bilgisi saklama sorunu kalici olarak duzeltiliyor...
git config --global credential.credentialStore dpapi
git config --global credential.helper manager

echo [2/5] Klasor GitHub deposuna baglaniyor...
if not exist ".git" git init -b main
git remote remove origin >nul 2>nul
git remote add origin https://github.com/gotechhub/emir-sahin.git
git config user.name "gotechhub"
git config user.email "selcuk.gonder@gmail.com"

echo [3/5] Canli (internetteki) surum aliniyor...
git fetch origin
if errorlevel 1 (
  echo.
  echo HATA: GitHub'a baglanilamadi. Tarayicida GitHub girisi acilabilir; giris yapip
  echo bu dosyayi tekrar calistir.
  echo.
  pause
  exit /b 1
)

echo.
echo [4/5] DIKKAT: Bu klasor, internetteki CANLI surumle birebir ayni hale getirilecek.
echo Bu klasorde henuz gonderilmemis yerel bir degisiklik varsa uzerine yazilabilir.
echo Devam etmek icin bir tusa bas; vazgecmek icin bu pencereyi kapat.
pause
git reset --hard origin/main
git branch --set-upstream-to=origin/main main >nul 2>nul

echo.
echo [5/5] TAMAM - Bilgisayarin artik GitHub'a bagli.
echo.
echo Bundan sonra bir degisiklik gondermek icin: GONDER.bat dosyasina cift tikla.
echo (Ilk gonderimde GitHub tarayicida bir kez giris isteyebilir; sonra hatirlar.)
echo.
pause
