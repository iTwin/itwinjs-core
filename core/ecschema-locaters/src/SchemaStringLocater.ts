/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Locaters
 */

import { Schema, SchemaContext, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";

/**
 * A SchemaKey implementation that aids in identifying Schema strings via the
 * addition of the schemaText property. The schemaText is the full XML string
 * representation of the Schema.
 * @beta
 */
export class StringSchemaKey extends SchemaKey {
  // The text for the schema loaded
  public schemaText: string;

  /**
   * Initializes a new StringSchemaKey object.
   * @param key The EC SchemaKey identifying the Schema.
   * @param schemaText The string representation of the Schema
   */
  constructor(key: SchemaKey, schemaText: string) {
    super(key.name, key.version);
    this.schemaText = schemaText;
  }
}

/**
 * Abstract class to hold common/overlapping functionality between SchemaJsonStringLocater and SchemaXmlStringLocater
 * @beta
 */
export abstract class SchemaStringLocater {
  public schemaStrings: string[];

  constructor() {
    this.schemaStrings = [];
  }

  /**
   * Adds schema strings used by this locator to find the
   * Schemas.
   * @param schemaPaths An array of Schema strings to add
   */
  public addSchemaStrings(schemaStrings: string[]) {
    // If the path is not in the schemaPaths array, add it
    for (const schemaString of schemaStrings)
      this.addSchemaString(schemaString);
  }

  /**
   * Adds a schema string used by this locator to locate and load Schemas.
   * @param schemaText The text of the Schema
   */
  public addSchemaString(schemaString: string) {
    const schemaKey = this.getSchemaKey(schemaString);
    // If the string is not in the schemaStrings array, add it
    if (!this.schemaStrings.find((entry) => this.getSchemaKey(entry).matches(schemaKey, SchemaMatchType.Exact)))
      this.schemaStrings.push(schemaString);
  }

  protected abstract getSchemaKey(data: string): SchemaKey;

  /**
   * Attempts to find all Schema strings that match the desired SchemaKey.
   * @param desiredKey The SchemaKey to match.
   * @param matchType The SchemaMatchType.
   */
  protected findEligibleSchemaKeys(desiredKey: Readonly<SchemaKey>, matchType: SchemaMatchType): StringSchemaKey[] {
    const foundStrings = new Array<StringSchemaKey>();

    for (const schemaString of this.schemaStrings) {
      // Get the schema key
      const key = this.getSchemaKey(schemaString);

      // If the key matches, put it in foundFiles
      if (key.matches(desiredKey, matchType))
        foundStrings.push(new StringSchemaKey(key, schemaString));
    }

    return foundStrings;
  }

  public abstract getSchema<T extends Schema>(key: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<T | undefined>;

  /**
   * Compares two Schema versions.  If the left-hand version is greater, 1 is returned. If the
   * left-hand version is less, -1 us returned.  If the versions are an exact match, 0 is returned.
   * @param lhs The 'left-hand' StringSchemaKey.
   * @param rhs The 'right-hand' StringSchemaKey.
   */
  public compareSchemaKeyByVersion = (lhs: StringSchemaKey, rhs: StringSchemaKey): number => {
    return lhs.compareByVersion(rhs);
  };
}
