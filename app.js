// app.js
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session"); // <-- Añadir esta línea

const app = express();
const port = 3000;

// Configurar middleware de sesión <-- Añadir este bloque
/*¿Para qué sirve?
Este bloque configura el manejo de sesiones en tu aplicación Express usando el paquete express-session.

Una sesión permite que el servidor recuerde información sobre el usuario entre distintas
 solicitudes (requests). Por ejemplo, una vez que el usuario inicia sesión, podés guardar su ID en 
 la sesión para que no tenga que volver a autenticarse en cada página que visita.

 ¿Qué significa cada parte?
secret:
Es una clave secreta que se usa para firmar la cookie de sesión.
Esta clave asegura que nadie pueda modificar los datos de sesión desde el cliente.
¡Debe ser una cadena larga y aleatoria!

resave: false:
No se vuelve a guardar la sesión en cada request si no hubo cambios. Es más eficiente.

saveUninitialized: true:
Guarda nuevas sesiones vacías (por ejemplo, cuando un visitante entra por primera vez).

cookie.secure: false:
Cuando está en true, solo se envía la cookie por HTTPS. En desarrollo usamos false.

para que funciones instalar:  pnp install express-session

*/
app.use(
  session({
    secret: "3n6#Z!q@r0$pP8v1GxF9^uR@w2ZbM",
    saveUninitialized: true,
    cookie: { secure: false }, // Cambiar a true en producción si usas HTTPS
  })
);

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
