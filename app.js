// app.js
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session"); // <-- Añadir esta línea

const app = express();
const port = 3000;
// Configuarar express-session
app.use(session({
  secret: "3n6#Z!q@r0$pP8v1GxF9^uR@w2ZbM",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Cambiar a true si usás HTTPS
    maxAge: 1000 * 60 * 60 // 1 hora, opcional
  }
}));

// Configurar body-parser para leer formularios
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, "public")));

// Configurar motor de vistas o servir HTML directamente
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Rutas
const authRoutes = require("./routes/ruta");
app.use("/", authRoutes); // para login y registro

// Iniciar servidor
app.listen(port, () => {
  console.log(`🟢 Servidor corriendo en http://localhost:${port}`);
});
