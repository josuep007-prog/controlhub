/** Calendário da competência: dias úteis e dias de repouso para o DSR. */

const pad = (n: number) => String(n).padStart(2, "0");

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** Feriados nacionais (Lei 662/1949, Lei 6.802/1980, Lei 14.759/2023) + Sexta-feira Santa. */
export function feriadosNacionais(ano: number): Set<string> {
  const fixos = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];
  const s = new Set(fixos.map((md) => `${ano}-${md}`));
  const p = pascoa(ano);
  const sexta = new Date(p.getTime() - 2 * 86400000);
  s.add(`${ano}-${pad(sexta.getUTCMonth() + 1)}-${pad(sexta.getUTCDate())}`);
  return s;
}

export interface CalendarioCompetencia {
  diasNoMes: number;
  /** Segunda a sábado, exceto feriados. */
  diasUteis: number;
  /** Domingos + feriados (base do DSR). */
  diasRepouso: number;
}

export function calendarioCompetencia(competencia: string, feriadosExtras: string[] = []): CalendarioCompetencia {
  const [ano, mes] = competencia.split("-").map(Number) as [number, number];
  const feriados = feriadosNacionais(ano);
  for (const f of feriadosExtras) feriados.add(f);
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  let diasUteis = 0;
  let diasRepouso = 0;
  for (let d = 1; d <= diasNoMes; d++) {
    const data = `${ano}-${pad(mes)}-${pad(d)}`;
    const domingo = new Date(Date.UTC(ano, mes - 1, d)).getUTCDay() === 0;
    if (domingo || feriados.has(data)) diasRepouso++;
    else diasUteis++;
  }
  return { diasNoMes, diasUteis, diasRepouso };
}
