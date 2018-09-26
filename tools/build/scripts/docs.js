/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

process.env.NODE_ENV = "prod";

const isCI = (process.env.TF_BUILD);

const paths = require("./config/paths");
const path = require("path");
const cpx = require("cpx");
const fs = require("fs");
const { spawn, handleInterrupts } = require("./utils/simpleSpawn");
const { validateTags } = require("./utils/validateTags");
const argv = require("yargs").argv;


// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on("unhandledRejection", err => {
    throw err;
});

const source = (argv.source === undefined) ? paths.appSrc : argv.source;
const out = (argv.out === undefined) ? paths.appDocs : argv.out;
const json = (argv.json === undefined) ? paths.appJsonDocs : argv.json;

const baseUrlOptions = (argv.baseUrl === undefined) ? [] : ["--baseUrl", argv.baseUrl];
const includeOptions = (argv.includes === undefined) ? [] : ["--includes", argv.includes];

let excludeList = "**/node_modules/**/*,**/test/**/*";
if (argv.excludes !== undefined)
    excludeList += ",**/" + argv.excludes + "/**/*";

let outputOptions = [
    "--json", json
];

if (argv.onlyJson === undefined)
    outputOptions = outputOptions.concat(["--out", out]);

const readmeOption = (argv.readme === undefined) ? "none" : argv.readme;

const options = [
    "--excludePrivate",
    "--experimentalDecorators",
    "--excludeExternals",
    "--excludeNotExported",
    "--ignoreCompilerErrors",
    "--hideGenerator"
]

if (argv.name) options.push("--name", argv.name);

if (argv.theme) options.push("--theme", argv.theme);

const args = [
    path.resolve(process.cwd(), source),
    ...options,
    "--exclude", [excludeList],
    ...outputOptions,
    "--mode", "modules",
    "--readme", readmeOption,
    "--module", "commonjs",
    ...baseUrlOptions,
    ...includeOptions
]

console.log("Arguments to TypeDoc: " + JSON.stringify(args, null, 2));

spawn(path.resolve(process.cwd(), "node_modules/.bin/typedoc"), args).then((code) => {
    if (code === 0) {
        let tagErrors = validateTags(json);
        if (tagErrors.toString()) {
            console.error(`JSON contains invalid tags: ${JSON.stringify(tagErrors)}`);
            fs.unlink(json);
            console.log(`JSON removed from ${json}`)
            code = 5;
        }
    }
    // Copy index.ts file to json output folder and rename to index.ts if a file is specified. Needed by bemetalsmith for adding descriptions
    if (code === 0 && argv.tsIndexFile) {
        const outputDir = path.parse(json).dir;
        cpx.copySync(path.join(source, argv.tsIndexFile), outputDir);
        fs.renameSync(path.join(outputDir, argv.tsIndexFile), path.join(outputDir, 'index.ts'));
    }

    process.exit(0)
});
handleInterrupts();
