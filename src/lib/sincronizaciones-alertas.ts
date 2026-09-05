type SyncReciente = { tenant_id: string; plataforma: string; tipo: string; estado: string };

/**
 * Grupos (tenant, plataforma, tipo) cuyos últimos 3 intentos de
 * sincronización terminaron en error -- una corrida puntual fallida no
 * alcanza para alertar (Meta a veces rechaza una sola corrida y se
 * recupera sola en la siguiente), pero 3 seguidas sí es una señal real.
 *
 * `syncsOrdenados` tiene que venir ordenado por iniciado_en descendente
 * (el más reciente primero) -- esta función no reordena.
 */
export function gruposConFallosConsecutivos(syncsOrdenados: SyncReciente[]): string[] {
  const porGrupo = new Map<string, string[]>();
  for (const s of syncsOrdenados) {
    const clave = `${s.tenant_id}|${s.plataforma}|${s.tipo}`;
    const estados = porGrupo.get(clave) ?? [];
    if (estados.length < 3) estados.push(s.estado);
    porGrupo.set(clave, estados);
  }
  const alertas: string[] = [];
  for (const [clave, estados] of porGrupo) {
    if (estados.length === 3 && estados.every((e) => e === 'error')) alertas.push(clave);
  }
  return alertas;
}
