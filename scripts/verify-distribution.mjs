#!/usr/bin/env node
// Confere, de forma deterministica, o que sai deste repositorio como artefato
// de distribuicao.
//
// Existe por causa de uma deriva real: a versao 1.2.15 foi publicada no npm e
// depois `package.json` e `THIRDPARTY.md` ganharam tres dependencias de
// desenvolvimento em `main` sem que nada notasse a divergencia entre o pacote
// publicado e o repositorio. Os avisos obrigatorios estavam corretos nos dois
// — a deriva era so de inventario de desenvolvimento —, mas nada garantia isso:
// descobriu-se por auditoria manual, e por auditoria manual e que nao se
// descobre a proxima.
//
// Tres conferencias, todas fecham em falha:
//
//   A. toda dependencia declarada no manifesto aparece no THIRDPARTY.md, e
//      toda linha do THIRDPARTY.md corresponde a uma dependencia declarada;
//   B. o que o `npm pack` empacota traz os quatro arquivos legais;
//   C. todo pacote incorporado ao bundle stdio tem o texto de licenca
//      reproduzido em dist/THIRD_PARTY_LICENSES.txt.
//
// Uso:
//   node scripts/verify-distribution.mjs

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const falhas = [];
const registrar = (titulo, itens) => {
  falhas.push({ titulo, itens });
};

const manifesto = JSON.parse(readFileSync(resolve(RAIZ, "package.json"), "utf8"));
const inventario = readFileSync(resolve(RAIZ, "THIRDPARTY.md"), "utf8");

// ------------------------------------------------------- A. inventario legal

// As linhas do inventario tem a forma "- `nome`, Licenca[, observacao]". So
// interessa o nome: a licenca em si ja e conferida contra o lockfile pelo
// proprio npm, e repetir a comparacao aqui daria a impressao de uma segunda
// fonte de verdade que nao existe.
const nomesNoInventario = new Set(
  [...inventario.matchAll(/^-\s+`([^`]+)`/gmu)].map((m) => m[1]),
);

// `Research-only references` lista trabalhos consultados, nao dependencias.
// Ele nao usa a forma de lista com crase, entao nao entra na varredura acima —
// mas se um dia entrar, esta conferencia acusaria falso positivo. O corte fica
// explicito para que a suposicao seja visivel.
const declaradas = new Set([
  ...Object.keys(manifesto.dependencies || {}),
  ...Object.keys(manifesto.devDependencies || {}),
  ...Object.keys(manifesto.optionalDependencies || {}),
  ...Object.keys(manifesto.peerDependencies || {}),
]);

const ausentesNoInventario = [...declaradas].filter((n) => !nomesNoInventario.has(n)).sort();
if (ausentesNoInventario.length) {
  registrar(
    "Dependencias declaradas no package.json que nao constam do THIRDPARTY.md:",
    ausentesNoInventario,
  );
}

const inventariadasSemManifesto = [...nomesNoInventario]
  .filter((n) => !declaradas.has(n))
  .sort();
if (inventariadasSemManifesto.length) {
  registrar(
    "Linhas do THIRDPARTY.md sem dependencia correspondente no package.json. Um inventario que nomeia o que nao existe e tao errado quanto um que omite:",
    inventariadasSemManifesto,
  );
}

// ------------------------------------------------------- B. arquivos legais

// O campo `files` diz a intencao; `npm pack` diz o resultado. Um `.npmignore`
// ou um padrao mal escrito derruba um arquivo legal sem avisar, e o pacote sai
// sem LICENSE. A conferencia e sobre a lista que o npm de fato empacotaria.
const ARQUIVOS_LEGAIS = [
  "LICENSE",
  "NOTICE",
  "THIRDPARTY.md",
  "dist/THIRD_PARTY_LICENSES.txt",
];

let empacotados = null;
try {
  // `--ignore-scripts` evita reentrancia: `prepack` roda o build, que roda este
  // gate. A saida JSON vem depois de ruido do npm em algumas versoes, entao
  // corta-se a partir do primeiro colchete.
  // Chama-se o CLI do npm pelo proprio Node em vez do executavel de shell: no
  // Windows, `npm` e um `.cmd` e o Node recusa spawn direto de arquivo em lote
  // (EINVAL) desde a correcao de CVE-2024-27980. `npm_execpath` e definido pelo
  // npm quando ele invoca o script; rodando o gate solto, cai no `npm` do PATH
  // via shell, com argumentos literais e nenhuma interpolacao.
  const cliDoNpm = process.env.npm_execpath;
  const bruto = cliDoNpm
    ? execFileSync(
        process.execPath,
        [cliDoNpm, "pack", "--dry-run", "--json", "--ignore-scripts"],
        { cwd: RAIZ, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
      )
    : execFileSync("npm pack --dry-run --json --ignore-scripts", [], {
        cwd: RAIZ,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
        shell: true,
        stdio: ["ignore", "pipe", "ignore"],
      });
  // `npm pack --json` ja teve duas formas de saida: um array com um elemento
  // por tarball, e um objeto indexado pelo nome do pacote. As duas trazem
  // `files` com o mesmo formato. Aceitar so uma delas prenderia o gate a uma
  // versao do npm, e a falha seria de analise, nao de conteudo — barulho no
  // lugar de sinal.
  const analisado = JSON.parse(bruto);
  const entradas = Array.isArray(analisado) ? analisado : Object.values(analisado);
  const comArquivos = entradas.find((e) => Array.isArray(e?.files));
  if (!comArquivos) {
    throw new Error("saida de `npm pack --json` sem lista de arquivos reconhecivel");
  }
  empacotados = comArquivos.files.map((f) => f.path);
} catch (erro) {
  registrar("Nao foi possivel listar o que o npm empacotaria:", [erro.message]);
}

if (empacotados) {
  const ausentes = ARQUIVOS_LEGAIS.filter((a) => !empacotados.includes(a));
  if (ausentes.length) {
    registrar(
      "Arquivos legais que o pacote publicado nao levaria. O artefato distribuido tem de carregar o texto das licencas que ele incorpora:",
      ausentes,
    );
  }
}

// -------------------------------------- C. avisos dos componentes empacotados

// O bundler grava este arquivo a partir dos pacotes que de fato entraram no
// bundle stdio. Conferi-lo aqui pega o caso em que alguem publica sem ter
// gerado o dist, ou em que a geracao passou a nao cobrir um pacote novo.
const CAMINHO_LICENCAS = resolve(RAIZ, "dist/THIRD_PARTY_LICENSES.txt");
if (!existsSync(CAMINHO_LICENCAS)) {
  registrar("Avisos dos componentes empacotados ausentes:", [
    "dist/THIRD_PARTY_LICENSES.txt nao existe. Rode: npm run build",
  ]);
} else {
  const licencas = readFileSync(CAMINHO_LICENCAS, "utf8");
  const cobertos = new Set(
    [...licencas.matchAll(/^(@?[^\s@]+(?:\/[^\s@]+)?)@\d[^\s]*$/gmu)].map((m) => m[1]),
  );
  if (!cobertos.size) {
    registrar("Avisos dos componentes empacotados sem nenhum pacote nomeado:", [
      "dist/THIRD_PARTY_LICENSES.txt nao lista componente algum",
    ]);
  }
  // O bundle so pode incorporar o que o manifesto resolve. O componente
  // empacotado declarado no inventario tem de estar entre os cobertos.
  const empacotadoDeclarado = "@modelcontextprotocol/sdk";
  if (declaradas.has(empacotadoDeclarado) && !cobertos.has(empacotadoDeclarado)) {
    registrar("Componente empacotado sem texto de licenca reproduzido:", [
      `${empacotadoDeclarado} e incorporado ao bundle stdio mas nao aparece em dist/THIRD_PARTY_LICENSES.txt`,
    ]);
  }
}

// ------------------------------------------------------------------ resultado

if (falhas.length) {
  for (const { titulo, itens } of falhas) {
    console.error(`\n${titulo}\n`);
    for (const i of itens) console.error(`  ${i}`);
  }
  console.error("");
  process.exit(1);
}

console.log(
  `Artefato de distribuicao confere: ${declaradas.size} dependencias inventariadas, ${ARQUIVOS_LEGAIS.length} arquivos legais empacotados.`,
);
