// npm install nodemailer 
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'sandbox.smtp.mailtrap.io',
  port: 587,
  auth: {
    user: '70fc89afd66467',
    pass: 'a8d9e648703626',
  },
});

module.exports = transporter;