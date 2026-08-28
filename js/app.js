import { obtenerInflacion } from "./api.js";
import { calcularIPC, calcularNuevoMonto } from "./ipc.js";

const montoBaseInput = document.getElementById("montoBase");
const trimestreSelect = document.getElementById("trimestre");

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
  return new Date(`${fecha.slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR");
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

function obtenerUltimoDiaMes(anio, mes) {
  return new Date(
    anio,
    mes,
    0
  ).getDate();
}

function generarTrimestres() {
  const anioActual = new Date().getFullYear();

  const desdeAnio = anioActual - 3;
  const hastaAnio = anioActual + 2;

  trimestreSelect.innerHTML = "";

  for (let anio = desdeAnio; anio <= hastaAnio; anio++) {
    const trimestres = [
      {
        inicio: 1,
        fin: 3,
      },
      {
        inicio: 4,
        fin: 6,
      },
      {
        inicio: 7,
        fin: 9,
      },
      {
        inicio: 10,
        fin: 12,
      },
    ];

    trimestres.forEach((trimestre) => {
      const option = document.createElement("option");

      const mesInicio = nombresMeses[
        trimestre.inicio - 1
      ];

      const mesFin = nombresMeses[
        trimestre.fin - 1
      ];

      option.value =
        `${anio}-${pad(trimestre.inicio)}`;

      option.textContent =
        `${mesInicio} - ${mesFin} ${anio}`;

      trimestreSelect.appendChild(option);
    });
  }

  seleccionarTrimestreActual();
}

function seleccionarTrimestreActual() {
  const hoy = new Date();

  const anio = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;

  let mesInicioTrimestre;

  if (mes <= 3) {
    mesInicioTrimestre = 1;
  } else if (mes <= 6) {
    mesInicioTrimestre = 4;
  } else if (mes <= 9) {
    mesInicioTrimestre = 7;
  } else {
    mesInicioTrimestre = 10;
  }

  const valor = `${anio}-${pad(
    mesInicioTrimestre
  )}`;

  trimestreSelect.value = valor;
}

function obtenerPeriodoTrimestre(valorTrimestre) {
  const [anio, mesInicio] =
    valorTrimestre.split("-").map(Number);

  const mesFin = mesInicio + 2;

  const ultimoDia =
    obtenerUltimoDiaMes(
      anio,
      mesFin
    );

  const desde =
    `${anio}-${pad(mesInicio)}-01`;

  const hasta =
    `${anio}-${pad(mesFin)}-${pad(
      ultimoDia
    )}`;

  return {
    anio,
    mesInicio,
    mesFin,
    desde,
    hasta,
  };
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
    return JSON.parse(
      historialGuardado
    );
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
        ${ajuste.notas ? `<p><em>${escaparHTML(ajuste.notas)}</em></p>` : ""}
      `;

      historialContainer.appendChild(
        item
      );
    });
}

async function calcularAjuste() {
  const montoBase =
    Number(montoBaseInput.value);

  const trimestre =
    trimestreSelect.value;

  if (!montoBase || montoBase <= 0) {
    alert(
      "Ingresa un monto vigente válido."
    );

    return;
  }

  if (!trimestre) {
    alert(
      "Selecciona un trimestre."
    );

    return;
  }

  try {
    calcularBtn.disabled = true;

    calcularBtn.textContent =
      "Consultando BCRA...";

    const periodo =
      obtenerPeriodoTrimestre(
        trimestre
      );

    const meses =
      await obtenerInflacion(
        periodo.desde,
        periodo.hasta
      );

    if (meses.length === 0) {
      throw new Error(
        "El BCRA no devolvió datos para ese trimestre."
      );
    }

    if (meses.length !== 3) {
      throw new Error(
        `El BCRA devolvió ${meses.length} mes(es). ` +
        "El trimestre todavía no tiene los 3 IPC publicados."
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
      nuevoMonto - montoBase;

    const nombreTrimestre =
      trimestreSelect.options[
        trimestreSelect.selectedIndex
      ].textContent;

    ultimoCalculo = {
      id: `automatico-${Date.now()}`,
      tipo: "automatico",
      nombreTrimestre,
      periodoIPC: nombreTrimestre,
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
        ultimoCalculo.periodoDesde
    );

  if (yaExiste) {
    const confirmar = confirm(
      "Ya existe un ajuste guardado para este trimestre. " +
      "¿Quieres guardarlo de todos modos?"
    );

    if (!confirmar) {
      return;
    }
  }

  const montoAbonado = numeroOpcional(montoAbonadoAutomatico.value);
  ultimoCalculo.montoAbonado = montoAbonado ?? ultimoCalculo.nuevoMonto;
  ultimoCalculo.fechaPago = fechaPagoAutomatico.value || new Date().toISOString().slice(0, 10);
  ultimoCalculo.diferencia = ultimoCalculo.nuevoMonto - ultimoCalculo.montoAbonado;

  historial.push(
    ultimoCalculo
  );

  guardarHistorial(
    historial
  );

  renderizarHistorial();

  montoBaseInput.value =
    ultimoCalculo.nuevoMonto.toFixed(2);

  alert(
    "Ajuste guardado correctamente."
  );
}

function guardarRegistroManual(event) {
  event.preventDefault();

  const valor = (id) => document.getElementById(id).value;
  const montoAbonado = numeroOpcional(valor("montoAbonadoManual"));
  const nuevoMonto = numeroOpcional(valor("nuevoMontoManual"));
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
    ipcAcumulado: numeroOpcional(valor("porcentajeManual")),
    aumento: numeroOpcional(valor("aumentoManual")),
    nuevoMonto,
    montoAbonado,
    diferencia: diferenciaIngresada ?? (esNumero(nuevoMonto) ? nuevoMonto - montoAbonado : null),
    fechaPago: valor("fechaPagoManual"),
    notas: valor("notasManual").trim(),
    fechaRegistro: new Date().toISOString(),
  };

  const historial = obtenerHistorial();
  historial.push(registro);
  guardarHistorial(historial);
  historialManualForm.reset();
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

generarTrimestres();
inicializarPagosConocidos();
renderizarHistorial();
