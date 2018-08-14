bentleyjs-tools
==========

bentleyjs-tools is a package for Bentley developers to consolidate the steps for building TypeScript-based packages. The tools contained in this package are written in either Typescript or Javascript within the src/ directory, and compiled for use into the lib/ directory. As a developer package, this package has only dependencies, no devDependencies. Generally, it should minimize the number of devDependencies your package requires, but you will still need devDependencies on:

- gulp
- mocha
- chai (if you use assertion libraries)

## TSLint Rules

Location: tslint-rules

This package contains several developer-defined TSLint rules that may be imported into tslint.json files. The rules are written in Typescript within the src directory and compiled. These rules are imported into the tslint.json file for this package (which other imodeljs packages inherit from), however, the rules may also be imported individually from the generated tslint-rules directory after compilation.

## NPM Scripts

Location: scripts

The following node scripts are delivered in this package's scripts folder in order to ease development of imodeljs packages with npm scripts. These scripts may require that additional packages be installed as dependencies of your package.

The default behaviors of the scripts (without parameters) assume that the directory structure of your package mirrors the following:

```
<pkgroot>
  + source
    + test
        + assets
  + lib
  gulpfile.js
  package.json
  tsconfig.json
  tslint.json
```

docs.js - This script runs a TypeDoc command with specific parameters to generate html TypeScript documentation as well as a json representation of this documentation to be consumed for other purposes (for example, metalsmith). It includes the following parameters:

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

extract.js - This is a script designed to extract sample code from test.ts files in a specific directory. The sample code should be surrounded by comments containing "\_\_PUBLISH_EXTRACT_START\_\_" and "\_\_PUBLISH_EXTRACT_END\_\_" directives.

- extractDir - the path at which the sample code files are located
- outDir - the path at which to output the selected code

printconfig.js - This script will read a json file and search for an "extends" property. It will then open the base json file specified by the property and merge the contents with the original file. This action will be taken recursively. (The "extends" property will be removed from the merged file)

- config (required) - the configuration files to start with (ex: tsconfig.json)
- out - the file name to write the merged json file to (otherwise the output will be written to console)

test.js - This script runs the javascript output of Mocha tests with a few standard parameters. The output (success/failure) of the tests will be written to the console.

- packageRoot - the root directory of the package in which the Mocha executable should be located. Really only needed for multi-package repos.
- testDir - the path to the javascript test output
- watch - adds the "--watch" and "--inline-diffs" parameters to the Mocha command
- debug - adds the "--inspect=9229" and "--debug-brk" parameters to the Mocha command (for debugging with VS Code)

tslint.js - Lints the project directory using the tsconfig file in the root directory. May be deprecated soon.

test-tsnode - This script is similar to the test.js command, but looks for the TypeScript test source in order to run it using ts-node. The arguments for this command are similar to the test command, witht he following differences:

- testDir - specifies the test TypeScript source folder (instead of the test JavaScript output folder)
- tscPaths - adds the --require tsconfig-paths/register arguments to the mocha command, in order to resolve paths in the typescript source files to run them with ts-node (needed for multi-package repos like imodeljs-core)

compile.js, copyassets.js and copytestassets.js will likely be deprecated due to being wrappers for short, simple commands.

## Coding Guidelines

[npm Script Guidelines](docs/npm-scripts-guidelines.md)

[Markdown Guidelines](docs/markdown-guidelines.md)

[TypeScript Coding Guidelines](docs/typescript-coding-guidelines.md)
