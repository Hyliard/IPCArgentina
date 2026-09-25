const BCRA_API_URL =
  "https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/27";

const TIMEOUT_MS = 15000;

export async function obtenerInflacion(desde, hasta) {
  const params = new URLSearchParams({ desde, hasta });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;

  try {
    response = await fetch(`${BCRA_API_URL}?${params}`, {
      signal: controller.signal,
    });
  } catch (error) {
    throw new Error(
      error.name === "AbortError"
        ? "El BCRA tardó demasiado en responder. Intenta nuevamente."
        : "No se pudo conectar con la API del BCRA."
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Error BCRA: ${response.status}`);
  }

  const data = await response.json();
  const detalle = data.results?.[0]?.detalle ?? [];

  return detalle
    .map((mes) => ({
      fecha: String(mes.fecha ?? "").slice(0, 10),
      valor: Number(mes.valor),
    }))
    .filter((mes) => mes.fecha && Number.isFinite(mes.valor))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}