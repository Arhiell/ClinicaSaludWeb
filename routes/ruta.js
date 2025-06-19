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
        [idPersona, obra_social || "sin obra social"], // obra_social puede ser null si no se proporciona
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

router.get("/horarios-disponibles", async (req, res) => {
  const id_profesional = req.query.id_profesional;
  const fecha = req.query.fecha;

  if (!id_profesional || !fecha) {
    return res.status(400).json({ error: "Faltan parámetros" });
  }

  const diasSemana = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];
  const fechaObj = new Date(fecha + "T12:00:00Z");
  const diaNombre = diasSemana[fechaObj.getUTCDay()];

  try {
    // Obtener rango horario del profesional para ese día
    const [horario] = await conexion.promise().query(
      `SELECT hora_inicio, hora_fin
       FROM horario_disponible
       WHERE id_profesional = ? AND dia_semana = ? AND id_estado = 1
       LIMIT 1`,
      [id_profesional, diaNombre]
    );

    if (horario.length === 0) {
      return res.json([]); // No hay horarios disponibles
    }

    const { hora_inicio, hora_fin } = horario[0];

    // Verificar si el día ya tiene 10 turnos
    const [turnosPorDia] = await conexion.promise().query(
      `SELECT COUNT(*) as cantidad
       FROM turno
       WHERE id_profesional = ? AND DATE(fecha_hora) = ?`,
      [id_profesional, fecha]
    );

    if (turnosPorDia[0].cantidad >= 3) {
      return res.json([]); // Día completo
    }

    // Generar horarios de 30 minutos
    let fechaInicio = new Date(`2000-01-01T${hora_inicio}`);
    let fechaFin = new Date(`2000-01-01T${hora_fin}`);
    let horarios = [];

    while (fechaInicio < fechaFin) {
      const horaStr = fechaInicio.toTimeString().substring(0, 5) + ":00";
      horarios.push(horaStr);
      fechaInicio = new Date(fechaInicio.getTime() + 30 * 60000);
    }

    // Verificar disponibilidad de cada horario
    const consultas = horarios.map((hora) => {
      const fechaHoraStr = `${fecha} ${hora}`;
      return conexion.promise().query(
        `SELECT COUNT(*) as cantidad
         FROM turno
         WHERE id_profesional = ? AND fecha_hora = ?`,
        [id_profesional, fechaHoraStr]
      );
    });

    const resultados = await Promise.all(consultas);

    const horariosDisponibles = horarios.filter((hora, index) => {
      return resultados[index][0][0].cantidad < 2; // Solo incluir horarios con menos de 2 pacientes
    });

    const respuestaHorarios = horariosDisponibles.map((hora) => {
      if (!hora_inicio || !hora_fin) {
        return { hora_inicio: hora };
      } else {
        return { hora_inicio: hora, rango_definido: true };
      }
    });

    res.json(respuestaHorarios);
  } catch (error) {
    console.error("[DEBUG] Error en /horarios-disponibles:", error);
    res.status(500).json({ error: "Error en la base de datos" });
  }
});

// Obtener días disponibles para un profesional (solo días con menos de 10 turnos y que no sean feriados)
router.get("/dias-disponibles", async (req, res) => {
  const id_profesional = req.query.id_profesional;

  if (!id_profesional) {
    return res.status(400).json({ error: "Falta parámetro id_profesional" });
  }

  try {
    // Obtener días de la semana en los que el profesional atiende
    const [dias] = await conexion.promise().query(
      `SELECT DISTINCT hd.dia_semana
       FROM horario_disponible hd
       WHERE hd.id_profesional = ? AND hd.id_estado = 1`,
      [id_profesional]
    );

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

    // Filtrar fechas que no sean feriados nacionales
    const feriados2025 = [
      "2025-01-01",
      "2025-02-03",
      "2025-02-04",
      "2025-03-24",
      "2025-04-02",
      "2025-04-18",
      "2025-05-01",
      "2025-05-25",
      "2025-06-16",
      "2025-06-20",
      "2025-07-09",
      "2025-08-18",
      "2025-10-13",
      "2025-12-08",
      "2025-12-25",
    ];
    const fechasNoFeriado = fechas.filter((f) => !feriados2025.includes(f));

    // Verificar disponibilidad de cada fecha
    const placeholders = fechasNoFeriado.map(() => "?").join(",");
    const [turnos] = await conexion.promise().query(
      `SELECT DATE(fecha_hora) as fecha, COUNT(*) as cantidad
       FROM turno
       WHERE id_profesional = ? AND DATE(fecha_hora) IN (${placeholders})
       GROUP BY DATE(fecha_hora)`,
      [id_profesional, ...fechasNoFeriado]
    );

    const fechasDisponibles = fechasNoFeriado.filter((f) => {
      const t = turnos.find((tu) => tu.fecha === f);
      return (!t || t.cantidad < 3) && new Date(f) >= hoy;
    });

    res.json(fechasDisponibles);
  } catch (error) {
    console.error("[DEBUG] Error en /dias-disponibles:", error);
    res.status(500).json({ error: "Error en la base de datos" });
  }
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
      const estadoActivo = 1; // Asumiendo 1 es el estado activo

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
        const obraSocialMenor = menor.obraSocial || "sin obra social"; // Asegúrate de que el frontend envíe esto si es necesario
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

    // Verificar límite de 10 turnos por día
    const [turnosPorDia] = await conexion.promise().query(
      `SELECT COUNT(*) as cantidad
   FROM turno
   WHERE id_profesional = ? AND DATE(fecha_hora) = ?`,
      [idProfesional, fecha]
    );

    if (turnosPorDia[0].cantidad >= 3) {
      return res.status(400).json({
        error: "El profesional ya tiene 10 turnos agendados para este día.",
      });
    }

    // Verificar límite de 2 turnos por horario
    const [turnosPorHorario] = await conexion.promise().query(
      `SELECT COUNT(*) as cantidad
   FROM turno
   WHERE id_profesional = ? AND fecha_hora = ?`,
      [idProfesional, `${fecha} ${hora}`]
    );

    if (turnosPorHorario[0].cantidad >= 2) {
      return res.status(400).json({
        error: "Este horario ya tiene 2 pacientes agendados.",
      });
    }
    // === GENERAR COMPROBANTE AUTOMÁTICO ===
    // Explicación: Este bloque genera un comprobante único para cada turno, siguiendo el formato ST-YYYYMMDD-XXXXXX.
    // El número correlativo se obtiene consultando cuántos turnos existen para la fecha actual y sumando 1.
    const fechaActual = new Date();
    const yyyy = fechaActual.getFullYear();
    const mm = String(fechaActual.getMonth() + 1).padStart(2, "0");
    const dd = String(fechaActual.getDate()).padStart(2, "0");
    const fechaComprobante = `${yyyy}${mm}${dd}`;

    // Consultar la cantidad de turnos generados hoy para crear el correlativo
    const [turnosHoy] = await conexion
      .promise()
      .query(
        `SELECT COUNT(*) AS cantidad FROM turno WHERE DATE(fecha_creacion) = CURDATE()`
      );
    const correlativo = String(turnosHoy[0].cantidad + 1).padStart(6, "0");
    const comprobante = `ST-${fechaComprobante}-${correlativo}`;

    // === FIN GENERAR COMPROBANTE ===

    // 7. Insertar el turno en la base de datos
    const insertarTurno = `
      INSERT INTO turno (comprobante, id_paciente, id_profesional, fecha_hora, duracion, id_estado)
      VALUES (?, ?, ?, ?, ?, 9)`; // 9: Estado "Pendiente" (asumiendo que es el estado inicial)

    await conexion.promise().query(insertarTurno, [
      comprobante,
      idPacientePersonaTurno, // id_persona del paciente (adulto o menor)
      idProfesional, // id_persona del profesional
      fechaHoraTurno,
      duracionTurno,
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
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    const verTodos = req.query.todos === "true";
    const limite = verTodos ? "" : "LIMIT 3"; // solo 3 si no pidió todos
    const idPaciente = req.session.user.id_persona;

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
       WHERE t.id_paciente = ?
       ORDER BY t.fecha_hora DESC
       ${limite}`,
      [idPaciente]
    );

    const idUsuarioLogueado = req.session.user.id_usuario;
    const [rowsTutor] = await conexion.promise().query(
      `SELECT t.id_tutor
       FROM tutor t
       JOIN persona p ON t.id_persona = p.id_persona
       JOIN usuario u ON u.id_persona = p.id_persona
       WHERE u.id_usuario = ?`,
      [idUsuarioLogueado]
    );

    const idTutor = rowsTutor[0]?.id_tutor;

    const [turnosMenores] = await conexion.promise().query(
      `SELECT 
         CONCAT(p.nombre, ' ', p.apellido) AS nombre,
         t.comprobante,
         t.fecha_hora,
         CONCAT(p_medico.nombre, ' ', p_medico.apellido) AS medico,
         e.nombre AS especialidad,
         es.nombre AS estado
       FROM paciente_tutor pt
       JOIN paciente pa ON pt.id_paciente = pa.id_paciente
       JOIN persona p ON pa.id_persona = p.id_persona
       JOIN turno t ON t.id_paciente = pa.id_persona
       JOIN persona p_medico ON t.id_profesional = p_medico.id_persona
       JOIN profesional prof ON prof.id_persona = p_medico.id_persona
       JOIN especialidad e ON prof.id_especialidad = e.id_especialidad
       JOIN estado es ON t.id_estado = es.id_estado
       WHERE pt.id_tutor = ?
       ORDER BY t.fecha_hora DESC
       ${limite}`,
      [idTutor]
    );

    res.json({ success: true, data: turnos, menores: turnosMenores });
  } catch (error) {
    console.error("[DEBUG] Error al obtener los turnos:", error);
    res
      .status(500)
      .json({ error: "Ocurrió un error al intentar obtener los turnos." });
  }
});

// -----------------------------------------------------------------
//        MOSTRAR LOS DATOS DEL PACIENTE LOGUEADO
//------------------------------------------------------------------
router.get("/datos-paciente", async (req, res) => {
  if (!req.session.user) {
    console.error("[DEBUG] Usuario no autenticado al intentar obtener datos");
    return res.status(401).json({ error: "No autorizado" }); // Verificar si el usuario está logueado
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
         pa.obra_social,
         u.nombre_usuario
       FROM persona p
       JOIN paciente pa ON p.id_persona = pa.id_persona
       LEFT JOIN usuario u ON p.id_persona = u.id_persona
       WHERE p.id_persona = ?`,
      [idPaciente]
    );

    if (datosPaciente.length === 0) {
      console.error("[DEBUG] No se encontraron datos del paciente");
      return res
        .status(404)
        .json({ error: "Datos del paciente no encontrados" });
    }

    console.log(
      `[DEBUG] Datos obtenidos para paciente (id_persona) ${idPaciente}:`,
      datosPaciente[0]
    );
    res.json({ success: true, data: datosPaciente[0] }); // Devolver los datos del paciente
  } catch (error) {
    console.error("[DEBUG] Error al obtener los datos del paciente:", error);
    res
      .status(500)
      .json({ error: "Ocurrió un error al intentar obtener los datos." });
  }
});

// -----------------------------------------------------------------
//        ACTUALIZAR LOS DATOS DEL PACIENTE LOGUEADO
//------------------------------------------------------------------
router.put("/actualizar-datos", async (req, res) => {
  if (!req.session.user) {
    console.error(
      "[DEBUG] Usuario no autenticado al intentar actualizar datos"
    );
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
    await conexion
      .promise()
      .query(
        `UPDATE persona SET telefono = ?, direccion = ?, email = ? WHERE id_persona = ?`,
        [telefono, direccion, email, idPersona]
      );

    // Actualizar obra social en paciente
    await conexion
      .promise()
      .query(`UPDATE paciente SET obra_social = ? WHERE id_persona = ?`, [
        obra_social || null,
        idPersona,
      ]);

    // Actualizar usuario si corresponde
    if (nombre_usuario) {
      await conexion
        .promise()
        .query(`UPDATE usuario SET nombre_usuario = ? WHERE id_persona = ?`, [
          nombre_usuario,
          idPersona,
        ]);
    }
    // Confirmar que los datos se han actualizado correctamente
    console.log(`[DEBUG] Datos actualizados para id_persona: ${idPersona}`);
    res.json({
      success: true,
      message: "Datos actualizados correctamente.",
      data: { telefono, direccion, email, obra_social, nombre_usuario },
    });
  } catch (error) {
    console.error("[DEBUG] Error al actualizar los datos:", error);
    res
      .status(500)
      .json({ error: "Error al actualizar los datos del paciente." });
  }
});

module.exports = router;
