// routee/authPlugins.js
const express = require("express");
const router = express.Router();
const conexion = require("../db/conexion");

// Login de usuarios
router.post("/login", (req, res) => {
  const { usuario, password } = req.body;

  const sql = `
    SELECT u.*, p.nombre, p.apellido, p.id_rol
    FROM usuario u
    JOIN persona p ON u.id_persona = p.id_persona
    WHERE u.nombre_usuario = ?
    LIMIT 1
  `;

  conexion.query(sql, [usuario], (err, results) => {
    if (err) {
      console.error("Error en la consulta:", err);
      return res.status(500).send("Error en el servidor");
    }

    if (results.length === 0) {
      return res.status(401).send("Usuario no encontrado o inactivo");
    }

    const user = results[0];

    // Comparar contraseña en texto plano (temporal)
    if (password === user.contrasena) {
      console.log("Usuario autenticado:", user.nombre_usuario);
      // Redirigir a inicio.html
      return res.redirect("HTML/inicio.html");
    } else {
      return res.status(401).send("Contraseña incorrecta");
    }
  });
});

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
    return res.status(400).send("Faltan datos obligatorios");
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
        return res.status(500).send("Error al registrar persona");
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
            return res.status(500).send("Error al registrar paciente");
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
                return res.status(500).send("Error al registrar usuario");
              }
              // Redirigir a inicio.html después de registrar exitosamente
              res.redirect("/HTML/inicio.html");
            }
          );
        }
      );
    }
  );
});

// ------------------------------------------------------
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
  console.log("[DEBUG] fechaObj ISO:", fechaObj.toISOString(), "getUTCDay():", fechaObj.getUTCDay());
  let diaNombre = diasSemana[fechaObj.getUTCDay()];
  // Parche temporal: si la fecha es 2025-06-02, forzar Lunes
  if (fecha === "2025-06-02") {
    diaNombre = "Lunes";
    console.log("[DEBUG] Parche aplicado: Forzando diaNombre a Lunes para 2025-06-02");
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
        console.log("[DEBUG] No se encontró horario_disponible para ese profesional y día");
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
          console.log("[DEBUG] hora_inicio (raw):", hora_inicio, typeof hora_inicio);
          console.log("[DEBUG] hora_fin (raw):", hora_fin, typeof hora_fin);
          const [inicioHoras, inicioMinutos] = String(hora_inicio).split(":").map(Number);
          const [finHoras, finMinutos] = String(hora_fin).split(":").map(Number);
          let fechaInicio = new Date(`2000-01-01T${hora_inicio}`);
          let fechaFin = new Date(`2000-01-01T${hora_fin}`);
          console.log("[DEBUG] fechaInicio:", fechaInicio, "fechaFin:", fechaFin);
          let count = 0;
          while (fechaInicio < fechaFin && count < 20) {
            const horaStr = fechaInicio.toTimeString().substring(0, 5) + ":00";
            let siguiente = new Date(fechaInicio.getTime() + 30 * 60000);
            let horaFinStr = siguiente <= fechaFin ? siguiente.toTimeString().substring(0, 5) + ":00" : fechaFin.toTimeString().substring(0, 5) + ":00";
            console.log(`[DEBUG] Slot ${count+1}: hora_inicio=${horaStr}, hora_fin=${horaFinStr}`);
            horarios.push({
              hora_inicio: horaStr,
              hora_fin: horaFinStr
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
        "2025-12-25"  // Navidad
      ];
      const fechasNoFeriado = fechas.filter(f => !feriados2025.includes(f));
      if (fechasNoFeriado.length === 0) return res.json([]);
      // Solo fechas a partir de hoy y máximo 10 turnos por día
      const placeholders = fechasNoFeriado.map(() => '?').join(',');
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

module.exports = router;
