// PARA EL MENU DE HEARDER
function toggleMenu() {
  const menu = document.querySelector("nav ul.menu");
  const toggleButton = document.querySelector(".menu-toggle");
  const isOpen = menu.classList.toggle("show");
  toggleButton.setAttribute("aria-expanded", isOpen);
}

// PARA CERRAR SECCION
function cerrarSesion() {
  // Si usás localStorage o sessionStorage
  sessionStorage.clear(); // o localStorage.clear();

  // Redirigís al login
  window.location.href = "../login.html";
}
  // Obtener la URL actual
  const currentUrl = window.location.href;

  // Seleccionar todos los enlaces del menú
  const menuLinks = document.querySelectorAll('nav .menu a');

  menuLinks.forEach(link => {
    // Verifica si el href del enlace está contenido en la URL actual
    if (currentUrl.includes(link.getAttribute('href'))) {
      link.classList.add('activo');
    }
  });


