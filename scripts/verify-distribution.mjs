#!/usr/bin/env node
// Confere, de forma deterministica, a superficie legal que sai deste
// repositorio no tarball publicado.
//
// Existe por causa de uma deriva real: depois de 1.2.15, `package.json` ganhou
// dependencias de desenvolvimento e `THIRDPARTY.md` — prosa mantida a mao, que
// VAI no tarball pelo campo `files` — ficou semanas sem acompanha-las, e nada
// reclamou. Descobriu-se por auditoria manual, e por auditoria manual e que nao
// se descobre a proxima.
//
// O que este gate NAO confere, porque outros ja conferem a partir de fontes
// melhores: os avisos dos componentes incorporados ao bundle stdio.
// `scripts/bundle-mcp-server.mjs` deriva esse conjunto do metafile do esbuild
// e lanca erro se qualquer pacote empacotado nao traz arquivo de licenca; e
// `scripts/published-consumer-security-regression.mjs` (test:consumer) empacota
// o tarball, instala-o num consumidor limpo e le dist/THIRD_PARTY_LICENSES.txt
// do pacote INSTALADO. Repetir isso aqui seria uma terceira copia, mais fraca,
// da mesma verificacao.
//
// Duas conferencias, ambas fecham em falha:
//
//   A. toda dependencia declarada no manifesto aparece no THIRDPARTY.md, uma
//      vez so, com o MESMO rotulo de licenca que o lockfile registra para ela;
//      a observacao entre parenteses, quando ha, e de vocabulario fechado e
//      afirma um fato conferido contra o manifesto e contra o bundle; e toda
//      linha de dependencia do THIRDPARTY.md corresponde a uma dependencia
//      declarada;
//   B. o que o `npm pack` de fato empacotaria traz os quatro arquivos legais.
//
// Uso:
//   node scripts/verify-distribution.mjs

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const falhas = [];
const registrar = (titulo, itens) => {
  falhas.push({ titulo, itens });
};

const manifesto = JSON.parse(readFileSync(resolve(RAIZ, "package.json"), "utf8"));
const lockfile = JSON.parse(readFileSync(resolve(RAIZ, "package-lock.json"), "utf8"));
const inventario = readFileSync(resolve(RAIZ, "THIRDPARTY.md"), "utf8");
const linhasDoInventario = inventario.split(/\r?\n/u);

// ------------------------------------------------------- A. inventario legal

// As linhas de dependencia do inventario tem a forma "- `nome`, Rotulo" com uma
// observacao opcional entre parenteses no fim. O rotulo NAO e extraido da
// linha: ele e conferido contra a verdade conhecida — o campo `license` que o
// npm registra no lockfile para cada dependencia. Comparar contra o valor
// esperado dispensa qualquer regra para separar rotulo de observacao, e por
// isso nao quebra em expressoes SPDX inteiramente parentizadas, como
// "(MIT AND Zlib)", que sao forma real do registro npm.
const declaradas = new Set([
  ...Object.keys(manifesto.dependencies || {}),
  ...Object.keys(manifesto.devDependencies || {}),
  ...Object.keys(manifesto.optionalDependencies || {}),
  ...Object.keys(manifesto.peerDependencies || {}),
]);

// A observacao entre parenteses nao e texto livre nem vocabulario solto: cada
// forma aceita afirma um FATO, e o fato e conferido contra a fonte dele. Um
// vocabulario sem amarra deixaria "(development only)" numa dependencia de
// runtime, ou "(bundled)" numa que nunca entrou no bundle — rotulo certo,
// leitura errada. Uma observacao nova entra aqui, com o seu predicado, antes de
// entrar no inventario.
//
// "E empacotada" vem do arquivo de avisos que o bundler escreve a partir do
// metafile do esbuild, no mesmo `npm test`, um passo antes deste. Sem esse
// arquivo nao ha como conferir a afirmacao, e o gate para em vez de supor.
const CAMINHO_AVISOS = resolve(RAIZ, "dist/THIRD_PARTY_LICENSES.txt");
let empacotadasNoBundle = null;
try {
  const avisos = readFileSync(CAMINHO_AVISOS, "utf8");
  empacotadasNoBundle = new Set(
    [...avisos.matchAll(/^(@?[^\s@]+(?:\/[^\s@]+)?)@[^\s]+$/gmu)].map((m) => m[1]),
  );
} catch (erro) {
  registrar("Nao foi possivel ler o arquivo de avisos que o bundler escreve. Rode: npm run build", [
    `${CAMINHO_AVISOS}: ${erro.message}`,
  ]);
}

const soDesenvolvimento = (nome) =>
  Object.hasOwn(manifesto.devDependencies || {}, nome) &&
  !Object.hasOwn(manifesto.dependencies || {}, nome) &&
  !Object.hasOwn(manifesto.optionalDependencies || {}, nome) &&
  !Object.hasOwn(manifesto.peerDependencies || {}, nome);

// Com o arquivo de avisos ausente, `empacotadasNoBundle` e null e as duas
// comparacoes estritas abaixo dao falso: nenhuma observacao e aceita sem a
// fonte que a confirma.
const OBSERVACOES = new Map([
  [
    "(development only)",
    (nome) => soDesenvolvimento(nome) && empacotadasNoBundle?.has(nome) === false,
  ],
  [
    "(reachable stdio subset is bundled)",
    (nome) => soDesenvolvimento(nome) && empacotadasNoBundle?.has(nome) === true,
  ],
]);

const semLockfile = [];
const ausentesNoInventario = [];
const rotulosDivergentes = [];
const observacoesFalsas = [];
const duplicadas = [];
for (const nome of [...declaradas].sort()) {
  const entrada = lockfile.packages?.[`node_modules/${nome}`];
  if (typeof entrada?.license !== "string" || !entrada.license.trim()) {
    semLockfile.push(nome);
    continue;
  }
  const licenca = entrada.license.trim();
  const prefixo = `- \`${nome}\`, `;
  const candidatas = linhasDoInventario.filter((l) => l.startsWith(prefixo));
  if (candidatas.length === 0) {
    ausentesNoInventario.push(`${nome} (lockfile: ${licenca})`);
    continue;
  }
  if (candidatas.length > 1) {
    duplicadas.push(nome);
    continue;
  }
  const restante = candidatas[0].slice(prefixo.length);
  if (restante === licenca) continue;
  if (!restante.startsWith(`${licenca} `)) {
    rotulosDivergentes.push(`${nome}: inventario diz "${restante}", lockfile diz "${licenca}"`);
    continue;
  }
  const observacao = restante.slice(licenca.length + 1);
  const verdadeira = OBSERVACOES.get(observacao);
  if (!verdadeira) {
    rotulosDivergentes.push(
      `${nome}: observacao "${observacao}" nao esta no vocabulario aceito (${[...OBSERVACOES.keys()].join(", ")})`,
    );
    continue;
  }
  if (!verdadeira(nome)) {
    observacoesFalsas.push(
      `${nome}: a observacao "${observacao}" nao corresponde ao que o manifesto e o bundle registram`,
    );
  }
}

if (semLockfile.length) {
  registrar(
    "Dependencias declaradas no package.json sem entrada com licenca no package-lock.json. O lockfile e a fonte do rotulo; sem ele nao ha o que conferir. Rode: npm install",
    semLockfile,
  );
}
if (ausentesNoInventario.length) {
  registrar(
    "Dependencias declaradas no package.json que nao constam do THIRDPARTY.md:",
    ausentesNoInventario,
  );
}
if (duplicadas.length) {
  registrar("Dependencias com mais de uma linha no THIRDPARTY.md:", duplicadas);
}
if (rotulosDivergentes.length) {
  registrar(
    "Rotulos de licenca do THIRDPARTY.md que nao batem com o package-lock.json. O inventario vai no tarball e afirma a licenca de cada componente; um rotulo errado e uma afirmacao legal errada:",
    rotulosDivergentes,
  );
}
if (observacoesFalsas.length) {
  registrar(
    "Observacoes do THIRDPARTY.md que afirmam o que o manifesto e o bundle desmentem. Uma observacao so entra no inventario quando e verdadeira:",
    observacoesFalsas,
  );
}

// Sentido inverso. `Research-only references` lista trabalhos consultados, nao
// dependencias, e nao usa a forma de lista com crase — por isso nao entra aqui.
// Se um dia passar a usar, esta conferencia acusa, e e melhor um falso positivo
// visivel do que uma linha fantasma silenciosa.
const nomesNoInventario = [...inventario.matchAll(/^-\s+`([^`]+)`/gmu)].map((m) => m[1]);
const inventariadasSemManifesto = nomesNoInventario.filter((n) => !declaradas.has(n)).sort();
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
// test:consumer ja prova que dist/THIRD_PARTY_LICENSES.txt chega ao pacote
// instalado; os outros tres so sao provados aqui.
const ARQUIVOS_LEGAIS = ["LICENSE", "NOTICE", "THIRDPARTY.md", "dist/THIRD_PARTY_LICENSES.txt"];

let empacotados = null;
try {
  // `--ignore-scripts` evita reentrancia: `prepack` roda o build, que roda este
  // gate. Chama-se o CLI do npm pelo proprio Node em vez do executavel de
  // shell: no Windows, `npm` e um `.cmd` e o Node recusa spawn direto de arquivo
  // em lote (EINVAL) desde a correcao de CVE-2024-27980. `npm_execpath` e
  // definido pelo npm quando ele invoca o script; rodando o gate solto, cai no
  // `npm` do PATH via shell, com argumentos literais e nenhuma interpolacao.
  const cliDoNpm = process.env.npm_execpath;
  const bruto = cliDoNpm
    ? execFileSync(
        process.execPath,
        [cliDoNpm, "pack", "--dry-run", "--json", "--ignore-scripts"],
        {
          cwd: RAIZ,
          encoding: "utf8",
          maxBuffer: 32 * 1024 * 1024,
          stdio: ["ignore", "pipe", "ignore"],
        },
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
  `Artefato de distribuicao confere: ${declaradas.size} dependencias com nome e licenca conferidos contra o lockfile, ${ARQUIVOS_LEGAIS.length} arquivos legais empacotados.`,
);
