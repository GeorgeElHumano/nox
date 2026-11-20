#!/bin/sh
# Notas del parche de domos de luz, bordes de la bolsa y descarga completa (rama kerana). Se corre recién al publicar, con el OK del dueño.
cd "$(dirname "$0")/.."
sh scripts/patch.sh "Domos de luz y bolsa renovada" \
 "Cerro Tres Kandú: cada altar tiene ahora un domo de luz con niebla del color de su jefe, y el rayo al cielo sale desde la cima del domo" \
 "Bolsa: las piezas Míticas brillan en celeste y verde agua, y las del conjunto NOX llevan un marco rojo con filete de oro" \
 "Arreglo: la descripción de los objetos al pasar el mouse dejaba de aparecer después de arrastrar algo en la bolsa o el baúl" \
 "Nuevo: al entrar podés descargar todo el juego de una vez (unos 80 MB, mejor con wifi) para evitar pantallas de carga largas y tirones al cambiar de mapa; se puede jugar mientras baja"
