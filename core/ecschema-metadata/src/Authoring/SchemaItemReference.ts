/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

/**
 * A structured reference to a schema item (a class, enumeration, KindOfQuantity, custom attribute
 * class, ...) in the form `[schemaNameOrAlias]:itemName`. The schema part is optional; when absent
 * the reference is *local* - it points at an item within the same document.
 *
 * Named to distinguish it from a schema *reference* (a `name` + `version` entry in a document's
 * reference list): this points at an item, not at another schema. It is the authoring-model
 * counterpart to a bare full-name string and deliberately resolves nothing: it does not know whether
 * `schemaNameOrAlias` is a schema name or an alias, nor whether the referenced item exists. That
 * resolution happens at compile time. Modeling references this way (rather than as a bare string or a
 * branded string) makes the optional-schema / local-reference semantics explicit and format-checkable
 * without a resolved graph.
 *
 * Inputs across the authoring API accept `string | SchemaItemReference` and normalize to this form via
 * {@link SchemaItemReference.from}; {@link SchemaItemReference.parse} accepts both the `:` and `.`
 * separators that EC full names use in different contexts. {@link SchemaItemReference.toString} emits
 * the `:` form; format writers choose their own separator when serializing.
 * @alpha
 */
export class SchemaItemReference {
  /** The schema name or alias, or `undefined` for a local (same-document) reference. */
  public readonly schemaNameOrAlias?: string;
  /** The unqualified item name. */
  public readonly name: string;

  /** @param name The unqualified item name. @param schemaNameOrAlias The schema name or alias; omit (or pass empty) for a local reference. */
  public constructor(name: string, schemaNameOrAlias?: string) {
    this.name = name;
    // Normalize an empty / whitespace-only schema part to undefined so `isLocal` is unambiguous.
    this.schemaNameOrAlias = schemaNameOrAlias && schemaNameOrAlias.trim().length > 0 ? schemaNameOrAlias : undefined;
  }

  /** True when this reference has no schema part, i.e. it points at an item in the same document. */
  public get isLocal(): boolean {
    return this.schemaNameOrAlias === undefined;
  }

  /**
   * Parses a full-name string into a SchemaItemReference. Accepts `schema:item`, `schema.item`, or a
   * bare `item` (local). The `:` separator takes precedence over `.`, matching how SchemaView resolves
   * qualified names. No graph is consulted and no validity is asserted.
   */
  public static parse(text: string): SchemaItemReference {
    const trimmed = text.trim();
    let sep = trimmed.indexOf(":");
    if (sep === -1)
      sep = trimmed.indexOf(".");

    if (sep === -1)
      return new SchemaItemReference(trimmed);

    const schema = trimmed.substring(0, sep).trim();
    const name = trimmed.substring(sep + 1).trim();
    return new SchemaItemReference(name, schema.length > 0 ? schema : undefined);
  }

  /** Normalizes a `string | SchemaItemReference` to a SchemaItemReference. Strings are parsed; SchemaItemReference values pass through unchanged. */
  public static from(value: string | SchemaItemReference): SchemaItemReference {
    return typeof value === "string" ? SchemaItemReference.parse(value) : value;
  }

  /** Formats this reference as `schemaNameOrAlias:name`, or just `name` when local. */
  public toString(): string {
    return this.schemaNameOrAlias === undefined ? this.name : `${this.schemaNameOrAlias}:${this.name}`;
  }

  /**
   * Case-insensitive lexical equality of both parts. This compares the strings as written - it does
   * not resolve aliases against schema names, so a schema-name reference and an alias reference to the
   * same item are not considered equal.
   */
  public equals(other: SchemaItemReference): boolean {
    const sameSchema = this.schemaNameOrAlias === undefined
      ? other.schemaNameOrAlias === undefined
      : other.schemaNameOrAlias !== undefined && this.schemaNameOrAlias.toLowerCase() === other.schemaNameOrAlias.toLowerCase();
    return sameSchema && this.name.toLowerCase() === other.name.toLowerCase();
  }
}
