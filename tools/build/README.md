# @itwin/build-tools

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

## Description

The **@itwin/build-tools** is a package for developers to consolidate the steps for building TypeScript-based packages. The tools contained in this package are written in either Typescript or Javascript within the src/ directory, and compiled for use into the lib/ directory. As a developer package, this package has only dependencies, no devDependencies.

### tsconfig-base

Location: tsconfig-base.json\
Requires build: no

This file contains common tsconfig settings across all iTwin.js packages. Packages should extend this file in their own tsconfig.json file, and then overwrite and set new properties as needed. Note that this file is different from the tsconfig.json file for this package, as that contains different settings for bentleyjs-tools only.

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

#### pseudolocalize.js

This script handles translating an English localization JSON file into a pseudoLocalization file.
