// Intereses de Meta recomendados para publicidad inmobiliaria.
//
// Los identificadores son los REALES del catálogo de Meta, consultados con
// `GET /search?type=adinterest` el 16 ago 2026 y verificados uno por uno. No se
// pueden inventar: si el id no existe, Meta rechaza el conjunto de anuncios.
//
// La búsqueda devuelve bastante ruido (una película llamada "House Hunting", tiendas
// de EE. UU.); acá quedaron solo los que describen a alguien que está buscando o
// pensando en comprar una propiedad.
//
// Ojo con la intuición: agregar intereses **reduce** la audiencia, no la aumenta.
// Meta solo mostrará el anuncio a quien calce con alguno de ellos. Por eso no se
// activan solos: el usuario los agrega cuando quiere acotar.

export type InteresRecomendado = {
  id: string;
  name: string;
  // Para qué sirve, en palabras de alguien que no sabe de publicidad.
  paraQue: string;
  // Alcance mundial aproximado que informó Meta. Sirve para ordenarlos, no es el
  // alcance en Chile.
  alcance: number;
};

export const INTERESES_INMOBILIARIOS: InteresRecomendado[] = [
  {
    id: "6003578086487",
    name: "Bienes raíces (sector)",
    paraQue: "El más amplio: gente interesada en el mundo inmobiliario.",
    alcance: 424648647,
  },
  {
    id: "6003174415534",
    name: "Persona que compra su primera casa (bienes raíces)",
    paraQue: "Quienes están buscando su primera vivienda.",
    alcance: 20647829,
  },
  {
    id: "6003141785766",
    name: "Préstamos hipotecarios (banca)",
    paraQue: "Señal fuerte de intención de compra: están viendo cómo financiarla.",
    alcance: 144190748,
  },
  {
    id: "6003446239080",
    name: "Inversiones inmobiliarias (inversión)",
    paraQue: "Compran para arrendar o revender, no para vivir.",
    alcance: 97533199,
  },
  {
    id: "6003332796032",
    name: "Desarrollo inmobiliario (bienes raíces)",
    paraQue: "Interesados en proyectos y propiedades nuevas.",
    alcance: 53970340,
  },
  {
    id: "6003435139283",
    name: "Condominio (bienes raíces)",
    paraQue: "Útil si la propiedad está en condominio.",
    alcance: 15583829,
  },
  {
    id: "6007114546664",
    name: "Ayuda para la compra de primera vivienda (bienes raíces)",
    paraQue: "Buscan subsidios y créditos para comprar.",
    alcance: 5746253,
  },
];
