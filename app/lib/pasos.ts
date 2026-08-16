// Los pasos para publicar un anuncio, en el orden en que hay que hacerlos.
//
// El orden no es una preferencia: son dependencias reales del sistema.
//   - Sin conexión a Meta no se puede crear ningún objeto publicitario.
//   - Sin propiedad con fotos no hay creativo, y el texto que escribe la IA sale de
//     los datos de la propiedad.
//   - Publicar y activar están separados a propósito: publicar deja todo PAUSADO en
//     Meta y no cuesta nada; activar es el único paso que empieza a gastar dinero.
//
// Este archivo es la fuente única de la guía: la pantalla de Inicio lee de acá, así
// que cambiar un paso o su texto se hace en un solo lugar.

export type EstadoPaso = "HECHO" | "ACTUAL" | "PENDIENTE";

export type Paso = {
  numero: number;
  titulo: string;
  // Qué tiene que hacer la persona, en lenguaje de todos los días.
  quehacer: string;
  // Por qué importa. Sirve para que no lo salte pensando que es opcional.
  porque: string;
  href: string;
  textoBoton: string;
};

export const PASOS: Paso[] = [
  {
    numero: 1,
    titulo: "Conecta tu cuenta de Meta",
    quehacer:
      "Inicias sesión con Facebook y autorizas la app para que pueda crear los anuncios por ti.",
    porque: "Se hace una sola vez. Sin esto no se puede publicar nada en Facebook ni Instagram.",
    href: "/conectar",
    textoBoton: "Conectar Meta",
  },
  {
    numero: 2,
    titulo: "Carga la propiedad y sus fotos",
    quehacer:
      "Nombre, precio y las fotos. Mientras más datos completes (comuna, dormitorios, superficie), mejor queda el texto del anuncio.",
    porque:
      "Las fotos son lo que se va a ver, y los datos son lo que la IA usa para escribir. Sin esto no hay anuncio posible.",
    href: "/propiedades/nueva",
    textoBoton: "Cargar propiedad",
  },
  {
    numero: 3,
    titulo: "Crea el anuncio",
    quehacer:
      "Eliges la propiedad, el formato (una foto o varias deslizables), dónde quieres que te contacten y cuánto invertir por día.",
    porque:
      "Nosotros nos encargamos del resto: escribimos el texto y decidimos a quién mostrárselo.",
    href: "/crear-anuncio",
    textoBoton: "Crear anuncio",
  },
  {
    numero: 4,
    titulo: "Revísalo antes de publicar",
    quehacer:
      "Mira cómo quedó el texto y las fotos. La app revisa sola que cumpla las normas de Meta y la ley chilena, y te avisa si algo lo impide.",
    porque:
      "Corregir acá es gratis. Si Meta rechaza un anuncio, hay que esperar la revisión de nuevo.",
    href: "/campanas",
    textoBoton: "Ver mis anuncios",
  },
  {
    numero: 5,
    titulo: "Publícalo en Meta",
    quehacer: "Con un botón, el anuncio se crea en tu cuenta publicitaria.",
    porque: "Queda PAUSADO: existe en Meta pero no se muestra a nadie y no gasta ni un peso.",
    href: "/campanas",
    textoBoton: "Ver mis anuncios",
  },
  {
    numero: 6,
    titulo: "Actívalo cuando estés listo",
    quehacer: "Confirmas que quieres que empiece a mostrarse.",
    porque:
      "Este es el único paso que gasta dinero. Está separado justamente para que nadie active algo sin querer. Puedes pausarlo cuando quieras.",
    href: "/campanas",
    textoBoton: "Ver mis anuncios",
  },
  {
    numero: 7,
    titulo: "Mira cómo va",
    quehacer:
      "Cuántas personas lo vieron, cuántas hicieron clic y cuántas te contactaron, agrupado por propiedad.",
    porque: "Sirve para decidir dónde poner el presupuesto del mes siguiente.",
    href: "/reportes",
    textoBoton: "Ver resultados",
  },
];

// Datos que necesita la pantalla de Inicio para saber en qué paso va la persona.
export type AvanceUsuario = {
  tieneConexion: boolean;
  tienePropiedadConFotos: boolean;
  tieneCampana: boolean;
  tieneCampanaEnMeta: boolean;
  tieneCampanaActiva: boolean;
};

// Devuelve el estado de cada paso. El "ACTUAL" es el primero sin hacer: es el que se
// destaca en pantalla, para que siempre haya una sola cosa evidente por hacer.
export function estadoDePasos(avance: AvanceUsuario): Record<number, EstadoPaso> {
  const hechos: Record<number, boolean> = {
    1: avance.tieneConexion,
    2: avance.tienePropiedadConFotos,
    3: avance.tieneCampana,
    4: avance.tieneCampana, // revisar es parte de tener la campaña creada
    5: avance.tieneCampanaEnMeta,
    6: avance.tieneCampanaActiva,
    7: avance.tieneCampanaActiva,
  };

  const estados: Record<number, EstadoPaso> = {};
  let yaHayActual = false;
  for (const paso of PASOS) {
    if (hechos[paso.numero]) {
      estados[paso.numero] = "HECHO";
    } else if (!yaHayActual) {
      estados[paso.numero] = "ACTUAL";
      yaHayActual = true;
    } else {
      estados[paso.numero] = "PENDIENTE";
    }
  }
  return estados;
}

// Es la primera vez si todavía no ha creado ninguna campaña.
export function esPrimeraVez(avance: AvanceUsuario): boolean {
  return !avance.tieneCampana;
}
