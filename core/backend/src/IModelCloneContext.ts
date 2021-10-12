/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */
import { Id64, Id64String } from "@itwin/core-bentley";
import { CodeScopeSpec, CodeSpec, ElementProps, IModel, PropertyMetaData, RelatedElement } from "@itwin/core-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { SubCategory } from "./Category";
import { Element } from "./Element";
import { IModelDb } from "./IModelDb";
import { IModelHost } from "./IModelHost";

/** The context for transforming a *source* Element to a *target* Element and remapping internal identifiers to the target iModel.
 * @beta
 */
export class IModelCloneContext {
  /** The source IModelDb. */
  public readonly sourceDb: IModelDb;
  /** The target IModelDb. */
  public readonly targetDb: IModelDb;
  /** The native import context */
  private _nativeContext: IModelJsNative.ImportContext;

  /** Construct a new IModelCloneContext.
   * @param sourceDb The source IModelDb.
   * @param targetDb If provided the target IModelDb. If not provided, the source and target are the same IModelDb.
   */
  public constructor(sourceDb: IModelDb, targetDb?: IModelDb) {
    this.sourceDb = sourceDb;
    this.targetDb = (undefined !== targetDb) ? targetDb : sourceDb;
    this._nativeContext = new IModelHost.platform.ImportContext(this.sourceDb.nativeDb, this.targetDb.nativeDb);
  }

  /** Returns `true` if this context is for transforming between 2 iModels and `false` if it for transforming within the same iModel. */
  public get isBetweenIModels(): boolean { return this.sourceDb !== this.targetDb; }

  /** Dispose any native resources associated with this IModelCloneContext. */
  public dispose(): void { this._nativeContext.dispose(); }

  /** Debugging aid that dumps the Id remapping details and other information to the specified output file.
   * @internal
   */
  public dump(outputFileName: string): void { this._nativeContext.dump(outputFileName); }

  /** Add a rule that remaps the specified source [CodeSpec]($common) to the specified target [CodeSpec]($common).
   * @param sourceCodeSpecName The name of the CodeSpec from the source iModel.
   * @param targetCodeSpecName The name of the CodeSpec from the target iModel.
   * @throws [[IModelError]] if either CodeSpec could not be found.
   */
  public remapCodeSpec(sourceCodeSpecName: string, targetCodeSpecName: string): void {
    const sourceCodeSpec: CodeSpec = this.sourceDb.codeSpecs.getByName(sourceCodeSpecName);
    const targetCodeSpec: CodeSpec = this.targetDb.codeSpecs.getByName(targetCodeSpecName);
    this._nativeContext.addCodeSpecId(sourceCodeSpec.id, targetCodeSpec.id);
  }

  /** Add a rule that remaps the specified source class to the specified target class. */
  public remapElementClass(sourceClassFullName: string, targetClassFullName: string): void {
    this._nativeContext.addClass(sourceClassFullName, targetClassFullName);
  }

  /** Add a rule that remaps the specified source Element to the specified target Element. */
  public remapElement(sourceId: Id64String, targetId: Id64String): void {
    this._nativeContext.addElementId(sourceId, targetId);
  }

  /** Remove a rule that remaps the specified source Element. */
  public removeElement(sourceId: Id64String): void {
    this._nativeContext.removeElementId(sourceId);
  }

  /** Look up a target CodeSpecId from the source CodeSpecId.
   * @returns the target CodeSpecId or [Id64.invalid]($bentley) if a mapping not found.
   */
  public findTargetCodeSpecId(sourceId: Id64String): Id64String {
    if (Id64.invalid === sourceId) {
      return Id64.invalid;
    }
    return this._nativeContext.findCodeSpecId(sourceId);
  }

  /** Look up a target ElementId from the source ElementId.
   * @returns the target ElementId or [Id64.invalid]($bentley) if a mapping not found.
   */
  public findTargetElementId(sourceElementId: Id64String): Id64String {
    if (Id64.invalid === sourceElementId) {
      return Id64.invalid;
    }
    return this._nativeContext.findElementId(sourceElementId);
  }

  /** Filter out geometry entries in the specified SubCategory from GeometryStreams in the target iModel.
   * @note It is not possible to filter out a *default* SubCategory. A request to do so will be ignored.
   * @see [SubCategory.isDefaultSubCategory]($backend)
   */
  public filterSubCategory(sourceSubCategoryId: Id64String): void {
    const sourceSubCategory = this.sourceDb.elements.tryGetElement<SubCategory>(sourceSubCategoryId, SubCategory);
    if (sourceSubCategory && !sourceSubCategory.isDefaultSubCategory) {
      this._nativeContext.filterSubCategoryId(sourceSubCategoryId);
    }
  }

  /** Returns `true` if there are any SubCategories being filtered. */
  public get hasSubCategoryFilter(): boolean {
    return this._nativeContext.hasSubCategoryFilter();
  }

  /** Returns `true` if this SubCategory is being filtered. */
  public isSubCategoryFiltered(subCategoryId: Id64String): boolean {
    return this._nativeContext.isSubCategoryFiltered(subCategoryId);
  }

  /** Import the specified font from the source iModel into the target iModel.
   * @internal
   */
  public importFont(sourceFontNumber: number): void {
    this._nativeContext.importFont(sourceFontNumber);
  }

  /** Import a single CodeSpec from the source iModel into the target iModel.
   * @internal
   */
  public importCodeSpec(sourceCodeSpecId: Id64String): void {
    this._nativeContext.importCodeSpec(sourceCodeSpecId);
  }

  /** Clone the specified source Element into ElementProps for the target iModel.
   * @internal
   */
  public cloneElement(sourceElement: Element, cloneOptions?: IModelJsNative.CloneElementOptions): ElementProps {
    const targetElementProps: ElementProps = this._nativeContext.cloneElement(sourceElement.id, cloneOptions);
    // Ensure that all NavigationProperties in targetElementProps have a defined value so "clearing" changes will be part of the JSON used for update
    sourceElement.forEachProperty((propertyName: string, meta: PropertyMetaData) => {
      if ((meta.isNavigation) && (undefined === (sourceElement as any)[propertyName])) {
        (targetElementProps as any)[propertyName] = RelatedElement.none;
      }
    }, false); // exclude custom because C++ has already handled them
    if (this.isBetweenIModels) {
      // The native C++ cloneElement strips off federationGuid, want to put it back if transformation is between iModels
      targetElementProps.federationGuid = sourceElement.federationGuid;
      if (CodeScopeSpec.Type.Repository === this.targetDb.codeSpecs.getById(targetElementProps.code.spec).scopeType) {
        targetElementProps.code.scope = IModel.rootSubjectId;
      }
    }
    const jsClass: any = this.sourceDb.getJsClass<typeof Element>(sourceElement.classFullName); // declared as "any" so we can call the protected onCloned method
    jsClass.onCloned(this, sourceElement, targetElementProps);
    return targetElementProps;
  }
}
