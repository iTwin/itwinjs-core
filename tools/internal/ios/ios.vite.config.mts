/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { globSync } from "glob";
import { isBuiltin } from "node:module";
import path from "node:path";

const builtinModulePrefix = "\0ios-node-builtin:";
const emptyModuleId = "\0ios-empty-module";
const testEntryId = "\0ios-test-entry";

const callableCommonJsModules = ["assert", "chai-as-promised", "deep-equal-in-any-order", "touch"];

const modulesToIgnore = [
  /ECSqlTestParser\.js$/,
  /ECSqlTestRunner\.test\.js$/,
  /growl\.js$/,
  /xunit\.js$/,
  /bunyan/,
  /mocha[\\/]lib[\\/]nodejs[\\/]/,
  /mocha[\\/]lib[\\/]cli[\\/]/,
  /supports-color/,
];

function createLineIdentitySourceMap(id: string, source: string) {
  const lineCount = source.split("\n").length;
  return {
    mappings: Array.from({ length: lineCount }, (_, index) => index === 0 ? "AAAA" : "AACA").join(";"),
    names: [],
    sources: [id],
    sourcesContent: [source],
    version: 3,
  };
}

// The compiled ESM preserves namespace imports, but the iOS tests call these CommonJS exports as functions.
// Rewrite only known callable dependencies and Node builtins before Rollup resolves them.
function normalizeCallableCommonJsImports() {
  return {
    name: "normalize-callable-commonjs-imports",
    enforce: "pre",
    transform(code, id) {
      let transformed = code;
      for (const moduleName of callableCommonJsModules) {
        const namespaceImport = new RegExp(`import \\* as ([A-Za-z_$][\\w$]*) from (["'])${moduleName}\\2;`, "g");
        transformed = transformed.replace(namespaceImport, `import $1 from "${moduleName}";`);
      }

      const builtinNamespaceImport = /import \* as ([A-Za-z_$][\w$]*) from (["'])([^"']+)\2;/g;
      transformed = transformed.replace(builtinNamespaceImport, (statement, binding, _quote, moduleName) =>
        isBuiltin(moduleName) ? `import ${binding} from "${moduleName}";` : statement);

      if (transformed === code)
        return undefined;

      // These replacements preserve line boundaries, so line-level mappings are sufficient for downstream source maps.
      return { code: transformed, map: createLineIdentitySourceMap(id, code) };
    },
  };
}

// The embedded iOS runtime exposes Node builtins through require, not as loadable ESM modules.
function loadBuiltinsWithRequire() {
  return {
    name: "load-ios-builtins-with-require",
    enforce: "pre",
    resolveId(source) {
      return isBuiltin(source) ? `${builtinModulePrefix}${source}` : undefined;
    },
    load(id) {
      if (!id.startsWith(builtinModulePrefix))
        return undefined;

      const builtin = id.slice(builtinModulePrefix.length);
      return {
        code: `const builtinModule = require(${JSON.stringify(builtin)});\nexport default builtinModule;`,
        syntheticNamedExports: true,
      };
    },
  };
}

// These optional Node paths depend on APIs unavailable in the embedded runtime and are not exercised by the iOS suite.
function ignoreUnsupportedModules() {
  return {
    name: "ignore-unsupported-ios-modules",
    enforce: "pre",
    resolveId(source) {
      return modulesToIgnore.some((pattern) => pattern.test(source)) ? emptyModuleId : undefined;
    },
    load(id) {
      return id === emptyModuleId ? "export default {};" : undefined;
    },
  };
}

// Mocha setup must execute before every test module, and the runner must execute only after all tests register.
function createOrderedTestEntry() {
  return {
    name: "create-ordered-ios-test-entry",
    resolveId(source) {
      return source === testEntryId ? testEntryId : undefined;
    },
    load(id) {
      if (id !== testEntryId)
        return undefined;

      const testsGlob = process.env.TESTS_GLOB;
      if (!testsGlob)
        this.error("TESTS_GLOB must identify the compiled iOS tests.");

      const testsPattern = path.resolve(process.cwd(), testsGlob);
      const files = [
        path.resolve(__dirname, "scripts/configureMocha.js"),
        ...globSync(testsPattern),
        path.resolve(__dirname, "scripts/runMocha.js"),
      ];

      return files.map((file) => `import ${JSON.stringify(file)};`).join("\n");
    },
  };
}

const commonJsBanner = [
  'import { createRequire as createRequireForBundledCommonJs } from "node:module";',
  'import { dirname as dirnameForBundledCommonJs } from "node:path";',
  'import { fileURLToPath as fileURLToPathForBundledCommonJs } from "node:url";',
  "const require = createRequireForBundledCommonJs(import.meta.url);",
  "const __filename = fileURLToPathForBundledCommonJs(import.meta.url);",
  "const __dirname = dirnameForBundledCommonJs(__filename);",
].join("\n");

export default {
  build: {
    commonjsOptions: {
      // Mobile loads the native binding through process._linkedBinding before reaching the fallback dynamic require.
      ignore: (id) => isBuiltin(id),
      ignoreDynamicRequires: true,
      include: [/./],
      transformMixedEsModules: true,
    },
    copyPublicDir: false,
    emptyOutDir: false,
    minify: false,
    outDir: path.resolve(__dirname, "../lib/ios/assets"),
    reportCompressedSize: false,
    rollupOptions: {
      input: testEntryId,
      output: {
        banner: commonJsBanner,
        entryFileNames: "main.js",
        format: "es",
        inlineDynamicImports: true,
        sourcemapPathTransform: (sourcePath, sourcemapPath) => `file:///${path.resolve(path.dirname(sourcemapPath), sourcePath)}`,
      },
    },
    sourcemap: true,
    target: "esnext",
  },
  define: {
    // Preserve Webpack's development-mode test behavior, including enabled assertions.
    "process.env.NODE_ENV": '"development"',
  },
  environments: {
    client: { keepProcessEnv: true },
  },
  plugins: [normalizeCallableCommonJsImports(), loadBuiltinsWithRequire(), ignoreUnsupportedModules(), createOrderedTestEntry()],
  publicDir: false,
  resolve: {
    alias: [{ find: /^mocha$/, replacement: "mocha/lib/mocha" }],
    conditions: ["node", "development"],
    mainFields: ["main"],
  },
};
