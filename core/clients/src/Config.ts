/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Config */

/**
 * @public
 * @deprecated  Previously only used by the Config
 */
export type ValueType = string | boolean | number;

/** Helper class that manages all configuration settings for an iModel.js application.
 *
 * The static [[Config.App]] is used by many parts of the iModel.js library to retrieve configuration settings.
 *
 * The initial use of [[Config.App]] gathers configuration variables from 3 different locations:
 * 1. Sets 'imjs_env_is_browser' based on if the window is defined.
 * 1. Performs a GET request for a "config.json".  If found merges the files contents into the Config.
 * 1. Appends any environment variable that are prefixed with "imjs".
 *
 * > The order listed above is important because if there is any overlap, the last one to contain the variable will win.
 *
 * After the initial use of `Config.App`, all additional updates to the configuration must be performed using [[Config.App.add]] or [[Config.App.merge]].
 *
 * **Expanding variables** is supported using `${}` syntax.  If the variable is of type string and contains a `${}`, the rest of
 * the configuration variables are searched to populate the place of the variable.
 *  i.e. If the variable `appName='TestApp'`, a variable with a value of 'https://${appName}' will be expanded to 'https://TestApp'.
 * > Does not recursively expand variables such as, `appName=${appName}`.
 *
 * @public
 */
export class Config {
  private static _appConfig: Config;
  private _container: any = {};
  private _expanded: any = {};
  private constructor() { }

  /** Sets up the Config object by performing 3 steps, this order:
   * 1. Sets 'imjs_env_is_browser' based on if the window is defined.
   * 1. Performs a GET request for a "config.json".  If found merges the entire file.
   * 1. Appends environment variables that are prefixed with "imjs".
   */
  private appendSystemVars() {
    this.set("imjs_env_is_browser", Boolean(typeof window !== undefined));
    try {
      const configRequest: XMLHttpRequest = new XMLHttpRequest();
      configRequest.open("GET", "config.json", false);
      configRequest.send();
      const configResponse: any = JSON.parse(configRequest.responseText);
      if (typeof configResponse !== "undefined")
        this.merge(configResponse);
    } catch (error) {
      // couldn't get config.
    }

    // Merge system environment variables that start with "imjs"
    const imjsPrefix = /^imjs/i;
    const systemEnv = Object.keys(process.env)
      .filter((key) => imjsPrefix.test(key))
      .reduce<any>((env: any, key: string) => {
        env[key] = process.env[key];
        return env;
      }, {});
    this.merge(systemEnv);
  }

  /** Performs a case insensitive search for the variable name.
   * If the variable exists, return the variable in the casing its currently stored.
   * Otherwise, return the original name provided.
   */
  private checkExists(name: string): string {
    const foundVar: string | undefined = Object.keys(this._container).find((key) => key.toLowerCase() === name.toLowerCase());
    return foundVar ? foundVar : name;
  }

  /** Expand variable containing other variables as values.
   * Nested variables are wrapped with ${}.
   *  i.e. ${test1}_${test2}
   *       ${test1}${test2}
   * This is strict function that will fail if recursion is detected or var name is not found.
   */
  private expand(name: string, value: string): any {
    if (typeof value !== "string")
      return value;

    // If the variable already exists, return existing value.
    const descriptor = Object.getOwnPropertyDescriptor(this._expanded, name);
    if (descriptor !== undefined)
      return descriptor.value;

    const matches = value.match(/\${[\w]+}/gi);
    if (matches === null)
      return value;

    // Will contain the '${\w+}' string value with the key being the '\w+'
    const vars: any = {};
    matches.forEach((element: string) => {
      const varName: string = element.match(/\${([\w]+)}/i)![1];
      if (!vars.hasOwnProperty(varName))
        vars[varName] = element;
    });

    this._expanded[name] = null; // avoid recursive resolution by setting current entry to empty
    Object.getOwnPropertyNames(vars).forEach((element: string) => {
      const toReplace = vars[element];
      const subDescriptor = Object.getOwnPropertyDescriptor(this._expanded, element);
      if (subDescriptor !== undefined) {
        if (null === subDescriptor.value)
          throw new Error(`Found recursive definition of configuration variable in '${element}'`);
        value = value.replace(toReplace, subDescriptor.value);
      } else if (this.has(element))
        value = value.replace(toReplace, this.get(element));
      else
        throw new Error(`Failed to expand the configuration variable '${element}'`);
    });

    this._expanded[name] = value;
    return value;
  }

  /** Checks, case-insensitive, if a variable exists.
   */
  public has(varName: string): boolean {
    const name = this.checkExists(varName);
    return this._container.hasOwnProperty(name);
  }

  /** Attempts to retrieve a variable, the search is case-insensitve.
   * @param varName The name of the config variable to find
   * @param defaultVal The default value to return if the variable does not exist.  If undefined, an exception is thrown.
   * @throws if the variable does not exist and a default value is not provided.
   */
  public get(varName: string, defaultVal?: boolean | string | number): any {
    const name = this.checkExists(varName);
    const descriptor = Object.getOwnPropertyDescriptor(this._container, name);
    if (descriptor === undefined) {
      if (defaultVal !== undefined)
        return defaultVal;
      throw new Error(`The configuration variable '${name}' does not exist.`);
    }
    // If the variable exists and is of type string, check if it is also available in the `this._expanded` container.
    if (typeof descriptor.value === "string") {
      const strVal = descriptor.value;
      if (strVal.match(/\${\w+}/) !== null)
        return this.expand(name, strVal);
    }
    return descriptor.value;
  }

  /** Retrieves a variable if it exists, otherwise returns undefined.
   */
  public query(varName: string): any {
    return this.has(varName) ? this.get(varName) : undefined;
  }

  /** Attempt to get a number type variable value.
   * @param name the variable name to retrieve.
   * @param defaultVal the value to return if the variable does not exist.
   * @throws if the variable does not exist and a default value is not provided.
   */
  public getNumber(name: string, defaultVal?: number): number {
    return Number(this.get(name, defaultVal));
  }

  /** Attempt to get a boolean type variable value.
   * @param name the variable name to retrieve.
   * @param defaultVal the value to return if the variable does not exist.
   * @throws if the variable does not exist and a default value is not provided.
   */
  public getBoolean(name: string, defaultVal?: boolean): boolean {
    return Boolean(this.get(name, defaultVal));
  }

  /** Attempt to get a string type variable value.
   * @param name the variable name to retrieve.
   * @param defaultVal the value to return if the variable does not exist.
   * @throws if the variable does not exist and a default value is not provided.
   */
  public getString(name: string, defaultVal?: string): string {
    return String(this.get(name, defaultVal));
  }

  /** Remove a variable from the config.
   * @throws if the variable does not exist.
   */
  public remove(varName: string) {
    const name = this.checkExists(varName);
    if (!this.has(name))
      throw new Error(`The configuration variable '${name}' does not exists.`);
    this._expanded = {};
    delete this._container[name];
  }

  /** Set a new property if it does not exist or updates a property to new value.
   */
  public set(varName: string, value: boolean | string | number) {
    const name = this.checkExists(varName);
    this._container[name] = value;
    this._expanded = {};
  }

  /** Return a list of variable names present in the config.
   */
  public getVars(): string[] { return Object.getOwnPropertyNames(this._container); }

  /** Merges the provided object into the config.
   * @note Overrides existing variables if already exist.  Immutable properties are skipped.
   * @throws if the provided `source` is not of type object.
   */
  public merge(source: any) {
    // Need to check for null here since null can be an object.  See https://developer.mozilla.org/docs/Web/JavaScript/Reference/Operators/typeof#null.
    if (typeof source !== "object" || null === source)
      throw new Error("The provided source to be merged with the configuration is not of type 'object' and could not be merged.");
    this._copyProperties(this._container, source, true);
  }

  /** Copies the properties, recursing into object properties. Only do the translateVar at the top level. */
  private _copyProperties(destination: any, source: any, doTranslate: boolean) {
    Object.keys(source).forEach((varName) => {
      // if subkey is an object, recurse.
      if (typeof (source[varName]) === "object") {
        destination[varName] = {};
        this._copyProperties(destination[varName], source[varName], false);

      } else {
        const name = doTranslate ? this.checkExists(varName) : varName;
        const val = source[name];
        if (typeof val === "object" || typeof val === "undefined" || val === null)
          return;

        const descriptor = Object.getOwnPropertyDescriptor(source, name);
        if (descriptor !== undefined) {
          if (!descriptor.writable)
            return;
        }
        destination[name] = val;
      }
    });
  }

  /** Return clone of the internal property container object.
   */
  public getContainer(): any {
    return JSON.parse(JSON.stringify(this._container));
  }

  /** Provide singleton object for application
   */
  public static get App(): Config {
    if (!Config._appConfig) {
      Config._appConfig = new Config();
      Config._appConfig.appendSystemVars();
    }
    return Config._appConfig;
  }
}
