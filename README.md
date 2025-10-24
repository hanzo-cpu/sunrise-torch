# Alarma Linterna — Sunrise (Web / PWA)
Funciona como sitio estático (GitHub Pages). En **Android Chrome** intentará encender la **linterna** (si el dispositivo/navegador lo permiten). En **iPhone/iOS**, por limitaciones del sistema, **no es posible activar la linterna desde la web**; se usa una pantalla blanca con brillo visual de amanecer + un tono de alarma como alternativa.

## Archivos
- `index.html` — interfaz
- `styles.css` — estilos
- `app.js` — lógica (programación, torch si se puede, fallback en iOS)
- `manifest.json` — para instalar como PWA
- `sw.js` — service worker sencillo (cache ligero)
  
## Uso
1. Sube estos archivos a un repositorio público en GitHub (rama `main`, carpeta raíz).
2. Activa **GitHub Pages**: Settings → Pages → Source: `main /(root)` → Save.
3. Abre la URL de Pages en tu iPhone/Android.
4. **Instala como PWA** (“Añadir a pantalla de inicio”).
5. Pulsa **Habilitar permisos** (desbloquea audio, wake lock y solicita cámara si procede).
6. Programa la hora de la alarma y deja la app **abierta en primer plano** (limitación de web móvil).
7. A la hora indicada, intentará:
   - Android: torch ON (si el navegador lo permite) + pantalla amanecer + tono creciente.
   - iPhone: pantalla amanecer + tono creciente (sin torch).

## Notas importantes
- Las páginas web **no pueden ejecutarse en segundo plano** de forma confiable en móviles. Debes mantener la app abierta.
- iOS **no permite** controlar la linterna desde Safari/PWA. Para linterna real en iPhone, usa **Atajos** con una Automatización de “Hora del día”.
- El control de `torch` via `MediaStreamTrack.applyConstraints({advanced:[{torch:true}]})` **no está disponible en todos los dispositivos Android**.

## Seguridad y batería
- La linterna puede calentar el dispositivo; úsala con moderación.
- Asegura buena carga de batería y prueba el **botón de prueba** antes de dormir.

¡Éxitos!
