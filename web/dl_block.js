/* ===== Enlaces de descarga ===== */
const VERSION='1.0.6';
const REL='https://github.com/GeorgeElHumano/nox/releases/latest/download/';
const LINKS={android:REL+'NOX.apk',windows:REL+'NOX-Instalador.exe',mac:REL+'NOX-Mac-AppleSilicon.zip',macIntel:REL+'NOX-Mac-Intel.zip',web:'jugar/'};
const PREVIEW=/claude/.test(location.hostname);
const GAME_PREVIEW='https://claude.ai/artifact/DFUdRNZw2EpYzqMqfuYVtU';
const webURL=()=>PREVIEW?GAME_PREVIEW:new URL(LINKS.web,location.href).href;
/* conteo de descargas: cada clic en un enlace con data-track se anota en el servidor (api/dl/<plataforma>) */
const track=id=>{if(PREVIEW||!id)return;try{const u=new URL('api/dl/'+id,location.href).href;if(!(navigator.sendBeacon&&navigator.sendBeacon(u)))fetch(u,{method:'POST',keepalive:true}).catch(()=>{});}catch(e){}};
document.addEventListener('click',e=>{const t=e.target.closest('[data-track]');if(t)track(t.dataset.track);},true);
const ICONS={
  web:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.8 2.6 15.2 0 18M12 3c-2.6 2.8-2.6 15.2 0 18"/></svg>',
  android:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M10.5 18.5h3"/></svg>',
  windows:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
  mac:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="11" rx="1.8"/><path d="M2 19h20l-1.5-4h-17z"/></svg>',
  ios:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6.5" y="2" width="11" height="20" rx="3"/><path d="M11 5h2"/><path d="M12 16.5v-6M9.5 13l2.5-2.5 2.5 2.5"/></svg>'
};
const PLAT=[
 {id:'web',name:'Navegador',req:'Chrome, Edge, Safari o Firefox',sub:'Sin instalar nada',btn:'Jugar ahora',
  steps:['Tocá <b>Jugar ahora</b>. El juego se abre en una pestaña nueva.','Entrá con tu cuenta o tocá <b>Crear cuenta</b>. Es la misma cuenta de la tienda.','Elegí tu raza, tu rostro y el nombre de tu personaje.','En PC, <b>F11</b> pone el navegador en pantalla completa. En el celular se ve mejor acostado.'],
  note:'Funciona en PC, Mac, celulares y tablets. La primera vez tarda un poco más porque descarga los modelos del juego.'},
 {id:'android',name:'Android',req:'Chrome en Android',sub:'Se instala desde Chrome',btn:'Abrir el juego',
  steps:['Tocá <b>Abrir el juego</b> desde el celular, en <b>Chrome</b>. Se abre con una guía.','Tocá <b>Instalar NOX</b>. Si no aparece, abrí el menú <b>⋮</b> de Chrome y tocá <b>Agregar a la pantalla principal</b> y después <b>Instalar</b>.','Abrí NOX desde su ícono: se ve a pantalla completa y se actualiza solo.'],
  note:'Así siempre tenés la última versión, sin descargar archivos.'},
 {id:'windows',name:'Windows',req:'Windows 10 y 11 · 64 bits',sub:'Instalador, unos 140 MB',btn:'Descargar el instalador',
  steps:['Descargá <b>NOX-Instalador.exe</b> y abrilo.','Si aparece <b>Windows protegió tu PC</b>, tocá <b>Más información</b> y después <b>Ejecutar de todas formas</b>.','Se instala solo, sin pedir permisos de administrador, y deja el acceso directo <b>NOX</b> en el escritorio y en el menú Inicio.','Abrí NOX desde ese acceso directo. <b>F11</b> alterna pantalla completa.'],
  note:'El aviso de Windows aparece porque el juego todavía no tiene firma digital. Con internet, NOX abre siempre la última versión. Para quitarlo: Configuración → Aplicaciones → NOX → Desinstalar.'},
 {id:'mac',name:'Mac',req:'macOS 11 o superior',sub:'Apple Silicon e Intel',btn:'Mac con Apple Silicon (M1, M2, M3, M4)',btn2:'Mac con Intel',
  steps:['Elegí tu tipo de Mac: abrí el <b>menú Apple → Acerca de esta Mac</b>. Si dice <b>Chip Apple M</b>, bajá la de Apple Silicon. Si dice <b>Intel</b>, la de Intel.','Hacé doble clic en el .zip descargado para descomprimirlo. Aparece <b>NOX.app</b>.','Arrastrá <b>NOX.app</b> a la carpeta <b>Aplicaciones</b>.','Abrí NOX. La primera vez macOS avisa que no puede verificar al desarrollador: tocá <b>Listo</b>.','Andá a <b>Ajustes del Sistema</b>, entrá en <b>Privacidad y seguridad</b>, bajá hasta el mensaje de NOX y tocá <b>Abrir igualmente</b>.','Confirmá con tu contraseña. Desde ahí NOX abre normal, como cualquier app.'],
  note:'El aviso aparece porque NOX todavía no está firmado por Apple. Solo hay que aprobarlo una vez.'},
 {id:'ios',name:'iPhone y iPad',req:'Safari · sin App Store',sub:'Se instala desde el navegador',btn:'Abrir el juego',
  steps:['En <b>Safari</b>, tocá el botón <b>Agregar a inicio</b> de abajo: se abre el juego con una guía.','Tocá <b>Compartir</b> en Safari: el cuadrado con una flecha hacia arriba (en iOS 26 está dentro del menú <b>···</b>).','Bajá en el menú y tocá <b>Agregar a inicio</b>.','Tocá <b>Agregar</b>. El ícono de NOX queda en tu pantalla de inicio.','Abrí NOX desde ese ícono: se ve a pantalla completa y se actualiza solo.'],
  note:'Por ahora NOX no está en la App Store, así que en iPhone y iPad se instala de esta forma. Tiene que ser desde Safari: Chrome en iPhone no muestra la opción.',copy:true}
];
