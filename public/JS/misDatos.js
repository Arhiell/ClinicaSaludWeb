// public/JS/misDatos.js

//------------------------------------------
//   LOS DATOS DEL USUARIO                 |
//------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("btnModificar").addEventListener("click", () => {
    document.getElementById("formulario").classList.remove("oculto");
    document.querySelector(".datos-usuario").classList.add("oculto");
    document.getElementById("btnModificar").classList.add("oculto");
  });

  try {
    const res = await fetch("/datos-paciente");
    if (!res.ok) throw new Error("Error al obtener los datos del usuario.");

    const resultado = await res.json();
    const datos = resultado.data;

    // Agregamos nombre completo
    const nombreCompleto = `${datos.nombre} ${datos.apellido}`;
    document.getElementById("nombreCompleto").textContent = nombreCompleto;

    document.getElementById("usuario").textContent = datos.nombre_usuario; // Si no tenés usuario, mostrar em
    document.getElementById("dni").textContent = datos.dni;
    document.getElementById("direccion").textContent = datos.direccion;
    document.getElementById("email").textContent = datos.email;
    document.getElementById("obraSocial").textContent =
      datos.obra_social || "Sin obra social";
    document.getElementById("telefono").textContent =
      datos.telefono || "No especificado";
    const fechaNacimiento = new Date(datos.fecha_nacimiento);
    document.getElementById("fechaNacimiento").textContent = isNaN(
      fechaNacimiento.getTime()
    )
      ? "Fecha inválida"
      : fechaNacimiento.toLocaleDateString("es-AR");

    const fechaCreacion = new Date(datos.fecha_creacion);
    document.getElementById("fechaRegistro").textContent = isNaN(
      fechaCreacion.getTime()
    )
      ? "Fecha no válida"
      : fechaCreacion.toLocaleDateString("es-AR");
  } catch (error) {
    console.error("Fallo al cargar datos del paciente:", error);
    const mensaje = document.getElementById("mensajeError");
    if (mensaje) {
      mensaje.textContent =
        "No se pudieron cargar tus datos. Por favor, intenta más tarde.";
      mensaje.classList.remove("oculto");
    }
  }
});

//----------------------------------------
//    Actualizar Datos del Usuario        |
//----------------------------------------

document
  .getElementById("formulario")
  .addEventListener("submit", async function (e) {
    e.preventDefault();
    const form = e.target;
    const datos = {
      email: form.email.value,
      telefono: form.telefono.value,
      direccion: form.direccion.value,
      obra_social: form.obra_social.value,
      nombre_usuario: form.usuario.value,
    };

    const mensajeError = document.getElementById("mensajeError");
    const mensajeExito = document.getElementById("mensajeExito");
    mensajeError.classList.add("oculto");
    mensajeExito.classList.add("oculto");

    try {
      const res = await fetch("/actualizar-datos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });

      const resultado = await res.json();

      if (!res.ok) {
        mensajeError.textContent =
          resultado.error || "Error al actualizar los datos.";
        mensajeError.classList.remove("oculto");
      } else {
        mensajeExito.textContent = "Datos actualizados correctamente.";
        mensajeExito.classList.remove("oculto");
        form.reset();
        form.classList.add("oculto");
        document.querySelector(".datos-usuario").classList.remove("oculto");
        document.getElementById("btnModificar").classList.remove("oculto");
        // Opcional: recargar los datos del usuario
        location.reload();
      }
    } catch (err) {
      mensajeError.textContent = "No se pudo actualizar. Intenta más tarde.";
      mensajeError.classList.remove("oculto");
    }
  });

//----------------------------------------
// CANCELAR EL FORMULARIO
//----------------------------------------
// Función global para cancelar el formulario
function cancelarFormulario() {
  const formulario = document.getElementById("formulario");
  const mensajeError = document.getElementById("mensajeError");
  const mensajeExito = document.getElementById("mensajeExito");

  // Ocultar el formulario
  formulario.classList.add("oculto");

  // Mostrar los datos nuevamente
  document.querySelector(".datos-usuario").classList.remove("oculto");
  document.getElementById("btnModificar").classList.remove("oculto");

  // Ocultar mensajes si estaban visibles
  mensajeError.classList.add("oculto");
  mensajeExito.classList.add("oculto");

  // Reiniciar el formulario
  formulario.reset();
}
