document.addEventListener("DOMContentLoaded", async () => {
  const tbody = document.getElementById("cuerpoTurnos");
  const mensajeNoTurnos = document.getElementById("mensajeNoTurnos");
  tbody.innerHTML = ""; // Limpiar el tbody antes de agregar nuevos turnos

  try {
    const res = await fetch("/turnos-paciente"); // Asegúrate de que esta ruta sea correcta y esté configurada en tu servidor
// Verificar si la respuesta es 401 (no autorizado)
    if (res.status === 401) {
      throw new Error("No autorizado. Por favor, inicia sesión.");
    } else if (!res.ok) {
      throw new Error("No se pudo cargar la lista de turnos. Intenta más tarde.");
    }

    const { data } = await res.json();
// Asegúrate de que la respuesta tenga la estructura correcta
    if (!data || data.length === 0) {
      mensajeNoTurnos.textContent = "No tienes turnos asignados.";
      mensajeNoTurnos.classList.remove("oculto");
    } else {
      mensajeNoTurnos.classList.add("oculto");

      data.forEach(turno => {
        const tr = document.createElement("tr");// Crear una nueva fila
        tr.classList.add("turno");

        const fechaHora = new Date(turno.fecha_hora);
        const fecha = fechaHora.toLocaleDateString("es-AR"); // Formatear la fecha
        // Formatear la hora
        const hora = fechaHora.toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit" 
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
  } catch (error) {
    console.error("Error al cargar los turnos:", error);
    mensajeNoTurnos.textContent = error.message;
    mensajeNoTurnos.classList.remove("oculto");
  }
});