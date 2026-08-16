// Segmentación de audiencia (M6).
//
// Punto clave del proyecto (ver sección 3 del plan de trabajo): la Special Ad
// Category de Meta para vivienda —que obliga a restringir edad, género, ubicación
// e intereses— aplica SOLO si la campaña se dirige a EE. UU., Canadá o ciertos
// países de Europa. Para Chile no aplica, así que por defecto se permite
// segmentación completa y las restricciones se activan solas si alguna vez se
// agrega uno de esos países.

// Países donde Meta exige la categoría especial de vivienda.
const PAISES_RESTRINGIDOS = new Set([
  "US", // Estados Unidos
  "CA", // Canadá
  // Unión Europea / EEE
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES",
  "SE", "IS", "LI", "NO",
]);

// Tipos JSON explícitos: las columnas Json de Prisma no aceptan `unknown`, así que
// el valor que se guarda tiene que estar tipado como JSON de verdad.
export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
export type JsonObject = { [k: string]: JsonValue };

// Convierte una estructura propia (ConfigSegmentacion) al tipo JSON que espera
// Prisma. Es un límite de serialización: el objeto se guarda tal cual.
export function comoJson(valor: unknown): JsonObject {
  return valor as JsonObject;
}

// "subcity" es el tipo que Meta usa para las comunas chilenas (Providencia,
// Las Condes, Pudahuel...). "city" es la conurbación (Santiago de Chile).
export type GeoSeleccion = {
  key: string;
  name: string;
  type: "city" | "subcity" | "region" | "country";
  countryCode: string;
  radiusKm?: number;
};

// Rango válido del radio en kilómetros, verificado contra la API de Meta con
// delivery_estimate: fuera de 16-80 km el alcance estimado cae a CERO y Meta NO
// devuelve ningún error — el anuncio simplemente nunca se entregaría.
export const RADIO_MIN_KM = 16;
export const RADIO_MAX_KM = 80;
// En mercados con Special Ad Category el mínimo que exige Meta es 15 millas (~25 km).
const RADIO_MIN_KM_RESTRINGIDO = 25;

export function radioValido(km: number, restringido = false): number {
  const minimo = restringido ? RADIO_MIN_KM_RESTRINGIDO : RADIO_MIN_KM;
  return Math.min(Math.max(km, minimo), RADIO_MAX_KM);
}

export type InteresSeleccion = { id: string; name: string };

export type ConfigSegmentacion = {
  modo: "MANUAL" | "AUTOMATICO";
  ubicaciones: GeoSeleccion[];
  edadMin: number;
  edadMax: number;
  generos: ("HOMBRES" | "MUJERES")[]; // vacío = todos
  intereses: InteresSeleccion[];
};

// Rango de edad que acepta Meta.
export const EDAD_MIN_META = 18;
export const EDAD_MAX_META = 65;

// Punto de partida de toda campaña nueva.
//
// 30-55 años: es el tramo donde se concentra quien compra o arrienda una propiedad en
// Chile. Antes era 18-65, que incluía mucha gente sin capacidad de compra.
//
// El modo es MANUAL y no Advantage+ por una razón de Meta, no de preferencia:
// **Advantage+ no admite acotar la edad**. Verificado contra la API el 16 ago 2026:
// con `advantage_audience: 1` y cualquier rango distinto de 18-65 —incluso poniendo
// solo `age_min`— Meta responde "puedes agregar una edad mínima superior como
// sugerencia". Las dos cosas juntas son imposibles, así que se prioriza el rango.
export const SEGMENTACION_POR_DEFECTO: ConfigSegmentacion = {
  modo: "MANUAL",
  ubicaciones: [{ key: "CL", name: "Chile", type: "country", countryCode: "CL" }],
  edadMin: 30,
  edadMax: 55,
  generos: [],
  intereses: [],
};

// Devuelve los países restringidos que están incluidos en la segmentación.
// Si devuelve algo, hay que activar la Special Ad Category para esa campaña.
export function paisesRestringidosIncluidos(config: ConfigSegmentacion): string[] {
  const encontrados = new Set<string>();
  for (const ubicacion of config.ubicaciones) {
    if (PAISES_RESTRINGIDOS.has(ubicacion.countryCode)) encontrados.add(ubicacion.countryCode);
  }
  return [...encontrados];
}

export function requiereSpecialAdCategory(config: ConfigSegmentacion): boolean {
  return paisesRestringidosIncluidos(config).length > 0;
}

// Traduce la configuración del formulario al objeto `targeting` que espera la
// Marketing API de Meta.
export function construirTargeting(config: ConfigSegmentacion): JsonObject {
  const restringido = requiereSpecialAdCategory(config);

  const countries: string[] = [];
  const cities: JsonObject[] = [];
  const subcities: JsonObject[] = [];
  const regions: JsonObject[] = [];

  for (const ubicacion of config.ubicaciones) {
    if (ubicacion.type === "country") countries.push(ubicacion.key);
    else if (ubicacion.type === "region") regions.push({ key: ubicacion.key });
    else if (ubicacion.type === "subcity") {
      // Las comunas van SIN radio: agregarle radio a una subcity deja el alcance
      // en cero (verificado con delivery_estimate). Se segmenta la comuna completa.
      subcities.push({ key: ubicacion.key });
    } else {
      // Solo las ciudades admiten radio, y dentro del rango válido.
      const radius = radioValido(ubicacion.radiusKm ?? RADIO_MIN_KM, restringido);
      cities.push({ key: ubicacion.key, radius, distance_unit: "kilometer" });
    }
  }

  const geo_locations: JsonObject = {};
  // Un país NO puede convivir con divisiones internas (verificado con
  // delivery_estimate): país+región da alcance CERO, y país+comuna hace que el país
  // absorba a la comuna (se segmentaría todo Chile creyendo apuntar a Providencia).
  // Si hay algo más específico, el país se descarta.
  const hayEspecificos = cities.length > 0 || subcities.length > 0 || regions.length > 0;
  if (countries.length && !hayEspecificos) geo_locations.countries = countries;
  if (cities.length) geo_locations.cities = cities;
  if (subcities.length) geo_locations.subcities = subcities;
  if (regions.length) geo_locations.regions = regions;
  // Si el usuario no dejó ninguna ubicación, se cae a Chile para no mandar a Meta
  // una segmentación vacía (que rechazaría).
  if (Object.keys(geo_locations).length === 0) geo_locations.countries = ["CL"];

  const targeting: JsonObject = { geo_locations };

  if (restringido) {
    // Meta obliga: 18-65+, todos los géneros, sin intereses detallados.
    targeting.age_min = 18;
    targeting.age_max = 65;
    return targeting;
  }

  // Se acota siempre al rango que acepta Meta. La interfaz ya lo hace al salir del
  // campo, pero esto es lo que de verdad protege: si por cualquier vía llegara una
  // edad fuera de rango (un formulario manipulado, un valor a medio escribir), Meta
  // rechazaría el conjunto de anuncios entero.
  const edadMin = Math.min(Math.max(Math.round(config.edadMin) || EDAD_MIN_META, EDAD_MIN_META), EDAD_MAX_META);
  const edadMax = Math.min(Math.max(Math.round(config.edadMax) || EDAD_MAX_META, edadMin), EDAD_MAX_META);
  targeting.age_min = edadMin;
  targeting.age_max = edadMax;

  // genders: [1] hombres, [2] mujeres. Si van los dos (o ninguno), se omite el
  // campo, que para Meta significa "todos".
  if (config.generos.length === 1) {
    targeting.genders = [config.generos[0] === "HOMBRES" ? 1 : 2];
  }

  if (config.modo === "MANUAL" && config.intereses.length > 0) {
    targeting.interests = config.intereses.map((i) => ({ id: i.id, name: i.name }));
  }

  // `advantage_audience` se declara SIEMPRE, en 1 o en 0. Verificado contra la API:
  // si se acota la edad sin declararlo, Meta responde "debes activar o desactivar la
  // función de público Advantage" y rechaza el conjunto.
  targeting.targeting_automation = {
    advantage_audience: config.modo === "AUTOMATICO" ? 1 : 0,
  };

  if (config.modo === "AUTOMATICO") {
    // Advantage+ amplía la audiencia por su cuenta y NO acepta un rango de edad
    // acotado: con cualquier valor distinto de 18-65 Meta rechaza el conjunto. Se
    // fuerza el rango completo para que la combinación nunca sea inválida; la
    // interfaz avisa de esto al elegir el modo.
    targeting.age_min = EDAD_MIN_META;
    targeting.age_max = EDAD_MAX_META;
  }

  return targeting;
}

// Resumen legible para mostrar en pantalla.
export function describirSegmentacion(config: ConfigSegmentacion): string {
  const partes: string[] = [];
  partes.push(config.ubicaciones.map((u) => u.name).join(", ") || "Chile");
  if (requiereSpecialAdCategory(config)) {
    partes.push("18-65+ (restringido por Meta)");
    return partes.join(" · ");
  }
  partes.push(`${config.edadMin}-${config.edadMax} años`);
  if (config.generos.length === 1) partes.push(config.generos[0] === "HOMBRES" ? "hombres" : "mujeres");
  if (config.intereses.length) partes.push(`${config.intereses.length} interés(es)`);
  if (config.modo === "AUTOMATICO") partes.push("Advantage+");
  return partes.join(" · ");
}
