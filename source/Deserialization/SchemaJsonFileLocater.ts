/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaKey, ECVersion, Schema, SchemaMatchType, ECObjectsError, ECObjectsStatus, ISchemaLocater} from "..";
import { SchemaFileLocator, FileSchemaKey } from "./SchemaFileLocater";
import * as path from "path";

/**
 * A SchemaLocator implementation for locationg JSON Schema files
 * from the file system using configurable search paths.
 */
export class SchemaJsonFileLocater extends SchemaFileLocator implements ISchemaLocater {

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
   * Loads a Schema from disk as a Promise.
   * @param schemaPath The path to the Schema file.
   */
  public async loadSchema<T extends Schema>(schemaPath: string): Promise<T | undefined> {
    // Load the file
    const file = this.getSchemaFile(schemaPath);

    // If the file wasn't found, throw an error
    if (!file) throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Could not locate the schema file, ${schemaPath}`);

    this.addSchemaSearchPaths([path.dirname(schemaPath)]);

    const schemaText = file.toString();

    // Grab the key and see if the schema is already loaded
    const key = this.getSchemaKey(schemaText);
    const foundSchema = this.knownSchemas.getSchemaSync(key, SchemaMatchType.Exact);

    if (foundSchema) return foundSchema as T;

    // TODO - bad path
    // Load the schema and return it
    const schema = new Schema(new FileSchemaKey(key, schemaPath, schemaText));
    this.knownSchemas.addSchemaSync(schema);
    return schema as T;
  }

  /**
   * Attempts to retrieve a Schema with the given SchemaKey by using the configured
   * search paths to locate the JSON schema file from the file system.
   * @param key The SchemaKey of the Schema to retrieve.
   * @param matchType The SchemaMatchType
   */
  public async getSchema<T extends Schema>(key: SchemaKey, matchType: SchemaMatchType): Promise<T | undefined> {
    // Check for the schema in the known schemata
    const foundSchema = await this.knownSchemas.getSchema(key, matchType);
    // If the schema is a known one return it
    if (foundSchema)
      return foundSchema as T;

    // Grab all schema files that match the schema key
    const candidates: FileSchemaKey[] = this.findEligibleSchemaKeys(key, matchType, "json");
    if (!candidates || candidates.length === 0)
      return undefined;

    const maxCandidate = candidates.sort(this.compareSchemaKeyByVersion)[candidates.length - 1];
    const maxFilePath = maxCandidate.fileName;

    // Load the schema with that file path
    const schema: Promise<T | undefined> = this.loadSchema(maxFilePath);

    return schema;
  }
}
