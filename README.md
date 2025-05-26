prueba/
│
├── app.js
├── package.json
│
├── public/ # Archivos estáticos accesibles desde el navegador
│ ├── css/
│ │ └── estilos.css
│ ├── js/
│ │ └── scripts.js
│ ├── img/
│ │ └── logo.png
│ ├── inicio.html # Página de inicio después de login
│ ├── turnos.html # Agendar turnos
│ ├── misturnos.html # Ver turnos agendados
│ └── misdatos.html # Modificar datos del paciente
│
├── views/ # (Opcional) Si usas motor de plantillas (EJS, Pug, etc.)
│ └── login.html # Página de login
│
├── routes/ # Rutas de la app
│ └── auth.js # Login, registro, etc.
│ └── turnos.js # (Opcional) Rutas para turnos
│
├── db/
│ └── conexion.js # Conexión a la base de datos
│
└── README.md
