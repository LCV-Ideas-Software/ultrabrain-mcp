#!/usr/bin/env node
// Confere a superficie legal que o npm realmente colocaria no tarball.
//
// O inventario do repositorio pertence aos recursos nativos do GitHub
// (Dependency Graph, License Compliance e exportacao SBOM). O pacote nao
// duplica esse grafo em Markdown mantido a mao. Para o subconjunto efetivamente
// incorporado ao bundle stdio, `scripts/bundle-mcp-server.mjs` deriva os
// componentes do metafile do esbuild e gera `dist/THIRD_PARTY_LICENSES.txt` a
// partir dos arquivos de licenca instalados. O teste de consumidor instala o
// tarball e rele esse aviso do pacote instalado.
//
// Este gate fecha a ultima fronteira: a lista retornada pelo proprio
// `npm pack --json` precisa conter os tres arquivos legais, e nenhum pode estar
// vazio. `--ignore-scripts` evita reentrancia porque `prepack` chama este gate.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ARQUIVOS_LEGAIS = ["LICENSE", "NOTICE", "dist/THIRD_PARTY_LICENSES.txt"];

const falhas = [];
const registrar = (titulo, itens) => falhas.push({ titulo, itens });

let empacotados = null;
try {
  // No Windows, `npm` e um .cmd; quando o lifecycle fornece `npm_execpath`,
  // executa-se o CLI pelo Node. A execucao avulsa cai no npm do PATH.
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

  // O npm ja retornou tanto um array quanto um objeto indexado pelo nome do
  // pacote. Nas duas formas, uma entrada contem `files`.
  const analisado = JSON.parse(bruto);
  const entradas = Array.isArray(analisado) ? analisado : Object.values(analisado);
  const comArquivos = entradas.find((entrada) => Array.isArray(entrada?.files));
  if (!comArquivos) {
    throw new Error("saida de `npm pack --json` sem lista de arquivos reconhecivel");
  }
  empacotados = comArquivos.files.map((arquivo) => arquivo.path);
} catch (erro) {
  registrar("Nao foi possivel listar o que o npm empacotaria:", [erro.message]);
}

if (empacotados) {
  const ausentes = ARQUIVOS_LEGAIS.filter((arquivo) => !empacotados.includes(arquivo));
  if (ausentes.length) {
    registrar(
      "Arquivos legais que o pacote publicado nao levaria. O artefato precisa carregar sua licenca, seu NOTICE e os textos das licencas incorporadas:",
      ausentes,
    );
  }

  const vazios = [];
  for (const arquivo of ARQUIVOS_LEGAIS.filter((item) => empacotados.includes(item))) {
    try {
      if (!readFileSync(resolve(RAIZ, arquivo), "utf8").trim()) {
        vazios.push(`${arquivo}: existe e esta vazio`);
      }
    } catch (erro) {
      vazios.push(`${arquivo}: ${erro.message}`);
    }
  }
  if (vazios.length) {
    registrar("Arquivos legais que iriam no pacote sem conteudo:", vazios);
  }
}

if (falhas.length) {
  for (const { titulo, itens } of falhas) {
    console.error(`\n${titulo}\n`);
    for (const item of itens) console.error(`  ${item}`);
  }
  console.error("");
  process.exit(1);
}

console.log(
  `Artefato de distribuicao confere: ${ARQUIVOS_LEGAIS.length} arquivos legais empacotados com conteudo.`,
);
