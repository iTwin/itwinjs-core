/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import * as lodash from "lodash";
import { parse } from "jsonc-parser";

/** Defines mocha options common to all test runners. */
export interface CertaMochaOpts {
  /** The default hook and test-case timeout, in milliseconds. */
  timeout: number;
  /** A regular expression test filter - only tests matching this expression will be run. */
  grep?: string;
  /** A string test filter - only tests containing this string will be run. */
  fgrep?: string;
  /** Whether `grep` and `fgrep` matches should be inverted. */
  invert: boolean;
  /** Causes tests marked `only` to fail the suite. */
  forbidOnly: boolean;
  /** The name of a (built-in) mocha reporter to use. */
  reporter: string;
  /** Mocha reporter-specific options. */
  reporterOptions?: object;
}

/** Defines options specific to the chrome test runner */
export interface CertaChromeOpts {
  /** Array of additional chrome arguments. */
  args: string[];
  /** Array of absolute paths to directories that contain static assets which should be made available via the frontend webserver. */
  publicDirs: string[];
}

/** Defines ports that certa may listen on. */
export interface CertaPortOpts {
  /** The port that will be used by the v8 inspector in the "main" process to communicate with a debugger (when the `debug` option is enabled). */
  debugging: number;
  /** `[Chrome Only]` The port that will be used by to serve test assets to the frontend. */
  frontend: number;
  /** `[Chrome and Electron Only]` The port that will be used for remote debugging (when the `debug` option is enabled). */
  frontendDebugging: number;
}

export interface PartialCertaConfig {
  testBundle: string;
  instrumentedTestBundle?: string;
  backendInitModule?: string;
  debug?: boolean;
  ports?: Partial<CertaPortOpts>;
  mochaOptions?: Partial<CertaMochaOpts>;
  chromeOptions?: Partial<CertaChromeOpts>;
}

/** Certa configuration options. */
export interface CertaConfig {

  /** The absolute path to a JavaScript file containing all mocha tests to be run. */
  readonly testBundle: string;

  /**
   * An instanbul-instrumented version of the `testBundle`.
   * This will be used instead of `testBundle` when running with `cover` enabled.
   */
  readonly instrumentedTestBundle?: string;

  /**
   * The absolute path to a JavaScript module containing backend initialization logic.
   * This module will be required in Certa's "main" process ***before*** initializing a test runner.
   * If the file's `module.exports` is a Promise, that Promise will also be awaited before running tests.
   * The exported Promise may also optionally be resolved with a "cleanup" async callback, which will be executed _after_ running tests (not supported in electron).
   * @optional
   */
  readonly backendInitModule?: string;

  /**
   * Whether Certa should run in "debug mode".
   * When debug mode is enabled, chrome and electron windows will be visible and remote debugging is enabled.
   */
  readonly debug: boolean;

  /**
   * Whether Certa should measure code coverage.
   * NB: This is currently only supported by the chrome and node test runners.
   */
  readonly cover: boolean;

  /** Defines ports used by the chrome and electron test runners. */
  readonly ports: Readonly<CertaPortOpts>;

  /** Defines mocha options common to all test runners. */
  readonly mochaOptions: Readonly<CertaMochaOpts>;

  /** Defines options specific to the chrome test runner */
  readonly chromeOptions: Readonly<CertaChromeOpts>;
}

const SECONDS = 1000;
const MINUTES = 60 * SECONDS;

export namespace CertaConfig {
  export const defaults = {
    debug: false,
    cover: false,
    ports: {
      debugging: 5858,
      frontend: 3000,
      frontendDebugging: 9223,
    },
    mochaOptions: {
      invert: false,
      timeout: 2 * MINUTES,
      reporter: "spec",
    },
    chromeOptions: {
      // NB: These should stay **empty** arrays, otherwise lodash.defaultsDeep will not merge them correctly.
      args: new Array<string>(),
      publicDirs: new Array<string>(),
    },
  };

  // List of config options that may be relative file paths and should be resolved to absolute paths.
  const _filePathOpts = [
    "backendInitModule",
    "testBundle",
    "instrumentedTestBundle",
    "chromeOptions.publicDirs",
  ];

  /**
   * Resolves all relative file paths in `opts` to absolute paths, starting from `baseDir`.
   * NB: This mutates `opts`.
   * @param baseDir The starting point for resolving relative paths.
   * @param opts A partial CertaConfig object.
   */
  function resolvePaths(baseDir: string, opts: PartialCertaConfig): void {
    for (const propPath of _filePathOpts) {
      const relativeFilePath = lodash.get(opts, propPath);
      if (relativeFilePath) {
        if (Array.isArray(relativeFilePath))
          lodash.set(opts, propPath, relativeFilePath.map((p) => path.resolve(baseDir, p)));
        else
          lodash.set(opts, propPath, path.resolve(baseDir, relativeFilePath));
      }
    }
  }

  /**
   * Creates a complete CertaConfig object by combining a partial config with default values.
   * All relative paths are resolved from the current working directory.
   * Throws if the `testBundle` option is undefined or invalid.
   * @param opts A partial CertaConfig object.
   */
  export function fromObject(opts: PartialCertaConfig): CertaConfig {
    const resolvedOpts = lodash.defaultsDeep(opts, defaults);
    resolvePaths(process.cwd(), resolvedOpts);

    if (!resolvedOpts.testBundle)
      throw new Error("The required testBundle option was not set.");

    if (!fs.existsSync(resolvedOpts.testBundle))
      throw new Error(`The specified testBundle file "${resolvedOpts.testBundle}" does not exist.`);

    return resolvedOpts;
  }

  /**
   * Creates a complete CertaConfig object by loading options from a certa.json config file,
   * applying run-time overrides, then combining that with default values.
   * All relative paths specified in the config file are resolved from the config file directory.
   * All other relative paths (overrides or defaults) are resolved from the current working directory.
   * Throws if the `testBundle` option is undefined or invalid.
   * @param filePath The path to a certa.json config file.
   * @param overrides A partial CertaConfig object. These values will always override any options set in the config file.
   */
  export function fromConfigFile(filePath: string, overrides: PartialCertaConfig): CertaConfig {
    const fileContents = fs.readFileSync(filePath);
    const fileOpts = parse(fileContents.toString()); // Parsing with jsonc-parser lets us safely handle comments.
    resolvePaths(path.dirname(filePath), fileOpts);
    return fromObject(lodash.defaultsDeep(overrides, fileOpts));
  }
}
