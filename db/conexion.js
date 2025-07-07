// db/conexion.js
const mysql = require("mysql2/promise");

const conexion = mysql.createPool({
  host: "localhost",
  user: "root",

  password: "password",

  database: "clinica",
});

conexion.getConnection()
  .then((conn) => {
    console.log("🟢 Conectado a la base de datos");
    conn.release();
  })
  .catch((err) => {
    console.error("🔴 Error de conexión a la base de datos:", err);
  });

module.exports = conexion;
