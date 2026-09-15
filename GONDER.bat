@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================================
echo   Emir Web Sitesi - Degisiklikleri yayina gonder
echo ================================================================
echo.

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
  echo HATA: Bu klasor henuz GitHub'a bagli degil.
  echo Once 1-BAGLA-KUR.bat dosyasina cift tikla.
  echo.
  pause
  exit /b 1
)

echo Degisiklikler kaydediliyor...
git add -A
git commit -m "Site guncelleme %date% %time%" >nul 2>nul

echo Sunucudaki son surumle esitleniyor...
git pull --rebase origin main
if errorlevel 1 (
  echo.
  echo UYARI: Esitlemede bir sorun cikti. Ekran goruntusunu Claude'a gonder.
  echo.
  pause
  exit /b 1
)

echo GitHub'a gonderiliyor...
git push origin main
if errorlevel 1 (
  echo.
  echo UYARI: Gonderim tamamlanamadi. (Ilk seferde GitHub girisi acilmis olabilir.)
  echo Ekran goruntusunu Claude'a gonder.
  echo.
  pause
  exit /b 1
)

echo.
echo TAMAM - Gonderildi. Vercel birkac dakika icinde canliya alir.
echo Canli site: https://www.emrsahin.com
echo.
pause
