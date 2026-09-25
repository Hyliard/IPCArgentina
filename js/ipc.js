export function calcularIPC(meses) {
  if (!Array.isArray(meses) || meses.length === 0) {
    return 0;
  }

  const factorAcumulado = meses.reduce((factor, mes) => {
    return factor * (1 + mes.valor / 100);
  }, 1);

  return (factorAcumulado - 1) * 100;
}

export function redondearMonto(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function calcularNuevoMonto(montoBase, ipcAcumulado) {
  return redondearMonto(montoBase * (1 + ipcAcumulado / 100));
}