/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64Arg, Id64String } from "@itwin/core-bentley";
import {
  EcefLocationProps, ElementProps, FilePropertyProps, LocalFileName, ModelProps, RelationshipProps, SaveChangesArgs,
} from "@itwin/core-common";
import type { Range3dProps } from "@itwin/core-geometry";
import { EditTxn } from "../EditTxn";
import type { IModelDb, InsertElementOptions, SchemaImportOptions, UpdateModelOptions } from "../IModelDb";

class TestEditTxn extends EditTxn {
  public constructor(iModel: IModelDb) {
    super(iModel);
  }

  private ensureStarted(): void {
    if (this.iModel.activeTxn !== this)
      this.start();
  }

  public override saveChanges(args?: string | SaveChangesArgs): void {
    super.saveChanges(args);
  }

  public override insertElement(elProps: ElementProps, options?: InsertElementOptions): Id64String {
    this.ensureStarted();
    return super.insertElement(elProps, options);
  }

  public override updateElement<T extends ElementProps>(elProps: Partial<T>): void {
    this.ensureStarted();
    super.updateElement(elProps);
  }

  public override deleteElement(ids: Id64Arg): void {
    this.ensureStarted();
    super.deleteElement(ids);
  }

  public override insertModel(props: ModelProps): Id64String {
    this.ensureStarted();
    return super.insertModel(props);
  }

  public override updateModel(props: UpdateModelOptions): void {
    this.ensureStarted();
    super.updateModel(props);
  }

  public override deleteModel(ids: Id64Arg): void {
    this.ensureStarted();
    super.deleteModel(ids);
  }

  public override updateGeometryGuid(modelId: Id64String): void {
    this.ensureStarted();
    super.updateGeometryGuid(modelId);
  }

  public override insertRelationship(props: RelationshipProps): Id64String {
    this.ensureStarted();
    return super.insertRelationship(props);
  }

  public override updateRelationship(props: Partial<RelationshipProps>): void {
    this.ensureStarted();
    super.updateRelationship(props);
  }

  public override deleteRelationship(props: RelationshipProps): void {
    this.ensureStarted();
    super.deleteRelationship(props);
  }

  public override deleteRelationships(props: ReadonlyArray<RelationshipProps>): void {
    this.ensureStarted();
    super.deleteRelationships(props);
  }

  public override async importSchemas(schemaFileNames: LocalFileName[], options?: SchemaImportOptions): Promise<void> {
    this.ensureStarted();
    await super.importSchemas(schemaFileNames, options);
  }

  public override async importSchemaStrings(serializedXmlSchemas: string[], options?: SchemaImportOptions): Promise<void> {
    this.ensureStarted();
    await super.importSchemaStrings(serializedXmlSchemas, options);
  }

  public override saveFileProperty(prop: FilePropertyProps, strValue: string | undefined, blobVal?: Uint8Array): void {
    this.ensureStarted();
    super.saveFileProperty(prop, strValue, blobVal);
  }

  public override async updateProjectExtents(newExtents: Range3dProps): Promise<void> {
    this.ensureStarted();
    await super.updateProjectExtents(newExtents);
  }

  public override async updateEcefLocation(ecef: EcefLocationProps): Promise<void> {
    this.ensureStarted();
    await super.updateEcefLocation(ecef);
  }
}

const txns = new WeakMap<IModelDb, TestEditTxn>();

export function editTxnOf(iModel: IModelDb): TestEditTxn {
  let txn = txns.get(iModel);
  if (undefined === txn) {
    txn = new TestEditTxn(iModel);
    txns.set(iModel, txn);
  }

  return txn;
}
