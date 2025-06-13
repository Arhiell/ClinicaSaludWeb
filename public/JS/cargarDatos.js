// ruta: public/JS/cargarDatos.js

function cerrarSesion() {
  sessionStorage.clear();
  window.location.href = "../login.html";
}

// Mostrar u ocultar sección del menor
document.getElementById("turnoMenor").addEventListener("change", function () {
  const seccion = document.getElementById("seccionMenor");
  seccion.style.display = this.checked ? "block" : "none";
});

document.getElementById("doctor").addEventListener("change", function () {
  console.log("Evento change de especialista disparado");
  const idProfesional = this.value;
  console.log("ID profesional seleccionado:", idProfesional);
  const selectFecha = document.getElementById("fecha");
  selectFecha.innerHTML = '<option value="">-- Seleccionar día --</option>';
  selectFecha.disabled = true;

  // Limpiar horarios
  const selectHora = document.getElementById("hora");
  selectHora.innerHTML = '<option value="">-- Seleccioná fecha --</option>';

  if (!idProfesional) return;

  fetch(`/dias-disponibles?id_profesional=${idProfesional}`)
    .then((res) => res.json())
    .then((fechas) => {
      console.log("Fechas recibidas del backend:", fechas);
      selectFecha.disabled = fechas.length === 0;
      selectFecha.innerHTML = '<option value="">-- Seleccionar día --</option>'; // Limpiar opciones anteriores
      if (fechas.length > 0) {
        fechas.forEach((fecha) => {
          const option = document.createElement("option");
          option.value = fecha;
          option.textContent = fecha;
          selectFecha.appendChild(option);
        });
      } else {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No hay días disponibles";
        selectFecha.appendChild(option);
      }
    })
    .catch((error) => {
      console.error("Error al cargar días disponibles:", error);
    });
});

// Cargar especialidades al iniciar
document.addEventListener("DOMContentLoaded", function () {
  fetch("/especialidades")
    .then((res) => res.json())
    .then((data) => {
      const selectEspecialidad = document.getElementById("especialidad");
      data.forEach((esp) => {
        const option = document.createElement("option");
        option.value = esp.id_especialidad;
        option.textContent = esp.nombre;
        selectEspecialidad.appendChild(option);
      });
    });
});

// Cargar especialistas al cambiar especialidad
document.getElementById("especialidad").addEventListener("change", function () {
  const idEspecialidad = this.value;
  const selectDoctor = document.getElementById("doctor");
  selectDoctor.innerHTML =
    '<option value="">-- Seleccionar Especialista --</option>';
  if (!idEspecialidad) return;
  fetch(`/profesionales?id_especialidad=${idEspecialidad}`)
    .then((res) => res.json())
    .then((data) => {
      data.forEach((doc) => {
        const option = document.createElement("option");
        option.value = doc.id_profesional;
        option.textContent = doc.nombre + " " + doc.apellido;
        selectDoctor.appendChild(option);
      });
    });
});

// Cargar horarios disponibles al cambiar la fecha
document.getElementById("fecha").addEventListener("change", function () {
  const idProfesional = document.getElementById("doctor").value;
  const fecha = this.value;
  console.log("Evento change de fecha disparado");
  console.log("ID profesional:", idProfesional, "Fecha seleccionada:", fecha);
  const selectHora = document.getElementById("hora");
  selectHora.innerHTML = '<option value="">-- Seleccioná fecha --</option>';
  if (!idProfesional || !fecha) return;
  fetch(`/horarios-disponibles?id_profesional=${idProfesional}&fecha=${fecha}`)
    .then((res) => res.json())
    .then((data) => {
      console.log("Horarios recibidos del backend:", data);
      selectHora.innerHTML = '<option value="">-- Seleccioná horario --</option>'; // Limpiar opciones anteriores
      if (data.length > 0) {
        data.forEach((horario) => {
          const option = document.createElement("option");
          option.value = horario.hora_inicio;
          option.textContent = horario.hora_inicio; // Mostrar solo hora_inicio
          selectHora.appendChild(option);
        });
      } else {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No hay horarios disponibles";
        selectHora.appendChild(option);
      }
    })
    .catch((error) => {
      console.error("Error al cargar horarios disponibles:", error);
    });
});

//  Guardar el turno en la base de datos.
document.getElementById("formTurno").addEventListener("submit", (e) => {
  e.preventDefault(); // evita que recargue la página

  const idProfesional = document.getElementById("doctor").value;
  const fecha = document.getElementById("fecha").value;
  const hora = document.getElementById("hora").value;

  const esMenor = document.getElementById("turnoMenor").checked;

  const datosTurno = {
    idProfesional,
    fecha,
    hora,
  };

  // Si es para menor, agregamos los datos del menor
  if (esMenor) {
    datosTurno.menor = {
      nombre: document.getElementById("nombreMenor").value,
      apellido: document.getElementById("apellidoMenor").value,
      dni: document.getElementById("dniMenor").value,
      fechaNacimiento: document.getElementById("fechaNacimientoMenor").value,
      relacion: document.getElementById("relacion").value,
      obraSocial: document.getElementById("obraSocialMenor")?.value || null,
    };
  }

  // Validar campos básicos
  if (!idProfesional || !fecha || !hora) {
    alert("Por favor completá todos los campos del turno.");
    return;
  }

  // Validar datos del menor si aplica
  if (
    esMenor &&
    (!datosTurno.menor.nombre ||
      !datosTurno.menor.apellido ||
      !datosTurno.menor.dni ||
      !datosTurno.menor.fechaNacimiento ||
      !datosTurno.menor.relacion)
  ) {
    alert("Por favor completá todos los datos del menor.");
    return;
  }

  fetch("/guardar-turno", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datosTurno),
  })
    .then((res) => res.json())
    .then((data) => {
      console.log("Respuesta del servidor:", data); // Depuración
      const mensajeError = document.getElementById("mensajeError");
      const mensajeExito = document.getElementById("mensajeExito");

      if (data.success) {
        mensajeExito.textContent = "Turno registrado con éxito.";
        mensajeExito.style.display = "block";
        mensajeError.style.display = "none";

        // Resetear el formulario y ocultar la sección del menor
        document.getElementById("formTurno").reset();
        document.getElementById("seccionMenor").style.display = "none";
      } else {
        mensajeError.textContent = "Error al registrar turno: " + data.error;
        mensajeError.style.display = "block";
        mensajeExito.style.display = "none";
      }
    })
    .catch((err) => {
      console.error("Error al guardar el turno:", err);
      const mensajeError = document.getElementById("mensajeError");
      const mensajeExito = document.getElementById("mensajeExito");

      mensajeError.textContent =
        "Ocurrió un error al intentar registrar el turno.";
      mensajeError.style.display = "block";
      mensajeExito.style.display = "none";
    });
});
