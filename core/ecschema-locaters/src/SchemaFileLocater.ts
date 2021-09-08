/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as glob from "glob";
import * as path from "path";
import { Schema, SchemaContext, SchemaKey, SchemaMatchType } from "@bentley/ecschema-metadata";

const formatString = (format: string, ...args: string[]) => {
  return format.replace(/{(\d+)}/g, (match, theNumber) => {
    return typeof args[theNumber] !== "undefined"
      ? args[theNumber]
      : match;
  });
};

const padStartEx = (str: string, targetLength: number, padString: string) => {
  targetLength = targetLength >> 0; // truncate if number or convert non-number to 0;
  padString = String((typeof padString !== "undefined" ? padString : " "));
  if (str.length > targetLength) {
    return String(str);
  } else {
    targetLength = targetLength - str.length;
    if (targetLength > padString.length) {
      padString += padString.repeat(targetLength / padString.length); // append to original to ensure we are longer than needed
    }
    return padString.slice(0, targetLength) + str;
  }
};

/**
 * A SchemaKey implementation that aids in identifying Schema files via the
 * addition of two properties: fileName and schemaText.  The fileName contains the
 * full path to the file on disk and schemaText is the full string representation
 * of the Schema.
 * @alpha
 */
export class FileSchemaKey extends SchemaKey {
  // The schema file associated with the SchemaKey
  public fileName: string;
  // The JSON text for the schema loaded
  public schemaText?: string;

  /**
   * Initializes a new FileSchemaKey object.
   * @param key The EC SchemaKey identifying the Schema.
   * @param fileName The full path to the Schema file.
   * @param schemaText The string representation of the Schema
   * loaded from disk. Optional.
   */
  constructor(key: SchemaKey, fileName: string, schemaJson?: string) {
    super(key.name, key.version);
    this.fileName = fileName;
    this.schemaText = schemaJson;
  }
}

/**
 * Holds schemaPath and corresponding ReadSchemaText that has the promise to read schema text found there
 * @alpha
 */
interface SchemaText {
  schemaPath: string;
  readSchemaText: ReadSchemaText;
}

/**
 * Construct through a function that returns a promise to read the schema.
 * When readSchemaText() is called the first time, it will execute the function to actually begin the promise.
 * When readSchemaText() is called after the first time, it will just return the promise.
 * This ensures the promise doesn't run until readSchemaText() is called, and there's only one readSchemaText promise per schema path.
 * @alpha
 */
export class ReadSchemaText {
  private _readSchemaTextPromise: Promise<string | undefined> | undefined;

  constructor(private _readSchemaTextFunc: () => Promise<string | undefined>) {}

  public async readSchemaText(): Promise<string | undefined> {
    if (this._readSchemaTextPromise)
      return this._readSchemaTextPromise;

    this._readSchemaTextPromise = this._readSchemaTextFunc();
    return this._readSchemaTextPromise;
  }
}

/**
 * @alpha
 */
export class SchemaTextsCache extends Array<SchemaText> { }

/**
 * Abstract class to hold common/overlapping functionality between SchemaJsonFileLocater and SchemaXmlFileLocater
 * @alpha - Needs further testing and possibly moved to a separate package.
 */
export abstract class SchemaFileLocater {
  public searchPaths: string[];
  /* Schema texts cache to hold read schema texts promises; Ensures that schema texts are only read once with promises */
  private _schemaTexts = new SchemaTextsCache();

  constructor() {
    this.searchPaths = [];
  }

  public get schemaTextsCount() { return this._schemaTexts.length; }

  public async addSchemaText(schemaPath: string, readSchemaText: ReadSchemaText) {
    this.addSchemaTextSync(schemaPath, readSchemaText);
  }

  public addSchemaTextSync(schemaPath: string, readSchemaText: ReadSchemaText) {
    if (undefined === this.findCachedSchemaText(schemaPath))
      this._schemaTexts.push({ schemaPath, readSchemaText });
  }

  public async getSchemaText(schemaPath: string): Promise<string | undefined> {
    return this.getSchemaTextSync(schemaPath);
  }

  public getSchemaTextSync(schemaPath: string): Promise<string | undefined> | undefined {
    const foundSchemaText = this.findCachedSchemaText(schemaPath);
    if (foundSchemaText)
      return foundSchemaText.readSchemaText.readSchemaText();

    return undefined;
  }

  private findCachedSchemaText(schemaPath: string): SchemaText | undefined {
    const findSchemaText = (schemaText: SchemaText) => {
      return schemaText.schemaPath === schemaPath;
    };

    return this._schemaTexts.find(findSchemaText);
  }

  /**
   * Promise to read a schema and return a string of its contents if successful
   * @param schemaPath Schema file path that matched the schema key
   */
  public async readSchemaText(schemaPath: string): Promise<string | undefined> {
    // Load the file
    if (!await this.fileExists(schemaPath))
      return undefined;

    const schemaText = await this.readUtf8FileToString(schemaPath);
    if (!schemaText)
      return undefined;

    return schemaText;
  }

  public async readUtf8FileToString(filePath: string): Promise<string | undefined> {
    return new Promise<string | undefined>((resolve, reject) => {
      fs.readFile(filePath, "utf-8", (err, data) => {
        if (err)
          reject(err);
        else
          resolve(data);
      });
    });
  }

  public readUtf8FileToStringSync(filePath: string): string | undefined {
    return fs.readFileSync(filePath, "utf-8");
  }

  public async fileExists(filePath: string): Promise<boolean | undefined> {
    return new Promise<boolean | undefined>((resolve) => {
      fs.access(filePath, fs.constants.F_OK, (err) => {
        resolve(err ? false : true);
      });
    });
  }

  public fileExistsSync(filePath: string): boolean | undefined {
    return fs.existsSync(filePath);
  }

  /**
   * Adds more search paths used by this locator to find the
   * Schema files.
   * @param schemaPaths An array of search paths to add
   */
  public addSchemaSearchPaths(schemaPaths: string[]) {
    // If the path is not in the schemaPaths array, add it
    for (const schemaPath of schemaPaths)
      this.addSchemaSearchPath(schemaPath);
  }

  /**
   * Add one search path used by this locator to find the
   * Schema files.
   * @param schemaPath A search path to add
   */
  public addSchemaSearchPath(schemaPath: string) {
    // If the path is not in the schemaPaths array, add it
    if (!this.searchPaths.find((entry) => entry === schemaPath))
      this.searchPaths.push(schemaPath);
  }

  protected abstract getSchemaKey(data: string): SchemaKey;

  /**
   * Adds SchemaKeys to the provided foundFiles collection that match the desired SchemaKey. This method
   * only attempts to find schema files that have no version in the file name.
   * @param foundFiles The collection of SchemaKeys found in the given directory.
   * @param schemaPath The directory in which to search for the Schemas.
   * @param schemaName The short name of the Schema (without version).
   * @param desiredKey The SchemaKey used to find matching Schema files.
   * @param matchType The SchemaMatchType to use when comparing the desiredKey and the keys found during the search.
   * @param format The type of file that the schema key refers to. json or xml
   */
  private async addCandidateNoExtSchemaKey(foundFiles: FileSchemaKey[], schemaPath: string, schemaName: string, desiredKey: SchemaKey, matchType: SchemaMatchType, format: string) {
    const fullPath = path.join(schemaPath, `${schemaName}.ecschema.${format}`);

    await this.addSchemaText(fullPath, new ReadSchemaText(async () => this.readSchemaText(fullPath)));
    const schemaText = await this.getSchemaText(fullPath);
    if (!schemaText)
      return;

    // Get the schema key
    const key = this.getSchemaKey(schemaText);

    // If the key matches, put it in foundFiles
    if (key.matches(desiredKey, matchType))
      foundFiles.push(new FileSchemaKey(key, fullPath, schemaText));
  }

  /**
   * Adds SchemaKeys to the provided foundFiles collection that match the desired SchemaKey. This method
   * only attempts to find schema files that have no version in the file name.
   * @param foundFiles The collection of SchemaKeys found in the given directory.
   * @param schemaPath The directory in which to search for the Schemas.
   * @param schemaName The short name of the Schema (without version).
   * @param desiredKey The SchemaKey used to find matching Schema files.
   * @param matchType The SchemaMatchType to use when comparing the desiredKey and the keys found during the search.
   * @param format The type of file that the schema key refers to. json or xml
   */
  private addCandidateNoExtSchemaKeySync(foundFiles: FileSchemaKey[], schemaPath: string, schemaName: string, desiredKey: SchemaKey, matchType: SchemaMatchType, format: string) {
    const fullPath = path.join(schemaPath, `${schemaName}.ecschema.${format}`);

    // If the file does not exist, end
    if (!fs.existsSync(fullPath)) return;

    // Read the file
    const file = fs.readFileSync(fullPath);
    if (!file) return;

    // Get the schema key
    const key = this.getSchemaKey(file.toString());

    // If the key matches, put it in foundFiles
    if (key.matches(desiredKey, matchType))
      foundFiles.push(new FileSchemaKey(key, fullPath, file.toString()));
  }

  /**
   * Adds SchemaKeys to the provided foundFiles collection that match the desired SchemaKey
   * @param foundFiles The collection of SchemaKeys found in the given directory
   * @param schemaPath The directory in which to search for the Schemas
   * @param fileFilter The file filter, potentially with wildcards, used to locate the Schema files.
   * @param desiredKey The schemaKey used to find matching Schema files
   * @param matchType The SchemaMatchType to use when comparing the desired Key and the keys found during the search.
   * @param format The type of file that the schema key refers to. json or xml
   */
  private async addCandidateSchemaKeys(foundFiles: FileSchemaKey[], schemaPath: string, fileFilter: string, desiredKey: SchemaKey, matchType: SchemaMatchType, format: string) {
    const fullPath = path.join(schemaPath, fileFilter);

    const result = new glob.GlobSync(fullPath, { sync: true });
    for (const match of result.found) {
      let fileName = path.basename(match, (`.ecschema.${format}`));
      // TODO: should this be moved or handled elsewhere?
      // Handles two version file names - SchemaKey.parseString supports only 3 version names.
      if (/[^\d]\.\d?\d\.\d?\d$/.test(fileName)) {
        const parts = fileName.split(".");
        parts.splice(2, 0, "00");
        fileName = parts.join(".");
      }

      await this.addSchemaText(match, new ReadSchemaText(async () => this.readSchemaText(match)));
      const schemaText = await this.getSchemaText(match);
      if (!schemaText)
        continue;

      const schemaKey = SchemaKey.parseString(fileName);
      if (schemaKey.matches(desiredKey, matchType))
        foundFiles.push(new FileSchemaKey(schemaKey, match, schemaText));
    }
  }

  /**
   * Adds SchemaKeys to the provided foundFiles collection that match the desired SchemaKey
   * @param foundFiles The collection of SchemaKeys found in the given directory
   * @param schemaPath The directory in which to search for the Schemas
   * @param fileFilter The file filter, potentially with wildcards, used to locate the Schema files.
   * @param desiredKey The schemaKey used to find matching Schema files
   * @param matchType The SchemaMatchType to use when comparing the desired Key and the keys found during the search.
   * @param format The type of file that the schema key refers to. json or xml
   */
  private addCandidateSchemaKeysSync(foundFiles: FileSchemaKey[], schemaPath: string, fileFilter: string, desiredKey: SchemaKey, matchType: SchemaMatchType, format: string) {
    const fullPath = path.join(schemaPath, fileFilter);

    const result = new glob.GlobSync(fullPath, { sync: true });
    for (const match of result.found) {
      let fileName = path.basename(match, (`.ecschema.${format}`));
      // TODO: should this be moved or handled elsewhere?
      // Handles two version file names - SchemaKey.parseString supports only 3 version names.
      if (/[^\d]\.\d?\d\.\d?\d$/.test(fileName)) {
        const parts = fileName.split(".");
        parts.splice(2, 0, "00");
        fileName = parts.join(".");
      }

      const file = fs.readFileSync(match);
      if (!file)
        continue;

      const schemaKey = SchemaKey.parseString(fileName);
      if (schemaKey.matches(desiredKey, matchType))
        foundFiles.push(new FileSchemaKey(schemaKey, match, file.toString()));
    }
  }

  /**
   * Attempts to find all Schema files in the configurable search paths that match
   * the desired SchemaKey.
   * @param desiredKey The SchemaKey to match.
   * @param matchType The SchemaMatchType.
   * @param format The type of file that the schema key refers to. json or xml
   */
  protected async findEligibleSchemaKeys(desiredKey: SchemaKey, matchType: SchemaMatchType, format: string): Promise<FileSchemaKey[]> {
    const foundFiles = new Array<FileSchemaKey>();

    let twoVersionSuffix: string;
    let threeVersionSuffix: string;
    const readVersion = desiredKey.readVersion.toString();
    const writeVersion = desiredKey.writeVersion.toString();
    const minorVersion = desiredKey.minorVersion.toString();

    if (matchType === SchemaMatchType.Latest) {
      twoVersionSuffix = (`.*.*.ecschema.${format}`);
      threeVersionSuffix = (`.*.*.*.ecschema.${format}`);
    } else if (matchType === SchemaMatchType.LatestWriteCompatible) {
      twoVersionSuffix = formatString(`.{0}.*.ecschema.${format}`, padStartEx(readVersion, 2, "0"));
      threeVersionSuffix = formatString(`.{0}.{1}.*.ecschema.${format}`, padStartEx(readVersion, 2, "0"), padStartEx(writeVersion, 2, "0"));
    } else if (matchType === SchemaMatchType.LatestReadCompatible) {
      twoVersionSuffix = formatString(`.{0}.*.ecschema.${format}`, padStartEx(readVersion, 2, "0"));
      threeVersionSuffix = formatString(`.{0}.*.*.ecschema.${format}`, padStartEx(readVersion, 2, "0"));
    } else {
      twoVersionSuffix = formatString(`.{0}.{1}.ecschema.${format}`, padStartEx(readVersion, 2, "0"), padStartEx(writeVersion, 2, "0"));
      threeVersionSuffix = formatString(`.{0}.{1}.{2}.ecschema.${format}`, padStartEx(readVersion, 2, "0"), padStartEx(writeVersion, 2, "0"), padStartEx(minorVersion, 2, "0"));
    }

    const twoVersionExpression = desiredKey.name + twoVersionSuffix;
    const threeVersionExpression = desiredKey.name + threeVersionSuffix;

    for (const searchPath of this.searchPaths) {
      await this.addCandidateNoExtSchemaKey(foundFiles, searchPath, desiredKey.name, desiredKey, matchType, format);
      await this.addCandidateSchemaKeys(foundFiles, searchPath, twoVersionExpression, desiredKey, matchType, format);
      await this.addCandidateSchemaKeys(foundFiles, searchPath, threeVersionExpression, desiredKey, matchType, format);
    }

    return foundFiles;
  }

  /**
   * Attempts to find all Schema files in the configurable search paths that match
   * the desired SchemaKey.
   * @param desiredKey The SchemaKey to match.
   * @param matchType The SchemaMatchType.
   * @param format The type of file that the schema key refers to. json or xml
   */
  protected findEligibleSchemaKeysSync(desiredKey: SchemaKey, matchType: SchemaMatchType, format: string): FileSchemaKey[] {
    const foundFiles = new Array<FileSchemaKey>();

    let twoVersionSuffix: string;
    let threeVersionSuffix: string;
    const readVersion = desiredKey.readVersion.toString();
    const writeVersion = desiredKey.writeVersion.toString();
    const minorVersion = desiredKey.minorVersion.toString();

    if (matchType === SchemaMatchType.Latest) {
      twoVersionSuffix = (`.*.*.ecschema.${format}`);
      threeVersionSuffix = (`.*.*.*.ecschema.${format}`);
    } else if (matchType === SchemaMatchType.LatestWriteCompatible) {
      twoVersionSuffix = formatString(`.{0}.*.ecschema.${format}`, padStartEx(readVersion, 2, "0"));
      threeVersionSuffix = formatString(`.{0}.{1}.*.ecschema.${format}`, padStartEx(readVersion, 2, "0"), padStartEx(writeVersion, 2, "0"));
    } else if (matchType === SchemaMatchType.LatestReadCompatible) {
      twoVersionSuffix = formatString(`.{0}.*.ecschema.${format}`, padStartEx(readVersion, 2, "0"));
      threeVersionSuffix = formatString(`.{0}.*.*.ecschema.${format}`, padStartEx(readVersion, 2, "0"));
    } else {
      twoVersionSuffix = formatString(`.{0}.{1}.ecschema.${format}`, padStartEx(readVersion, 2, "0"), padStartEx(writeVersion, 2, "0"));
      threeVersionSuffix = formatString(`.{0}.{1}.{2}.ecschema.${format}`, padStartEx(readVersion, 2, "0"), padStartEx(writeVersion, 2, "0"), padStartEx(minorVersion, 2, "0"));
    }

    const twoVersionExpression = desiredKey.name + twoVersionSuffix;
    const threeVersionExpression = desiredKey.name + threeVersionSuffix;

    for (const searchPath of this.searchPaths) {
      this.addCandidateNoExtSchemaKeySync(foundFiles, searchPath, desiredKey.name, desiredKey, matchType, format);
      this.addCandidateSchemaKeysSync(foundFiles, searchPath, twoVersionExpression, desiredKey, matchType, format);
      this.addCandidateSchemaKeysSync(foundFiles, searchPath, threeVersionExpression, desiredKey, matchType, format);
    }

    return foundFiles;
  }

  public abstract getSchema<T extends Schema>(key: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<T | undefined>;

  /**
   * Compares two Schema versions.  If the left-hand version is greater, 1 is returned. If the
   * left-hand version is less, -1 us returned.  If the versions are an exact match, 0 is returned.
   * @param lhs The 'left-hand' FileSchemaKey.
   * @param rhs The 'right-hand' FileSchemaKey.
   */
  public compareSchemaKeyByVersion = (lhs: FileSchemaKey, rhs: FileSchemaKey): number => {
    return lhs.compareByVersion(rhs);
  };
}
