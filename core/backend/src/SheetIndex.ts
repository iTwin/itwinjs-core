/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { BisCodeSpec, Code, CodeScopeProps, CodeSpec, ElementProps, EntityReferenceSet, IModelError, RelatedElementProps, SheetIndexEntryProps, SheetIndexFolderProps, SheetIndexReferenceProps, SheetReferenceProps } from "@itwin/core-common";
import { InformationReferenceElement, Sheet } from "./Element";
import { IModelDb } from "./IModelDb";
import { Id64String, IModelStatus } from "@itwin/core-bentley";
import { SheetIndexFolderOwnsEntries, SheetIndexOwnsEntries, SheetIndexReferenceRefersToSheetIndex, SheetReferenceRefersToSheet } from "./NavigationRelationship";

/** Arguments used to create a [[SheetIndexEntry]].
 * @beta
 */
export interface SheetIndexEntryCreateArgs {
  /** The iModel that will contain the sheet index entry. */
  iModelDb: IModelDb;
  /** The Id of the [[SheetIndexModel]] that will contain the sheet index entry. */
  sheetIndexModelId: Id64String;
  /** The [[SheetIndex]] or [[SheetIndexFolder]] that is parent to this SheetIndexEntry */
  parentId: Id64String;
  /** The name of the SheetIndexEntry */
  name: string;
  /** The priority of the SheetIndexEntry */
  priority: number;
}

/** Arguments supplied when creating a [[SheetIndexReference]].
 * @beta
 */
export interface SheetIndexReferenceCreateArgs extends SheetIndexEntryCreateArgs {
  /** The [[SheetIndex]] to which the reference refers. */
  sheetIndexId?: Id64String;
}

/** Arguments supplied when creating a [[SheetReference]].
 * @beta
 */
export interface SheetReferenceCreateArgs extends SheetIndexEntryCreateArgs {
  /** The [[Sheet]] to which the reference refers. */
  sheetId?: Id64String;
}

/** A [structured collection]($docs/bis/domains/drawings-sheets#sheet-index) of [[SheetIndexEntry]]s.
 * The sheet index is a tree whose leaf nodes refer to [[Sheet]]s, optionally grouped by [[SheetIndexFolder]]s and/or incorporating
 * sub-trees via [[SheetIndexReference]]s.
 * @beta
 */
export class SheetIndex extends InformationReferenceElement {
  public static override get className(): string { return "SheetIndex"; }

  /** Create a Code for a SheetIndex given a name that is meant to be unique within the scope of the specified SheetIndexModel.
   * @param iModel  The IModelDb
   * @param scopeSheetIndexModelId The Id of the Model that contains the LinkElement and provides the scope for its name.
   * @param codeValue The SheetIndex name
   */
  public static createCode(iModel: IModelDb, scopeSheetIndexModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.sheetIndex);
    return new Code({ spec: codeSpec.id, scope: scopeSheetIndexModelId, value: codeValue });
  }

  /** Create a SheetIndex
   * @param iModelDb The IModelDb
   * @param modelId The Id of the Model that contains the SheetIndex and provides the scope for its name.
   * @param name The name (codeValue) of the SheetIndex
   * @returns The newly constructed SheetIndex
   * @throws [[IModelError]] if there is a problem creating the SheetIndex
   */
  public static create(iModelDb: IModelDb, modelId: Id64String, name: string): SheetIndex {
    const props: ElementProps = {
      classFullName: this.classFullName,
      code: this.createCode(iModelDb, modelId, name).toJSON(),
      model: modelId,
    };
    return new this(props, iModelDb);
  }

  /** Insert a SheetIndex
   * @param iModelDb The IModelDb
   * @param modelId The Id of the Model that contains the SheetIndex and provides the scope for its name.
   * @param name The name (codeValue) of the SheetIndex
   * @returns The Id of the newly inserted SheetIndex
   * @throws [[IModelError]] if there is a problem inserting the SheetIndex
   */
  public static insert(iModelDb: IModelDb, modelId: Id64String, name: string): Id64String {
    const instance = this.create(iModelDb, modelId, name);
    const elements = iModelDb.elements;
    instance.id = elements.insertElement(instance.toJSON());
    return instance.id;
  }
}

/** The base class for all elements that can participate in a [[SheetIndex]] hierarchy.
 * @beta
*/
export abstract class SheetIndexEntry extends InformationReferenceElement {
  public static override get className(): string { return "SheetIndexEntry"; }
  /** Can be used to prioritize or order members within a SheetIndex or SheetIndexFolder. */
  public entryPriority: number;

  protected constructor(props: SheetIndexEntryProps, iModel: IModelDb) {
    super(props, iModel);
    this.entryPriority = props.entryPriority;
  }

  public override toJSON(): SheetIndexEntryProps {
    return { ...super.toJSON(), entryPriority: this.entryPriority };
  }

  /** Create a Code for a Sheet Index Entry given a name that is meant to be unique within the scope of the specified SheetIndexModel.
   * @param iModel  The IModel
   * @param scopeModelId The Id of the [[SheetIndexModel]] that contains the [[SheetIndexEntry]] and provides the scope for its name.
   * @param codeValue The name of the entry
   */
  public static createCode(iModelDb: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModelDb.codeSpecs.getByName(BisCodeSpec.sheetIndexEntry);
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }

  protected static createParentRelationshipProps(iModelDb: IModelDb, id: Id64String): RelatedElementProps {
    const parentElementProps = iModelDb.elements.getElementProps(id);
    const isFolder = parentElementProps.classFullName === SheetIndexFolder.classFullName;
    const relClass = isFolder ? SheetIndexFolderOwnsEntries : SheetIndexOwnsEntries;
    return { id, relClassName: relClass.classFullName };
  }

  protected static createProps(arg: SheetIndexEntryCreateArgs) {
    const parent = this.createParentRelationshipProps(arg.iModelDb, arg.parentId);
    const props: SheetIndexEntryProps = {
      classFullName: this.classFullName,
      model: arg.sheetIndexModelId,
      code: this.createCode(arg.iModelDb, arg.sheetIndexModelId, arg.name),
      entryPriority: arg.priority,
      parent,
    };
    return props;
  }
}

/** A container used to group [[SheetIndexEntry]]s within a [[SheetIndex]].
 * @beta
 */
export class SheetIndexFolder extends SheetIndexEntry {
  public static override get className(): string { return "SheetIndexFolder"; }

  /** Create a new SheetIndexFolder
   * @returns The newly constructed SheetIndexFolder element.
   * @throws [[IModelError]] if unable to create the element.
   */
  public static create(arg: SheetIndexEntryCreateArgs) {
    const props: SheetIndexFolderProps = this.createProps(arg);
    return new this(props, arg.iModelDb);
  }

  /** Create a new SheetIndexFolder
   * @returns The Id of the newly inserted SheetIndexFolder element.
   * @throws [[IModelError]] if unable to create the element.
   */
  public static insert(arg: SheetIndexEntryCreateArgs): Id64String {
    const instance = this.create(arg);
    const elements = arg.iModelDb.elements;
    instance.id = elements.insertElement(instance.toJSON());
    return instance.id;
  }
}

/** A node within one [[SheetIndex]] that incorporates another [[SheetIndex]] as a sub-tree.
 * @beta
*/
export class SheetIndexReference extends SheetIndexEntry {
  public static override get className(): string { return "SheetIndexReference"; }

  /** The bis:SheetIndex that this bis:SheetIndexReference is pointing to. */
  public sheetIndex?: SheetIndexReferenceRefersToSheetIndex;

  protected constructor(props: SheetIndexReferenceProps, iModel: IModelDb) {
    super(props, iModel);
    if (props.sheetIndex) {
      const sheetIndex = iModel.elements.tryGetElement<SheetIndex>(props.sheetIndex.id);
      if (!sheetIndex)
        throw new IModelError(IModelStatus.NotFound, "SheetIndex not found");

      this.sheetIndex = new SheetIndexReferenceRefersToSheetIndex(props.sheetIndex.id);
    }
  }

  protected static createReferenceRelationshipProps(id: Id64String): RelatedElementProps {
    return { id, relClassName: SheetIndexReferenceRefersToSheetIndex.classFullName };
  }

  public override toJSON(): SheetIndexReferenceProps { // This override only specializes the return type
    return {
      ...super.toJSON(),
      sheetIndex: this.sheetIndex ? this.sheetIndex.toJSON() : undefined,
    } as SheetIndexReferenceProps;
  }

  /** Create a new SheetIndexReference
   * @returns The newly constructed SheetIndexReference element.
   * @throws [[IModelError]] if unable to create the element.
   */
  public static create(arg: SheetIndexReferenceCreateArgs) {
    const props: SheetIndexReferenceProps = {
      ...this.createProps(arg),
      sheetIndex: arg.sheetIndexId ? this.createReferenceRelationshipProps(arg.sheetIndexId) : undefined,
    };
    return new this(props, arg.iModelDb);
  }

  /** Create a new SheetIndexReference
   * @returns The Id of the newly inserted SheetIndexReference element.
   * @throws [[IModelError]] if unable to create the element.
   */
  public static insert(arg: SheetIndexReferenceCreateArgs): Id64String {
    const instance = this.create(arg);
    const elements = arg.iModelDb.elements;
    instance.id = elements.insertElement(instance.toJSON());
    return instance.id;
  }

  /** @alpha */
  protected override collectReferenceIds(referenceIds: EntityReferenceSet): void {
    super.collectReferenceIds(referenceIds);
    if (this.sheetIndex)
      referenceIds.addElement(this.sheetIndex.id);
  }
}

/** A leaf node in a [[SheetIndex]] that refers to a specific [[Sheet]].
 * @beta
*/
export class SheetReference extends SheetIndexEntry {
  public static override get className(): string { return "SheetReference"; }

  /** The bis:Sheet that this bis:SheetReference is pointing to. */
  public sheet: SheetReferenceRefersToSheet | undefined;

  protected constructor(props: SheetReferenceProps, iModel: IModelDb) {
    super(props, iModel);
    if (props.sheet) {
      const sheet = iModel.elements.tryGetElement<Sheet>(props.sheet.id);
      if (!sheet)
        throw new IModelError(IModelStatus.NotFound, "Sheet not found");

      this.sheet = new SheetReferenceRefersToSheet(sheet.id);
    }
  }

  protected static createReferenceRelationshipProps(id: Id64String): RelatedElementProps {
    return { id, relClassName: SheetIndexReferenceRefersToSheetIndex.classFullName };
  }

  public override toJSON(): SheetReferenceProps { // This override only specializes the return type
    return {
      ...super.toJSON(),
      sheet: this.sheet ? this.sheet.toJSON() : undefined,
    } as SheetReferenceProps;
  }

  /** Create a new SheetReference
   * @returns The newly constructed SheetReference element.
   * @throws [[IModelError]] if unable to create the element.
   */
  public static create(arg: SheetReferenceCreateArgs) {
    const props: SheetReferenceProps = {
      ...this.createProps(arg),
      sheet: arg.sheetId ? this.createReferenceRelationshipProps(arg.sheetId) : undefined,
    };
    return new this(props, arg.iModelDb);
  }

  /** Insert a new SheetReference
   * @returns The Id of the newly inserted SheetReference element.
   * @throws [[IModelError]] if unable to create the element.
   */
  public static insert(arg: SheetReferenceCreateArgs): Id64String {
    const instance = this.create(arg);
    const elements = arg.iModelDb.elements;
    instance.id = elements.insertElement(instance.toJSON());
    return instance.id;
  }

  /** @alpha */
  protected override collectReferenceIds(referenceIds: EntityReferenceSet): void {
    super.collectReferenceIds(referenceIds);
    if (this.sheet)
      referenceIds.addModel(this.sheet.id);
  }
}
