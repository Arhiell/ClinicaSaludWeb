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
      return res.redirect("/inicio.html");
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
              res.redirect("/inicio.html");
            }
          );
        }
      );
    }
  );
});

module.exports = router;
