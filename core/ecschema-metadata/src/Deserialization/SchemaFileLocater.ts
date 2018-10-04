/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { SchemaKey, Schema, SchemaMatchType } from "..";
import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";

// Temporary work around - need to add format method to string here for now....
declare global {
  interface String {
    format(...params: string[]): string;
    padStartEx(targetLength: number, padString: string): string;
  }
}
String.prototype.format = function () {
  const args = arguments;
  return this.replace(/{(\d+)}/g, (match, theNumber) => {
    return typeof args[theNumber] !== "undefined"
      ? args[theNumber]
      : match;
  });
};

// Temporary work around - need to add padStart method to string here for now...
if (!String.prototype.padStartEx) {
  String.prototype.padStartEx = function padStartEx(targetLength: number, padString: string) {
    targetLength = targetLength >> 0; // truncate if number or convert non-number to 0;
    padString = String((typeof padString !== "undefined" ? padString : " "));
    if (this.length > targetLength) {
      return String(this);
    } else {
      targetLength = targetLength - this.length;
      if (targetLength > padString.length) {
        padString += padString.repeat(targetLength / padString.length); // append to original to ensure we are longer than needed
      }
      return padString.slice(0, targetLength) + String(this);
    }
  };
}

/**
 * A SchemaKey implementation that aids in identifying Schema files via the
 * addition of two properties: fileName and schemaText.  The fileName contains the
 * full path to the file on disk and schemaText is the full string representation
 * of the Schema.
 */
export class FileSchemaKey extends SchemaKey {
  // The schema file associated with the SchemnaKey
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
 * Abstract class to hold common/overlapping functionality between SchemaJsonFileLocater and SchemaXmlFileLocater
 */
export abstract class SchemaFileLocater {
  public searchPaths: string[];

  constructor() {
    this.searchPaths = [];
  }

  public readUtf8FileToString(filePath: string): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, "utf-8", (err, data) => {
        if (err)
          reject(err);
        else
          resolve(data);
      });
    });
  }

  public fileExists(filePath: string): Promise<boolean | undefined> {
    return new Promise((resolve) => {
      fs.exists(filePath, (data) => {
        resolve(data);
      });
    });
  }

  /**
   * Adds more search paths used by this locator to find the
   * Schema files.
   * @param schemaPaths An array of search paths to add
   */
  public addSchemaSearchPaths(schemaPaths: string[]) {
    // If the path is not in the schemaPaths array, add it
    for (const schemaPath of schemaPaths) {
      this.addSchemaSearchPath(schemaPath);
    }
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
  private addCandidateNoExtSchemaKey(foundFiles: FileSchemaKey[], schemaPath: string, schemaName: string, desiredKey: SchemaKey, matchType: SchemaMatchType, format: string) {

    let fullPath = path.join();

    fullPath = path.join(schemaPath, schemaName + ".ecschema." + format);

    // If the file does not exist, end
    if (!fs.existsSync(fullPath)) return;

    // Read the file
    const file = fs.readFileSync(fullPath);
    if (!file) return;

    let key: any;

    // Get the schema key
    key = this.getSchemaKey(file.toString());

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
   * @param matchType The SchemaMatchType to use when comparing the disiredKey and the keys found during the search.
   * @param format The type of file that the schema key refers to. json or xml
   */
  private addCandidateSchemaKeys(foundFiles: FileSchemaKey[], schemaPath: string, fileFilter: string, desiredKey: SchemaKey, matchType: SchemaMatchType, format: string) {
    const fullPath = path.join(schemaPath, fileFilter);

    const result = new glob.GlobSync(fullPath, { sync: true });
    for (const match of result.found) {
      let fileName = path.basename(match, (".ecschema." + format));
      // TODO: should this be moved or handled elsewhere?
      // Handles two version file names - SchemaKey.parseString supports only 3 version names.
      if (/[^\d]\.\d?\d\.\d?\d$/.test(fileName)) {
        const parts = fileName.split(".");
        parts.splice(2, 0, "00");
        fileName = parts.join(".");
      }

      const schemaKey = SchemaKey.parseString(fileName);

      const file = fs.readFileSync(match);
      if (!file)
        continue;

      if (schemaKey.matches(desiredKey, matchType)) {
        foundFiles.push(new FileSchemaKey(schemaKey, match, file.toString()));
      }
    }
  }

  /**
   * Attempts to find all Schema files in the configurable search paths that match
   * the desired SchemaKey.
   * @param desiredKey The SchemaKey to match.
   * @param matchType The SchemaMatchType.
   * @param format The type of file that the schema key refers to. json or xml
   */
  protected findEligibleSchemaKeys(desiredKey: SchemaKey, matchType: SchemaMatchType, format: string): FileSchemaKey[] {

    const foundFiles = new Array<FileSchemaKey>();

    let twoVersionSuffix: string;
    let threeVersionSuffix: string;
    const readVersion = desiredKey.readVersion.toString();
    const writeVersion = desiredKey.writeVersion.toString();
    const minorVersion = desiredKey.minorVersion.toString();

    if (matchType === SchemaMatchType.Latest) {
      twoVersionSuffix = (".*.*.ecschema." + format);
      threeVersionSuffix = (".*.*.*.ecschema." + format);
    } else if (matchType === SchemaMatchType.LatestWriteCompatible) {
      twoVersionSuffix = (".{0}.*.ecschema." + format).format(readVersion.padStartEx(2, "0"));
      threeVersionSuffix = (".{0}.{1}.*.ecschema." + format).format(readVersion.padStartEx(2, "0"), writeVersion.padStartEx(2, "0"));
    } else if (matchType === SchemaMatchType.LatestReadCompatible) {
      twoVersionSuffix = (".{0}.*.ecschema." + format).format(readVersion.padStartEx(2, "0"));
      threeVersionSuffix = (".{0}.*.*.ecschema." + format).format(readVersion.padStartEx(2, "0"));
    } else {
      twoVersionSuffix = (".{0}.{1}.ecschema." + format).format(readVersion.padStartEx(2, "0"), writeVersion.padStartEx(2, "0"));
      threeVersionSuffix = (".{0}.{1}.{2}.ecschema." + format).format(readVersion.padStartEx(2, "0"), writeVersion.padStartEx(2, "0"), minorVersion.padStartEx(2, "0"));
    }

    const twoVersionExpression = desiredKey.name + twoVersionSuffix;
    const threeVersionExpression = desiredKey.name + threeVersionSuffix;

    for (const searchPath of this.searchPaths) {
      this.addCandidateNoExtSchemaKey(foundFiles, searchPath, desiredKey.name, desiredKey, matchType, format);
      this.addCandidateSchemaKeys(foundFiles, searchPath, twoVersionExpression, desiredKey, matchType, format);
      this.addCandidateSchemaKeys(foundFiles, searchPath, threeVersionExpression, desiredKey, matchType, format);
    }

    return foundFiles;
  }

  public abstract getSchema<T extends Schema>(key: SchemaKey, matchType: SchemaMatchType): Promise<T | undefined>;

  /**
   * Compares two Schema versions.  If the left-hand version is greater, 1 is returned. If the
   * left-hand version is less, -1 us returned.  If the versions are an exact match, 0 is returned.
   * @param lhs The 'left-hand' FileSchemaKey.
   * @param rhs The 'right-hand' FileSchemaKey.
   */
  public compareSchemaKeyByVersion(lhs: FileSchemaKey, rhs: FileSchemaKey): number {
    return lhs.compareByVersion(rhs);
  }
}
