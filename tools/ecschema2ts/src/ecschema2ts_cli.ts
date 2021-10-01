/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable no-console */
import * as path from "path";
import * as commander from "commander";
import * as chalk from "chalk";
import * as fs from "fs-extra";

import { ECSchemaToTsXmlWriter } from "./ecschema2ts_io";
import { SchemaContext } from "@itwin/ecschema-metadata";

function commaSeparatedList(value: string): string[] {
  return value.split(",");
}

// Program options
const program = new commander.Command("ecschema2ts");
program.option("-i, --input <required>", "ECSchemaXml file");
program.option("-o, --output <required>", "Directory to put the out typescript file.");
program.option("-r, --references <optional>", "A comma-separated list of reference schema paths", commaSeparatedList);
program.parse(process.argv);

if (process.argv.length === 0) program.help();

if (!program.input || !program.output) {
  console.log(chalk.red("Invalid input. For help use the '-h' option."));
  process.exit(1);
}

// begin converting schema file to typescript
console.log(`Creating a typescript file for ${program.input}.`);

// check references path
const referencePaths: string[] = [];
if (undefined !== program.references) {
  for (const ref of program.references) {
    const refPath = path.normalize(ref);
    try {
      fs.accessSync(refPath);
    } catch (err: any) {
      console.warn(chalk.yellow(err.toString()));
      console.warn(chalk.yellow(`The reference path ${refPath} does not exist.  Skipping...`));
      continue;
    }

    console.log(`Adding reference path '${refPath}'.`);
    referencePaths.push(refPath);
  }
}

(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises
  // convert schema file to typescript
  let createdFiles;
  try {
    const writer = new ECSchemaToTsXmlWriter(program.output);
    createdFiles = await writer.convertSchemaFile(new SchemaContext(), program.input, referencePaths);
  } catch (err: any) {
    console.log(chalk.red(`Failed to create: ${err.message}`));
    process.exit(1);
  }

  // output result
  console.log(chalk.green(`${createdFiles}`));
})();
