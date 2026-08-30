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
// e lanca erro se qualquer pacote empacotado nao traz arquivo de licenca ou
// traz um vazio; e `scripts/published-consumer-security-regression.mjs`
// (test:consumer) empacota o tarball, instala-o num consumidor limpo e le
// dist/THIRD_PARTY_LICENSES.txt do pacote INSTALADO. Repetir isso aqui seria
// uma terceira copia, mais fraca, da mesma verificacao.
//
// Duas conferencias, ambas fecham em falha:
//
//   A. toda dependencia declarada no manifesto aparece no THIRDPARTY.md, uma
//      vez so, na secao certa, com o MESMO rotulo de licenca que o lockfile
//      registra para ela; a observacao entre parenteses, quando ha, e de
//      vocabulario fechado e afirma um fato conferido contra o manifesto e
//      contra o bundle; e toda entrada de dependencia do THIRDPARTY.md
//      corresponde a uma dependencia declarada;
//   B. o que o `npm pack` de fato empacotaria traz os quatro arquivos legais,
//      e nenhum deles esta vazio.
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

// ------------------------------------------------------- A. inventario legal

const declaradas = new Set([
  ...Object.keys(manifesto.dependencies || {}),
  ...Object.keys(manifesto.devDependencies || {}),
  ...Object.keys(manifesto.optionalDependencies || {}),
  ...Object.keys(manifesto.peerDependencies || {}),
]);

const soDesenvolvimento = (nome) =>
  Object.hasOwn(manifesto.devDependencies || {}, nome) &&
  !Object.hasOwn(manifesto.dependencies || {}, nome) &&
  !Object.hasOwn(manifesto.optionalDependencies || {}, nome) &&
  !Object.hasOwn(manifesto.peerDependencies || {}, nome);

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

// Nem a observacao entre parenteses nem a secao do inventario sao texto livre:
// cada forma aceita afirma um FATO, e o fato e conferido contra a fonte dele —
// o manifesto para "e de desenvolvimento" e "e de runtime", o bundle para "e
// empacotada". Uma forma nova entra aqui, com o seu predicado, antes de entrar
// no inventario. Com o arquivo de avisos ausente, `empacotadasNoBundle` e null
// e as comparacoes estritas dao falso: nenhuma afirmacao sobre o bundle e
// aceita sem a fonte que a confirma.
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

// A secao em que a entrada aparece tambem afirma algo, e uma entrada na secao
// errada e uma classificacao falsa publicada — `zod` sob "Development
// dependencies" passaria por dependencia de desenvolvimento. A secao mista
// exige observacao, porque e ela que diz qual dos dois fatos vale ali.
const SECOES = new Map([
  [
    "Direct runtime dependencies:",
    { valida: (nome) => Object.hasOwn(manifesto.dependencies || {}, nome), exigeObservacao: false },
  ],
  [
    "Bundled runtime component and build-only dependencies:",
    { valida: (nome) => soDesenvolvimento(nome), exigeObservacao: true },
  ],
  [
    "Development dependencies:",
    {
      valida: (nome) => soDesenvolvimento(nome) && empacotadasNoBundle?.has(nome) === false,
      exigeObservacao: false,
    },
  ],
]);

// Um unico reconhecedor para toda entrada de dependencia, no sentido direto e
// no inverso. Reconhecer a entrada por prefixo exato numa direcao e por regex
// folgada na outra deixava passar uma duplicata escrita com dois espacos apos
// o marcador: a contagem nao a via, e o sentido inverso a aceitava como
// declarada. O rotulo continua NAO sendo extraido: `resto` e conferido inteiro
// contra a verdade conhecida do lockfile.
const ENTRADA = /^-\s+`([^`]+)`(.*)$/u;
const CABECALHO = /^([^\s`-].*:)$/u;
const entradas = [];
let secaoAtual = null;
for (const linha of inventario.split(/\r?\n/u)) {
  const cabecalho = CABECALHO.exec(linha);
  if (cabecalho) {
    secaoAtual = cabecalho[1];
    continue;
  }
  const entrada = ENTRADA.exec(linha);
  if (entrada) entradas.push({ nome: entrada[1], resto: entrada[2], secao: secaoAtual });
}
const porNome = new Map();
for (const e of entradas) {
  if (!porNome.has(e.nome)) porNome.set(e.nome, []);
  porNome.get(e.nome).push(e);
}

const semLockfile = [];
const ausentesNoInventario = [];
const duplicadas = [];
const rotulosDivergentes = [];
const observacoesFalsas = [];
const secoesErradas = [];
for (const nome of [...declaradas].sort()) {
  const registro = lockfile.packages?.[`node_modules/${nome}`];
  if (typeof registro?.license !== "string" || !registro.license.trim()) {
    semLockfile.push(nome);
    continue;
  }
  const licenca = registro.license.trim();
  const ocorrencias = porNome.get(nome) || [];
  if (ocorrencias.length === 0) {
    ausentesNoInventario.push(`${nome} (lockfile: ${licenca})`);
    continue;
  }
  if (ocorrencias.length > 1) {
    duplicadas.push(nome);
    continue;
  }
  const { resto, secao } = ocorrencias[0];

  // Rotulo: o resto da linha e ", <licenca>" ou ", <licenca> <observacao>".
  let observacao = null;
  if (resto !== `, ${licenca}`) {
    if (!resto.startsWith(`, ${licenca} `)) {
      rotulosDivergentes.push(
        `${nome}: inventario diz "${resto.replace(/^,\s*/u, "")}", lockfile diz "${licenca}"`,
      );
      continue;
    }
    observacao = resto.slice(`, ${licenca} `.length);
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
      continue;
    }
  }

  // Secao: a entrada precisa estar sob um cabecalho conhecido cujo predicado
  // seja verdadeiro para ela.
  const regra = secao === null ? null : SECOES.get(secao);
  if (!regra) {
    secoesErradas.push(
      `${nome}: esta sob "${secao ?? "(nenhum cabecalho)"}", que nao e uma secao de dependencias conhecida (${[...SECOES.keys()].map((s) => `"${s}"`).join(", ")})`,
    );
    continue;
  }
  if (!regra.valida(nome)) {
    secoesErradas.push(
      `${nome}: esta sob "${secao}", e o manifesto e o bundle dizem que nao pertence a essa secao`,
    );
    continue;
  }
  if (regra.exigeObservacao && observacao === null) {
    secoesErradas.push(
      `${nome}: a secao "${secao}" exige uma observacao que diga qual dos dois casos se aplica`,
    );
  }
}

// Sentido inverso, com o MESMO reconhecedor de entrada. `Research-only
// references` lista trabalhos consultados, nao dependencias, e nao usa a forma
// de lista com crase — por isso nao entra aqui. Se um dia passar a usar, esta
// conferencia acusa, e e melhor um falso positivo visivel do que uma linha
// fantasma silenciosa.
const inventariadasSemManifesto = [...porNome.keys()].filter((n) => !declaradas.has(n)).sort();

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
  registrar("Dependencias com mais de uma entrada no THIRDPARTY.md:", duplicadas);
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
if (secoesErradas.length) {
  registrar(
    "Entradas do THIRDPARTY.md na secao errada. A secao classifica o componente, e uma classificacao falsa e publicada junto com ele:",
    secoesErradas,
  );
}
if (inventariadasSemManifesto.length) {
  registrar(
    "Entradas do THIRDPARTY.md sem dependencia correspondente no package.json. Um inventario que nomeia o que nao existe e tao errado quanto um que omite:",
    inventariadasSemManifesto,
  );
}

// ------------------------------------------------------- B. arquivos legais

// O campo `files` diz a intencao; `npm pack` diz o resultado. Um `.npmignore`
// ou um padrao mal escrito derruba um arquivo legal sem avisar, e o pacote sai
// sem LICENSE. A conferencia e sobre a lista que o npm de fato empacotaria — e,
// para cada arquivo listado, sobre o conteudo: um LICENSE de zero bytes chega
// ao tarball com o mesmo nome e nenhum texto.
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
  const entradasDoPack = Array.isArray(analisado) ? analisado : Object.values(analisado);
  const comArquivos = entradasDoPack.find((e) => Array.isArray(e?.files));
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
  const vazios = [];
  for (const arquivo of ARQUIVOS_LEGAIS.filter((a) => empacotados.includes(a))) {
    let conteudo = "";
    try {
      conteudo = readFileSync(resolve(RAIZ, arquivo), "utf8");
    } catch (erro) {
      vazios.push(`${arquivo}: ${erro.message}`);
      continue;
    }
    if (!conteudo.trim()) vazios.push(`${arquivo}: existe e esta vazio`);
  }
  if (vazios.length) {
    registrar(
      "Arquivos legais que iriam no pacote sem conteudo. Um arquivo vazio com o nome certo nao e um aviso:",
      vazios,
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
  `Artefato de distribuicao confere: ${declaradas.size} dependencias com nome, secao e licenca conferidos contra manifesto, lockfile e bundle; ${ARQUIVOS_LEGAIS.length} arquivos legais empacotados com conteudo.`,
);
