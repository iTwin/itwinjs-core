/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaKey, ECVersion, Schema, SchemaMatchType, ECObjectsError, ECObjectsStatus, ISchemaLocater} from "..";
import { SchemaFileLocater, FileSchemaKey } from "./SchemaFileLocater";
import { SchemaContext } from "./../Context";
import * as path from "path";
import * as fs from "fs";

/**
 * A SchemaLocator implementation for locationg JSON Schema files
 * from the file system using configurable search paths.
 */
export class SchemaJsonFileLocater extends SchemaFileLocater implements ISchemaLocater {

  /**
   * Constructs a SchemaKey based on the information in the Schema JSON
   * @param data The Schema JSON as a string
   */
  protected getSchemaKey(data: string): SchemaKey {
    const dataJson = JSON.parse(data);

    // Check if the name is present
    if (!(dataJson.name))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Could not retrieve the ECSchema name in the given file.`);

    // Check if versions is present
    if (!(dataJson.version))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Could not parse the ECSchema version in the given file.`);

    // Get the name and version from the JSON
    const schemaName = dataJson.name;
    const schemaVersion = dataJson.version;

    const key = new SchemaKey(schemaName.toString(), ECVersion.fromString(schemaVersion.toString()));
    return key;
  }

  /**
   * Attempts to retrieve a Schema with the given SchemaKey by using the configured
   * search paths to locate the JSON schema file from the file system.
   * @param key The SchemaKey of the Schema to retrieve.
   * @param matchType The SchemaMatchType
   */
  public async getSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context?: SchemaContext): Promise<T | undefined> {
    // Grab all schema files that match the schema key
    const candidates: FileSchemaKey[] = this.findEligibleSchemaKeys(schemaKey, matchType, "json");
    if (!candidates || candidates.length === 0)
      return undefined;

    const maxCandidate = candidates.sort(this.compareSchemaKeyByVersion)[candidates.length - 1];
    const schemaPath = maxCandidate.fileName;

    // Load the file
    if (!await this.fileExists(schemaPath))
        return undefined;

    const schemaText = await this.readUtf8FileToString(schemaPath);
    if (!schemaText)
      return undefined;

    this.addSchemaSearchPaths([path.dirname(schemaPath)]);

    const schema = await Schema.fromJson(schemaText, context);
    return schema as T;
  }

  /**
   * Attempts to retrieve a Schema with the given SchemaKey by using the configured
   * search paths to locate the JSON schema file from the file system.
   * @param key The SchemaKey of the Schema to retrieve.
   * @param matchType The SchemaMatchType
   */
  public getSchemaSync<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context?: SchemaContext): T | undefined {
    // Grab all schema files that match the schema key
    const candidates: FileSchemaKey[] = this.findEligibleSchemaKeys(schemaKey, matchType, "json");
    if (!candidates || candidates.length === 0)
      return undefined;

    const maxCandidate = candidates.sort(this.compareSchemaKeyByVersion)[candidates.length - 1];
    const schemaPath = maxCandidate.fileName;

    // Load the file
    if (!fs.existsSync(schemaPath))
        return undefined;

    const schemaText = fs.readFileSync(schemaPath, "utf-8");
    if (!schemaText)
      return undefined;

    this.addSchemaSearchPaths([path.dirname(schemaPath)]);

    const schema = Schema.fromJsonSync(schemaText, context);
    return schema as T;
  }
}
