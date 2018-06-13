/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import * as commander from "commander";
import * as chalk from "chalk";

const program = new commander.Command("bank-demo");
program.option("-i, --input <required>", "ECSchemaXml file");
program.option("-o, --output <required>", "Directory to put the out typescript file.");
program.parse(process.argv);

if (process.argv.length === 0) program.help();

if (!program.input || !program.output) {
  // tslint:disable-next-line:no-console
  console.log(chalk.default.red("Invalid input. For help use the '-h' option."));
  process.exit(1);
}

// tslint:disable-next-line:no-console
console.log("Creating a typescript file for " + program.input + ".");

let createdFile;
try {
  // TODO
  createdFile = "TBD";
} catch (err) {
  // tslint:disable-next-line:no-console
  console.log(chalk.default.red("Failed to create: " + err.message));
  process.exit(1);
}

// tslint:disable-next-line:no-console
console.log(chalk.default.green(`Successfully created typescript file, "${createdFile}".`));
