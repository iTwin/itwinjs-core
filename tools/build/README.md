# @bentley/build-tools

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

## Description

The __@bentley/build-tools__ is a package for developers to consolidate the steps for building TypeScript-based packages. The tools contained in this package are written in either Typescript or Javascript within the src/ directory, and compiled for use into the lib/ directory. As a developer package, this package has only dependencies, no devDependencies.

### tsconfig-base

Location: tsconfig-base.json\
Requires build: no

This file contains common tsconfig settings across all iTwin.js packages. Packages should extend this file in their own tsconfig.json file, and then overwrite and set new properties as needed. Note that this file is different from the tsconfig.json file for this package, as that contains different settings for bentleyjs-tools only.

### tslint

> WARNING: TSLint support will be dropped in the next major release, 3.0. Please switch to ESLint, using `@bentley/eslint-plugin`.

Location: tslint.json\
Requires build: yes

This file contains common tslint settings across all iTwin.js packages. Packages should extend this file in their own tslint.json file, and then overwrite and set new properties as needed.

### TSLint Rules

> WARNING: TSLint support will be dropped in the next major release, 3.0. Please switch to ESLint, using `@bentley/eslint-plugin`.

Location: tslint-rules\
Requires build: yes

This directory contains several developer-defined TSLint rules that may be imported into tslint.json files. The rules are written in Typescript and compiled. These rules are imported into the tslint.json file for this package (which other imodeljs packages inherit from), however, the rules may also be imported individually from the generated tslint-rules directory after compilation.

The following are several guidelines to follow when creating new TSLint rules:

- Each new rule must be defined in its own file.
- The file name must be camel-case and end with the suffix "Rule". When accessing the rule in a tslint.json file, the rule's name will be all lowercase and contain each word in the file name separated with a hyphen (except for the word "Rule").
  - ie: The file noImportsRule.ts would be accessible in tslint.json as "no-imports".

After compiling each rule, they may be used inside a tslint.json file by setting the "rulesDirectory" property to the path of the directory containing the rule. The rule may be accessed and set just as any other.

### NPM Scripts

Location: scripts/\
Requires build: no

The following node scripts are delivered in this package's scripts folder in order to ease development of iTwin.js packages with npm scripts. These scripts may require that additional packages be installed as dependencies of your package.

The default behaviors of the scripts (without parameters) assume that the directory structure of your package mirrors the following:

- root
  - source
    - test
      - assets
  - lib
  - package.json
  - tsconfig.json
  - tslint.json

The following is a list of some of the most commonly used scripts within this package:

#### docs.js

This script runs a TypeDoc command, with specific parameters, to generate html TypeScript documentation as well as a json representation of the documentation to be consumed for other purposes. It includes the following parameters:

- source - specify the TypeScript source directory
- out - specify the directory of the html output
- json - specify the directory and filename of the json output
- baseUrl - specify a baseUrl to resolve modules
- onlyJson - including this option will skip the html output and only output the json file
- includes - directory of files to include in documentation (ex: for sample code)
- excludes - name of directory, files, or file extensions to exclude.
  - A list can be provided using a `,` as a separator
  - Each of the provided to exclude is added to a glob pattern which checks all directories within the source.
    - i.e `--excludes=test,docs/*.md` will translate to `**/{test,docs/*.md}/**/*`

#### extract.js

This is a script designed to extract sample code from test.ts files in a specific directory. The sample code should be surrounded by comments containing "\_\_PUBLISH_EXTRACT_START\_\_" and "\_\_PUBLISH_EXTRACT_END\_\_" directives.

- extractDir - the path at which the sample code files are located
- outDir - the path at which to output the selected code

#### test.js

This script runs the javascript output of Mocha tests with a few standard parameters. The output (success/failure) of the tests will be written to the console.

- packageRoot - the root directory of the package in which the Mocha executable should be located. Really only needed for multi-package repositories.
- testDir - the path to the javascript test output
- watch - adds the "--watch" and "--inline-diffs" parameters to the Mocha command
- debug - adds the "--inspect=9229" and "--debug-brk" parameters to the Mocha command (for debugging with VS Code)

#### test-tsnode.js

> WARNING: The tsnode script will be dropped.  Please switch to using `test.js` or directly using mocha.

This script is similar to the test.js command, but looks for the TypeScript test source in order to run it using ts-node. The arguments for this command are similar to the test command, with the following differences:

- testDir - specifies the test TypeScript source folder (instead of the test JavaScript output folder)
- tscPaths - adds the --require tsconfig-paths/register arguments to the mocha command, in order to resolve paths in the typescript source files to run them with ts-node (needed for multi-package repositories like imodeljs-core)

#### pseudolocalize.js

This script handles translating an English localization JSON file into a pseudoLocalization file.
