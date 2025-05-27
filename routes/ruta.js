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

// Obtener horarios disponibles para un profesional y fecha
router.get("/horarios-disponibles", (req, res) => {
  const id_profesional = req.query.id_profesional;
  const fecha = req.query.fecha;
  if (!id_profesional || !fecha)
    return res.status(400).json({ error: "Faltan parámetros" });

  // Obtener el día de la semana en español
  const diasSemana = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miercoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];
  const diaNombre = diasSemana[new Date(fecha).getDay()];

  conexion.query(
    `SELECT hora_inicio, hora_fin
     FROM horario_disponible
     WHERE id_profesional = ? AND dia_semana = ? AND id_estado = 1`,
    [id_profesional, diaNombre],
    (error, results) => {
      if (error)
        return res.status(500).json({ error: "Error en la base de datos" });
      res.json(results);
    }
  );
});

// Obtener días disponibles para un profesional (solo días con menos de 10 turnos)
router.get("/dias-disponibles", (req, res) => {
  const id_profesional = req.query.id_profesional;
  if (!id_profesional)
    return res.status(400).json({ error: "Falta parámetro id_profesional" });

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
          "Miercoles",
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
      conexion.query(
        `SELECT DATE(fecha_hora) as fecha, COUNT(*) as cantidad
       FROM turno
       WHERE id_profesional = ? AND DATE(fecha_hora) IN (?)
       GROUP BY DATE(fecha_hora)`,
        [id_profesional, fechas],
        (err, turnos) => {
          if (err)
            return res.status(500).json({ error: "Error en la base de datos" });
          const fechasDisponibles = fechas.filter((f) => {
            const t = turnos.find((tu) => tu.fecha === f);
            return !t || t.cantidad < 10;
          });
          res.json(fechasDisponibles);
        }
      );
    }
  );
});

module.exports = router;
