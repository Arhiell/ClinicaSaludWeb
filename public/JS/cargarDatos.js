// ruta: public/JS/cargarDatos.js
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
      if (fechas.length > 0) {
        fechas.forEach((fecha) => {
          const option = document.createElement("option");
          option.value = fecha;
          option.textContent = fecha;
          selectFecha.appendChild(option);
        });
      }
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
      data.forEach((horario) => {
        const option = document.createElement("option");
        option.value = horario.hora_inicio + " - " + horario.hora_fin;
        option.textContent = horario.hora_inicio + " - " + horario.hora_fin;
        selectHora.appendChild(option);
      });
    });
});
