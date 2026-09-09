/**
 * Gera o hash a ser colado em CLOSE_OPERATION_PASSWORD_HASH no .env.
 *
 * Uso:
 *   npm run hash:password -- "SuaSenhaAqui"
 *
 * A senha em texto puro NUNCA é salva em nenhum lugar — só passa pela
 * memória do processo o tempo suficiente para gerar o hash impresso abaixo.
 */
import { hashPassword } from "../src/security/password";

const plain = process.argv[2];

if (!plain) {
  console.error('Uso: npm run hash:password -- "SuaSenhaAqui"');
  process.exit(1);
}

if (plain.length < 6) {
  console.error("⚠️  Senha muito curta (mínimo 6 caracteres recomendado). Gerando mesmo assim...");
}

console.log(hashPassword(plain));
console.log("\nCole o valor acima em CLOSE_OPERATION_PASSWORD_HASH no seu .env.");
