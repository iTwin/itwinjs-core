/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Locaters
 */

import { DOMParser } from "@xmldom/xmldom";
import {
  ECObjectsError, ECObjectsStatus, ECVersion, ISchemaLocater, Schema, SchemaContext, SchemaInfo, SchemaKey, SchemaMatchType, SchemaReadHelper, XmlParser,
} from "@itwin/ecschema-metadata";
import { SchemaStringLocater, StringSchemaKey } from "./SchemaStringLocater";

/**
 * A SchemaLocator implementation for locating and deserializing EC Schemas from XML strings
 * loaded in memory.
 * @beta
 */
export class SchemaXmlStringLocater extends SchemaStringLocater implements ISchemaLocater {

  /**
   * Constructs a SchemaKey based on the information in the Schema XML.
   * @param schemaXml The Schema XML as a string.
   */
  public getSchemaKey(schemaXml: string): SchemaKey {
    const matches = schemaXml.match(/<ECSchema ([^]+?)>/g);
    if (!matches || matches.length !== 1)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `Could not find '<ECSchema>' tag in the given string`);

    const name = matches[0].match(/schemaName="(.+?)"/);
    const version = matches[0].match(/version="(.+?)"/);
    if (!name || name.length !== 2 || !version || version.length !== 2)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `Could not find the ECSchema 'schemaName' or 'version' tag in the given string`);

    const ecVersion = ECVersion.fromString(version[1]);
    const key = new SchemaKey(name[1], ecVersion);
    return key;
  }

  /**
   * Attempts to retrieve a Schema with the given SchemaKey by searching the configured
   * Schema strings.
   * @param key The SchemaKey of the Schema to retrieve.
   * @param matchType The SchemaMatchType.
   * @param context The SchemaContext that will control the lifetime of the schema and holds the schema's references, if they exist.
   */
  public async getSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<T | undefined> {
    await this.getSchemaInfo(schemaKey, matchType, context);

    const schema = await context.getCachedSchema(schemaKey, matchType);
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
    // Grab all schema strings that match the schema key
    const candidates: StringSchemaKey[] = this.findEligibleSchemaKeys(schemaKey, matchType);
    if (!candidates || candidates.length === 0)
      return undefined;

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const maxCandidate = candidates.sort(this.compareSchemaKeyByVersion)[candidates.length - 1];
    const schemaText = maxCandidate.schemaText;

    const parser = new DOMParser();
    const document = parser.parseFromString(schemaText);

    const reader = new SchemaReadHelper(XmlParser, context);
    const schema = new Schema(context);

    return reader.readSchemaInfo(schema, document);
  }

  /**
   * Attempts to retrieve a Schema with the given SchemaKey by searching the configured
   * Schema strings.
   * @param key The SchemaKey of the Schema to retrieve.
   * @param matchType The SchemaMatchType.
   * @param context The SchemaContext that will control the lifetime of the schema and holds the schema's references, if they exist.
   */
  public getSchemaSync<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): T | undefined {
    // Grab all schema strings that match the schema key
    const candidates: StringSchemaKey[] = this.findEligibleSchemaKeys(schemaKey, matchType);
    if (!candidates || candidates.length === 0)
      return undefined;

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const maxCandidate = candidates.sort(this.compareSchemaKeyByVersion)[candidates.length - 1];
    const schemaText = maxCandidate.schemaText;

    const parser = new DOMParser();
    const document = parser.parseFromString(schemaText);

    const reader = new SchemaReadHelper(XmlParser, context);
    let schema: Schema = new Schema(context);
    schema = reader.readSchemaSync(schema, document);

    return schema as T;
  }

  /**
   * Parses a valid EC 2.0 version string and returns an ECVersion object. The second digit becomes the minor version,
   * and a zero is inserted as the 'write' digit. Example: "1.1" -> "1.0.1".
   * @param versionString A valid EC 2.0 version string of the format, 'RR.mm'.
   */
  private fromECv2String(versionString: string): ECVersion {
    const [read, minor] = versionString.split(".");

    if (!read)
      throw new ECObjectsError(ECObjectsStatus.InvalidECVersion, `The read version is missing from version string, ${versionString}`);

    if (!minor)
      throw new ECObjectsError(ECObjectsStatus.InvalidECVersion, `The minor version is missing from version string, ${versionString}`);

    return new ECVersion(+read, 0, +minor);
  }

}
