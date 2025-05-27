// db/conexion.js
const mysql = require("mysql2");

const conexion = mysql.createConnection({
  host: "",
  user: "",
  password: "",
  database: "clinica",
});

conexion.connect((err) => {
  if (err) throw err;
  console.log("🟢 Conectado a la base de datos");
});

module.exports = conexion;
