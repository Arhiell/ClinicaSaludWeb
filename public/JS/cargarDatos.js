document.getElementById("doctor").addEventListener("change", function () {
  const idProfesional = this.value;
  const inputFecha = document.getElementById("fecha");
  inputFecha.value = "";
  inputFecha.disabled = true;

  if (!idProfesional) return;

  fetch(`/dias-disponibles?id_profesional=${idProfesional}`)
    .then((res) => res.json())
    .then((fechas) => {
      // Habilitar el campo fecha solo si hay fechas disponibles
      inputFecha.disabled = fechas.length === 0;
      // Guardar fechas válidas en un atributo para validar luego
      inputFecha.setAttribute("data-fechas-validas", JSON.stringify(fechas));
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

// Validar que solo se pueda elegir una fecha válida
document.getElementById("fecha").addEventListener("input", function () {
  const fechasValidas = JSON.parse(
    this.getAttribute("data-fechas-validas") || "[]"
  );
  if (!fechasValidas.includes(this.value)) {
    this.setCustomValidity("Selecciona una fecha disponible");
  } else {
    this.setCustomValidity("");
  }
});

// Cargar horarios disponibles al cambiar la fecha
document.getElementById("fecha").addEventListener("change", function () {
  const idProfesional = document.getElementById("doctor").value;
  const fecha = this.value;
  const selectHora = document.getElementById("hora");
  selectHora.innerHTML = '<option value="">-- Seleccioná fecha --</option>';
  if (!idProfesional || !fecha) return;
  fetch(`/horarios-disponibles?id_profesional=${idProfesional}&fecha=${fecha}`)
    .then((res) => res.json())
    .then((data) => {
      data.forEach((horario) => {
        const option = document.createElement("option");
        option.value = horario.hora_inicio + " - " + horario.hora_fin;
        option.textContent = horario.hora_inicio + " - " + horario.hora_fin;
        selectHora.appendChild(option);
      });
    });
});
