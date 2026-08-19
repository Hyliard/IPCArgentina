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
      "ipcAdjustmentHistory"
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
    "ipcAdjustmentHistory",
    JSON.stringify(historial)
  );
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
    .reverse()
    .forEach((ajuste) => {
      const item =
        document.createElement("div");

      item.classList.add(
        "historial-item"
      );

      item.innerHTML = `
        <strong>
          ${ajuste.nombreTrimestre}
        </strong>

        <p>
          Monto anterior:
          ${formatterARS.format(
            ajuste.montoAnterior
          )}
        </p>

        <p>
          IPC acumulado:
          ${formatterPorcentaje.format(
            ajuste.ipcAcumulado
          )} %
        </p>

        <p>
          Aumento:
          ${formatterARS.format(
            ajuste.aumento
          )}
        </p>

        <p>
          Nuevo monto:
          <strong>
            ${formatterARS.format(
              ajuste.nuevoMonto
            )}
          </strong>
        </p>
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
      nombreTrimestre,
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
    "ipcAdjustmentHistory"
  );

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

generarTrimestres();
renderizarHistorial();