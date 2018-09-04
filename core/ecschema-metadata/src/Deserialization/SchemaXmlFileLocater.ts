/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaKey, ECVersion, Schema, SchemaMatchType, ECObjectsError, ECObjectsStatus, ISchemaLocater } from "../";
import { SchemaFileLocater, FileSchemaKey } from "./SchemaFileLocater";
import { SchemaContext } from "./../Context";
import * as path from "path";

/**
 * A SchemaLocater implementation for locating XML Schema files
 * from the file system using configurable search paths. Returns only
 * Schemas from XML files with their keys populated.
 */
export class SchemaXmlFileLocater extends SchemaFileLocater implements ISchemaLocater {
  /**
   * Gets an array of SchemaKeys of the Schemas referenced by the given Schema.
   * @param xmlSchemaKey The SchemaKey of the parent Schema containing the references.
   */
  public getSchemaReferenceKeys(schemaKey: FileSchemaKey): SchemaKey[] {
    return this._getSchemaReferenceKeys(schemaKey);
  }

  /**
   * Attempts to retrieve a Schema with the given SchemaKey by using the configured search paths
   * to locate the XML Schema file from the file system. Returns only Schemas from XML files with
   * their keys populated.
   * @param key The SchemaKey of the Schema to retrieve.
   * @param matchType The SchemaMatchType.
   */
  public async getSchema<T extends Schema>(key: SchemaKey, matchType: SchemaMatchType, context?: SchemaContext): Promise<T | undefined> {
    const candidates: FileSchemaKey[] = this.findEligibleSchemaKeys(key, matchType, "xml");

    if (!candidates || candidates.length === 0)
      return undefined;

    const maxCandidate = candidates.sort(this.compareSchemaKeyByVersion)[candidates.length - 1];

    // TODO: Re-implement once references collection is a Promise[].
    /*
    const promise = new Promise<T>(async () => {
      const schema = new Schema(maxCandidate) as T;
      await this.addSchemaReferences(schema);
      this._knownSchemas.addSchema(schema);
      return schema;
    });
    */

    const schema = new Schema(maxCandidate) as T;
    if (context)
      await context.addSchema(schema);
    await this.addSchemaReferences(schema, context);
    return schema;
  }

  /**
   * Attempts to retrieve a Schema with the given SchemaKey by using the configured search paths
   * to locate the XML Schema file from the file system. Returns only Schemas from XML files with
   * their keys populated.
   * @param key The SchemaKey of the Schema to retrieve.
   * @param matchType The SchemaMatchType.
   */
  public getSchemaSync<T extends Schema>(key: SchemaKey, matchType: SchemaMatchType, context?: SchemaContext): T | undefined {
    const candidates: FileSchemaKey[] = this.findEligibleSchemaKeys(key, matchType, "xml");

    if (!candidates || candidates.length === 0)
      return undefined;

    const maxCandidate = candidates.sort(this.compareSchemaKeyByVersion)[candidates.length - 1];
    const schema = new Schema(maxCandidate) as T;
    if (context)
      context.addSchemaSync(schema);

    this.addSchemaReferencesSync(schema, context);
    return schema;
  }

  /**
   * Adds schemas to the references collection for the given Schema by locating
   * the referenced schemas.
   * @param schema The schema for which to add the references.
   */
  public async addSchemaReferences(schema: Schema, context?: SchemaContext): Promise<void> {
    const refKeys = this.getSchemaReferenceKeys(schema.schemaKey as FileSchemaKey);

    for (const key of refKeys) {
      /* TODO: Re-implement once references collection is an array of Promises.
      const promise = new Promise<Schema>(async () => {
        return await this.getSchema(key, SchemaMatchType.LatestReadCompatible);
      });
      const refSchema = await promise;
      if (refSchema)
        schema.references.push(refSchema);
        */

      const refSchema = context ? await context.getSchema(key, SchemaMatchType.LatestReadCompatible) : undefined;
      if (!refSchema)
        throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Unable to locate referenced schema: ${key.name}.${key.readVersion}.${key.writeVersion}.${key.minorVersion}`);

      schema.references.push(refSchema);
    }
  }

  /**
   * Adds schemas to the references collection for the given Schema by locating
   * the referenced schemas.
   * @param schema The schema for which to add the references.
   */
  public addSchemaReferencesSync(schema: Schema, context?: SchemaContext): void {
    const refKeys = this.getSchemaReferenceKeys(schema.schemaKey as FileSchemaKey);

    for (const key of refKeys) {
      /* TODO: Re-implement once references collection is an array of Promises.
      const promise = new Promise<Schema>(async () => {
        return await this.getSchema(key, SchemaMatchType.LatestReadCompatible);
      });
      const refSchema = await promise;
      if (refSchema)
        schema.references.push(refSchema);
        */

      const refSchema = context ? context.getSchemaSync(key, SchemaMatchType.LatestReadCompatible) : undefined;
      if (!refSchema)
        throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Unable to locate referenced schema: ${key.name}.${key.readVersion}.${key.writeVersion}.${key.minorVersion}`);

      schema.references.push(refSchema);
    }
  }

  /**
   * Loads a Schema from disk as a Promise.
   * @param schemaPath The path to the Schema file.
   */
  public async loadSchema<T extends Schema>(schemaPath: string): Promise<T | undefined> {
    // Load the file
    const schemaText = await this.readUtf8FileToString(schemaPath);

    // If the file wasn't found, throw an error
    if (!schemaText) throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Could not locate the schema file, ${schemaPath}`);

    this.addSchemaSearchPaths([path.dirname(schemaPath)]);

    // Grab the key and see if the schema is already loaded
    const key = this.getSchemaKey(schemaText);

    // TODO - bad path
    // Load the schema and return it
    const schema = new Schema(new FileSchemaKey(key, schemaPath, schemaText));
    await this.addSchemaReferences(schema);
    return schema as T;
  }

  /**
   * Constructs a SchemaKey based on the information in the Schema XML.
   * @param data The Schema XML as a string.
   */
  protected getSchemaKey(data: string): SchemaKey {
    const matches = data.match(/<ECSchema ([^]+?)>/g);
    if (!matches || matches.length !== 1)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `Could not find '<ECSchema>' tag in the given file`);

    const name = matches[0].match(/schemaName="(.+?)"/);
    const version = matches[0].match(/version="(.+?)"/);
    if (!name || name.length !== 2 || !version || version.length !== 2)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `Could not find the ECSchema 'schemaName' or 'version' tag in the given file`);

    const key = new SchemaKey(name[1], ECVersion.fromString(version[1]));
    return key;
  }

  /**
   * Gets an array of SchemaKeys of the Schemas referenced by the given Schema.
   * @param data The Schema XML string.
   */
  private _getSchemaReferenceKeys(xmlSchemaKey: FileSchemaKey): SchemaKey[] {
    const file = xmlSchemaKey.schemaText;

    if (!file)
      throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Could not locate the schema file, ${xmlSchemaKey.fileName}, for the schema ${xmlSchemaKey.name}`);

    const data = file.toString().replace(/(\s*)<!--.*?-->/g, ""); // ignore any comments in the XML file when getting the array of SchemaKeys

    const keys: SchemaKey[] = [];
    const matches = data.match(/<ECSchemaReference ([^]+?)\/>/g);
    if (!matches)
      return keys;

    for (const match of matches) {
      const name = match.match(/name="(.+?)"/);
      const versionMatch = match.match(/version="(.+?)"/);
      if (!name || name.length !== 2 || !versionMatch || versionMatch.length !== 2)
        throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `Invalid ECSchemaReference xml encountered in the schema file`);

      // write version maybe missing, so insert "0"
      let versionString = versionMatch[1];
      const versionParts = versionString.split(".");
      if (versionParts.length === 2)
        versionParts.splice(1, 0, "0");

      versionString = versionParts.join(".");

      const key = new SchemaKey(name[1], ECVersion.fromString(versionString));
      keys.push(key);
    }

    return keys;
  }
}
