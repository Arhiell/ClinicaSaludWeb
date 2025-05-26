// app.js
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const port = 3000;

// Configurar body-parser para leer formularios
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, "public")));

// Configurar motor de vistas o servir HTML directamente
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
  res.sendFile(path.join(__dirname, "public", "inicio.html"));
});

// Rutas
const authRoutes = require("./routes/auth");
app.use("/", authRoutes); // para login y registro

// Iniciar servidor
app.listen(port, () => {
  console.log(`🟢 Servidor corriendo en http://localhost:${port}`);
});
