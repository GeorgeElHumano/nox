# NOX · Crónicas del Paraguay

Juego de rol online ambientado en el Paraguay medieval y las leyendas guaraníes.

- `public/` — sitio web (portada), `jugar/` (el juego) y `cuenta/` (tienda, cuenta y administración)
- `functions/api/` — servidor: cuentas, guardado en la nube, tienda por transferencia y panel de administración
- `lib/catalog.js` — catálogo y precios de la tienda (se genera con `gencatalog.py`)
- `wrangler.toml` — configuración de Cloudflare Pages y la base de datos D1 (`DB`)

Se publica solo en Cloudflare Pages con cada cambio en la rama `main`.

Un juego de GeorgeElHumano · The BnKr Media
