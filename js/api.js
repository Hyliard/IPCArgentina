const BCRA_API_URL =
  "https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/27";

export async function obtenerInflacion(desde, hasta) {
  const url = `${BCRA_API_URL}?desde=${desde}&hasta=${hasta}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Error BCRA: ${response.status}`);
  }

  const data = await response.json();

  return data.results?.[0]?.detalle ?? [];
}