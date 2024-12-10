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
  ECObjectsError, ECObjectsStatus, ECVersion, ISchemaLocater, Schema, SchemaContext, SchemaInfo, SchemaKey, SchemaMatchType, SchemaReadHelper, XmlParser,
} from "@itwin/ecschema-metadata";
import { FileSchemaKey, SchemaFileLocater } from "./SchemaFileLocater";
import { globSync } from "glob";

/**
 * A SchemaLocater implementation for locating XML Schema files
 * from the file system using configurable search paths.
 * @beta This is a workaround the current lack of a full xml parser.
 */
export class SchemaXmlFileLocater extends SchemaFileLocater implements ISchemaLocater {
  /**
   * Attempts to retrieve a Schema with the given SchemaKey by using the configured search paths
   * to locate the XML Schema file from the file system.
   * @param key The SchemaKey of the Schema to retrieve.
   * @param matchType The SchemaMatchType.
   * @param context The SchemaContext that will control the lifetime of the schema.
   */
  public async getSchema<T extends Schema>(key: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<T | undefined> {
    await this.getSchemaInfo(key, matchType, context);

    const schema = await context.getCachedSchema(key, matchType);
    return schema as T;
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

    // Find the first non-default user-defined search path
    const preferredCandidate = candidates.find((candidate) => this.searchPathPrecedence.get(path.dirname(candidate.fileName)) === 0);
    const schemaPath: string = preferredCandidate ? preferredCandidate.fileName : candidates.sort(this.compareSchemaKeyByVersion)[candidates.length - 1].fileName;

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
  public getSchemaSync<T extends Schema>(key: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): T | undefined {
    const candidates: FileSchemaKey[] = this.findEligibleSchemaKeys(key, matchType, "xml");

    if (!candidates || candidates.length === 0)
      return undefined;

    // Find the first non-default user-defined search path
    const preferredCandidate = candidates.find((candidate) => this.searchPathPrecedence.get(path.dirname(candidate.fileName)) === 0);
    const schemaPath: string = preferredCandidate ? preferredCandidate.fileName : candidates.sort(this.compareSchemaKeyByVersion)[candidates.length - 1].fileName;

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

    return schema as T;
  }

  /**
   * Constructs a SchemaKey based on the information in the Schema XML.
   * @param data The Schema XML as a string.
   */
  public getSchemaKey(data: string): SchemaKey {
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
}

/**
 * A SchemaLocater implementation for locating XML Schema files
 * from the file system using configurable search paths.
 * This locater is responsible for locating standard schema files
 * that are released in the core-backend package.
 * @beta This is a workaround the current lack of a full xml parser.
 */
export class PublishedSchemaXmlFileLocater extends SchemaXmlFileLocater implements ISchemaLocater {
  private _standardSchemaSearchPaths = new Set<string>();

  /**
   * Constructs a new PublishedSchemaXmlFileLocater
   * @param knownBackendAssetsDir The assets directory where the core-backend package is installed.
   */
  public constructor(knownBackendAssetsDir?: string) {
    super();

    if (!knownBackendAssetsDir) {
      globSync(path.join(__dirname, "..", "..", "node_modules", "@bentley", "*-schema"), { windowsPathsNoEscape: true }).forEach(match => this._standardSchemaSearchPaths.add(match));
    } else {
      // Pre-defined set of standard schema search paths
      this._standardSchemaSearchPaths = new Set([
        path.join(knownBackendAssetsDir, "ECSchemas", "Dgn"),
        path.join(knownBackendAssetsDir, "ECSchemas", "Domain"),
        path.join(knownBackendAssetsDir, "ECSchemas", "ECDb"),
        path.join(knownBackendAssetsDir, "ECSchemas", "Standard"),
      ]);
    }

    this._standardSchemaSearchPaths.forEach((schemaPath) => {
      if (fs.existsSync(schemaPath)) {
        this.searchPaths.push(schemaPath);

        // The precedence of the standard schema search paths is set to the lower priority of 1
        // This is to ensure that user-defined search paths have higher precedence which will be set with the priority of 0
        this.searchPathPrecedence.set(schemaPath, 1);
      }
    });
  }

  /**
   * Add one search path to be used by this locator to find the Schema files.
   * @param schemaPath A search path to add
   */
  public override addSchemaSearchPath(schemaPath: string): void {
    this.addSchemaSearchPaths([schemaPath]);
  }

  /**
   * Adds more search paths to be used by this locator to find the Schema files.
   * @param schemaPaths An array of search paths to add
   */
  public override addSchemaSearchPaths(schemaPaths: string[]): void {
    // Add a schema path if it doesn't exist in the locater's search paths
    schemaPaths.forEach((schemaPath) => {
      if (!this.searchPaths.includes(schemaPath) && !this.searchPaths.includes(`\\\\?\\${schemaPath}`)) {
        this.searchPaths.push(schemaPath);

        // User defined search paths have the highesh precendence/priority of 0
        if (this.searchPathPrecedence.get(schemaPath) === undefined)
          this.searchPathPrecedence.set(schemaPath, 0);
      }
    });
  }
}
