// routee/ruta.js

const express = require("express");
const router = express.Router();
const conexion = require("../db/conexion");
const ESTADO_ACTIVO = 1;
const ESTADO_TURNO_PENDIENTE = 9;
// -----------------------------------------------------------------
//           INICIO DE SECCION POR PARTE DEL PACIENTE
//------------------------------------------------------------------

// Login de usuarios
router.post("/login", async (req, res) => {
  const { usuario, password } = req.body;

  const sql = `
    SELECT u.*, p.nombre, p.apellido, p.id_rol, p.email, p.telefono, p.direccion, pa.id_paciente
    FROM usuario u
    JOIN persona p ON u.id_persona = p.id_persona
    LEFT JOIN paciente pa ON p.id_persona = pa.id_persona -- Unir con paciente para obtener id_paciente si es paciente
    WHERE u.nombre_usuario = ? AND u.id_estado = 1 -- Asumiendo id_estado 1 es activo
    LIMIT 1
  `;

try {
    const [results] = await conexion.execute(sql, [usuario]);

    if (results.length === 0) {
      return res.status(401).json({ error: "Usuario no encontrado o inactivo" });
    }

    const user = results[0];

    // Comparación de contraseña (sin hash, solo temporalmente)
    if (password === user.contrasena) {
      console.log("Usuario autenticado:", user.nombre_usuario);

      // Guardar en sesión
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
        id_paciente: user.id_paciente,
      };

      console.log("Sesión guardada:", req.session.user);
      return res.json({ success: true, redirect: "/HTML/inicio.html" });
    } else {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }
  } catch (err) {
    console.error("Error en el login:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

// --------------------------------------------------------------------------
//       RESGISTRAR AL NUEVO PACIENTE CON SUS CONTRASEÑA Y NOMBRE DE USUARIO
//---------------------------------------------------------------------------
// Registro de pacientes
router.post("/register", async (req, res) => {
  const {
    nombre,
    apellido,
    dni,
    fecha_nacimiento,
    telefono,
    direccion,
    email,
    obra_social,
    nombre_usuario,
    contrasena,
  } = req.body;

  if (!email || !nombre_usuario || !contrasena) {
    console.error("Faltan datos obligatorios para el registro");
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  const insertarPersona = `
    INSERT INTO persona (nombre, apellido, dni, fecha_nacimiento, telefono, direccion, email, id_rol, id_estado)
    VALUES (?, ?, ?, ?, ?, ?, ?, 4, 1)`;

  try {
    const [resultadoPersona] = await conexion.execute(
      insertarPersona,
      [nombre, apellido, dni, fecha_nacimiento, telefono, direccion, email]
    );
    const idPersona = resultadoPersona.insertId;

    const insertarPaciente = `
      INSERT INTO paciente (id_persona, obra_social, id_estado)
      VALUES (?, ?, 1)`;

    await conexion.execute(
      insertarPaciente,
      [idPersona, obra_social || "sin obra social"]
    );

    const insertarUsuario = `
      INSERT INTO usuario (nombre_usuario, contrasena, id_persona, id_estado)
      VALUES (?, ?, ?, 1)`;

    await conexion.execute(
      insertarUsuario,
      [nombre_usuario, contrasena, idPersona]
    );

    res.json({ success: true, redirect: "/HTML/inicio.html" });
  } catch (err) {
    console.error("Error en el registro:", err);
    res.status(500).json({ error: "Error al registrar usuario o paciente" });
  }
});

// -----------------------------------------------------------------
//       OPTENER LAS EPECIALIDADES, ESPECIALISTAS, DIAS Y HORARIO
//------------------------------------------------------------------

// Obtener especialidades
router.get("/especialidades", async (req, res) => {
  try {
    const [results] = await conexion.execute(
      "SELECT id_especialidad, nombre FROM especialidad WHERE id_estado = 1"
    );
    res.json(results);
  } catch (error) {
    console.error("Error al obtener especialidades:", error);
    res.status(500).json({ error: "Error en la base de datos" });
  }
});

// Obtener profesionales por especialidad
router.get("/profesionales", async (req, res) => {
  const id_especialidad = req.query.id_especialidad;
  if (!id_especialidad)
    return res.status(400).json({ error: "Falta parámetro id_especialidad" });

  try {
    const [results] = await conexion.execute(
      `SELECT p.id_persona AS id_profesional, per.nombre, per.apellido
       FROM profesional p
       JOIN persona per ON p.id_persona = per.id_persona
       WHERE p.id_especialidad = ? AND p.id_estado = 1`,
      [id_especialidad]
    );
    res.json(results);
  } catch (error) {
    console.error("Error al obtener profesionales:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});
// Obtener horarios disponibles para un profesional en una fecha específica
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
    const [horario] = await conexion.execute(
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
    const [turnosPorDia] = await conexion.execute(
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
      return conexion.execute(
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
    const [dias] = await conexion.execute(
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
    
    // Si no hay fechas, devolver vacío sin consultar
    if (fechasNoFeriado.length === 0) {
  return res.json([]);
}
// Consultar turnos para las fechas filtradas
    const [turnos] = await conexion.execute(
      `SELECT DATE(fecha_hora) as fecha, COUNT(*) as cantidad
       FROM turno
       WHERE id_profesional = ? AND DATE(fecha_hora) IN (${placeholders})
       GROUP BY DATE(fecha_hora)`,
      [id_profesional, ...fechasNoFeriado]
    );
// Filtrar fechas que tengan menos de 3 turnos y sean futuras
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

// Función auxiliar para generar comprobante
async function generarComprobante(idPaciente, fechaHora) {
  const fechaFormateada = new Date(fechaHora).toISOString().replace(/[-:T.]/g, "").slice(0, 14);
  const aleatorio = Math.floor(Math.random() * 90000 + 10000);
  return `CMP-${idPaciente}-${fechaFormateada}-${aleatorio}`;
}

// Función auxiliar para registrar menor y devolver su id_persona
async function registrarMenor(menor, idTutor, connection) {
  const { nombre, apellido, dni, fechaNacimiento } = menor;
async function registrarMenor(menor, idTutor, connection) {
  const { nombre, apellido, dni, fechaNacimiento } = menor;
  const email = `menor${dni}@sinmail.com`; // Email ficticio para menores

  // Insertar persona
  const [personaResult] = await connection.execute(`
    INSERT INTO persona (nombre, apellido, dni, fecha_nacimiento, email, id_rol, id_estado)
    VALUES (?, ?, ?, ?, ?, 3, ?)
  `, [nombre, apellido, dni, fechaNacimiento, email, ESTADO_ACTIVO]);

  const idPersona = personaResult.insertId;

  // Insertar paciente
  const [pacienteResult] = await connection.execute(`
    INSERT INTO paciente (id_persona)
    VALUES (?)
  `, [idPersona]);

  const idPaciente = pacienteResult.insertId;

  // Relación paciente-tutor
  await connection.execute(`
    INSERT INTO paciente_tutor (id_paciente, id_tutor)
    VALUES (?, ?)
  `, [idPaciente, idTutor]);

  return idPersona;
}
  // Insertar persona
  const [personaResult] = await connection.execute(`
    INSERT INTO persona (nombre, apellido, dni, fecha_nacimiento, id_rol, id_estado)
    VALUES (?, ?, ?, ?, 3, ?)
  `, [nombre, apellido, dni, fechaNacimiento, ESTADO_ACTIVO]);

  const idPersona = personaResult.insertId;

  // Insertar paciente
  const [pacienteResult] = await connection.execute(`
    INSERT INTO paciente (id_persona)
    VALUES (?)
  `, [idPersona]);

  const idPaciente = pacienteResult.insertId;

  // Relación paciente-tutor
  await connection.execute(`
    INSERT INTO paciente_tutor (id_paciente, id_tutor)
    VALUES (?, ?)
  `, [idPaciente, idTutor]);

  return idPersona;
}

// Endpoint POST
router.post("/guardar-turno", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const { fecha, hora, idProfesional, menor } = req.body; //aqui esta el error
  console.log("[DEBUG] Body recibido:", req.body);
  if (!fecha || !hora || !idProfesional) {
    return res.status(400).json({ error: "Faltan datos requeridos" });
  }

  const connection = await conexion.getConnection();

  try {
    await connection.beginTransaction();

    const fechaHoraTurno = `${fecha} ${hora}`;
    const idPersona = req.session.user.id_persona;

    // Validar que no haya turno ya asignado
    const [turnosExistentes] = await connection.execute(`
      SELECT id_turno FROM turno 
      WHERE id_profesional = ? AND fecha_hora = ?
    `, [idProfesional, fechaHoraTurno]);

    if (turnosExistentes.length > 0) {
      throw new Error("El profesional ya tiene un turno asignado en esa fecha y hora");
    }

    // Determinar paciente (adulto o menor)
    let idPaciente;
    if (menor) {
      let idTutor;
      const [tutorRows] = await connection.execute(`
        SELECT id_tutor FROM tutor WHERE id_persona = ?
      `, [idPersona]);

      if (tutorRows.length > 0) {
        idTutor = tutorRows[0].id_tutor;
      } else {
        // Registrar al usuario logueado como tutor
        const [result] = await connection.execute(`
          INSERT INTO tutor (id_persona, id_estado) VALUES (?, ?)
        `, [idPersona, ESTADO_ACTIVO]);
        idTutor = result.insertId;
      }

      idPaciente = await registrarMenor(menor, idTutor, connection);
    } else {
      idPaciente = idPersona;
    }

    // Generar comprobante
    const comprobante = await generarComprobante(idPaciente, fechaHoraTurno);

    // Insertar el turno
    const duracion = 30; // minutos

    await connection.execute(`
      INSERT INTO turno (id_paciente, id_profesional, fecha_hora, comprobante, duracion, id_estado)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [idPaciente, idProfesional, fechaHoraTurno, comprobante, duracion, ESTADO_TURNO_PENDIENTE]);

    await connection.commit();
    return res.json({ success: true, comprobante });

  } catch (error) {
    await connection.rollback();
    console.error("[DEBUG] Error al guardar turno:", error.message);
    return res.status(500).json({ error: error.message });
  } finally {
    connection.release();
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

    const [turnos] = await conexion.execute(
      `
      SELECT 
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

    // Buscar si es tutor
    const idUsuarioLogueado = req.session.user.id_usuario;
    const [rowsTutor] = await conexion.execute(
      `
      SELECT t.id_tutor
      FROM tutor t
      JOIN persona p ON t.id_persona = p.id_persona
      JOIN usuario u ON u.id_persona = p.id_persona
      WHERE u.id_usuario = ?`,
      [idUsuarioLogueado]
    );

    const idTutor = rowsTutor[0]?.id_tutor;

    // Si no es tutor, no consultamos menores
    let turnosMenores = [];
    if (idTutor) {
      const [resultMenores] = await conexion.execute(
        `
        SELECT 
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

      turnosMenores = resultMenores;
    }

    res.json({ success: true, data: turnos, menores: turnosMenores });
  } catch (error) {
    console.error("[DEBUG] Error al obtener los turnos:", error);
    res.status(500).json({ error: "Ocurrió un error al intentar obtener los turnos." });
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

    const [datosPaciente] = await conexion.execute(
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
    return res.status(401).json({ error: "No autorizado" });
  }

  const idPersona = req.session.user.id_persona;
  const { telefono, direccion, email, obra_social, nombre_usuario } = req.body;

  try {
    // Validar email solo si se envía
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Email no válido." });
    }

    // Actualizar campos dinámicamente en persona
    const camposPersona = [];
    const valoresPersona = [];

    if (telefono) {
      camposPersona.push("telefono = ?");
      valoresPersona.push(telefono);
    }
    if (direccion) {
      camposPersona.push("direccion = ?");
      valoresPersona.push(direccion);
    }
    if (email) {
      camposPersona.push("email = ?");
      valoresPersona.push(email);
    }

    if (camposPersona.length > 0) {
      await conexion.execute(
          `UPDATE persona SET ${camposPersona.join(", ")} WHERE id_persona = ?`,
          [...valoresPersona, idPersona]
        );
    }

    // Actualizar obra social si se envía
    if (typeof obra_social !== "undefined") {
      await conexion.execute(`UPDATE paciente SET obra_social = ? WHERE id_persona = ?`, [
          obra_social || null,
          idPersona,
        ]);
    }

    // Actualizar nombre de usuario si se envía
    if (nombre_usuario) {
      await conexion.execute(`UPDATE usuario SET nombre_usuario = ? WHERE id_persona = ?`, [
        nombre_usuario,
        idPersona,
      ]);
    }

    res.json({
      success: true,
      message: "Datos actualizados correctamente.",
    });
  } catch (error) {
    console.error("[DEBUG] Error al actualizar los datos:", error);
    res.status(500).json({ error: "Error al actualizar los datos del paciente." });
  }
});

require('../mailservice/notificador');
module.exports = router;
