/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@bentley/bentleyjs-core";
import { CodeScopeSpec, CodeSpec, ElementProps, IModel } from "@bentley/imodeljs-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { Element } from "./Element";
import { IModelDb } from "./IModelDb";
import { IModelHost } from "./IModelHost";

/** The context for transforming a *source* Element to a *target* Element and remapping internal identifiers to the target iModel.
 * @alpha
 */
export class IModelCloneContext {
  /** The source IModelDb. */
  public readonly sourceDb: IModelDb;
  /** The target IModelDb. */
  public readonly targetDb: IModelDb;
  /** The native import context */
  private _nativeContext: IModelJsNative.ImportContext;

  /** Construct a new IModelTransformContext.
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

  /** Dispose any native resources associated with this IModelTransformContext. */
  public dispose(): void {
    this._nativeContext.dispose();
  }

  /** Add a rule that remaps the specified source CodeSpec to the specified target CodeSpec.
   * @param sourceCodeSpecName The name of the CodeSpec from the source iModel.
   * @param targetCodeSpecName The name of the CodeSpec from the target iModel.
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

  /** Look up a target CodeSpecId from the source CodeSpecId.
   * @returns the target CodeSpecId
   */
  public findTargetCodeSpecId(sourceId: Id64String): Id64String {
    return this._nativeContext.findCodeSpecId(sourceId);
  }

  /** Look up a target ElementId from the source ElementId.
   * @returns the target ElementId
   */
  public findTargetElementId(sourceElementId: Id64String): Id64String {
    return this._nativeContext.findElementId(sourceElementId);
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
  public cloneElement(sourceElement: Element): ElementProps {
    const targetElementProps: ElementProps = this._nativeContext.cloneElement(sourceElement.id);
    if (CodeScopeSpec.Type.Repository === this.targetDb.codeSpecs.getById(targetElementProps.code.spec).scopeType) {
      // WIP: temporary work-around for addon bug!
      targetElementProps.code.scope = IModel.rootSubjectId;
    }
    const jsClass = this.sourceDb.getJsClass<typeof Element>(sourceElement.classFullName) as any; // "as any" so we can call the protected methods
    jsClass.onCloned(this, sourceElement, targetElementProps);
    return targetElementProps;
  }
}
