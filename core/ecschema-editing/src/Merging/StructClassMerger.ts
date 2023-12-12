/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SchemaKey, StructClass } from "@itwin/ecschema-metadata";
import { ClassMerger } from "./ClassMerger";
import { SchemaItemEditResults } from "../Editing/Editor";

/**
 * @internal
 */
export default class StructClassMerger extends ClassMerger<StructClass> {

  protected override async create(schemaKey: SchemaKey, ecClass: StructClass): Promise<SchemaItemEditResults> {
    return this.context.editor.structs.create(schemaKey, ecClass.name);
  }
}
