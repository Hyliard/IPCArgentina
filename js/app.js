import { obtenerInflacion } from "./api.js";
import { calcularIPC, calcularNuevoMonto, redondearMonto } from "./ipc.js";

const montoBaseInput = document.getElementById("montoBase");
const mesInicioSelect = document.getElementById("mesInicio");
const anioInicioSelect = document.getElementById("anioInicio");
const cantidadMesesSelect = document.getElementById("cantidadMeses");
const periodoResumen = document.getElementById("periodoResumen");

const calcularBtn = document.getElementById("calcularBtn");
const guardarBtn = document.getElementById("guardarBtn");
const borrarHistorialBtn = document.getElementById("borrarHistorialBtn");

const resultadoSection = document.getElementById("resultado");
const detalleMeses = document.getElementById("detalleMeses");

const montoAnteriorResultado = document.getElementById(
  "montoAnteriorResultado"
);

const ipcResultado = document.getElementById("ipcResultado");
const aumentoResultado = document.getElementById("aumentoResultado");

const nuevoMontoResultado = document.getElementById(
  "nuevoMontoResultado"
);

const historialContainer = document.getElementById("historial");
const historialManualForm = document.getElementById("historialManualForm");
const montoAbonadoAutomatico = document.getElementById("montoAbonadoAutomatico");
const fechaPagoAutomatico = document.getElementById("fechaPagoAutomatico");
const exportarHistorialBtn = document.getElementById("exportarHistorialBtn");
const importarHistorialBtn = document.getElementById("importarHistorialBtn");
const importarHistorialInput = document.getElementById("importarHistorialInput");

const STORAGE_KEY = "ipcAdjustmentHistory";
const INITIALIZED_KEY = "ipcAdjustmentHistoryInitialized";
const PAGOS_INICIALES = [
  { fechaPago: "2026-05-07", montoAbonado: 300282 },
  { fechaPago: "2026-06-06", montoAbonado: 300282 },
  { fechaPago: "2026-07-03", montoAbonado: 300282 },
  {
    fechaPago: "2026-08-05",
    montoAbonado: 339918,
    notas: "Composición pendiente de reconstruir; puede incluir una regularización anterior.",
  },
];

let ultimoCalculo = null;

const formatterARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

const formatterPorcentaje = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

function esNumero(valor) {
  return typeof valor === "number" && Number.isFinite(valor);
}

function numeroOpcional(valor) {
  return valor === "" ? null : Number(valor);
}

function formatearMonto(valor) {
  return esNumero(valor) ? formatterARS.format(valor) : "Pendiente";
}

function formatearPorcentaje(valor) {
  return esNumero(valor) ? `${formatterPorcentaje.format(valor)} %` : "Pendiente";
}

function fechaLocal(fecha) {
  if (!fecha) return "Fecha pendiente";
  const date = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "Fecha inválida" : date.toLocaleDateString("es-AR");
}

function escaparHTML(texto = "") {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

const nombresMeses = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function pad(numero) {
  return String(numero).padStart(2, "0");
}

function generarSelectoresPeriodo() {
  nombresMeses.forEach((nombre, indice) => {
    mesInicioSelect.add(new Option(nombre, indice + 1));
  });

  const anioActual = new Date().getFullYear();
  for (let anio = anioActual; anio >= anioActual - 10; anio--) {
    anioInicioSelect.add(new Option(anio, anio));
  }

  seleccionarPeriodoPorDefecto();
  actualizarResumenPeriodo();
}

// Defaults to the months ending last month, the most recent that may already be published.
function seleccionarPeriodoPorDefecto() {
  const hoy = new Date();
  const inicio = new Date(
    hoy.getFullYear(),
    hoy.getMonth() - Number(cantidadMesesSelect.value),
    1
  );

  mesInicioSelect.value = inicio.getMonth() + 1;
  anioInicioSelect.value = inicio.getFullYear();
}

function obtenerPeriodo() {
  const anio = Number(anioInicioSelect.value);
  const mes = Number(mesInicioSelect.value);
  const cantidad = Number(cantidadMesesSelect.value);

  const inicio = new Date(anio, mes - 1, 1);
  const fin = new Date(anio, mes - 1 + cantidad, 0);

  const iso = (fecha) =>
    `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
  const nombreMes = (fecha) =>
    fecha.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  return {
    cantidad,
    fin,
    desde: iso(inicio),
    hasta: iso(fin),
    nombre: cantidad === 1
      ? nombreMes(inicio)
      : `${nombreMes(inicio)} - ${nombreMes(fin)}`,
  };
}

function actualizarResumenPeriodo() {
  const periodo = obtenerPeriodo();
  periodoResumen.textContent =
    `Se usará el IPC de ${periodo.nombre} (${periodo.cantidad} ${periodo.cantidad === 1 ? "mes" : "meses"}).`;
}

function obtenerNombreMes(fecha) {
  const [anio, mes] = fecha.split("-");

  const fechaLocal = new Date(
    Number(anio),
    Number(mes) - 1,
    1
  );

  return fechaLocal.toLocaleDateString(
    "es-AR",
    {
      month: "long",
      year: "numeric",
    }
  );
}

function ordenarMeses(meses) {
  return [...meses].sort(
    (a, b) =>
      new Date(a.fecha) -
      new Date(b.fecha)
  );
}

function mostrarDetalleMeses(meses) {
  detalleMeses.innerHTML = "";

  ordenarMeses(meses).forEach((mes) => {
    const fila =
      document.createElement("div");

    fila.classList.add("mes");

    fila.innerHTML = `
      <span>
        ${obtenerNombreMes(mes.fecha)}
      </span>

      <strong>
        ${formatterPorcentaje.format(
          mes.valor
        )} %
      </strong>
    `;

    detalleMeses.appendChild(fila);
  });
}

function obtenerHistorial() {
  const historialGuardado =
    localStorage.getItem(
      STORAGE_KEY
    );

  if (!historialGuardado) {
    return [];
  }

  try {
    const historial = JSON.parse(historialGuardado);
    if (!Array.isArray(historial)) return [];

    let faltabanIds = false;
    historial.forEach((registro, indice) => {
      if (!registro.id) {
        registro.id = `legacy-${Date.now()}-${indice}`;
        faltabanIds = true;
      }
    });
    if (faltabanIds) guardarHistorial(historial);

    return historial;
  } catch {
    return [];
  }
}

function guardarHistorial(historial) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(historial)
  );
}

function inicializarPagosConocidos() {
  if (localStorage.getItem(STORAGE_KEY) !== null || localStorage.getItem(INITIALIZED_KEY)) return;

  guardarHistorial(PAGOS_INICIALES.map((pago) => ({
    id: `inicial-${pago.fechaPago}`,
    tipo: "manual",
    periodoIPC: null,
    montoAnterior: null,
    meses: [],
    ipcAcumulado: null,
    aumento: null,
    nuevoMonto: null,
    diferencia: null,
    ...pago,
    fechaRegistro: new Date().toISOString(),
  })));
  localStorage.setItem(INITIALIZED_KEY, "1");
}

function renderizarHistorial() {
  const historial =
    obtenerHistorial();

  historialContainer.innerHTML = "";

  if (historial.length === 0) {
    historialContainer.innerHTML = `
      <p class="empty">
        Todavía no hay ajustes guardados.
      </p>
    `;

    return;
  }

  historial
    .slice()
    .sort((a, b) => String(b.fechaPago || b.fechaCalculo || "").localeCompare(String(a.fechaPago || a.fechaCalculo || "")))
    .forEach((ajuste) => {
      const item =
        document.createElement("div");

      item.classList.add(
        "historial-item"
      );

      const tipo = ajuste.tipo === "manual" ? "Histórico / manual" : "Automático BCRA";
      const periodo = ajuste.periodoIPC || ajuste.nombreTrimestre || "Período pendiente";
      const meses = Array.isArray(ajuste.meses) && ajuste.meses.length
        ? ajuste.meses.map((mes, indice) => `${mes.fecha ? obtenerNombreMes(mes.fecha) : `Mes ${indice + 1}`}: ${formatearPorcentaje(esNumero(mes.valor) ? mes.valor : null)}`).join(" · ")
        : "IPC mensuales pendientes";
      const diferencia = esNumero(ajuste.diferencia)
        ? `<p class="difference">Diferencia / regularización: ${formatearMonto(ajuste.diferencia)}</p>`
        : "";

      item.innerHTML = `
        <div class="record-heading"><strong>${escaparHTML(periodo)}</strong><span class="badge ${ajuste.tipo === "manual" ? "" : "auto"}">${tipo}</span></div>
        <p>Pago: <strong>${formatearMonto(ajuste.montoAbonado)}</strong> · ${fechaLocal(ajuste.fechaPago)}</p>
        <p>${escaparHTML(meses)}</p>
        <div class="history-details">
          <p>Monto base: ${formatearMonto(ajuste.montoAnterior)}</p>
          <p>IPC total: ${formatearPorcentaje(ajuste.ipcAcumulado)}</p>
          <p>Aumento: ${formatearMonto(ajuste.aumento)}</p>
          <p>Nuevo monto mensual: ${formatearMonto(ajuste.nuevoMonto)}</p>
          ${diferencia}
        </div>
        ${ajuste.notas ? `<p><em>${escaparHTML(String(ajuste.notas))}</em></p>` : ""}
      `;

      const eliminarBtn = document.createElement("button");
      eliminarBtn.type = "button";
      eliminarBtn.className = "danger-link";
      eliminarBtn.textContent = "Eliminar";
      eliminarBtn.dataset.id = ajuste.id;
      item.appendChild(eliminarBtn);

      historialContainer.appendChild(
        item
      );
    });
}

function eliminarRegistro(event) {
  const boton = event.target.closest("button[data-id]");
  if (!boton) return;

  if (!confirm("¿Eliminar este registro del historial?")) return;

  guardarHistorial(
    obtenerHistorial().filter((registro) => registro.id !== boton.dataset.id)
  );
  renderizarHistorial();
}

function exportarHistorial() {
  const blob = new Blob(
    [JSON.stringify(obtenerHistorial(), null, 2)],
    { type: "application/json" }
  );
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = `historial-ipc-${new Date().toISOString().slice(0, 10)}.json`;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 0);
}

async function importarHistorial() {
  const archivo = importarHistorialInput.files[0];
  importarHistorialInput.value = "";
  if (!archivo) return;

  try {
    const datos = JSON.parse(await archivo.text());

    if (
      !Array.isArray(datos) ||
      !datos.every((registro) => registro && typeof registro === "object" && !Array.isArray(registro))
    ) {
      throw new Error("Formato inválido");
    }

    if (!confirm(`Se importarán ${datos.length} registro(s) y se reemplazará el historial actual. ¿Continuar?`)) return;

    guardarHistorial(datos);
    localStorage.setItem(INITIALIZED_KEY, "1");
    renderizarHistorial();
  } catch {
    alert("El archivo no es un historial válido.");
  }
}

function invalidarCalculo() {
  ultimoCalculo = null;
  resultadoSection.classList.add("hidden");
}

function precargarMontoVigente() {
  if (montoBaseInput.value) return;

  const ultimo = obtenerHistorial()
    .filter((registro) => esNumero(registro.nuevoMonto))
    .sort((a, b) => String(b.fechaPago || b.fechaCalculo || "").localeCompare(String(a.fechaPago || a.fechaCalculo || "")))[0];

  if (ultimo) montoBaseInput.value = ultimo.nuevoMonto.toFixed(2);
}

function calcularCamposManuales() {
  const valor = (id) => numeroOpcional(document.getElementById(id).value);
  const ipcMensuales = [1, 2, 3].map((numero) => valor(`mes${numero}Valor`));
  const montoBase = valor("montoBaseManual");

  const ipc = valor("porcentajeManual") ??
    (ipcMensuales.every(esNumero) ? calcularIPC(ipcMensuales.map((v) => ({ valor: v }))) : null);
  const nuevoMonto = valor("nuevoMontoManual") ??
    (esNumero(montoBase) && esNumero(ipc) ? calcularNuevoMonto(montoBase, ipc) : null);
  const aumento = valor("aumentoManual") ??
    (esNumero(montoBase) && esNumero(nuevoMonto) ? redondearMonto(nuevoMonto - montoBase) : null);

  return { ipc, nuevoMonto, aumento };
}

function actualizarSugerenciasManuales() {
  const { ipc, nuevoMonto, aumento } = calcularCamposManuales();
  const sugerir = (id, calculado, porDefecto, decimales) => {
    document.getElementById(id).placeholder = esNumero(calculado)
      ? `Calculado: ${calculado.toFixed(decimales)}`
      : porDefecto;
  };

  sugerir("porcentajeManual", ipc, "Se calcula con los 3 IPC", 4);
  sugerir("nuevoMontoManual", nuevoMonto, "Se calcula con base y %", 2);
  sugerir("aumentoManual", aumento, "Se calcula con base y %", 2);
}

async function calcularAjuste() {
  const montoBase =
    Number(montoBaseInput.value);

  const periodo = obtenerPeriodo();

  if (!montoBase || montoBase <= 0) {
    alert(
      "Ingresa un monto vigente válido."
    );

    return;
  }

  const hoy = new Date();
  if (periodo.fin >= new Date(hoy.getFullYear(), hoy.getMonth(), 1)) {
    alert(
      "El período incluye el mes en curso o meses futuros, que todavía no tienen IPC publicado."
    );

    return;
  }

  try {
    calcularBtn.disabled = true;

    calcularBtn.textContent =
      "Consultando BCRA...";

    const meses =
      await obtenerInflacion(
        periodo.desde,
        periodo.hasta
      );

    if (meses.length === 0) {
      throw new Error(
        "El BCRA no devolvió datos para ese período."
      );
    }

    if (meses.length !== periodo.cantidad) {
      throw new Error(
        `El BCRA devolvió ${meses.length} de ${periodo.cantidad} mes(es). ` +
        "Probablemente el último IPC del período todavía no fue publicado."
      );
    }

    const ipcAcumulado =
      calcularIPC(meses);

    const nuevoMonto =
      calcularNuevoMonto(
        montoBase,
        ipcAcumulado
      );

    const aumento =
      redondearMonto(nuevoMonto - montoBase);

    ultimoCalculo = {
      id: `automatico-${Date.now()}`,
      tipo: "automatico",
      periodoIPC: periodo.nombre,
      periodoDesde:
        periodo.desde,
      periodoHasta:
        periodo.hasta,

      montoAnterior:
        montoBase,

      ipcAcumulado,
      aumento,
      nuevoMonto,

      meses,

      fechaCalculo:
        new Date().toISOString(),
    };

    mostrarDetalleMeses(meses);

    montoAnteriorResultado.textContent =
      formatterARS.format(
        montoBase
      );

    ipcResultado.textContent =
      `${formatterPorcentaje.format(
        ipcAcumulado
      )} %`;

    aumentoResultado.textContent =
      formatterARS.format(
        aumento
      );

    nuevoMontoResultado.textContent =
      formatterARS.format(
        nuevoMonto
      );

    resultadoSection.classList.remove(
      "hidden"
    );
  } catch (error) {
    console.error(error);

    alert(
      error.message ||
      "No se pudo calcular el ajuste."
    );
  } finally {
    calcularBtn.disabled = false;

    calcularBtn.textContent =
      "Calcular ajuste";
  }
}

function guardarAjuste() {
  if (!ultimoCalculo) {
    alert(
      "Primero debes realizar un cálculo."
    );

    return;
  }

  const historial =
    obtenerHistorial();

  const yaExiste =
    historial.some(
      (ajuste) =>
        ajuste.periodoDesde ===
        ultimoCalculo.periodoDesde &&
        ajuste.periodoHasta ===
        ultimoCalculo.periodoHasta
    );

  if (yaExiste) {
    const confirmar = confirm(
      "Ya existe un ajuste guardado para este período. " +
      "¿Quieres guardarlo de todos modos?"
    );

    if (!confirmar) {
      return;
    }
  }

  const montoAbonado = numeroOpcional(montoAbonadoAutomatico.value);
  ultimoCalculo.montoAbonado = montoAbonado ?? ultimoCalculo.nuevoMonto;
  ultimoCalculo.fechaPago = fechaPagoAutomatico.value || new Date().toISOString().slice(0, 10);
  ultimoCalculo.diferencia = redondearMonto(ultimoCalculo.nuevoMonto - ultimoCalculo.montoAbonado);

  historial.push(
    ultimoCalculo
  );

  guardarHistorial(
    historial
  );

  renderizarHistorial();

  montoBaseInput.value =
    ultimoCalculo.nuevoMonto.toFixed(2);
  montoAbonadoAutomatico.value = "";
  fechaPagoAutomatico.value = "";
  invalidarCalculo();

  alert(
    "Ajuste guardado correctamente."
  );
}

function guardarRegistroManual(event) {
  event.preventDefault();

  const valor = (id) => document.getElementById(id).value;
  const montoAbonado = numeroOpcional(valor("montoAbonadoManual"));
  const { ipc, nuevoMonto, aumento } = calcularCamposManuales();
  const diferenciaIngresada = numeroOpcional(valor("diferenciaManual"));
  const meses = [1, 2, 3].map((numero) => ({
    fecha: valor(`mes${numero}Nombre`) ? `${valor(`mes${numero}Nombre`)}-01` : "",
    valor: numeroOpcional(valor(`mes${numero}Valor`)),
  })).filter((mes) => mes.fecha || esNumero(mes.valor));

  const registro = {
    id: `manual-${Date.now()}`,
    tipo: "manual",
    periodoIPC: valor("periodoManual").trim() || null,
    montoAnterior: numeroOpcional(valor("montoBaseManual")),
    meses,
    ipcAcumulado: ipc,
    aumento,
    nuevoMonto,
    montoAbonado,
    diferencia: diferenciaIngresada ?? (esNumero(nuevoMonto) ? redondearMonto(nuevoMonto - montoAbonado) : null),
    fechaPago: valor("fechaPagoManual"),
    notas: valor("notasManual").trim(),
    fechaRegistro: new Date().toISOString(),
  };

  const historial = obtenerHistorial();
  historial.push(registro);
  guardarHistorial(historial);
  historialManualForm.reset();
  actualizarSugerenciasManuales();
  renderizarHistorial();
  alert("Registro manual guardado correctamente.");
}

function borrarHistorial() {
  const historial =
    obtenerHistorial();

  if (
    historial.length === 0
  ) {
    return;
  }

  const confirmar = confirm(
    "¿Seguro que quieres borrar todo el historial?"
  );

  if (!confirmar) {
    return;
  }

  localStorage.removeItem(
    STORAGE_KEY
  );
  localStorage.setItem(INITIALIZED_KEY, "1");

  renderizarHistorial();
}

calcularBtn.addEventListener(
  "click",
  calcularAjuste
);

guardarBtn.addEventListener(
  "click",
  guardarAjuste
);

borrarHistorialBtn.addEventListener(
  "click",
  borrarHistorial
);

historialManualForm.addEventListener("submit", guardarRegistroManual);
historialManualForm.addEventListener("input", actualizarSugerenciasManuales);
historialContainer.addEventListener("click", eliminarRegistro);
exportarHistorialBtn.addEventListener("click", exportarHistorial);
importarHistorialBtn.addEventListener("click", () => importarHistorialInput.click());
importarHistorialInput.addEventListener("change", importarHistorial);
montoBaseInput.addEventListener("input", invalidarCalculo);
[mesInicioSelect, anioInicioSelect, cantidadMesesSelect].forEach((select) => {
  select.addEventListener("change", () => {
    invalidarCalculo();
    actualizarResumenPeriodo();
  });
});

generarSelectoresPeriodo();
inicializarPagosConocidos();
renderizarHistorial();
precargarMontoVigente();
