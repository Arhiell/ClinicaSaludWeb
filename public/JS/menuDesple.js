// PARA EL MENU DE HEARDER
function toggleMenu() {
  const menu = document.querySelector("nav ul.menu");
  menu.classList.toggle("show");
}

// PARA CERRAR SECCION
function cerrarSesion() {
  // Si usás localStorage o sessionStorage
  sessionStorage.clear(); // o localStorage.clear();

  // Redirigís al login
  window.location.href = "../login.html";
}
