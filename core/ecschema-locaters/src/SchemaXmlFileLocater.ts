/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Locaters
 */

import * as path from "path";
import * as fs from "fs";
import { DOMParser } from "@xmldom/xmldom";
import {
  ECSchemaError, ECSchemaStatus, ECVersion, ISchemaLocater, Schema, SchemaContext, SchemaInfo, SchemaKey, SchemaMatchType, SchemaReadHelper, XmlParser,
} from "@itwin/ecschema-metadata";
import { FileSchemaKey, SchemaFileLocater } from "./SchemaFileLocater";
import { globSync } from "glob";

/**
 * A SchemaLocater implementation for locating XML Schema files
 * from the file system using configurable search paths.
 * @public @preview This is a workaround the current lack of a full xml parser.
 */
export class SchemaXmlFileLocater extends SchemaFileLocater implements ISchemaLocater {
  /**
   * Attempts to retrieve a Schema with the given SchemaKey by using the configured search paths
   * to locate the XML Schema file from the file system.
   * @param key The SchemaKey of the Schema to retrieve.
   * @param matchType The SchemaMatchType.
   * @param context The SchemaContext that will control the lifetime of the schema.
   */
  public async getSchema(key: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<Schema | undefined> {
    await this.getSchemaInfo(key, matchType, context);

    const schema = await context.getCachedSchema(key, matchType);
    return schema;
  }

  /**
    * Gets the schema info which matches the provided SchemaKey.  The schema info may be returned before the schema is fully loaded.
    * The fully loaded schema can be gotten later from the context using the getCachedSchema method.
    * @param schemaKey The SchemaKey describing the schema to get from the cache.
    * @param matchType The match type to use when locating the schema
    * @param context The SchemaContext that will control the lifetime of the schema and holds the schema's references, if they exist.
    */
  public async getSchemaInfo(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<SchemaInfo | undefined> {
    const candidates: FileSchemaKey[] = this.findEligibleSchemaKeys(schemaKey, matchType, "xml");

    if (0 === candidates.length)
      return undefined;

    const maxCandidate = candidates.sort(this.compareSchemaKeyByVersion)[candidates.length - 1];
    const schemaPath = maxCandidate.fileName;

    // Load the file
    if (undefined === await this.fileExists(schemaPath))
      return undefined;

    const schemaText = await this.readUtf8FileToString(schemaPath);
    if (undefined === schemaText)
      return undefined;

    const parser = new DOMParser();
    const document = parser.parseFromString(schemaText);

    this.addSchemaSearchPaths([path.dirname(schemaPath)]);
    const reader = new SchemaReadHelper(XmlParser, context);
    const schema = new Schema(context);

    return reader.readSchemaInfo(schema, document);
  }

  /**
   * Attempts to retrieve a Schema with the given SchemaKey by using the configured search paths
   * to locate the XML Schema file from the file system.
   * @param key The SchemaKey of the Schema to retrieve.
   * @param matchType The SchemaMatchType.
   * @param context The SchemaContext that will control the lifetime of the schema.
   */
  public getSchemaSync(key: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Schema | undefined {
    const candidates: FileSchemaKey[] = this.findEligibleSchemaKeys(key, matchType, "xml");

    if (!candidates || candidates.length === 0)
      return undefined;

    const maxCandidate = candidates.sort(this.compareSchemaKeyByVersion)[candidates.length - 1];
    const schemaPath = maxCandidate.fileName;

    // Load the file
    if (!this.fileExistsSync(schemaPath))
      return undefined;

    const schemaText = this.readUtf8FileToStringSync(schemaPath);
    if (!schemaText)
      return undefined;

    const parser = new DOMParser();
    const document = parser.parseFromString(schemaText);

    this.addSchemaSearchPaths([path.dirname(schemaPath)]);
    const reader = new SchemaReadHelper(XmlParser, context);
    let schema: Schema = new Schema(context);
    schema = reader.readSchemaSync(schema, document);

    return schema;
  }

  /**
   * Constructs a SchemaKey based on the information in the Schema XML.
   * @param data The Schema XML as a string.
   */
  public getSchemaKey(data: string): SchemaKey {
    const matches = data.match(/<ECSchema ([^]+?)>/g);
    if (!matches || matches.length !== 1)
      throw new ECSchemaError(ECSchemaStatus.InvalidSchemaXML, `Could not find '<ECSchema>' tag in the given file`);

    const name = matches[0].match(/schemaName="(.+?)"/);
    const version = matches[0].match(/version="(.+?)"/);
    if (!name || name.length !== 2 || !version || version.length !== 2)
      throw new ECSchemaError(ECSchemaStatus.InvalidSchemaXML, `Could not find the ECSchema 'schemaName' or 'version' tag in the given file`);

    const key = new SchemaKey(name[1], ECVersion.fromString(version[1]));
    return key;
  }
}

/**
 * This locater is responsible for locating standard schema files that are released by the core-backend package.
 * The locater needs an argument to the known backend assets directory where the core-backend package is installed.
 * This can be accessed by the KnownLocations.nativeAssetsDir getter provided by core-backend.
 *
 * @note This locater is read-only and does not allow adding new schema search paths.
 * @note This locater should be used as a fallback/last chance locater in the schema context as any user defined schema should have higher precedence over the standard schema.
 * @public @preview This is a workaround due to the current lack of a full xml parser.
 */
export class PublishedSchemaXmlFileLocater extends SchemaXmlFileLocater implements ISchemaLocater {
  /**
   * Constructs a new PublishedSchemaXmlFileLocater
   * @param knownBackendAssetsDir The assets directory where the core-backend package is installed. Can be accessed by the KnownLocations.nativeAssetsDir getter provided by core-backend.
   */
  public constructor(knownBackendAssetsDir: string) {
    super();

    const ecSchemaDir = path.join(knownBackendAssetsDir, "ECSchemas");
    if (!fs.existsSync(ecSchemaDir))
      throw new Error(`The directory ${ecSchemaDir} containing standard schemas does not exist.`);

    // Pre-defined set of standard schema search paths
    this.searchPaths.push(...globSync(path.join(ecSchemaDir, "*/"), { windowsPathsNoEscape: true }).filter(fs.existsSync));
  }

  /**
   * Overrides the addSchemaSearchPath method to prevent adding new schema search paths.
   *
   * @param _schemaPath - The schema path to add (ignored).
   */
  public override addSchemaSearchPath(_schemaPath: string): void {
    return; // Do nothing, this is a read-only locator
  }

  /**
   * Overrides the addSchemaSearchPaths method to prevent adding new schema search paths.
   *
   * @param _schemaPaths - The schema paths to add (ignored).
   */
  public override addSchemaSearchPaths(_schemaPaths: string[]): void {
    return; // Do nothing, this is a read-only locator
  }
}
