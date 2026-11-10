// Execute the actual TS sources on every supported Node version, without
// browser globals, a bundler, or a mock of the authorial algorithm.
import {readFile} from "node:fs/promises";
import ts from "typescript";
const encode = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const compile = source => ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022},
}).outputText;
const engineURL = encode(compile(await readFile(new URL("../../public-web/chronos/chronos_ai_module.ts", import.meta.url), "utf8")));
const coreURL = new URL("../../public-web/public/labs/sc5-chronos/sc5-core.mjs", import.meta.url).href;
const source = await readFile(new URL("../../app/chronos-run.ts", import.meta.url), "utf8");
const runnerURL = encode(compile(source)
  .replace('"../public-web/chronos/chronos_ai_module"', JSON.stringify(engineURL))
  .replace('"../public-web/public/labs/sc5-chronos/sc5-core.mjs"', JSON.stringify(coreURL)));
export const engine = await import(engineURL);
export const runner = await import(runnerURL);
