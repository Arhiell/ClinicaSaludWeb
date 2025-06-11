document.addEventListener("DOMContentLoaded", async () => {
  const tbody = document.getElementById("cuerpoTurnos");
  const mensajeNoTurnos = document.getElementById("mensajeNoTurnos");
  const tbodyMenores = document.getElementById("cuerpoTurnosMenores");
  const mensajeNoTurnosMenores = document.getElementById(
    "mensajeNoTurnosMenores"
  );

  tbody.innerHTML = ""; // Limpiar el tbody antes de agregar nuevos turnos
  tbodyMenores.innerHTML = ""; // Limpiar el tbody de menores

  try {
    const res = await fetch("/turnos-paciente");
    if (res.status === 401) {
      throw new Error("No autorizado. Por favor, inicia sesión.");
    } else if (!res.ok) {
      throw new Error(
        "No se pudo cargar la lista de turnos. Intenta más tarde."
      );
    }

    const { data, menores } = await res.json();
    console.log("Turnos propios:", data);
    console.log("Turnos de menores:", menores);

    // Mostrar turnos propios
    if (!data || data.length === 0) {
      mensajeNoTurnos.textContent = "No tienes turnos asignados.";
      mensajeNoTurnos.classList.remove("oculto");
    } else {
      mensajeNoTurnos.classList.add("oculto");

      data.forEach((turno) => {
        const tr = document.createElement("tr");
        tr.classList.add("turno");

        const fechaHora = new Date(turno.fecha_hora);
        const fecha = fechaHora.toLocaleDateString("es-AR");
        const hora = fechaHora.toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
        });

        tr.innerHTML = `
          <td>${turno.comprobante || ""}</td>
          <td>${fecha}</td>
          <td>${hora}</td>
          <td>${turno.medico || ""}</td>
          <td>${turno.especialidad || ""}</td>
          <td>${turno.estado || ""}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    // Mostrar turnos de menores
    if (!menores || menores.length === 0) {
      mensajeNoTurnosMenores.textContent =
        "No hay turnos asignados para menores a cargo.";
      mensajeNoTurnosMenores.classList.remove("oculto");
    } else {
      mensajeNoTurnosMenores.classList.add("oculto");

      menores.forEach((turno) => {
        const tr = document.createElement("tr");
        tr.classList.add("turno-menor");

        const fechaHora = new Date(turno.fecha_hora);
        const fecha = fechaHora.toLocaleDateString("es-AR");
        const hora = fechaHora.toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
        });

        tr.innerHTML = `
          <td>${turno.nombre || ""}</td>
          <td>${turno.comprobante || ""}</td>
          <td>${fecha}</td>
          <td>${hora}</td>
          <td>${turno.medico || ""}</td>
          <td>${turno.especialidad || ""}</td>
          <td>${turno.estado || ""}</td>
        `;
        tbodyMenores.appendChild(tr);
      });
    }
  } catch (error) {
    console.error("Error al cargar los turnos:", error);
    mensajeNoTurnos.textContent = error.message;
    mensajeNoTurnos.classList.remove("oculto");
    mensajeNoTurnosMenores.textContent = error.message;
    mensajeNoTurnosMenores.classList.remove("oculto");
  }
});
