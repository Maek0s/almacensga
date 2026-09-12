export type SupportIncident = {
  code: string;
  title: string;
  message: string;
  technicalMessage?: string;
  hint: string;
  route: string;
  resource?: string;
  action?: string;
};

const errorMessage = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return message.trim().slice(0, 420) || fallback;
};

export const classifyError = (error: unknown, fallback = "No se pudo completar la operación"): SupportIncident => {
  const message = errorMessage(error, fallback);
  const normalized = message.toLowerCase();
  const route = window.location.hash || window.location.pathname;

  if (normalized.includes("403") || normalized.includes("permiso") || normalized.includes("rol") || normalized.includes("autoriz")) {
    return { code: "PERMISO_INSUFICIENTE", title: "No tienes permiso para esta acción", message, hint: "Pide a tu responsable que revise tu rol o el alcance de la instalación.", route };
  }
  if (normalized.includes("sql") || normalized.includes("consulta") || normalized.includes("solo lectura") || normalized.includes("select")) {
    return { code: "DATOS_NO_DISPONIBLES", title: "No se pueden mostrar estos datos", message: "Esta pantalla no ha podido obtener la información del sistema. No se ha borrado ni modificado ningún registro.", technicalMessage: message, hint: "Pulsa Reintentar. Si vuelve a ocurrir, envía el informe y soporte podrá revisar esta pantalla.", route };
  }
  if (normalized.includes("fetch") || normalized.includes("network") || normalized.includes("conexión") || normalized.includes("servidor") || normalized.includes("api")) {
    return { code: "CONEXION_NO_DISPONIBLE", title: "No se ha podido conectar con el sistema", message: "El almacén sigue abierto, pero no hemos podido actualizar los datos.", hint: "Comprueba la conexión y vuelve a intentarlo. Si continúa, avisa a soporte.", route };
  }
  if (normalized.includes("timeout") || normalized.includes("tiempo máximo") || normalized.includes("demasiado tiempo")) {
    return { code: "OPERACION_LENTA", title: "La operación está tardando demasiado", message: "El sistema ha detenido la operación para no bloquear el trabajo del almacén.", hint: "Prueba con menos registros o filtros más concretos. Si se repite, envía el informe a soporte.", route };
  }
  return { code: "OPERACION_NO_COMPLETADA", title: "No se ha podido completar la operación", message, hint: "Puedes reintentarlo. Si vuelve a ocurrir, envía el informe a soporte con una captura.", route };
};
