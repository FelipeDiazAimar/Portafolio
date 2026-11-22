// Títulos y certificados de la sección "Títulos".
//
// Cada uno aporta al carrusel una tarjeta de texto (`color`, `colorFin`) y, si tiene `imagen`, una
// foto (`aspecto`, `foco`, `ajuste`, `fondo`, `credito`). Al tocar la tarjeta de texto se abre
// `diploma`: la hoja del título recreada como una lámina de vidrio esmerilado.
//
// `diploma` copia la hoja impresa (los textos salen de los escaneos; el DNI no se publica):
//   orientacion  'horizontal' | 'vertical' (como la hoja impresa)
//   logo         escudo o logo del encabezado (si no hay, `sigla` va en un sello)
//   institucion  la primera línea del encabezado; `dependencia`, la de abajo
//   marcaAgua    texto en arco detrás de la hoja (opcional)
//   documento    "Certificado", "Diploma", etc.
//   otorga       la frase antes del nombre; `conector`, la frase entre el nombre y el título
//   destacado    el título, nivel o distinción
//   motivo       el texto después del título
//   datos        [{ etiqueta, valor }]: la grilla de datos de la hoja
//   nota         aclaración al pie (opcional)
//   emisor       quién emite, al pie (opcional); `lugarFecha`, ciudad y fecha de emisión
//   registro     número de certificado o inscripción (opcional), con `etiquetaRegistro`
//   firmas       [{ cargo, nombre? }] quienes firman la hoja; `propia: true` es la firma de Felipe
//   logoPie      logo al pie, en lugar del sello en relieve (opcional)
export const PERSONA = "Felipe Díaz Aimar";

const FIRMA_PROPIA = { propia: true, nombre: PERSONA, cargo: "Titular" };

// Los dos certificados del seminario de ingreso de la UTN comparten la hoja
const SEMINARIO_UTN = {
  orientacion: "horizontal",
  logo: "/titulos/logos/escudo-argentina.svg",
  institucion: "República Argentina",
  dependencia:
    "Universidad Tecnológica Nacional · Facultad Regional San Francisco",
  sigla: "UTN",
  marcaAgua: "UNIVERSIDAD TECNOLÓGICA NACIONAL",
  documento: "Certificado",
  otorga: "A través del presente certificamos que",
  conector: "participó en las clases de",
  motivo:
    "en el marco del seminario semipresencial 2025, coordinado por el Centro de Estudiantes Tecnológicos de la Facultad Regional San Francisco.",
  emisor: "Centro de Estudiantes UTNFRSFCO · AETI – FETI",
  logoPie: "/titulos/logos/utn.png",
};

export const TITULOS = [
  {
    clave: "seminario-agosto-2025",
    estado: "Docente",
    anio: "Ago 2025",
    nombre: "Profesor · Laboratorio de Ing. en Sistemas",
    lugar:
      "Seminario semipresencial 2025 · UTN Facultad Regional San Francisco",
    color: "#2f6bf0",
    colorFin: "#0c2a7a",
    imagen: "/hito4.jpeg",
    aspecto: 0.75,
    foco: [0.62, 0.5],
    diploma: {
      ...SEMINARIO_UTN,
      destacado: "Laboratorio de Ing. en Sistemas",
      datos: [
        { etiqueta: "Rol", valor: "Profesor" },
        { etiqueta: "Seminario", valor: "Semipresencial 2025" },
        {
          etiqueta: "Coordinación",
          valor: "Centro de Estudiantes Tecnológicos",
        },
        { etiqueta: "Fecha", valor: "9 de agosto de 2025" },
      ],
      lugarFecha: "9 de agosto de 2025",
      firmas: [
        { nombre: "Valentina Peralta", cargo: "Presidente · CEUT" },
        {
          nombre: "Mg. Juan C. Calloni",
          cargo: "Sec. Académico · UTN – Fac. Reg. San Fco.",
        },
        FIRMA_PROPIA,
      ],
    },
  },
  {
    clave: "seminario-febrero-2025",
    estado: "Docente",
    anio: "Feb 2025",
    nombre: "Profesor · Laboratorio de Ing. en Sistemas de Información",
    lugar:
      "Seminario semipresencial 2025 · UTN Facultad Regional San Francisco",
    color: "#1f8f6a",
    colorFin: "#0a4535",
    imagen: "/hito3.jpeg",
    aspecto: 0.75,
    foco: [0.5, 0.5],
    diploma: {
      ...SEMINARIO_UTN,
      destacado: "Laboratorio de Ing. en Sistemas de Información",
      datos: [
        { etiqueta: "Rol", valor: "Profesor" },
        { etiqueta: "Seminario", valor: "Semipresencial 2025" },
        {
          etiqueta: "Coordinación",
          valor: "Centro de Estudiantes Tecnológicos",
        },
        { etiqueta: "Fecha", valor: "1 de febrero de 2025" },
      ],
      lugarFecha: "1 de febrero de 2025",
      firmas: [
        { nombre: "Joaquín Libera", cargo: "Presidente · CEUT" },
        {
          nombre: "Mg. Juan C. Calloni",
          cargo: "Sec. Académico · UTN – Fac. Reg. San Fco.",
        },
        FIRMA_PROPIA,
      ],
    },
  },
  {
    clave: "python",
    estado: "Curso",
    anio: "2023",
    nombre: "Desarrollo con Python",
    lugar: "Aprendé Programando · 6 meses, remoto",
    color: "#f2b632",
    colorFin: "#2b5b84",
    diploma: {
      orientacion: "horizontal",
      logo: "/titulos/logos/aprende-programando.png",
      institucion: "Aprendé Programando",
      sigla: "AP",
      documento: "Certificado de finalización",
      otorga: "Se otorga el presente certificado a",
      destacado: "Desarrollo con Python",
      motivo: "por haber completado y aprobado el curso.",
      datos: [
        { etiqueta: "Duración", valor: "6 meses" },
        { etiqueta: "Carga horaria", valor: "3 horas semanales" },
        { etiqueta: "Modalidad", valor: "Remota" },
        { etiqueta: "Finalización", valor: "Fines de 2023" },
      ],
      lugarFecha: "2023",
      firmas: [{ cargo: "Dirección · Aprendé Programando" }, FIRMA_PROPIA],
    },
  },
  {
    clave: "cambridge",
    estado: "Certificación",
    anio: "2023",
    nombre: "First de Cambridge",
    lugar: "Cambridge English · Grade C, nivel B2 · rendido en Córdoba",
    color: "#c8203c",
    colorFin: "#5e0b1b",
    // King's College Chapel desde el río Cam
    imagen: "/titulos/cambridge-kings.jpg",
    aspecto: 0.75,
    foco: [0.5, 0.35],
    credito: {
      texto: "Foto: Martinvl, CC BY-SA 4.0",
      url: "https://commons.wikimedia.org/wiki/File:Kings_College_Cambridge_Chapel_from_the_river.jpg",
    },
    diploma: {
      orientacion: "vertical",
      logo: "/cambridge-escudo.png",
      institucion: "Cambridge English",
      dependencia: "Cambridge University Press & Assessment",
      sigla: "",
      documento: "Certificate",
      otorga: "This is to certify that",
      conector: "has been awarded Grade C in the",
      destacado: "First Certificate in English",
      motivo:
        "Cambridge English Level 1 Certificate in ESOL International (First)*",
      datos: [
        { etiqueta: "Council of Europe Level", valor: "B2" },
        { etiqueta: "Overall Score", valor: "166" },
        { etiqueta: "Reading", valor: "163" },
        { etiqueta: "Use of English", valor: "170" },
        { etiqueta: "Writing", valor: "171" },
        { etiqueta: "Listening", valor: "172" },
        { etiqueta: "Speaking", valor: "156" },
        { etiqueta: "Date of Examination", valor: "23 June 2023" },
        { etiqueta: "Place of Entry", valor: "Córdoba" },
        { etiqueta: "Centre Reference", valor: "AR612 1013" },
        { etiqueta: "Verification Number", valor: "C2680740" },
        { etiqueta: "Accreditation Number", valor: "500/2705/0" },
      ],
      nota: "*This level refers to the Regulated Qualifications Framework (RQF) in England and Northern Ireland · Ofqual Regulated · CEA Regulation",
      lugarFecha: "Date of Issue 13/07/2023",
      registro: "C3161222",
      etiquetaRegistro: "Certificate Number",
      firmas: [
        {
          nombre: "Francesca Woodward",
          cargo:
            "Global Managing Director – English · Cambridge University Press & Assessment",
        },
        FIRMA_PROPIA,
      ],
    },
  },
  {
    clave: "epi",
    estado: "Inglés",
    anio: "2022",
    nombre: "Inglés · Upper Intermediate",
    lugar: "EPI · English Private Institute · San Francisco (Cba.)",
    color: "#2b3a8f",
    colorFin: "#c8202f",
    diploma: {
      orientacion: "horizontal",
      logo: "/titulos/logos/epi.png",
      institucion: "English Private Institute",
      dependencia: "E.P.I. · Centro de Exámenes Internacionales Pearson",
      sigla: "EPI",
      documento: "Certificado",
      otorga: "Por cuanto",
      conector: "ha finalizado el curso correspondiente a",
      destacado: "Upper Intermediate",
      motivo:
        "se le expide el presente certificado en San Francisco (Cba.), a los 6 días del mes de julio de 2022.",
      datos: [
        { etiqueta: "Curso", valor: "Upper Intermediate" },
        { etiqueta: "Lugar", valor: "San Francisco (Cba.)" },
        { etiqueta: "Fecha", valor: "6 de julio de 2022" },
      ],
      lugarFecha: "San Francisco (Cba.) · 6 de julio de 2022",
      registro: "24948",
      etiquetaRegistro: "Inscripto en el Ministerio de Educación N.º",
      firmas: [
        { cargo: "Firma del Profesor" },
        {
          nombre: "Ana María Ambroggio de Bonetti",
          cargo: "Profesora de Inglés · Firma del Director",
        },
        FIRMA_PROPIA,
      ],
    },
  },
  {
    clave: "escolta",
    estado: "Egreso",
    anio: "2022",
    nombre: "Escolta de la Bandera",
    lugar: "Instituto San Francisco de Asís (ISFA) · San Francisco, Córdoba",
    color: "#5aa9e6",
    colorFin: "#1f5f9e",
    // la foto trae bandas negras arriba y abajo: el aspecto más ancho las deja afuera del recorte
    imagen: "/hito2.jpeg",
    aspecto: 0.6,
    foco: [0.5, 0.5],
    diploma: {
      orientacion: "horizontal",
      // escudo redibujado en SVG a partir del original
      logo: "/titulos/logos/isfa.svg",
      institucion: "Instituto San Francisco de Asís",
      dependencia: "Nivel Secundario · San Francisco, Córdoba",
      sigla: "ISFA",
      documento: "Diploma",
      otorga: "Se otorga el presente diploma a",
      destacado: "Escolta de la Bandera Nacional",
      motivo:
        "en reconocimiento a su desempeño académico, por haber sido designado Escolta de la Bandera Nacional en el ciclo lectivo 2022.",
      datos: [
        { etiqueta: "Distinción", valor: "Escolta de la Bandera Nacional" },
        { etiqueta: "Nivel", valor: "Secundario" },
        { etiqueta: "Ciclo lectivo", valor: "2022" },
      ],
      lugarFecha: "San Francisco, Córdoba · 2022",
      registro: null,
      firmas: [{ cargo: "Dirección · ISFA" }, FIRMA_PROPIA],
    },
  },
];
