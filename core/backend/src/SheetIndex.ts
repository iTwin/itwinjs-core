import { BisCodeSpec, Code, CodeScopeProps, CodeSpec, ElementProps, EntityReferenceSet, IModelError, RelatedElementProps, SheetIndexEntryProps, SheetIndexFolderProps, SheetIndexReferenceProps, SheetReferenceProps } from "@itwin/core-common";
import { InformationReferenceElement, Sheet } from "./Element";
import { IModelDb } from "./IModelDb";
import { Id64String, IModelStatus } from "@itwin/core-bentley";
import { SheetIndexFolderOwnsEntries, SheetIndexOwnsEntries, SheetIndexReferenceRefersToSheetIndex, SheetReferenceRefersToSheet } from "./NavigationRelationship";

/** Argument for creating a `SheetIndexFolder`
 * @beta
 */
export interface SheetIndexFolderArg {
  /** iModelDb The iModel */
  iModelDb: IModelDb;
  /** The [[SheetIndexModel]] */
  sheetIndexModelId: Id64String;
  /** The [[SheetIndex]] or [[SheetIndexFolder]] that is parent to this SheetIndexEntry */
  parentId: Id64String;
  /** The name of the SheetIndexEntry */
  name: string;
  /** The priority of the SheetIndexEntry */
  priority: number;
}

/** Argument for creating a `SheetIndexReference`
 * @beta
 */
export interface SheetIndexReferenceArg extends SheetIndexFolderArg {
  /** The Sheet Index referenced by the SheetIndexReference */
  sheetIndexId?: Id64String;
}

/** Argument for creating a `SheetReference`
 * @beta
 */
export interface SheetReferenceArg extends SheetIndexFolderArg {
  /** The Sheet referenced by the SheetReference */
  sheetId?: Id64String;
}

/**
 * A bis:InformationReferenceElement used to organize bis:Sheet instances into a hierarchy with the assistance
 * of [[bis:SheetIndexFolder]] and other [[bis:SheetIndex]] instances.
 *
 * See the doc site for more information about [SheetIndex]($docs/bis/domains/drawings-sheets#sheet-index).
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

/** A InformationReferenceElement used as the base-class for elements that participate in a Sheet-Index hierarchy.
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

  protected static createProps(arg: SheetIndexFolderArg) {
    // SheetIndexFolderArg is used as a base type here since it shares properties with all other SheetIndexEntries
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

/** A SheetIndexFolder used to organize other [[SheetIndexEntry]] instances in a hierarchy.
 * @beta
 */
export class SheetIndexFolder extends SheetIndexEntry {
  public static override get className(): string { return "SheetIndexFolder"; }

  /** Create a new SheetIndexFolder
   * @returns The newly constructed SheetIndexFolder element.
   * @throws [[IModelError]] if unable to create the element.
   */
  public static create(arg: SheetIndexFolderArg) {
    const props: SheetIndexFolderProps = this.createProps(arg);
    return new this(props, arg.iModelDb);
  }

  /** Create a new SheetIndexFolder
   * @returns The Id of the newly inserted SheetIndexFolder element.
   * @throws [[IModelError]] if unable to create the element.
   */
  public static insert(arg: SheetIndexFolderArg): Id64String {
    const instance = this.create(arg);
    const elements = arg.iModelDb.elements;
    instance.id = elements.insertElement(instance.toJSON());
    return instance.id;
  }
}

/** A SheetIndexReference used to include a [[SheetIndex]] hierarchy into another one.
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
  public static create(arg: SheetIndexReferenceArg) {
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
  public static insert(arg: SheetIndexReferenceArg): Id64String {
    const instance = this.create(arg);
    const elements = arg.iModelDb.elements;
    instance.id = elements.insertElement(instance.toJSON());
    return instance.id;
  }

  protected override collectReferenceIds(referenceIds: EntityReferenceSet): void {
    super.collectReferenceIds(referenceIds);
    if (this.sheetIndex)
      referenceIds.addElement(this.sheetIndex.id);
  }
}

/** A SheetReference used to include a [[Sheet]] instance into a Sheet-Index hierarchy.
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
  public static create(arg: SheetReferenceArg) {
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
  public static insert(arg: SheetReferenceArg): Id64String {
    const instance = this.create(arg);
    const elements = arg.iModelDb.elements;
    instance.id = elements.insertElement(instance.toJSON());
    return instance.id;
  }

  protected override collectReferenceIds(referenceIds: EntityReferenceSet): void {
    super.collectReferenceIds(referenceIds);
    if (this.sheet)
      referenceIds.addModel(this.sheet.id);
  }
}
