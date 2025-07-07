const db = require('../db/conexion'); // tu módulo de conexión
const transporter = require('./nodemailer');

async function revisarYEnviarEmails() {
  const [cambios] = await db.execute(`
    SELECT 
    h.id_historial,
    h.id_turno,
    ea.nombre_estado AS estado_anterior,
    en.nombre_estado AS estado_nuevo,
    t.id_paciente,
    p.email,
    p.nombre
    FROM historial_estado_turno h
    JOIN turno t ON h.id_turno = t.id_turno
    JOIN persona p ON t.id_paciente = p.id_persona
    JOIN estado ea ON h.estado_anterior = ea.id_estado
    JOIN estado en ON h.estado_nuevo = en.id_estado
    WHERE h.enviado = FALSE
  `);

  for (const cambio of cambios) {
    const mensajeHTML = `
      <p>Hola ${cambio.nombre},</p>
      <p>El estado de tu turno ha cambiado:</p>
      <p><strong>De:</strong> ${cambio.estado_anterior} → <strong>A:</strong> ${cambio.estado_nuevo}</p>
    `;

    try {
      await transporter.sendMail({
        from: '"Clínica Goya" <tucorreo@gmail.com>',
        to: cambio.email,
        subject: 'Actualización del estado de tu turno',
        html: mensajeHTML,
      });

      await db.execute('UPDATE historial_estado_turno SET enviado = TRUE WHERE id_historial = ?', [cambio.id_historial]);

      const hora = new Date().toLocaleTimeString();
      console.log(`Correo enviado a ${cambio.email} a las ${hora}`);
    } catch (error) {
      console.error(`Error enviando a ${cambio.email}:`, error.message);
    }
  }
}

// Ejecutar cada 1 minuto
setInterval(revisarYEnviarEmails, 1 * 60 * 1000);
