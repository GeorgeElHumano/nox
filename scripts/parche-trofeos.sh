#!/bin/sh
# Notas del parche de trofeos con forma propia (20/11).
cd "$(dirname "$0")/.."
sh scripts/patch.sh "Trofeos con forma propia" \
 "Los trofeos de las bestias tienen ahora su propia forma según su nombre: corazones, cráneos, coronas, medallas, mechones, frascos, cristales y más" \
 "Ya no hay dos trofeos iguales: cada ojo, piel, colmillo, garra, escama, gota, cuerno y pluma tiene su diseño (ojo de víbora, piel con rosetas, cuerno de carnero, escama de obsidiana…)" \
 "Se ven así en la bolsa, en el baúl y al caer al piso"
