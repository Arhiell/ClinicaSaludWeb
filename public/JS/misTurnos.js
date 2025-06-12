document.addEventListener("DOMContentLoaded", async () => {
  const tbody = document.getElementById("cuerpoTurnos");
  const mensajeNoTurnos = document.getElementById("mensajeNoTurnos");
  const tbodyMenores = document.getElementById("cuerpoTurnosMenores");
  const mensajeNoTurnosMenores = document.getElementById(
    "mensajeNoTurnosMenores"
  );
  const verMasTurnosBtn = document.getElementById("verMasTurnos");
  const verMasTurnosMenoresBtn = document.getElementById("verMasTurnosMenores");

  let mostrarTodosTurnos = false; // Estado para alternar entre "ver más" y "ver menos"
  let mostrarTodosTurnosMenores = false; // Estado para alternar entre "ver más" y "ver menos"

  // Función para cargar turnos
  async function cargarTurnos(todos = false) {
    tbody.innerHTML = "";
    mensajeNoTurnos.classList.add("oculto");

    try {
      const response = await fetch(`/turnos-paciente?todos=${todos}`);
      const data = await response.json();

      if (data.success && data.data.length > 0) {
        data.data.forEach((turno) => {
          const fila = document.createElement("tr");
          fila.innerHTML = `
            <td>${turno.comprobante}</td>
            <td>${new Date(turno.fecha_hora).toLocaleDateString()}</td>
            <td>${new Date(turno.fecha_hora).toLocaleTimeString()}</td>
            <td>${turno.medico}</td>
            <td>${turno.especialidad}</td>
            <td>${turno.estado}</td>
          `;
          tbody.appendChild(fila);
        });
      } else {
        mensajeNoTurnos.classList.remove("oculto");
        mensajeNoTurnos.textContent = "No tienes turnos registrados.";
      }
    } catch (error) {
      console.error("Error al cargar los turnos:", error);
    }
  }

  // Función para cargar turnos de menores
  async function cargarTurnosMenores(todos = false) {
    tbodyMenores.innerHTML = "";
    mensajeNoTurnosMenores.classList.add("oculto");

    try {
      const response = await fetch(`/turnos-paciente?todos=${todos}`);
      const data = await response.json();

      if (data.success && data.menores.length > 0) {
        data.menores.forEach((turno) => {
          const fila = document.createElement("tr");
          fila.innerHTML = `
            <td>${turno.nombre}</td>
            <td>${turno.comprobante}</td>
            <td>${new Date(turno.fecha_hora).toLocaleDateString()}</td>
            <td>${new Date(turno.fecha_hora).toLocaleTimeString()}</td>
            <td>${turno.medico}</td>
            <td>${turno.especialidad}</td>
            <td>${turno.estado}</td>
          `;
          tbodyMenores.appendChild(fila);
        });
      } else {
        mensajeNoTurnosMenores.classList.remove("oculto");
        mensajeNoTurnosMenores.textContent =
          "No hay turnos registrados para menores.";
      }
    } catch (error) {
      console.error("Error al cargar los turnos de menores:", error);
    }
  }

  // Cargar los turnos iniciales (limitados)
  cargarTurnos();
  cargarTurnosMenores();

  // Manejar clic en "Ver más turnos"
  verMasTurnosBtn.addEventListener("click", () => {
    mostrarTodosTurnos = !mostrarTodosTurnos; // Alternar estado
    cargarTurnos(mostrarTodosTurnos);
    verMasTurnosBtn.textContent = mostrarTodosTurnos
      ? "Ver menos turnos"
      : "Ver más turnos";
  });

  // Manejar clic en "Ver más turnos de menores"
  verMasTurnosMenoresBtn.addEventListener("click", () => {
    mostrarTodosTurnosMenores = !mostrarTodosTurnosMenores; // Alternar estado
    cargarTurnosMenores(mostrarTodosTurnosMenores);
    verMasTurnosMenoresBtn.textContent = mostrarTodosTurnosMenores
      ? "Ver menos turnos de menores"
      : "Ver más turnos de menores";
  });
});
