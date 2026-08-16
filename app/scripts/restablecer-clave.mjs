// Restablece la contraseña de un usuario.
//
// Por qué existe: las contraseñas se guardan como hash bcrypt, que es irreversible
// a propósito (ver lib/auth.ts). Si alguien olvida la suya, no hay forma de
// "recuperarla": solo se puede reemplazar por una nueva. La app todavía no tiene un
// flujo de "olvidé mi contraseña" por email, así que este script cumple esa función.
//
// La contraseña se escribe en la consola y NUNCA se muestra ni se guarda en texto
// plano: se convierte en hash antes de tocar la base de datos.
//
// Uso, parado en la carpeta app/:
//   node scripts/restablecer-clave.mjs

import pg from "pg";
import fs from "node:fs";
import readline from "node:readline";
import bcrypt from "bcryptjs";

// Cargar .env.local a mano: este script no pasa por Next.js, que es quien
// normalmente lee ese archivo.
for (const linea of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = linea.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

function preguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(texto, (v) => { rl.close(); resolve(v.trim()); }));
}

// Igual que la anterior, pero muestra asteriscos en vez de lo que se escribe, para
// que la contraseña no quede a la vista de quien pase por atrás ni en la pantalla.
function preguntarOculto(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const escribirOriginal = rl._writeToOutput.bind(rl);
  let ocultando = false;
  rl._writeToOutput = (cadena) => {
    if (ocultando) rl.output.write("*");
    else escribirOriginal(cadena);
  };
  return new Promise((resolve) => {
    rl.question(texto, (v) => {
      rl.close();
      process.stdout.write("\n");
      resolve(v);
    });
    ocultando = true;
  });
}

const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
await cliente.connect();

const { rows: usuarios } = await cliente.query(`select email, role from users order by "createdAt"`);
console.log("\nUsuarios registrados:");
usuarios.forEach((u, i) => console.log(`  ${i + 1}. ${u.email} (${u.role})`));

const email = (await preguntar("\nEmail del usuario a restablecer: ")).toLowerCase();
if (!usuarios.some((u) => u.email === email)) {
  console.error("Ese email no existe. No se cambió nada.");
  await cliente.end();
  process.exit(1);
}

const clave = await preguntarOculto("Contraseña nueva (mínimo 8 caracteres): ");
if (clave.length < 8) {
  console.error("Muy corta. No se cambió nada.");
  await cliente.end();
  process.exit(1);
}
const repetida = await preguntarOculto("Repítela para confirmar: ");
if (clave !== repetida) {
  console.error("No coinciden. No se cambió nada.");
  await cliente.end();
  process.exit(1);
}

const hash = await bcrypt.hash(clave, 12);
await cliente.query(`update users set "passwordHash" = $1 where email = $2`, [hash, email]);

// Se cierran las sesiones abiertas de ese usuario: si alguien había quedado con la
// sesión iniciada usando la contraseña vieja, deja de tener acceso.
const { rowCount } = await cliente.query(
  `delete from sessions where "userId" = (select id from users where email = $1)`,
  [email]
);

console.log(`\nListo. Contraseña de ${email} actualizada.`);
console.log(`Se cerraron ${rowCount} sesión(es) abierta(s); hay que volver a iniciar sesión.`);
await cliente.end();
