//--------------------------
//       BOTON MODIFICAR    |
//--------------------------

// Evento al hacer clic en el botón "Modificar"
document.getElementById("btnModificar").addEventListener("click", function () {
  const formulario = document.getElementById("formulario");
  formulario.classList.remove("oculto");

  const mensaje = document.getElementById("mensajeResultado");
  mensaje.classList.add("oculto"); // Oculta mensajes anteriores si los hay
});

//----------------------------------------------
//     CUANDO SELCCIONA UNO DE LOS BOTOENS DE  |
//             GUARDAR O CANCELAR              |
//----------------------------------------------

// Evento para el formulario
document.getElementById("formulario").addEventListener("submit", function (e) {
  e.preventDefault();

  const mensaje = document.getElementById("mensajeResultado");
  mensaje.textContent = "Cambios guardados correctamente.";
  mensaje.style.color = "green";
  mensaje.classList.remove("oculto");

  this.classList.add("oculto");
});

// Evento al cancelar
function cancelarFormulario() {
  const formulario = document.getElementById("formulario");
  formulario.classList.add("oculto");

  const mensaje = document.getElementById("mensajeResultado");
  mensaje.textContent = "Modificación cancelada.";
  mensaje.style.color = "red";
  mensaje.classList.remove("oculto");
}
