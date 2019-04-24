/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// usage: node createConfigFile outfile <file1[|filter]> <file2[|filter]> ...
// outfile is the name of the output json config file.
// fileN is either a full path to a json (or json5) file. It can be process.env to use the current environment, or imodeljs-config to use the default file in the imodeljs-config repository.
// filter is an optional regex filter to be applied to the contents of the file (or process.env)
// If the same key is found in multiple files, the key in the later file replaces that in the earlier file.
// The cwd when this script is executed from BuildIModelJsModule is the directory containing package.json.

"use strict";

function copyKeys(destination, source, filter) {
  Object.keys(source).forEach((key) => {
    // if the key is an object itself, then recurse.
    if (typeof source[key] === 'object') {
      destination[key] = {};
      copyKeys(destination[key], source[key], filter);
    } else {
      const value = source[key].toString();
      if ((key.toLowerCase !== "path") && (0 !== value.trim().length) && ((filter.length === 0) || (null !== key.match(filter))))
        destination[key] = source[key];
    }
  });
}

function main() {
  const JSON5 = require("json5");

  const fs = require("fs");
  const IModelJsConfig = require("../lib/IModelJsConfig").IModelJsConfig;
  if (process.argv.length < 3) {
    console.error("Usage: node createConfigFile outfile <file1[|filter>] <file2[|filter>] ...");
    console.error("fileN can be 'process.env' or 'imodeljs-config'");
    return;
  }

  // the output file:
  const outputJsonFile = process.argv[2];

  // set up the object that holds the consolidated configuration.
  const configObject = {};

  // step through each input source.
  for (let iArg = 3; iArg < process.argv.length; iArg++) {
    const argument = process.argv[iArg];
    let filter = "";
    let fileName = argument;
    const filterPos = argument.indexOf("|");
    if (-1 !== filterPos) {
      filter = argument.slice(filterPos + 1);
      fileName = argument.slice(0, filterPos);
    }

    let thisSource;
    if (fileName === "process.env") {
      thisSource = process.env;
    } else if (fileName === "imodeljs-config") {
      try {
        const configRepository = IModelJsConfig.getConfigurationDir("imodeljs-config");
        thisSource = IModelJsConfig.getConfiguration(configRepository);
      } catch (err) {
        console.log("Default imodeljs-config file not found, skipping");
        continue;
      }
    } else {
      // fileName specifies a file
      if (!fs.existsSync(fileName)) {
        console.log(`File not found: ${fileName}, ignoring`);
        continue;
      }
      try {
        thisSource = JSON5.parse(fs.readFileSync(fileName, "utf8").toString());
      } catch (err) {
        console.error(err.message);
        process.exit(1);
      }
    }
    // here we have a source.
    copyKeys(configObject, thisSource, filter);
  }

  try {
    fs.writeFileSync(outputJsonFile, JSON.stringify(configObject, null, 2), { encoding: "utf8", flag: "w" });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

main();