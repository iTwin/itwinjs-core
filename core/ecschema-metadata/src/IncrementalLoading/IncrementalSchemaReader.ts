/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { SchemaContext } from "../Context";
import { SchemaReadHelper } from "../Deserialization/Helper";
import { JsonParser } from "../Deserialization/JsonParser";
import { SchemaItemType } from "../ECObjects";
import { ECClass } from "../Metadata/Class";
import { Schema } from "../Metadata/Schema";
import { SchemaItem } from "../Metadata/SchemaItem";
import { SchemaLoadingController } from "../utils/SchemaLoadingController";

/**
 * Internal helper class to read schema information incrementally. It's based on the [[SchemaReadHelper]]
 * but overrides a few methods to support the incremental schema loading case.
 * @internal
 */
export class IncrementalSchemaReader extends SchemaReadHelper {
  private readonly _incremental: boolean;

  /**
   * Initializes a new [[IncrementalSchemaReader]] instance.
   * @param schemaContext The [[SchemaContext]] used to load the schemas.
   * @param incremental Indicates that the Schema should be read incrementally.
   * Pass false to load the full schema without an incremental/partial load.
   */
  constructor(schemaContext: SchemaContext, incremental: boolean) {
    super(JsonParser, schemaContext);
    this._incremental = incremental;
  }

  /**
   * Indicates that a given [[SchemaItem]] has been fully loaded.
   * @param schemaItem The SchemaItem to check.
   * @returns True if the item has been loaded, false if still in progress.
   */
  protected override isSchemaItemLoaded(schemaItem: SchemaItem | undefined): boolean {
    return schemaItem !== undefined
      && schemaItem.loadingController !== undefined
      && schemaItem.loadingController.isComplete;
  }

  /**
   * Starts loading the [[SchemaItem]] identified by the given name and itemType.
   * @param schema The [[Schema]] that contains the SchemaItem.
   * @param name The name of the SchemaItem to load.
   * @param itemType The SchemaItem type name of the item to load.
   * @param schemaItemObject The object accepting the SchemaItem data.
   * @returns A promise that resolves to the loaded SchemaItem instance. Can be undefined.
   */
  public override async loadSchemaItem(schema: Schema, name: string, itemType: string, schemaItemObject: Readonly<unknown>): Promise<SchemaItem | undefined> {
    const schemaItem = await super.loadSchemaItem(schema, name, itemType, this._incremental ? undefined : schemaItemObject);

    // In incremental mode, we only load the stubs of the classes. These include the modifier and base classes.
    // The fromJSON method of the actual class instances may complain about missing properties in the props, so
    // calling the fromJSON on the ECClass ensures only the bare minimum is loaded.
    if (this._incremental && schemaItemObject && schemaItem) {
      await schemaItem.fromJSON(schemaItemObject);
    }

    this.schemaItemLoading(schemaItem);
    return schemaItem;
  }

  private schemaItemLoading(schemaItem: SchemaItem | undefined): void {
    if (schemaItem === undefined)
      return;

    if (schemaItem.loadingController === undefined) {
      const controller = new SchemaLoadingController();
      schemaItem.setLoadingController(controller);

      return this.schemaItemLoading(schemaItem);
    }

    if (ECClass.isECClass(schemaItem)
      || schemaItem.schemaItemType === SchemaItemType.KindOfQuantity
      || schemaItem.schemaItemType === SchemaItemType.Format)
      schemaItem.loadingController.isComplete = !this._incremental;
    else
      schemaItem.loadingController.isComplete = true;
  }
}