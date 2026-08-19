# Calculadora de Ajuste por IPC 🇦🇷

Aplicación web para calcular ajustes periódicos utilizando la inflación mensual publicada por el Banco Central de la República Argentina (BCRA).

## Funcionalidades

- Consulta automática de inflación mensual desde la API del BCRA.
- Cálculo de IPC acumulado mediante composición mensual.
- Cálculo del aumento en pesos.
- Cálculo del nuevo monto actualizado.
- Selección de períodos trimestrales.
- Historial persistente mediante `localStorage`.
- Validación de disponibilidad de los tres meses del período.

## Tecnologías

- HTML
- CSS
- JavaScript
- BCRA API v4
- GitHub Pages

## Fuente de datos

Los valores de inflación mensual se obtienen desde la API pública de Estadísticas Monetarias del BCRA.

Variable utilizada:

- `idVariable: 27`
- Inflación mensual
- Unidad: porcentaje

## Cálculo

Las variaciones mensuales se componen:

```text
Factor acumulado =
(1 + IPC1 / 100) ×
(1 + IPC2 / 100) ×
(1 + IPC3 / 100)

IPC acumulado =
(Factor acumulado - 1) × 100


Ejemplo
Para:
Abril: 2,6 %
Mayo: 2,1 %
Junio: 1,9 %
IPC acumulado:
6,7449 %
Si el monto anterior es:
$255.561,00
el nuevo monto resulta aproximadamente:
$272.798,43
Autor
Luis Gerardo Martinez Hernandez
GitHub: Hyliard