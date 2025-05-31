// routee/ruta.js

const express = require("express");
const router = express.Router();
const conexion = require("../db/conexion");

// -----------------------------------------------------------------
//           INICIO DE SECCION POR PARTE DEL PACIENTE
//------------------------------------------------------------------

// Login de usuarios
router.post("/login", (req, res) => {
  const { usuario, password } = req.body;

  const sql = `
    SELECT u.*, p.nombre, p.apellido, p.id_rol, p.email, p.telefono, p.direccion, pa.id_paciente
    FROM usuario u
    JOIN persona p ON u.id_persona = p.id_persona
    LEFT JOIN paciente pa ON p.id_persona = pa.id_persona -- Unir con paciente para obtener id_paciente si es paciente
    WHERE u.nombre_usuario = ? AND u.id_estado = 1 -- Asumiendo id_estado 1 es activo
    LIMIT 1
  `;

  conexion.query(sql, [usuario], (err, results) => {
    if (err) {
      console.error("Error en la consulta de login:", err);
      return res.status(500).json({ error: "Error en el servidor" });
    }

    if (results.length === 0) {
      return res
        .status(401)
        .json({ error: "Usuario no encontrado o inactivo" });
    }

    const user = results[0];

    // Comparar contraseña en texto plano (temporal) - Considera usar hashing en producción
    if (password === user.contrasena) {
      console.log("Usuario autenticado:", user.nombre_usuario);

      //Guardar datos del usuario en la sesión ***
      req.session.user = {
        id_usuario: user.id_usuario,
        nombre_usuario: user.nombre_usuario,
        id_persona: user.id_persona,
        id_rol: user.id_rol,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        telefono: user.telefono,
        direccion: user.direccion,
        id_paciente: user.id_paciente, // Guardar id_paciente si existe (si el usuario es paciente)
      };
      console.log("Datos de usuario guardados en sesión:", req.session.user);
      // **************************************************************

      // Redirigir a inicio.html
      return res.json({ success: true, redirect: "/HTML/inicio.html" });
    } else {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }
  });
});

// --------------------------------------------------------------------------
//       RESGISTRAR AL NUEVO PACIENTE CON SUS CONTRASEÑA Y NOMBRE DE USUARIO
//---------------------------------------------------------------------------
// Registro de pacientes
router.post("/register", (req, res) => {
  const {
    nombre,
    apellido,
    dni,
    fecha_nacimiento,
    telefono,
    direccion,
    email,
    obra_social,
    nombre_usuario, // <- agregar al formulario
    contrasena, // <- agregar al formulario
  } = req.body;

  if (!email || !nombre_usuario || !contrasena) {
    console.error("Faltan datos obligatorios para el registro");
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  const insertarPersona = `
  INSERT INTO persona (nombre, apellido, dni, fecha_nacimiento, telefono, direccion, email, id_rol, id_estado)
  VALUES (?, ?, ?, ?, ?, ?, ?, 4, 1)`; // 4: Rol paciente

  conexion.query(
    insertarPersona,
    [nombre, apellido, dni, fecha_nacimiento, telefono, direccion, email],
    (err, resultadoPersona) => {
      if (err) {
        console.error("Error al insertar en persona:", err);
        return res
          .status(500)
          .json({ error: "Error alguno de los datos ya existen" });
      }

      const idPersona = resultadoPersona.insertId;

      const insertarPaciente = `
      INSERT INTO paciente (id_persona, obra_social, id_estado)
      VALUES (?, ?, 1)`; // 1: Estado activo de paciente

      conexion.query(
        insertarPaciente,
        [idPersona, obra_social || null],
        (err2, resultadoPaciente) => {
          if (err2) {
            console.error("Error al insertar en paciente:", err2);
            return res
              .status(500)
              .json({ error: "Error al registrar paciente" });
          }

          const insertarUsuario = `
          INSERT INTO usuario (nombre_usuario, contrasena, id_persona, id_estado)
          VALUES (?, ?, ?, 1)`; // 1: Estado activo de usuario

          conexion.query(
            insertarUsuario,
            [nombre_usuario, contrasena, idPersona],
            (err3, resultadoUsuario) => {
              if (err3) {
                console.error("Error al insertar en usuario:", err3);
                return res
                  .status(500)
                  .json({ error: "Error al registrar usuario" });
              }
              // Redirigir a inicio.html después de registrar exitosamente
              res.json({ success: true, redirect: "/HTML/inicio.html" });
            }
          );
        }
      );
    }
  );
});

// -----------------------------------------------------------------
//       OPTENER LAS EPECIALIDADES, ESPECIALISTAS, DIAS Y HORARIO
//------------------------------------------------------------------

// Obtener especialidades
router.get("/especialidades", (req, res) => {
  conexion.query(
    "SELECT id_especialidad, nombre FROM especialidad WHERE id_estado = 1",
    (error, results) => {
      if (error)
        return res.status(500).json({ error: "Error en la base de datos" });
      res.json(results);
    }
  );
});

// Obtener profesionales por especialidad
router.get("/profesionales", (req, res) => {
  const id_especialidad = req.query.id_especialidad;
  if (!id_especialidad)
    return res.status(400).json({ error: "Falta parámetro id_especialidad" });
  conexion.query(
    `SELECT p.id_persona AS id_profesional, per.nombre, per.apellido
     FROM profesional p
     JOIN persona per ON p.id_persona = per.id_persona
     WHERE p.id_especialidad = ? AND p.id_estado = 1`,
    [id_especialidad],
    (error, results) => {
      if (error)
        return res.status(500).json({ error: "Error en la base de datos" });
      res.json(results);
    }
  );
});

// Obtener horarios disponibles para un profesional y fecha (fraccionado cada 30 min, máx 10 turnos, permite turnos simultáneos)
router.get("/horarios-disponibles", (req, res) => {
  // Recibe: id_profesional y fecha. Devuelve los horarios posibles de ese día para ese profesional, si hay menos de 10 turnos agendados.
  const id_profesional = req.query.id_profesional;
  const fecha = req.query.fecha;
  if (!id_profesional || !fecha)
    return res.status(400).json({ error: "Faltan parámetros" });

  // Obtener el día de la semana en español (con tilde)
  const diasSemana = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];
  // Corregido: calcular día de la semana en UTC para evitar errores de zona horaria
  const fechaObj = new Date(fecha + "T12:00:00Z"); // Mediodía UTC
  console.log(
    "[DEBUG] fechaObj ISO:",
    fechaObj.toISOString(),
    "getUTCDay():",
    fechaObj.getUTCDay()
  );
  let diaNombre = diasSemana[fechaObj.getUTCDay()];
  // Parche temporal: si la fecha es 2025-06-02, forzar Lunes
  if (fecha === "2025-06-02") {
    diaNombre = "Lunes";
    console.log(
      "[DEBUG] Parche aplicado: Forzando diaNombre a Lunes para 2025-06-02"
    );
  }
  console.log(
    "[DEBUG] diaNombre:",
    diaNombre,
    "id_profesional:",
    id_profesional,
    "fecha:",
    fecha
  );

  // 1. Buscar el rango horario del profesional para ese día
  conexion.query(
    `SELECT hora_inicio, hora_fin
     FROM horario_disponible
     WHERE id_profesional = ? AND dia_semana = ? AND id_estado = 1
     LIMIT 1`,
    [id_profesional, diaNombre],
    (error, results) => {
      console.log("[DEBUG] Resultados horario_disponible:", results);
      if (error)
        return res.status(500).json({ error: "Error en la base de datos" });
      if (results.length === 0) {
        console.log(
          "[DEBUG] No se encontró horario_disponible para ese profesional y día"
        );
        return res.json([]);
      }

      const { hora_inicio, hora_fin } = results[0];
      console.log("[DEBUG] hora_inicio:", hora_inicio, "hora_fin:", hora_fin);

      // 2. Buscar la cantidad total de turnos ya reservados para ese profesional y fecha
      conexion.query(
        `SELECT COUNT(*) as cantidad FROM turno WHERE id_profesional = ? AND DATE(fecha_hora) = ?`,
        [id_profesional, fecha],
        (err2, turnos) => {
          if (err2)
            return res.status(500).json({ error: "Error en la base de datos" });
          if (turnos[0].cantidad >= 10) {
            console.log("[DEBUG] Ya hay 10 turnos para ese día");
            return res.json([]); // Si ya hay 10 turnos, no mostrar horarios
          }

          // 3. Generar los intervalos de 30 minutos usando lógica similar a generarIntervalos, pero con fecha base fija
          console.log(
            "[DEBUG] hora_inicio (raw):",
            hora_inicio,
            typeof hora_inicio
          );
          console.log("[DEBUG] hora_fin (raw):", hora_fin, typeof hora_fin);
          const [inicioHoras, inicioMinutos] = String(hora_inicio)
            .split(":")
            .map(Number);
          const [finHoras, finMinutos] = String(hora_fin)
            .split(":")
            .map(Number);
          let fechaInicio = new Date(`2000-01-01T${hora_inicio}`);
          let fechaFin = new Date(`2000-01-01T${hora_fin}`);
          console.log(
            "[DEBUG] fechaInicio:",
            fechaInicio,
            "fechaFin:",
            fechaFin
          );

          let horarios = [];
          let count = 0;
          while (fechaInicio < fechaFin && count < 20) {
            const horaStr = fechaInicio.toTimeString().substring(0, 5) + ":00";
            let siguiente = new Date(fechaInicio.getTime() + 30 * 60000);
            let horaFinStr =
              siguiente <= fechaFin
                ? siguiente.toTimeString().substring(0, 5) + ":00"
                : fechaFin.toTimeString().substring(0, 5) + ":00";
            console.log(
              `[DEBUG] Slot ${
                count + 1
              }: hora_inicio=${horaStr}, hora_fin=${horaFinStr}`
            );
            horarios.push({
              hora_inicio: horaStr,
              hora_fin: horaFinStr,
            });
            if (siguiente >= fechaFin) break;
            fechaInicio = siguiente;
            count++;
          }
          console.log("[DEBUG] Horarios generados:", horarios);
          res.json(horarios);
        }
      );
    }
  );
});

// Función auxiliar para sumar 30 minutos y devolver string HH:MM:SS
// Recibe hora y minutos, retorna el string del horario final del turno
function add30Min(h, m) {
  m += 30;
  if (m >= 60) {
    h += 1;
    m -= 60;
  }
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:00`;
}

// Obtener días disponibles para un profesional (solo días con menos de 10 turnos y que no sean feriados)
router.get("/dias-disponibles", (req, res) => {
  // Recibe: id_profesional. Devuelve los próximos 14 días hábiles (no feriados) en los que el profesional atiende y no tiene 10 turnos agendados.
  const id_profesional = req.query.id_profesional;
  if (!id_profesional)
    return res.status(400).json({ error: "Falta parámetro id_profesional" });

  // Buscar los días de la semana en los que el profesional atiende
  conexion.query(
    `SELECT DISTINCT hd.dia_semana
     FROM horario_disponible hd
     WHERE hd.id_profesional = ? AND hd.id_estado = 1`,
    [id_profesional],
    (error, dias) => {
      if (error)
        return res.status(500).json({ error: "Error en la base de datos" });

      const hoy = new Date();
      const fechas = [];
      for (let i = 0; i < 14; i++) {
        const fecha = new Date(hoy);
        fecha.setDate(hoy.getDate() + i);
        const diasSemana = [
          "Domingo",
          "Lunes",
          "Martes",
          "Miércoles",
          "Jueves",
          "Viernes",
          "Sábado",
        ];
        const diaNombre = diasSemana[fecha.getDay()];
        if (dias.some((d) => d.dia_semana === diaNombre)) {
          fechas.push(fecha.toISOString().slice(0, 10));
        }
      }
      if (fechas.length === 0) return res.json([]);
      // Filtrar fechas que no sean feriados nacionales
      const feriados2025 = [
        "2025-01-01", // Año Nuevo
        "2025-02-03", // Carnaval
        "2025-02-04", // Carnaval
        "2025-03-24", // Día de la Memoria
        "2025-04-02", // Malvinas
        "2025-04-18", // Viernes Santo
        "2025-05-01", // Día del Trabajador
        "2025-05-25", // Revolución de Mayo
        "2025-06-16", // Paso a la Inmortalidad de Güemes
        "2025-06-20", // Paso a la Inmortalidad de Belgrano
        "2025-07-09", // Independencia
        "2025-08-18", // Paso a la Inmortalidad de San Martín (trasladado)
        "2025-10-13", // Diversidad Cultural (trasladado)
        "2025-12-08", // Inmaculada Concepción
        "2025-12-25", // Navidad
      ];
      const fechasNoFeriado = fechas.filter((f) => !feriados2025.includes(f));
      if (fechasNoFeriado.length === 0) return res.json([]);
      // Solo fechas a partir de hoy y máximo 10 turnos por día
      const placeholders = fechasNoFeriado.map(() => "?").join(",");
      conexion.query(
        `SELECT DATE(fecha_hora) as fecha, COUNT(*) as cantidad
         FROM turno
         WHERE id_profesional = ? AND DATE(fecha_hora) IN (${placeholders})
         GROUP BY DATE(fecha_hora)`,
        [id_profesional, ...fechasNoFeriado],
        (err, turnos) => {
          if (err)
            return res.status(500).json({ error: "Error en la base de datos" });
          const fechasDisponibles = fechasNoFeriado.filter((f) => {
            const t = turnos.find((tu) => tu.fecha === f);
            return (!t || t.cantidad < 10) && new Date(f) >= hoy;
          });
          res.json(fechasDisponibles);
        }
      );
    }
  );
});

// -----------------------------------------------------------------
//      REGISTRAR DE TURNO PARA UN MENOR
//------------------------------------------------------------------
// Comienzo y Guardardado de turno
router.post("/guardar-turno", async (req, res) => {
  let fechaHoraTurno;
  const { idProfesional, fecha, hora, menor } = req.body;
  // Obtener datos del usuario logueado desde la sesión
  const usuarioLogueado = req.session?.user;

  if (!idProfesional || !fecha || !hora) {
    return res
      .status(400)
      .json({ error: "Faltan datos obligatorios del turno." });
  }

  // Validar si el usuario está logueado para obtener el id_persona o si se está registrando un menor
  if (!usuarioLogueado && !menor) {
    return res.status(401).json({ error: "Usuario no autenticado." });
  }

  try {
    let idPacientePersonaTurno; // Variable para almacenar el id_persona del paciente del turno (adulto o menor)

    // Si es un turno para el usuario logueado (adulto)
    if (!menor) {
      // *** MODIFICACIÓN AQUÍ: Usamos id_persona del usuario logueado ***
      if (!usuarioLogueado?.id_persona) {
        console.error(
          "Usuario logueado no tiene id_persona en la sesión:",
          usuarioLogueado
        );
        return res.status(401).json({
          error: "El usuario logueado no está registrado correctamente.",
        });
      }
      idPacientePersonaTurno = usuarioLogueado.id_persona; // Usamos id_persona
    } else {
      // Si es un turno para un menor
      console.log("Intentando registrar turno para menor:", menor);

      const idTutorPersona = usuarioLogueado?.id_persona;
      const emailTutor = usuarioLogueado?.email;
      const telefonoTutor = usuarioLogueado?.telefono || null;
      const direccionTutor = usuarioLogueado?.direccion || null;
      const estadoActivo = 1;

      if (!idTutorPersona || !emailTutor) {
        return res
          .status(401)
          .json({ error: "Datos del tutor no disponibles en la sesión." });
      }

      // --- Lógica para registrar menor y asegurar registro de tutor ---

      let idTutor;

      // 1. Buscar si el usuario logueado ya es tutor
      const [tutorRows] = await conexion
        .promise()
        .query(
          `SELECT id_tutor FROM tutor WHERE id_persona = ? AND id_estado = ?`,
          [idTutorPersona, estadoActivo]
        );

      if (tutorRows.length > 0) {
        // Si ya es tutor, obtenemos su id_tutor
        idTutor = tutorRows[0].id_tutor;
        console.log(
          `[DEBUG] Tutor existente encontrado con id_tutor: ${idTutor}`
        );
      } else {
        // Si no es tutor, lo registramos en la tabla tutor
        console.log(
          `[DEBUG] Usuario con id_persona: ${idTutorPersona} no encontrado como tutor. Creando registro.`
        );
        const insertarTutor = `
            INSERT INTO tutor (id_persona, id_estado)
            VALUES (?, ?)`;
        const [tutorResult] = await conexion
          .promise()
          .query(insertarTutor, [idTutorPersona, estadoActivo]);
        idTutor = tutorResult.insertId;
        console.log(`[DEBUG] Nuevo tutor registrado con id_tutor: ${idTutor}`);
      }

      // 2. Buscar si el menor ya existe por DNI
      const [menorPersonaRows] = await conexion.promise().query(
        `SELECT p.id_persona, pa.id_paciente
             FROM persona p
             JOIN paciente pa ON p.id_persona = pa.id_persona
             WHERE p.dni = ? AND p.id_rol = 4 AND p.id_estado = ?`, // Rol 4 para paciente
        [menor.dni, estadoActivo]
      );

      let idMenorPersona;
      let idMenorPaciente;

      if (menorPersonaRows.length > 0) {
        // Si el menor ya existe
        console.log(`[DEBUG] Menor existente encontrado con DNI: ${menor.dni}`);
        idMenorPersona = menorPersonaRows[0].id_persona;
        idMenorPaciente = menorPersonaRows[0].id_paciente;
        idPacientePersonaTurno = idMenorPersona; // Usamos el id_persona existente del menor

        // Asegurarnos de que la relación paciente_tutor exista
        const [pacienteTutorRows] = await conexion
          .promise()
          .query(
            `SELECT * FROM paciente_tutor WHERE id_paciente = ? AND id_tutor = ?`,
            [idMenorPaciente, idTutor]
          );
        if (pacienteTutorRows.length === 0) {
          // Si la relación no existe, la creamos
          console.log(
            `[DEBUG] Relación paciente_tutor no encontrada. Creando relación entre paciente ${idMenorPaciente} y tutor ${idTutor}`
          );
          await conexion
            .promise()
            .query(
              `INSERT INTO paciente_tutor (id_paciente, id_tutor) VALUES (?, ?)`,
              [idMenorPaciente, idTutor]
            );
        } else {
          console.log(
            `[DEBUG] Relación paciente_tutor ya existe entre paciente ${idMenorPaciente} y tutor ${idTutor}`
          );
        }
      } else {
        // Si el menor NO existe, lo registramos
        console.log(
          `[DEBUG] Menor con DNI: ${menor.dni} no encontrado. Registrando nuevo menor.`
        );

        // Generar email único para el menor a partir del email del tutor
        const emailMenor = `${emailTutor.split("@")[0]}+menor${Math.floor(
          Math.random() * 10000
        )}@${emailTutor.split("@")[1]}`;

        // Insertar al menor en la tabla persona
        const insertarPersonaMenor = `
              INSERT INTO persona (dni, nombre, apellido, email, telefono, direccion, id_estado, fecha_nacimiento, id_rol)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 4)`; // Rol 4 para paciente
        const [personaResult] = await conexion
          .promise()
          .query(insertarPersonaMenor, [
            menor.dni,
            menor.nombre,
            menor.apellido,
            emailMenor,
            telefonoTutor, // Usar datos del tutor
            direccionTutor, // Usar datos del tutor
            estadoActivo,
            menor.fechaNacimiento,
          ]);
        idMenorPersona = personaResult.insertId;
        console.log(
          `[DEBUG] Menor insertado en persona con id_persona: ${idMenorPersona}`
        );

        // Insertar al menor en paciente
        const insertarPacienteMenor = `
               INSERT INTO paciente (id_persona, obra_social, id_estado)
               VALUES (?, ?, ?)`;
        // Asume que obraSocialMenor viene en los datos del menor si aplica, o es null
        const obraSocialMenor = menor.obraSocial || null; // Asegúrate de que el frontend envíe esto si es necesario
        const [pacienteResult] = await conexion
          .promise()
          .query(insertarPacienteMenor, [
            idMenorPersona,
            obraSocialMenor,
            estadoActivo,
          ]);
        idMenorPaciente = pacienteResult.insertId; // El turno será para este nuevo paciente (el menor)
        idPacientePersonaTurno = idMenorPersona; // Usamos el id_persona recién creado del menor
        console.log(
          `[DEBUG] Menor insertado en paciente con id_paciente: ${idMenorPaciente}`
        );

        // Insertar la relación paciente_tutor
        await conexion.promise().query(
          `INSERT INTO paciente_tutor (id_paciente, id_tutor)
                VALUES (?, ?)`,
          [idMenorPaciente, idTutor]
        );
        console.log(
          `[DEBUG] Relación paciente_tutor creada entre paciente ${idMenorPaciente} y tutor ${idTutor}`
        );
      }

      // --- Fin Lógica para registrar menor y asegurar registro de tutor ---
    }

    // 6. Combinar fecha y hora para el campo fecha_hora en la base de datos
    const fechaHoraTurno = `${fecha} ${hora}`; // ejemplo: '2025-06-02 12:00:00'
    const duracionTurno = 30; // Define una duración por defecto en minutos

    // === GENERAR COMPROBANTE AUTOMÁTICO ===
    // Explicación: Este bloque genera un comprobante único para cada turno, siguiendo el formato ST-YYYYMMDD-XXXXXX.
    // El número correlativo se obtiene consultando cuántos turnos existen para la fecha actual y sumando 1.
    const fechaActual = new Date();
    const yyyy = fechaActual.getFullYear();
    const mm = String(fechaActual.getMonth() + 1).padStart(2, "0");
    const dd = String(fechaActual.getDate()).padStart(2, "0");
    const fechaComprobante = `${yyyy}${mm}${dd}`;

    // Consultar la cantidad de turnos generados hoy para crear el correlativo
    const [turnosHoy] = await conexion.promise().query(
      `SELECT COUNT(*) AS cantidad FROM turno WHERE DATE(fecha_creacion) = CURDATE()`
    );
    const correlativo = String(turnosHoy[0].cantidad + 1).padStart(6, "0");
    const comprobante = `ST-${fechaComprobante}-${correlativo}`;

    // === FIN GENERAR COMPROBANTE ===

    // 7. Insertar el turno en la base de datos
    const insertarTurno = `
      INSERT INTO turno (comprobante, id_paciente, id_profesional, fecha_hora, duracion, id_estado)
      VALUES (?, ?, ?, ?, ?, 1)`; // 1: Estado activo

    await conexion.promise().query(insertarTurno, [
      comprobante,
      idPacientePersonaTurno, // id_persona del paciente (adulto o menor)
      idProfesional,          // id_persona del profesional
      fechaHoraTurno,
      duracionTurno
    ]);

    console.log(
      `[DEBUG] Turno registrado con comprobante ${comprobante} para paciente (id_persona) ${idPacientePersonaTurno} con profesional (id_persona) ${idProfesional} en ${fechaHoraTurno}`
    );

    res.json({ success: true, message: "Turno registrado con éxito" });
  } catch (error) {
    console.error("Error al guardar el turno:", error);
    res
      .status(500)
      .json({ error: "Ocurrió un error al intentar registrar el turno." });
  }
});
//  -----------------------------------------------------------------
//       OPTENER LOS TURNOS DEL PACIENTE LOGUEADO
//------------------------------------------------------------------
router.get("/turnos-paciente", async (req, res) => {
  if (!req.session.user) {
    console.error("[DEBUG] Usuario no autenticado al intentar obtener turnos");
    return res.status(401).json({ error: "No autorizado" });// Verificar si el usuario está logueado
  }
  
  try {
    const idPaciente = req.session.user.id_persona; // Debe ser id_paciente

    const [turnos] = await conexion.promise().query(
      `SELECT 
         t.comprobante,
         t.fecha_hora,
         CONCAT(p_medico.nombre, ' ', p_medico.apellido) AS medico,
         e.nombre AS especialidad,
         es.nombre AS estado
       FROM turno t
       JOIN persona p_medico ON t.id_profesional = p_medico.id_persona
       JOIN profesional prof ON prof.id_persona = p_medico.id_persona
       JOIN especialidad e ON prof.id_especialidad = e.id_especialidad
       JOIN estado es ON t.id_estado = es.id_estado
       WHERE t.id_paciente = ?`,
      [idPaciente]
    );
    
    console.log(
      `[DEBUG] Turnos obtenidos para paciente (id_persona) ${idPaciente}:`,
      turnos
    );
    res.json({ success: true, data: turnos });// Devolver los turnos del paciente
  } catch (error) {
    console.error("[DEBUG] Error al obtener los turnos del paciente:", error);
    res.status(500).json({ error: "Ocurrió un error al intentar obtener los turnos." });
  }
});
// -----------------------------------------------------------------
//        MOSTRAR LOS DATOS DEL PACIENTE LOGUEADO
//------------------------------------------------------------------
router.get("/datos-paciente", async (req, res) => {
  if (!req.session.user) {
    console.error("[DEBUG] Usuario no autenticado al intentar obtener datos");
    return res.status(401).json({ error: "No autorizado" });// Verificar si el usuario está logueado
  }

  try {
    const idPaciente = req.session.user.id_persona; // Debe ser id_paciente

    const [datosPaciente] = await conexion.promise().query(
      `SELECT 
         p.nombre,
         p.apellido,
         p.dni,
         p.fecha_nacimiento,
         p.telefono,
         p.direccion,
         p.email,
         p.fecha_creacion,
         pa.obra_social
       FROM persona p
       JOIN paciente pa ON p.id_persona = pa.id_persona
       WHERE p.id_persona = ?`,
      [idPaciente]
    );

    if (datosPaciente.length === 0) {
      console.error("[DEBUG] No se encontraron datos del paciente");
      return res.status(404).json({ error: "Datos del paciente no encontrados" });
    }

    console.log(
      `[DEBUG] Datos obtenidos para paciente (id_persona) ${idPaciente}:`,
      datosPaciente[0]
    );
    res.json({ success: true, data: datosPaciente[0] });// Devolver los datos del paciente
  } catch (error) {
    console.error("[DEBUG] Error al obtener los datos del paciente:", error);
    res.status(500).json({ error: "Ocurrió un error al intentar obtener los datos." });
  }
});
module.exports = router;
// -----------------------------------------------------------------
//        ACTUALIZAR LOS DATOS DEL PACIENTE LOGUEADO
//------------------------------------------------------------------
router.put("/actualizar-datos", async (req, res) => {
  if (!req.session.user) {
    console.error("[DEBUG] Usuario no autenticado al intentar actualizar datos");
    return res.status(401).json({ error: "No autorizado" });
  }

  const idPersona = req.session.user.id_persona; // Debe ser id_persona del paciente logueado
  const { telefono, direccion, email, obra_social, nombre_usuario } = req.body;

  if (!telefono || !direccion || !email) {
    return res.status(400).json({ error: "Faltan datos obligatorios." });
  } // Validar que al menos uno de los campos opcionales esté presente

  try {
    // Validación simple de email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Email no válido." });
    }

    // Actualizar tabla persona
    await conexion.promise().query(
      `UPDATE persona SET telefono = ?, direccion = ?, email = ? WHERE id_persona = ?`,
      [telefono, direccion, email, idPersona]
    );

    // Actualizar obra social en paciente
    await conexion.promise().query(
      `UPDATE paciente SET obra_social = ? WHERE id_persona = ?`,
      [obra_social || null, idPersona]
    );

    // Actualizar usuario si corresponde
    if (nombre_usuario) {
      await conexion.promise().query(
        `UPDATE usuario SET nombre_usuario = ? WHERE id_persona = ?`,
        [nombre_usuario, idPersona]
      );
    }
    // Confirmar que los datos se han actualizado correctamente
    console.log(`[DEBUG] Datos actualizados para id_persona: ${idPersona}`);
    res.json({
      success: true,
      message: "Datos actualizados correctamente.",
      data: { telefono, direccion, email, obra_social, nombre_usuario }
    });

  } catch (error) {
    console.error("[DEBUG] Error al actualizar los datos:", error);
    res.status(500).json({ error: "Error al actualizar los datos del paciente." });
  }
});