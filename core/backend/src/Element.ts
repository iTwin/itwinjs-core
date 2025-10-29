/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { CompressedId64Set, GuidString, Id64, Id64String, JsonUtils, OrderedId64Array } from "@itwin/core-bentley";
import {
  AxisAlignedBox3d, BisCodeSpec, Code, CodeScopeProps, CodeSpec, ConcreteEntityTypes, DefinitionElementProps, DrawingProps, ElementAlignedBox3d,
  ElementProps, EntityMetaData, EntityReferenceSet, GeometricElement2dProps, GeometricElement3dProps, GeometricElementProps,
  GeometricModel2dProps, GeometricModel3dProps, GeometryPartProps, GeometryStreamProps, IModel, InformationPartitionElementProps, LineStyleProps, ModelProps, PhysicalElementProps, PhysicalTypeProps, Placement2d, Placement2dProps, Placement3d, Placement3dProps, ProjectInformation, ProjectInformationRecordProps, RelatedElement, RenderSchedule,
  RenderTimelineProps, RepositoryLinkProps, SectionDrawingLocationProps, SectionDrawingProps, SectionType,
  SheetBorderTemplateProps, SheetProps, SheetTemplateProps, SubjectProps, TypeDefinition, TypeDefinitionElementProps, UrlLinkProps
} from "@itwin/core-common";
import { ClipVector, LowAndHighXYZProps, Range3d, Transform, YawPitchRollAngles } from "@itwin/core-geometry";
import { CustomHandledProperty, DeserializeEntityArgs, ECSqlRow, Entity } from "./Entity";
import { IModelDb } from "./IModelDb";
import { IModelElementCloneContext } from "./IModelElementCloneContext";
import { DefinitionModel, DrawingModel, PhysicalModel, SectionDrawingModel } from "./Model";
import { SubjectOwnsProjectInformationRecord, SubjectOwnsSubjects } from "./NavigationRelationship";
import { _cache, _elementWasCreated, _nativeDb, _verifyChannel } from "./internal/Symbols";
import { EntityClass } from "@itwin/ecschema-metadata";

/** Argument for the `Element.onXxx` static methods
 * @beta
 */
export interface OnElementArg {
  /** The iModel for the Element affected by this method. */
  iModel: IModelDb;
}

/** Argument for `Element.onInsert` and `Element.onUpdate` static methods.
 * @beta
 */
export interface OnElementPropsArg extends OnElementArg {
  /** The properties of the Element affected by this method.
   * @note the properties may be modified. If so the modified values will be inserted/updated.
   */
  props: ElementProps;
}

/** Argument for the `Element.onXxx` static methods that notify of operations to an existing Element supplying its Id, ModelId and FederationGuid.
 * @beta
 */
export interface OnElementIdArg extends OnElementArg {
  /** The Id of the Element affected by this method */
  id: Id64String;
  /** The ModelId of the element affected by this method */
  model: Id64String;
  /** The federationGuid of the element affected by this method */
  federationGuid: GuidString;
}

/** Argument for the `Element.onChildXxx` static methods
 * @beta
 */
export interface OnChildElementArg extends OnElementArg {
  parentId: Id64String;
}

/** Argument for the `Element.onChildXxx` static methods that supply the properties of the child Element to be inserted or updated.
 * @beta
 */
export interface OnChildElementPropsArg extends OnChildElementArg {
  /** The new properties of the child Element for this method. */
  childProps: Readonly<ElementProps>;
}

/** Argument for the `Element.onChildXxx` static methods that only supply the Id of the child Element.
 * @beta
 */
export interface OnChildElementIdArg extends OnChildElementArg {
  /** The Id of the child element for this method */
  childId: Id64String;
}

/** Argument for the `Element.onSubModelInsert` static method
 * @beta
 */
export interface OnSubModelPropsArg extends OnElementArg {
  /** The properties of the prospective sub-model */
  subModelProps: ModelProps;
}

/** Argument for several `Element.onSubModelXxx` static methods
 * @beta
 */
export interface OnSubModelIdArg extends OnElementArg {
  /** The modelId of the sub Model */
  subModelId: Id64String;
}

/** The smallest individually identifiable building block for modeling the real world in an iModel.
 * Each element represents an [[Entity]] in the real world. Sets of Elements (contained in [[Model]]s) are used to model
 * other Elements that represent larger scale real world entities. Using this recursive modeling strategy,
 * Elements can represent entities at any scale. Elements can represent physical things or abstract concepts
 * or simply be information records.
 *
 * Every Element has a 64-bit id (inherited from Entity) that uniquely identifies it within an iModel. Every Element also
 * has a [[code]] that identifies its meaning in the real world. Additionally, Elements may have a [[federationGuid]]
 * to hold a GUID, if the element was assigned that GUID by some other federated database. The iModel database enforces
 * uniqueness of id, code, and federationGuid.
 *
 * The Element class provides `static` methods like [[onInsert]], [[onUpdated]], [[onCloned]], and [[onChildAdded]] that enable
 * it to customize persistence operations. For example, the base implementations of [[onInsert]], [[onUpdate]], and [[onDelete]]
 * validate that the appropriate [locks]($docs/learning/backend/ConcurrencyControl.md), [codes]($docs/learning/backend/CodeService.md),
 * and [channel permissions]($docs/learning/backend/Channel.md) are obtained before a change to the element is written to the iModel.
 * A subclass of Element that overrides any of these methods **must** call the `super` method as well. An application that supplies its
 * own Element subclasses should register them at startup via [[ClassRegistry.registerModule]] or [[ClassRegistry.register]].
 *
 * See:
 * * [Element Fundamentals]($docs/bis/guide/fundamentals/element-fundamentals.md)
 * * [Working with schemas and elements in TypeScript]($docs/learning/backend/SchemasAndElementsInTypeScript.md)
 * * [Creating elements]($docs/learning/backend/CreateElements.md)
 * @public @preview
 */
export class Element extends Entity {
  public static override get className(): string { return "Element"; }
  /** @internal */
  public static override get protectedOperations() { return ["onInsert", "onUpdate", "onDelete"]; }

  /** The ModelId of the [Model]($docs/bis/guide/fundamentals/model-fundamentals.md) containing this element */
  public readonly model: Id64String;
  /** The [Code]($docs/bis/guide/fundamentals/codes.md) for this element */
  public code: Code;
  /** The parent element, if present, of this element. */
  public parent?: RelatedElement;
  /** A [FederationGuid]($docs/bis/guide/fundamentals/element-fundamentals.md#federationguid) assigned to this element by some other federated database */
  public federationGuid?: GuidString;
  /** A [user-assigned label]($docs/bis/guide/fundamentals/element-fundamentals.md#userlabel) for this element. */
  public userLabel?: string;
  /** Optional [json properties]($docs/bis/guide/fundamentals/element-fundamentals.md#jsonproperties) of this element. */
  public readonly jsonProperties: { [key: string]: any };

  protected constructor(props: ElementProps, iModel: IModelDb) {
    super(props, iModel);
    this.code = Code.fromJSON(props.code);  // TODO: Validate props.code - don't silently fail if it is the wrong type
    this.model = RelatedElement.idFromJson(props.model);
    this.parent = RelatedElement.fromJSON(props.parent);
    this.federationGuid = props.federationGuid;
    this.userLabel = props.userLabel;
    this.jsonProperties = { ...props.jsonProperties }; // make sure we have our own copy
  }

  /**
   * Element custom HandledProps include 'codeValue', 'codeSpec', 'codeScope', 'model', 'parent', 'federationGuid', and 'lastMod'.
   * @inheritdoc
   * @beta
   */
  protected static override readonly _customHandledProps: CustomHandledProperty[] = [
    { propertyName: "codeValue", source: "Class" },
    { propertyName: "codeSpec", source: "Class" },
    { propertyName: "codeScope", source: "Class" },
    { propertyName: "model", source: "Class" },
    { propertyName: "parent", source: "Class" },
    { propertyName: "federationGuid", source: "Class" },
    { propertyName: "lastMod", source: "Class" },
  ];

  /**
   * Element deserializes 'codeValue', 'codeSpec', 'codeScope', 'model', 'parent', and 'federationGuid'.
   * @inheritdoc
   * @beta
   */
  public static override deserialize(props: DeserializeEntityArgs): ElementProps {
    const elProps = super.deserialize(props) as ElementProps;
    const instance = props.row;
    elProps.code = { value: instance.codeValue ?? "", spec: instance.codeSpec.id, scope: instance.codeScope.id }
    elProps.model = instance.model.id;
    if (instance.parent)
      elProps.parent = instance.parent;

    if (instance.federationGuid)
      elProps.federationGuid = instance.federationGuid;
    return elProps;
  }

  /**
   * Element serialize 'codeValue', 'codeSpec', 'codeScope', 'model', 'parent', and 'federationGuid'.
   * @inheritdoc
   * @beta
   */
  public static override serialize(props: ElementProps, iModel: IModelDb): ECSqlRow {
    const inst = super.serialize(props, iModel);
    inst.codeValue = props.code.value;
    inst.codeSpec = { id: props.code.spec };
    inst.codeScope = { id: props.code.scope };
    inst.model = { id: props.model };
    inst.parent = props.parent;
    inst.federationGuid = props.federationGuid ?? iModel[_nativeDb].newBeGuid();
    return inst;
  }

  /** Called before a new Element is inserted.
   * @note throw an exception to disallow the insert
   * @note If you override this method, you must call super.
   * @note `this` is the class of the Element to be inserted
   * @beta
   */
  protected static onInsert(arg: OnElementPropsArg): void {
    const { iModel, props } = arg;
    const operation = "insert";
    iModel.channels[_verifyChannel](arg.props.model);
    iModel.locks.checkSharedLock(props.model, "model", operation); // inserting requires shared lock on model
    if (props.parent)   // inserting requires shared lock on parent, if present
      iModel.locks.checkSharedLock(props.parent.id, "parent", operation);
    iModel.codeService?.verifyCode(arg);
  }

  /** Called after a new Element was inserted.
   * @note If you override this method, you must call super.
   * @note `this` is the class of the Element that was inserted
   * @beta
   */
  protected static onInserted(arg: OnElementIdArg): void {
    const locks = arg.iModel.locks;
    if (locks && !locks.holdsExclusiveLock(arg.model))
      locks[_elementWasCreated](arg.id);
    arg.iModel.models[_cache].delete(arg.model);
  }

  /** Called before an Element is updated.
   * @note throw an exception to disallow the update
   * @note If you override this method, you must call super.
   * @note `this` is the class of the Element to be updated
   * @beta
   */
  protected static onUpdate(arg: OnElementPropsArg): void {
    const { iModel, props } = arg;
    iModel.channels[_verifyChannel](props.model);
    iModel.locks.checkExclusiveLock(props.id!, "element", "update"); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    iModel.codeService?.verifyCode(arg);
  }

  /** Called after an Element was updated.
   * @note If you override this method, you must call super.
   * @note `this` is the class of the Element that was updated
   * @beta
   */
  protected static onUpdated(arg: OnElementIdArg): void {
    arg.iModel.elements[_cache].delete({ id: arg.id })
    arg.iModel.models[_cache].delete(arg.model);
  }

  /** Called before an Element is deleted.
   * @note throw an exception to disallow the delete
   * @note If you override this method, you must call super.
   * @note `this` is the class of the Element to be deleted
   * @beta
   */
  protected static onDelete(arg: OnElementIdArg): void {
    arg.iModel.channels[_verifyChannel](arg.model);
    arg.iModel.locks.checkExclusiveLock(arg.id, "element", "delete");
  }

  /** Called after an Element was deleted.
   * @note If you override this method, you must call super.
   * @note `this` is the class of the Element that was deleted
   * @beta
   */
  protected static onDeleted(arg: OnElementIdArg): void {
    arg.iModel.elements[_cache].delete(arg);
    arg.iModel.models[_cache].delete(arg.model);
  }

  /** Called when an element with an instance of this class as its parent is about to be deleted.
   * @note throw an exception if the element should not be deleted
   * @note implementers should not presume that the element was deleted if this method does not throw,
   * since the delete may fail for other reasons. Instead, rely on [[onChildDeleted]] for that purpose.
   * @note `this` is the class of the parent Element whose child will be deleted
   * @beta
   */
  protected static onChildDelete(_arg: OnChildElementIdArg): void { }

  /** Called after an element with an instance of this class as its parent was successfully deleted.
   * @note `this` is the class of the parent Element whose child was deleted
   * @beta
   */
  protected static onChildDeleted(arg: OnChildElementIdArg): void {
    arg.iModel.elements[_cache].delete({ id: arg.parentId });
    arg.iModel.elements[_cache].delete({ id: arg.childId });
  }

  /** Called when a *new element* with an instance of this class as its parent is about to be inserted.
   * @note throw an exception if the element should not be inserted
   * @note `this` is the class of the prospective parent Element.
   * @beta
   */
  protected static onChildInsert(_arg: OnChildElementPropsArg): void { }

  /** Called after a *new element* with an instance of this class as its parent was inserted.
   * @note `this` is the class of the parent Element.
   * @beta
   */
  protected static onChildInserted(arg: OnChildElementIdArg): void {
    arg.iModel.elements[_cache].delete({ id: arg.parentId });
  }

  /** Called when an element with an instance of this class as its parent is about to be updated.
   * @note throw an exception if the element should not be updated
   * @note `this` is the class of the parent Element.
   * @beta
   */
  protected static onChildUpdate(_arg: OnChildElementPropsArg): void { }

  /** Called after an element with an instance of this the class as its parent was updated.
   * @note `this` is the class of the parent Element.
   * @beta
   */
  protected static onChildUpdated(arg: OnChildElementIdArg): void {
    arg.iModel.elements[_cache].delete({ id: arg.parentId });
  }

  /** Called when an *existing element* is about to be updated so that an instance of this class will become its new parent.
   * @note throw an exception if the element should not be added
   * @note `this` is the class of the prospective parent Element.
   * @beta
   */
  protected static onChildAdd(_arg: OnChildElementPropsArg): void { }

  /** Called after an *existing element* has been updated so that an instance of this class is its new parent.
   * @note `this` is the class of the new parent Element.
   * @beta
   */
  protected static onChildAdded(arg: OnChildElementIdArg): void {
    arg.iModel.elements[_cache].delete({ id: arg.parentId });
  }

  /** Called when an element with an instance of this class as its parent is about to be updated change to a different parent.
   * @note throw an exception if the element should not be dropped
   * @note `this` is the class of the parent Element.
   * @beta
   */
  protected static onChildDrop(_arg: OnChildElementIdArg): void { }

  /** Called after an element with an instance of this class as its previous parent was updated to have a new parent.
   * @note `this` is the class of the previous parent Element.
   * @beta
   */
  protected static onChildDropped(arg: OnChildElementIdArg): void {
    arg.iModel.elements[_cache].delete({ id: arg.parentId });
  }

  /** Called when an instance of this class is being *sub-modeled* by a new Model.
   * @note throw an exception if model should not be inserted
   * @note `this` is the class of Element to be sub-modeled.
   * @beta
   */
  protected static onSubModelInsert(_arg: OnSubModelPropsArg): void { }

  /** Called after an instance of this class was *sub-modeled* by a new Model.
   * @note `this` is the class of Element that is now sub-modeled.
   * @beta
   */
  protected static onSubModelInserted(arg: OnSubModelIdArg): void {
    const id = arg.subModelId;
    arg.iModel.elements[_cache].delete({ id });
    arg.iModel.models[_cache].delete(id);

  }

  /** Called when a sub-model of an instance of this class is being deleted.
   * @note throw an exception if model should not be deleted
   * @note `this` is the class of Element that is sub-modeled.
   * @beta
   */
  protected static onSubModelDelete(_arg: OnSubModelIdArg): void { }

  /** Called after a sub-model of an instance of this class was deleted.
   * @note `this` is the class of Element that was sub-modeled.
   * @beta
   */
  protected static onSubModelDeleted(arg: OnSubModelIdArg): void {
    const id = arg.subModelId;
    arg.iModel.elements[_cache].delete({ id });
    arg.iModel.models[_cache].delete(id);
  }

  /** Called during the iModel transformation process after an Element from the source iModel was *cloned* for the target iModel.
   * The transformation process automatically handles remapping BisCore properties and those that are properly described in ECSchema.
   * This callback is only meant to be overridden if there are other Ids in non-standard locations that need to be remapped or other data that needs to be fixed up after the clone.
   * @param _context The context that persists any remapping between the source iModel and target iModel.
   * @param _sourceProps The ElementProps for the source Element that was cloned.
   * @param _targetProps The ElementProps that are a result of the clone. These can be further modified.
   * @note If you override this method, you must call super.
   * @beta
   */
  protected static onCloned(_context: IModelElementCloneContext, _sourceProps: ElementProps, _targetProps: ElementProps): Promise<void> | void { }

  /** Called when a *root* element in a subgraph is changed and before its outputs are processed.
   * This special callback is made when:
   * * the element is part of an [[ElementDrivesElement]] graph, and
   * * the element has no inputs, and
   * * none of the element's outputs have been processed.
   * @see [[ElementDrivesElement]] for more on element dependency graphs.
   * @beta
   */
  protected static onBeforeOutputsHandled(_id: Id64String, _iModel: IModelDb): void { }

  /** Called on an element in a graph after all of its inputs have been processed and before its outputs are processed.
   * This callback is made when:
   * * the specified element is part of an [[ElementDrivesElement]] graph, and
   * * there was a direct change to some element upstream in the dependency graph.
   * * all upstream elements in the graph have been processed.
   * * none of the downstream elements have been processed.
   * This method is not called if none of the element's inputs were changed.
   * @see [[ElementDrivesElement]] for more on element dependency graphs.
   * @beta
   */
  protected static onAllInputsHandled(_id: Id64String, _iModel: IModelDb): void { }

  public override toJSON(): ElementProps {
    const val = super.toJSON() as ElementProps;

    if (Code.isValid(this.code))
      val.code = this.code;

    val.model = this.model;
    if (undefined !== this.userLabel) // NOTE: blank string should be included in JSON
      val.userLabel = this.userLabel;
    if (this.federationGuid)
      val.federationGuid = this.federationGuid;
    if (this.parent)
      val.parent = this.parent;

    if (Object.keys(this.jsonProperties).length > 0)
      val.jsonProperties = this.jsonProperties;

    return val;
  }

  protected override collectReferenceIds(referenceIds: EntityReferenceSet): void {
    super.collectReferenceIds(referenceIds);
    referenceIds.addModel(this.model); // The modeledElement is a reference
    if (this.code.scope && Id64.isValidId64(this.code.scope))
      referenceIds.addElement(this.code.scope); // The element that scopes the code is a reference
    if (this.parent)
      referenceIds.addElement(this.parent.id); // A parent element is a reference
  }

  /** A *required reference* is an element that had to be inserted before this element could have been inserted.
   * This is the list of property keys on this element that store references to those elements
   * @note This should be overridden (with `super` called) at each level of the class hierarchy that introduces required references.
   * @note any property listed here must be added to the reference ids in [[collectReferenceIds]]
   * @beta
   */
  public static readonly requiredReferenceKeys: ReadonlyArray<string> = ["parent", "model"];

  /** A map of every [[requiredReferenceKeys]] on this class to their entity type.
   * @note This should be overridden (with `super` called) at each level of the class hierarchy that introduces required references.
   * @alpha
   */
  public static readonly requiredReferenceKeyTypeMap: Record<string, ConcreteEntityTypes> = {
    parent: ConcreteEntityTypes.Element,
    model: ConcreteEntityTypes.Model,
  };

  /** Get the class metadata for this element.
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Please use `getMetaData` provided by the parent class `Entity` instead.
   *
   * @example
   * ```typescript
   * // Current usage:
   * const metaData: EntityMetaData | undefined = element.getClassMetaData();
   *
   * // Replacement:
   * const metaData: EntityClass = await element.getMetaData();
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public getClassMetaData(): EntityMetaData | undefined { return this.iModel.classMetaDataRegistry.find(this.classFullName); }

  /** Query metadata for this entity class from the iModel's schema. Returns cached metadata if available.*/
  public override async getMetaData(): Promise<EntityClass> {
    if (this._metadata && EntityClass.isEntityClass(this._metadata)) {
      return this._metadata;
    }

    const entity = await this.iModel.schemaContext.getSchemaItem(this.schemaItemKey, EntityClass);
    if (entity !== undefined) {
      this._metadata = entity;
      return this._metadata;
    } else {
      throw new Error(`Cannot get metadata for ${this.classFullName}`);
    }
  }

  private getAllUserProperties(): any {
    if (!this.jsonProperties.UserProps)
      this.jsonProperties.UserProps = new Object();

    return this.jsonProperties.UserProps;
  }

  /** Get a set of JSON user properties by namespace */
  public getUserProperties(namespace: string) { return this.getAllUserProperties()[namespace]; }

  /** Change a set of user JSON properties of this Element by namespace. */
  public setUserProperties(nameSpace: string, value: any) { this.getAllUserProperties()[nameSpace] = value; }

  /** Remove a set of JSON user properties, specified by namespace, from this Element */
  public removeUserProperties(nameSpace: string) { delete this.getAllUserProperties()[nameSpace]; }

  /** Get a JSON property of this element, by namespace */
  public getJsonProperty(nameSpace: string): any { return this.jsonProperties[nameSpace]; }
  public setJsonProperty(nameSpace: string, value: any) { this.jsonProperties[nameSpace] = value; }

  /** Get a display label for this Element. By default returns userLabel if present, otherwise code value. */
  public getDisplayLabel(): string { return this.userLabel ?? this.code.value; }

  /** Get a list of HTML strings that describe this Element for the tooltip. Strings will be listed on separate lines in the tooltip.
   * Any instances of the pattern `%{tag}` will be replaced by the localized value of tag.
   */
  public getToolTipMessage(): string[] {
    const addKey = (key: string) => `<b>%{iModelJs:Element.${key}}:</b> `; // %{iModelJs:Element.xxx} is replaced with localized value of xxx in frontend.
    const msg: string[] = [];
    const display = this.getDisplayLabel();
    msg.push(display ? display : `${addKey("Id") + this.id}, ${addKey("Type")}${this.className}`);

    if (this instanceof GeometricElement)
      msg.push(addKey("Category") + this.iModel.elements.getElement(this.category).getDisplayLabel());

    msg.push(addKey("Model") + this.iModel.elements.getElement(this.model).getDisplayLabel());
    return msg;
  }

  /**
   * Insert this Element into the iModel.
   * @see [[IModelDb.Elements.insertElement]]
   * @note For convenience, the value of `this.id` is updated to reflect the resultant element's id.
   * However when `this.federationGuid` is not present or undefined, a new Guid will be generated and stored on the resultant element. But
   * the value of `this.federationGuid` is *not* updated. Generally, it is best to re-read the element after inserting (e.g. via [[IModelDb.Elements.getElement]])
   * if you intend to continue working with it. That will ensure its values reflect the persistent state.
   */
  public insert() {
    return this.id = this.iModel.elements.insertElement(this.toJSON());
  }
  /** Update this Element in the iModel. */
  public update() { this.iModel.elements.updateElement(this.toJSON()); }
  /** Delete this Element from the iModel. */
  public delete() { this.iModel.elements.deleteElement(this.id); }
}

/** An abstract base class to model real world entities that intrinsically have geometry.
 * @public @preview
 */
export abstract class GeometricElement extends Element {
  public static override get className(): string { return "GeometricElement"; }
  /** The Id of the [[Category]] for this GeometricElement. */
  public category: Id64String;
  /** The GeometryStream for this GeometricElement. */
  public geom?: GeometryStreamProps;
  /** The origin, orientation, and bounding box of this GeometricElement. */
  public abstract get placement(): Placement2d | Placement3d;

  protected constructor(props: GeometricElementProps, iModel: IModelDb) {
    super(props, iModel);
    this.category = Id64.fromJSON(props.category);
    this.geom = props.geom;
  }

  /** Type guard for instanceof [[GeometricElement3d]] */
  public is3d(): this is GeometricElement3d { return this instanceof GeometricElement3d; }
  /** Type guard for instanceof [[GeometricElement2d]] */
  public is2d(): this is GeometricElement2d { return this instanceof GeometricElement2d; }
  /** Get the [Transform]($geometry) from the Placement of this GeometricElement */
  public getPlacementTransform(): Transform { return this.placement.transform; }
  public calculateRange3d(): AxisAlignedBox3d { return this.placement.calculateRange(); }

  public override toJSON(): GeometricElementProps {
    const val = super.toJSON() as GeometricElementProps;
    val.category = this.category;
    if (this.geom)
      val.geom = this.geom;
    return val;
  }

  protected override collectReferenceIds(referenceIds: EntityReferenceSet): void {
    super.collectReferenceIds(referenceIds);
    referenceIds.addElement(this.category);
    // TODO: GeometryPartIds?
  }

  /** @beta */
  public static override readonly requiredReferenceKeys: ReadonlyArray<string> = [...super.requiredReferenceKeys, "category"];
  /** @alpha */
  public static override readonly requiredReferenceKeyTypeMap: Record<string, ConcreteEntityTypes> = {
    ...super.requiredReferenceKeyTypeMap,
    category: ConcreteEntityTypes.Element,
  };

  /**
   * GeometricElement custom HandledProps includes 'inSpatialIndex'.
   * @inheritdoc
   * @beta
   */
  protected static override readonly _customHandledProps: CustomHandledProperty[] = [
    { propertyName: "inSpatialIndex", source: "Class" },
  ];

  /**
   * GeometricElement deserializes 'inSpatialIndex'.
   * @inheritdoc
   * @beta
   */
  public static override deserialize(props: DeserializeEntityArgs): GeometricElementProps {
    return super.deserialize(props) as GeometricElementProps;
  }

  /**
   * GeometricElement serialize 'inSpatialIndex'.
   * @inheritdoc
   * @beta
   */
  public static override serialize(props: GeometricElementProps, iModel: IModelDb): ECSqlRow {
    return super.serialize(props, iModel);
  }
}

/** An abstract base class to model real world entities that intrinsically have 3d geometry.
 * See [how to create a GeometricElement3d]($docs/learning/backend/CreateElements.md#GeometricElement3d).
 * @public @preview
 */
export abstract class GeometricElement3d extends GeometricElement {
  public static override get className(): string { return "GeometricElement3d"; }
  public placement: Placement3d;
  public typeDefinition?: TypeDefinition;

  protected constructor(props: GeometricElement3dProps, iModel: IModelDb) {
    super(props, iModel);
    this.placement = Placement3d.fromJSON(props.placement);
    if (props.typeDefinition)
      this.typeDefinition = TypeDefinition.fromJSON(props.typeDefinition);
  }

  public override toJSON(): GeometricElement3dProps {
    const val = super.toJSON() as GeometricElement3dProps;
    val.placement = this.placement;
    if (undefined !== this.typeDefinition)
      val.typeDefinition = this.typeDefinition;

    return val;
  }

  protected override collectReferenceIds(referenceIds: EntityReferenceSet): void {
    super.collectReferenceIds(referenceIds);
    if (undefined !== this.typeDefinition)
      referenceIds.addElement(this.typeDefinition.id);
  }

  /**
   * GeometricElement3d custom HandledProps includes 'category', 'geometryStream', 'origin', 'yaw', 'pitch', 'roll',
   * 'bBoxLow', 'bBoxHigh', and 'typeDefinition'.
   * @inheritdoc
   * @beta
   */
  protected static override readonly _customHandledProps: CustomHandledProperty[] = [
    { propertyName: "category", source: "Class" },
    { propertyName: "geometryStream", source: "Class" },
    { propertyName: "origin", source: "Class" },
    { propertyName: "yaw", source: "Class" },
    { propertyName: "pitch", source: "Class" },
    { propertyName: "roll", source: "Class" },
    { propertyName: "bBoxLow", source: "Class" },
    { propertyName: "bBoxHigh", source: "Class" },
    { propertyName: "typeDefinition", source: "Class" }
  ];

  /**
   * GeometricElement3d deserializes 'category', 'geometryStream', 'origin', 'yaw', 'pitch', 'roll',
   * 'bBoxLow', 'bBoxHigh', and 'typeDefinition'.
   * @inheritdoc
   * @beta
   */
  public static override deserialize(props: DeserializeEntityArgs): GeometricElement3dProps {
    const elProps = super.deserialize(props) as GeometricElement3dProps;
    const instance = props.row;
    elProps.category = instance.category.id;

    const origin = instance.origin ? [instance.origin.x, instance.origin.y, instance.origin.z] : [0, 0, 0];
    let bbox: LowAndHighXYZProps | undefined;
    if ("bBoxHigh" in instance && instance.bBoxHigh !== undefined && "bBoxLow" in instance && instance.bBoxLow !== undefined) {
      bbox = {
        low: [instance.bBoxLow.x, instance.bBoxLow.y, instance.bBoxLow.z],
        high: [instance.bBoxHigh.x, instance.bBoxHigh.y, instance.bBoxHigh.z],
      }
    }

    elProps.placement = {
      origin,
      angles: YawPitchRollAngles.createDegrees(instance.yaw ?? 0, instance.pitch ?? 0, instance.roll ?? 0).toJSON(),
      bbox
    };

    if (instance.geometryStream) {
      elProps.geom = props.iModel[_nativeDb].convertOrUpdateGeometrySource({
        is2d: false,
        geom: instance.geometryStream as Uint8Array,
        placement: elProps.placement,
        categoryId: elProps.category
      }, "GeometryStreamProps", props.options?.element ?? {}).geom as GeometryStreamProps;
    }

    if (instance.typeDefinition) {
      elProps.typeDefinition = instance.typeDefinition;
    }

    return elProps;
  }

  /**
   * GeometricElement3d serializes 'category', 'geometryStream', 'origin', 'yaw', 'pitch', 'roll',
   * 'bBoxLow', 'bBoxHigh', and 'typeDefinition'.
   * @inheritdoc
   * @beta
   */
  public static override serialize(props: GeometricElement3dProps, iModel: IModelDb): ECSqlRow {
    const inst = super.serialize(props, iModel);
    inst.category = { id: props.category };

    const assignPlacement = (placement: Placement3dProps) => {
      if (Array.isArray(placement.origin)) {
        inst.origin = { x: placement.origin[0], y: placement.origin[1], z: placement.origin[2] };
      } else {
        inst.origin = placement.origin;
      }
      inst.yaw = placement.angles.yaw;
      inst.pitch = placement.angles.pitch;
      inst.roll = placement.angles.roll;
      if (placement.bbox) {
        if (Array.isArray(placement.bbox.low)) {
          inst.bBoxLow = { x: placement.bbox.low[0], y: placement.bbox.low[1], z: placement.bbox.low[2] };
        } else {
          inst.bBoxLow = placement.bbox.low;
        }

        if (Array.isArray(placement.bbox.high)) {
          inst.bBoxHigh = { x: placement.bbox.high[0], y: placement.bbox.high[1], z: placement.bbox.high[2] };
        } else {
          inst.bBoxHigh = placement.bbox.high;
        }
      }
    }


    if (props.placement) {
      assignPlacement(props.placement);
    }

    if (props.elementGeometryBuilderParams) {
      const source = iModel[_nativeDb].convertOrUpdateGeometrySource({
        builder: props.elementGeometryBuilderParams,
        is2d: true,
        placement: props.placement,
        categoryId: props.category,
      }, "BinaryStream", {});

      inst.geometryStream = source.geom;
      if (source.placement) {
        assignPlacement(source.placement as Placement3dProps);
      }
    }

    if (props.geom) {
      const source = iModel[_nativeDb].convertOrUpdateGeometrySource({
        geom: props.geom as any,
        is2d: false,
        placement: props.placement,
        categoryId: props.category,
      }, "BinaryStream", {});
      inst.geometryStream = source.geom;
      if (source.placement) {
        assignPlacement(source.placement as Placement3dProps);
      }
    }

    inst.typeDefinition = props.typeDefinition;
    return inst;
  }
}

/** A 3d Graphical Element
 * @public @preview
 */
export abstract class GraphicalElement3d extends GeometricElement3d {
  public static override get className(): string { return "GraphicalElement3d"; }
  protected constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

/** An abstract base class to model information entities that intrinsically have 2d geometry.
 * @public @preview
 */
export abstract class GeometricElement2d extends GeometricElement {
  public static override get className(): string { return "GeometricElement2d"; }
  public placement: Placement2d;
  public typeDefinition?: TypeDefinition;

  protected constructor(props: GeometricElement2dProps, iModel: IModelDb) {
    super(props, iModel);
    this.placement = Placement2d.fromJSON(props.placement);
    if (props.typeDefinition)
      this.typeDefinition = TypeDefinition.fromJSON(props.typeDefinition);
  }

  public override toJSON(): GeometricElement2dProps {
    const val = super.toJSON() as GeometricElement2dProps;
    val.placement = this.placement;
    if (undefined !== this.typeDefinition)
      val.typeDefinition = this.typeDefinition;

    return val;
  }

  /**
   * GeometricElement2d custom HandledProps includes 'category', 'geometryStream', 'origin', 'rotation',
   * 'bBoxLow', 'bBoxHigh', and 'typeDefinition'.
   * @inheritdoc
   * @beta
   */
  protected static override readonly _customHandledProps: CustomHandledProperty[] = [
    { propertyName: "category", source: "Class" },
    { propertyName: "geometryStream", source: "Class" },
    { propertyName: "origin", source: "Class" },
    { propertyName: "rotation", source: "Class" },
    { propertyName: "bBoxLow", source: "Class" },
    { propertyName: "bBoxHigh", source: "Class" },
    { propertyName: "typeDefinition", source: "Class" }
  ];

  /**
   * GeometricElement2d deserialize 'category', 'geometryStream', 'origin', 'rotation',
   * 'bBoxLow', 'bBoxHigh', and 'typeDefinition'.
   * @inheritdoc
   * @beta
   */
  public static override deserialize(props: DeserializeEntityArgs): GeometricElement2dProps {
    const elProps = super.deserialize(props) as GeometricElement2dProps;
    const instance = props.row;
    elProps.category = instance.category.id;
    const origin = instance.origin ? [instance.origin.x, instance.origin.y] : [0, 0];
    let bbox: LowAndHighXYZProps | undefined;
    if ("bBoxHigh" in instance && instance.bBoxHigh !== undefined && "bBoxLow" in instance && instance.bBoxLow !== undefined) {
      bbox = {
        low: [instance.bBoxLow.x, instance.bBoxLow.y],
        high: [instance.bBoxHigh.x, instance.bBoxHigh.y],
      }
    }
    elProps.placement = {
      origin,
      angle: instance.rotation,
      bbox,
    };

    if (instance.geometryStream) {
      const source = props.iModel[_nativeDb].convertOrUpdateGeometrySource({
        is2d: true,
        geom: instance.geometryStream,
        placement: elProps.placement,
        categoryId: elProps.category
      }, "GeometryStreamProps", props.options?.element ?? {});
      elProps.geom = source.geom as GeometryStreamProps;
      if (source.placement) {
        elProps.placement = source.placement as Placement2dProps;
      }
    }

    if (instance.typeDefinition) {
      elProps.typeDefinition = instance.typeDefinition;
    }

    return elProps;
  }

  /**
   * GeometricElement2d serializes 'category', 'geometryStream', 'origin', 'rotation',
   * 'bBoxLow', 'bBoxHigh', and 'typeDefinition'.
   * @inheritdoc
   * @beta
   */
  public static override serialize(props: GeometricElement2dProps, iModel: IModelDb): ECSqlRow {
    const inst = super.serialize(props, iModel);
    inst.category = { id: props.category };

    const assignPlacement = (placement: Placement2dProps) => {
      if (Array.isArray(placement.origin)) {
        inst.origin = { x: placement.origin[0], y: placement.origin[1] };
      } else {
        inst.origin = placement.origin;
      }
      inst.rotation = placement.angle;
      if (placement.bbox) {
        if (Array.isArray(placement.bbox.low)) {
          inst.bBoxLow = { x: placement.bbox.low[0], y: placement.bbox.low[1] };
        } else {
          inst.bBoxLow = placement.bbox.low;
        }

        if (Array.isArray(placement.bbox.high)) {
          inst.bBoxHigh = { x: placement.bbox.high[0], y: placement.bbox.high[1] };
        } else {
          inst.bBoxHigh = placement.bbox.high;
        }
      }
    }


    if (props.placement) {
      assignPlacement(props.placement);
    }

    if (props.elementGeometryBuilderParams) {
      const source = iModel[_nativeDb].convertOrUpdateGeometrySource({
        builder: props.elementGeometryBuilderParams,
        is2d: true,
        placement: props.placement,
        categoryId: props.category,
      }, "BinaryStream", {});

      inst.geometryStream = source.geom;
      if (source.placement) {
        assignPlacement(source.placement as Placement2dProps);
      }
    }

    if (props.geom) {
      const source = iModel[_nativeDb].convertOrUpdateGeometrySource({
        geom: props.geom as any,
        is2d: true,
        placement: props.placement,
        categoryId: props.category,
      }, "BinaryStream", {});

      inst.geometryStream = source.geom;
      if (source.placement) {
        assignPlacement(source.placement as Placement2dProps);
      }
    }
    inst.typeDefinition = props.typeDefinition;
    return inst;
  }

  protected override collectReferenceIds(referenceIds: EntityReferenceSet): void {
    super.collectReferenceIds(referenceIds);
    if (undefined !== this.typeDefinition)
      referenceIds.addElement(this.typeDefinition.id);
  }
}

/** An abstract base class for 2d Geometric Elements that are used to convey information within graphical presentations (like drawings).
 * @public @preview
 */
export abstract class GraphicalElement2d extends GeometricElement2d {
  public static override get className(): string { return "GraphicalElement2d"; }
  protected constructor(props: GeometricElement2dProps, iModel: IModelDb) { super(props, iModel); }
}

/** 2d element used to annotate drawings and sheets.
 * @public @preview
 */
export class AnnotationElement2d extends GraphicalElement2d {
  public static override get className(): string { return "AnnotationElement2d"; }
  protected constructor(props: GeometricElement2dProps, iModel: IModelDb) { super(props, iModel); }
}

/** 2d element used to persist graphics for use in drawings.
 * @public @preview
 */
export class DrawingGraphic extends GraphicalElement2d {
  public static override get className(): string { return "DrawingGraphic"; }
  protected constructor(props: GeometricElement2dProps, iModel: IModelDb) { super(props, iModel); }
}

/** An Element that occupies real world space. Its coordinates are in the project space of its iModel.
 * @public @preview
 */
export abstract class SpatialElement extends GeometricElement3d {
  public static override get className(): string { return "SpatialElement"; }
  protected constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

/** An Element that is spatially located, has mass, and can be *touched*.
 * @public @preview
 */
export abstract class PhysicalElement extends SpatialElement {
  public static override get className(): string { return "PhysicalElement"; }
  /** If defined, the [[PhysicalMaterial]] that makes up this PhysicalElement. */
  public physicalMaterial?: RelatedElement;
  protected constructor(props: PhysicalElementProps, iModel: IModelDb) {
    super(props, iModel);
    this.physicalMaterial = RelatedElement.fromJSON(props.physicalMaterial);
  }

  public override toJSON(): PhysicalElementProps {
    const val = super.toJSON() as PhysicalElementProps;
    val.physicalMaterial = this.physicalMaterial?.toJSON();
    return val;
  }
}

/** Identifies a *tracked* real world location but has no mass and cannot be *touched*.
 * @public @preview
 */
export abstract class SpatialLocationElement extends SpatialElement {
  public static override get className(): string { return "SpatialLocationElement"; }
  protected constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

/** A Volume Element is a Spatial Location Element that is restricted to defining a volume.
 * @public @preview
 */
export class VolumeElement extends SpatialLocationElement {
  public static override get className(): string { return "VolumeElement"; }
  protected constructor(props: GeometricElement3dProps, iModel: IModelDb) { super(props, iModel); }
}

/** A SectionDrawingLocation element identifies the location of a [[SectionDrawing]] in the context of a [[SpatialModel]],
 * enabling [HyperModeling]($hypermodeling).
 * @note The associated ECClass was added to the BisCore schema in version 1.0.11.
 * @public @preview
 */
export class SectionDrawingLocation extends SpatialLocationElement {
  /** The Id of the [[ViewDefinition]] to which this location refers. */
  public sectionView: RelatedElement;

  public static override get className(): string { return "SectionDrawingLocation"; }

  public constructor(props: SectionDrawingLocationProps, iModel: IModelDb) {
    super(props, iModel);
    this.sectionView = RelatedElement.fromJSON(props.sectionView) ?? RelatedElement.none;
  }

  public override toJSON(): SectionDrawingLocationProps {
    return {
      ...super.toJSON(),
      sectionView: this.sectionView.toJSON(),
    };
  }
}

/** Information Content Element is an abstract base class for modeling pure information entities. Only the
 * core framework should directly subclass from Information Content Element. Domain and application developers
 * should start with the most appropriate subclass of Information Content Element.
 * @public @preview
 */
export abstract class InformationContentElement extends Element {
  public static override get className(): string { return "InformationContentElement"; }
  protected constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** Element used in conjunction with bis:ElementDrivesElement relationships to bundle multiple inputs before
 * driving the output element.
 * @beta
 */
export abstract class DriverBundleElement extends InformationContentElement {
  public static override get className(): string { return "DriverBundleElement"; }
  protected constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** Information Reference is an abstract base class for modeling entities whose main purpose is to reference something else.
 * @public @preview
 */
export abstract class InformationReferenceElement extends InformationContentElement {
  public static override get className(): string { return "InformationReferenceElement"; }

  protected constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** A Subject is an information element that describes what this repository (or part thereof) is about.
 * @public @preview
 */
export class Subject extends InformationReferenceElement {
  public static override get className(): string { return "Subject"; }
  public description?: string;
  protected constructor(props: SubjectProps, iModel: IModelDb) {
    super(props, iModel);
    this.description = props.description;
  }

  public override toJSON(): SubjectProps { // This override only specializes the return type
    return super.toJSON() as SubjectProps; // Entity.toJSON takes care of auto-handled properties
  }
  /** Create a Code for a Subject given a name that is meant to be unique within the scope of its parent Subject.
   * @param iModelDb The IModelDb
   * @param parentSubjectId The Id of the parent Subject that provides the scope for names of its child Subjects.
   * @param codeValue The child Subject name
   */
  public static createCode(iModelDb: IModelDb, parentSubjectId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModelDb.codeSpecs.getByName(BisCodeSpec.subject);
    return new Code({ spec: codeSpec.id, scope: parentSubjectId, value: codeValue });
  }
  /** Create a Subject
   * @param iModelDb The IModelDb
   * @param parentSubjectId The new Subject will be a child of this Subject
   * @param name The name (codeValue) of the Subject
   * @param description The optional description of the Subject
   * @returns The newly constructed Subject
   * @throws [[IModelError]] if there is a problem creating the Subject
   */
  public static create(iModelDb: IModelDb, parentSubjectId: Id64String, name: string, description?: string): Subject {
    const subjectProps: SubjectProps = {
      classFullName: this.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsSubjects(parentSubjectId),
      code: this.createCode(iModelDb, parentSubjectId, name),
      description,
    };
    return new Subject(subjectProps, iModelDb);
  }

  /** Insert a Subject
   * @param iModelDb Insert into this IModelDb
   * @param parentSubjectId The new Subject will be inserted as a child of this Subject
   * @param name The name (codeValue) of the Subject
   * @param description The optional description of the Subject
   * @returns The Id of the newly inserted Subject
   * @throws [[IModelError]] if there is a problem inserting the Subject
   */
  public static insert(iModelDb: IModelDb, parentSubjectId: Id64String, name: string, description?: string): Id64String {
    const subject = this.create(iModelDb, parentSubjectId, name, description);
    return iModelDb.elements.insertElement(subject.toJSON());
  }
}

/** An InformationContentElement that identifies the content of a document.
 * The realized form of a document is called a DocumentCarrier (different class than Document).
 * For example, a will is a legal document. The will published into a PDF file is an ElectronicDocumentCopy.
 * The will printed onto paper is a PrintedDocumentCopy.
 * In this example, the Document only identifies, names, and tracks the content of the will.
 * @public @preview
 */
export abstract class Document extends InformationContentElement {
  public static override get className(): string { return "Document"; }
  protected constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** A document that represents a drawing, that is, a two-dimensional graphical representation of engineering data. A Drawing element is usually modelled by a [[DrawingModel]].
 * @public @preview
 */
export class Drawing extends Document {
  private _scaleFactor: number;

  /** A factor used by tools to adjust the size of text in [GeometricElement2d]($backend)s in the associated [DrawingModel]($backend) and to compute the
   * size of the [ViewAttachment]($backend) created when attaching the [Drawing]($backend) to a [Sheet]($backend).
   * Default: 1.
   * @note Attempting to set this property to a value less than or equal to zero will produce an exception.
   * @public @preview
   */
  public get scaleFactor(): number { return this._scaleFactor; }
  public set scaleFactor(factor: number) {
    if (factor <= 0) {
      if (this._scaleFactor === undefined) {
        // Entity constructor calls our setter before our constructor runs...don't throw an exception at that time,
        // because somebody may have persisted the value as zero.
        return;
      }

      throw new Error("Drawing.scaleFactor must be greater than zero");
    }

    this._scaleFactor = factor;
  }

  public static override get className(): string { return "Drawing"; }

  protected constructor(props: DrawingProps, iModel: IModelDb) {
    super(props, iModel);

    this._scaleFactor = typeof props.scaleFactor === "number" && props.scaleFactor > 0 ? props.scaleFactor : 1;
  }

  public override toJSON(): DrawingProps {
    const drawingProps: DrawingProps = super.toJSON();
    // Entity.toJSON auto-magically sets drawingProps.scaleFactor from this.scaleFactor - unset if default value of 1.
    if (drawingProps.scaleFactor === 1) {
      delete drawingProps.scaleFactor;
    }

    return drawingProps;
  }

  /** The name of the DrawingModel class modeled by this element type. */
  protected static get drawingModelFullClassName(): string { return DrawingModel.classFullName; }

  /** Create a Code for a Drawing given a name that is meant to be unique within the scope of the specified DocumentListModel.
   * @param iModel  The IModelDb
   * @param scopeModelId The Id of the DocumentListModel that contains the Drawing and provides the scope for its name.
   * @param codeValue The Drawing name
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.drawing);
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }

  /** Insert a Drawing element and a DrawingModel that breaks it down.
   * @param iModelDb Insert into this iModel
   * @param documentListModelId Insert the new Drawing into this DocumentListModel
   * @param name The name of the Drawing.
   * @param scaleFactor See [[scaleFactor]]. Must be greater than zero.
   * @returns The Id of the newly inserted Drawing element and the DrawingModel that breaks it down (same value).
   * @throws [[IModelError]] if unable to insert the element.
   * @throws Error if `scaleFactor` is less than or equal to zero.
   */
  public static insert(iModelDb: IModelDb, documentListModelId: Id64String, name: string, scaleFactor?: number): Id64String {
    const drawingProps: DrawingProps = {
      classFullName: this.classFullName,
      model: documentListModelId,
      code: this.createCode(iModelDb, documentListModelId, name),
    };

    if (scaleFactor !== undefined) {
      if (scaleFactor <= 0) {
        throw new Error("Drawing.scaleFactor must be greater than zero");
      }

      drawingProps.scaleFactor = scaleFactor;
    }

    const drawingId: Id64String = iModelDb.elements.insertElement(drawingProps);
    const model: DrawingModel = iModelDb.models.createModel({
      classFullName: this.drawingModelFullClassName,
      modeledElement: { id: drawingId },
    });
    return iModelDb.models.insertModel(model.toJSON());
  }
}

/** A document that represents a section drawing, that is, a graphical documentation derived from a planar
 * section of a spatial view. A SectionDrawing element is modelled by a [[SectionDrawingModel]] or a [[GraphicalModel3d]].
 * A [[SectionDrawingLocation]] can associate the drawing with a spatial location, enabling [HyperModeling]($hypermodeling).
 * @public @preview
 */
export class SectionDrawing extends Drawing {
  /** The type of section used to generate the drawing. */
  public sectionType: SectionType;
  /** The spatial view from which the section was generated. */
  public spatialView: RelatedElement;
  /** A transform from the section drawing model's coordinates to spatial coordinates. */
  public drawingToSpatialTransform?: Transform;
  /** If the section drawing is placed onto a [[Sheet]] via a [[ViewAttachment]], a transform from the sheet's coordinates to spatial coordinates. */
  public sheetToSpatialTransform?: Transform;
  /** If the section drawing is placed onto a [[Sheet]] via a [[ViewAttachment]], the clip to apply to the sheet graphics when drawn in the context
   * of the spatial view.
   * @note The ClipVector is defined in spatial coordinates.
   */
  public drawingBoundaryClip?: ClipVector;
  /** If true, when displaying the section drawing as a [DrawingViewState]($frontend), the [[spatialView]] will also be displayed. */
  public displaySpatialView: boolean;

  public static override get className(): string { return "SectionDrawing"; }

  protected static override get drawingModelFullClassName(): string { return SectionDrawingModel.classFullName; }

  protected constructor(props: SectionDrawingProps, iModel: IModelDb) {
    super(props, iModel);
    this.sectionType = JsonUtils.asInt(props.sectionType, SectionType.Section);
    this.spatialView = RelatedElement.fromJSON(props.spatialView) ?? RelatedElement.none;
    this.displaySpatialView = JsonUtils.asBool(props.jsonProperties?.displaySpatialView);

    const json = props.jsonProperties;
    if (!json)
      return;

    if (json.drawingToSpatialTransform)
      this.drawingToSpatialTransform = Transform.fromJSON(json.drawingToSpatialTransform);

    if (json.sheetToSpatialTransform)
      this.sheetToSpatialTransform = Transform.fromJSON(json.sheetToSpatialTransform);

    if (json.drawingBoundaryClip)
      this.drawingBoundaryClip = ClipVector.fromJSON(json.drawingBoundaryClip);
  }

  public override toJSON(): SectionDrawingProps {
    const props: SectionDrawingProps = {
      ...super.toJSON(),
      sectionType: this.sectionType,
      spatialView: this.spatialView.toJSON(),
    };

    if (!props.jsonProperties)
      props.jsonProperties = {};

    props.jsonProperties.displaySpatialView = this.displaySpatialView ? true : undefined;
    props.jsonProperties.drawingToSpatialTransform = this.drawingToSpatialTransform?.toJSON();
    props.jsonProperties.sheetToSpatialTransform = this.sheetToSpatialTransform?.toJSON();
    props.jsonProperties.drawingBoundaryClip = this.drawingBoundaryClip?.toJSON();

    return props;
  }
}

/** The template for a SheetBorder
 * @public @preview
 */
export class SheetBorderTemplate extends Document {
  public static override get className(): string { return "SheetBorderTemplate"; }
  public height?: number;
  public width?: number;
  protected constructor(props: SheetBorderTemplateProps, iModel: IModelDb) {
    super(props, iModel);
    this.height = props.height;
    this.width = props.width;
  }
}

/** The template for a [[Sheet]]
 * @public @preview
 */
export class SheetTemplate extends Document {
  public static override get className(): string { return "SheetTemplate"; }
  public height?: number;
  public width?: number;
  public border?: Id64String;

  protected constructor(props: SheetTemplateProps, iModel: IModelDb) {
    super(props, iModel);
    this.height = props.height;
    this.width = props.width;
    this.border = props.border;
  }

  protected override collectReferenceIds(referenceIds: EntityReferenceSet): void {
    super.collectReferenceIds(referenceIds);
    if (undefined !== this.border)
      referenceIds.addElement(this.border);
  }
}

/** A digital representation of a *sheet of paper*. Modeled by a [[SheetModel]].
 * @public @preview
 */
export class Sheet extends Document {
  public static override get className(): string { return "Sheet"; }
  public height: number;
  public width: number;
  public scale?: number;
  public sheetTemplate?: Id64String;

  protected constructor(props: SheetProps, iModel: IModelDb) {
    super(props, iModel);
    this.height = JsonUtils.asDouble(props.height);
    this.width = JsonUtils.asDouble(props.width);
    this.scale = props.scale;
    this.sheetTemplate = props.sheetTemplate ? Id64.fromJSON(props.sheetTemplate) : undefined;
  }

  protected override collectReferenceIds(referenceIds: EntityReferenceSet): void {
    super.collectReferenceIds(referenceIds);
    if (undefined !== this.sheetTemplate)
      referenceIds.addElement(this.sheetTemplate);
  }

  /** Create a Code for a Sheet given a name that is meant to be unique within the scope of the specified DocumentListModel.
   * @param iModel  The IModelDb
   * @param scopeModelId The Id of the DocumentListModel that contains the Sheet and provides the scope for its name.
   * @param codeValue The Sheet name
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.sheet);
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }
}

/** Information Record Element is an abstract base class for modeling information records. Information Record
 * Element is the default choice if no other subclass of Information Content Element makes sense.
 * @public @preview
 */
export abstract class InformationRecordElement extends InformationContentElement {
  public static override get className(): string { return "InformationRecordElement"; }

  protected constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** A Definition Element holds configuration-related information that is meant to be referenced / shared.
 * @public @preview
 */
export abstract class DefinitionElement extends InformationContentElement {
  public static override get className(): string { return "DefinitionElement"; }
  /** If true, don't show this DefinitionElement in user interface lists. */
  public isPrivate: boolean;

  protected constructor(props: DefinitionElementProps, iModel: IModelDb) {
    super(props, iModel);
    this.isPrivate = true === props.isPrivate;
  }

  /**
   * DefinitionElement custom HandledProps includes 'isPrivate'.
   * @inheritdoc
   * @beta
   */
  protected static override readonly _customHandledProps: CustomHandledProperty[] = [
    { propertyName: "isPrivate", source: "Class" },
  ];

  /**
   * DefinitionElement deserializes 'isPrivate'.
   * @inheritdoc
   * @beta
   */
  public static override deserialize(props: DeserializeEntityArgs): DefinitionElementProps {
    const elProps = super.deserialize(props) as DefinitionElementProps;
    if (props.row.isPrivate !== undefined)
      elProps.isPrivate = props.row.isPrivate;
    return elProps;
  }

  /**
   * DefinitionElement serialize 'isPrivate'.
   * @inheritdoc
   * @beta
   */
  public static override serialize(props: DefinitionElementProps, iModel: IModelDb): ECSqlRow {
    const inst = super.serialize(props, iModel);
    if (undefined !== props.isPrivate) {
      inst.isPrivate = props.isPrivate;
    }
    return inst;
  }

  public override toJSON(): DefinitionElementProps {
    const val = super.toJSON() as DefinitionElementProps;
    val.isPrivate = this.isPrivate;
    return val;
  }
}

/** This abstract class unifies DefinitionGroup and DefinitionContainer for relationship endpoint purposes.
 * @note The associated ECClass was added to the BisCore schema in version 1.0.10
 * @public @preview
 */
export abstract class DefinitionSet extends DefinitionElement {
  public static override get className(): string { return "DefinitionSet"; }
}

/** A DefinitionContainer exclusively owns a set of DefinitionElements contained within its sub-model (of type DefinitionModel).
 * @note The associated ECClass was added to the BisCore schema in version 1.0.10
 * @public @preview
 */
export class DefinitionContainer extends DefinitionSet {
  public static override get className(): string { return "DefinitionContainer"; }
  /** Create a DefinitionContainer
   * @param iModelDb The IModelDb
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that will contain this DefinitionContainer element.
   * @param code The Code for this DefinitionContainer.
   * @param isPrivate The optional hint, that if `true` means it should not be displayed in the UI.
   * @returns The newly constructed DefinitionContainer
   * @note There is not a predefined CodeSpec for DefinitionContainer elements, so it is the responsibility of the domain or application to create one.
   * @throws [[IModelError]] if there is a problem creating the DefinitionContainer
   */
  public static create(iModelDb: IModelDb, definitionModelId: Id64String, code: Code, isPrivate?: boolean): DefinitionContainer {
    const elementProps: DefinitionElementProps = {
      classFullName: this.classFullName,
      model: definitionModelId,
      code,
      isPrivate,
    };
    return new DefinitionContainer(elementProps, iModelDb);
  }
  /** Insert a DefinitionContainer and its sub-model.
   * @param iModelDb Insert into this IModelDb
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that will contain this DefinitionContainer element.
   * @param code The Code for this DefinitionContainer.
   * @param isPrivate The optional hint, that if `true` means it should not be displayed in the UI.
   * @returns The Id of the newly inserted DefinitionContainer and its newly inserted sub-model (of type DefinitionModel).
   * @note There is not a predefined CodeSpec for DefinitionContainer elements, so it is the responsibility of the domain or application to create one.
   * @throws [[IModelError]] if there is a problem inserting the DefinitionContainer
   */
  public static insert(iModelDb: IModelDb, definitionModelId: Id64String, code: Code, isPrivate?: boolean): Id64String {
    const containerElement = this.create(iModelDb, definitionModelId, code, isPrivate);
    const containerElementId = iModelDb.elements.insertElement(containerElement.toJSON());
    const containerSubModelProps: ModelProps = {
      classFullName: DefinitionModel.classFullName,
      modeledElement: { id: containerElementId },
      isPrivate,
    };
    iModelDb.models.insertModel(containerSubModelProps);
    return containerElementId;
  }
}

/** A non-exclusive set of DefinitionElements grouped using the DefinitionGroupGroupsDefinitions relationship.
 * @note The associated ECClass was added to the BisCore schema in version 1.0.10
 * @public @preview
 */
export class DefinitionGroup extends DefinitionSet {
  public static override get className(): string { return "DefinitionGroup"; }
  /** Create a DefinitionGroup
   * @param iModelDb The IModelDb
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that will contain this DefinitionGroup element.
   * @param code The Code for this DefinitionGroup
   * @param isPrivate The optional hint, that if `true` means it should not be displayed in the UI.
   * @returns The newly constructed DefinitionGroup
   * @note There is not a predefined CodeSpec for DefinitionGroup elements, so it is the responsibility of the domain or application to create one.
   * @throws [[IModelError]] if there is a problem creating the DefinitionGroup
   */
  public static create(iModelDb: IModelDb, definitionModelId: Id64String, code: Code, isPrivate?: boolean): DefinitionGroup {
    const elementProps: DefinitionElementProps = {
      classFullName: this.classFullName,
      model: definitionModelId,
      code,
      isPrivate,
    };
    return new DefinitionGroup(elementProps, iModelDb);
  }
}

/** Defines a set of properties (the *type*) that may be associated with an element.
 * @public @preview
 */
export abstract class TypeDefinitionElement extends DefinitionElement {
  public static override get className(): string { return "TypeDefinitionElement"; }
  public recipe?: RelatedElement;

  protected constructor(props: TypeDefinitionElementProps, iModel: IModelDb) {
    super(props, iModel);
    this.recipe = RelatedElement.fromJSON(props.recipe);
  }

  protected override collectReferenceIds(referenceIds: EntityReferenceSet): void {
    super.collectReferenceIds(referenceIds);
    if (undefined !== this.recipe)
      referenceIds.addElement(this.recipe.id);
  }
}

/** Defines a recipe for generating instances from a definition.
 * @beta
 */
export abstract class RecipeDefinitionElement extends DefinitionElement {
  public static override get className(): string { return "RecipeDefinitionElement"; }
  protected constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
}

/** Defines a set of properties (the *type*) that can be associated with a Physical Element. A Physical
 * Type has a strong correlation with something that can be ordered from a catalog since all instances
 * share a common set of properties.
 * @public @preview
 */
export abstract class PhysicalType extends TypeDefinitionElement {
  public static override get className(): string { return "PhysicalType"; }
  /** If defined, the [[PhysicalMaterial]] that makes up this PhysicalType. */
  public physicalMaterial?: RelatedElement;
  protected constructor(props: PhysicalTypeProps, iModel: IModelDb) {
    super(props, iModel);
    this.physicalMaterial = RelatedElement.fromJSON(props.physicalMaterial);
  }

  public override toJSON(): PhysicalTypeProps {
    const val = super.toJSON() as PhysicalTypeProps;
    val.physicalMaterial = this.physicalMaterial?.toJSON();
    return val;
  }
  /** Create a Code for a PhysicalType element given a name that is meant to be unique within the scope of the specified DefinitionModel.
   * @param iModel  The IModelDb
   * @param scopeModelId The Id of the DefinitionModel that contains the PhysicalType element and provides the scope for its name.
   * @param codeValue The PhysicalType name
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.physicalType);
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }
}

/** Defines a set of properties (the *type*) that can be associated with a spatial location.
 * @public @preview
 */
export abstract class SpatialLocationType extends TypeDefinitionElement {
  public static override get className(): string { return "SpatialLocationType"; }
  protected constructor(props: TypeDefinitionElementProps, iModel: IModelDb) { super(props, iModel); }

  /** Create a Code for a SpatialLocationType element given a name that is meant to be unique within the scope of the specified DefinitionModel.
   * @param iModel  The IModelDb
   * @param scopeModelId The Id of the DefinitionModel that contains the SpatialLocationType element and provides the scope for its name.
   * @param codeValue The SpatialLocationType name
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.spatialLocationType);
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }
}

/** A TemplateRecipe3d is a DefinitionElement that has a sub-model that contains the 3d template elements.
 * @beta
 */
export class TemplateRecipe3d extends RecipeDefinitionElement {
  public static override get className(): string { return "TemplateRecipe3d"; }

  protected constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }

  /** Create a Code for a TemplateRecipe3d given a name that is meant to be unique within the scope of its Model.
   * @param iModelDb The IModelDb
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that contains this TemplateRecipe3d element.
   * @param codeValue The name of the TemplateRecipe3d element.
   */
  public static createCode(iModelDb: IModelDb, definitionModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModelDb.codeSpecs.getByName(BisCodeSpec.templateRecipe3d);
    return new Code({ spec: codeSpec.id, scope: definitionModelId, value: codeValue });
  }

  /** Create a TemplateRecipe3d
   * @param iModelDb The IModelDb
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that contains this TemplateRecipe3d element.
   * @param name The name (Code.value) of the TemplateRecipe3d
   * @returns The newly constructed TemplateRecipe3d
   * @throws [[IModelError]] if there is a problem creating the TemplateRecipe3d
   */
  public static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string, isPrivate?: boolean): TemplateRecipe3d {
    const elementProps: DefinitionElementProps = {
      classFullName: this.classFullName,
      model: definitionModelId,
      code: this.createCode(iModelDb, definitionModelId, name),
      isPrivate,
    };
    return new TemplateRecipe3d(elementProps, iModelDb);
  }
  /** Insert a TemplateRecipe3d and a PhysicalModel (sub-model) that will contain the 3d template elements.
   * @param iModelDb The IModelDb
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that contains this TemplateRecipe3d element.
   * @param name The name (Code.value) of the TemplateRecipe3d
   * @returns The Id of the newly inserted TemplateRecipe3d and the PhysicalModel that sub-models it.
   * @throws [[IModelError]] if there is a problem inserting the TemplateRecipe3d or its sub-model.
   */
  public static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, isPrivate?: boolean): Id64String {
    const element = this.create(iModelDb, definitionModelId, name, isPrivate);
    const modeledElementId: Id64String = iModelDb.elements.insertElement(element.toJSON());
    const modelProps: GeometricModel3dProps = {
      classFullName: PhysicalModel.classFullName,
      modeledElement: { id: modeledElementId },
      isTemplate: true,
    };
    return iModelDb.models.insertModel(modelProps); // will be the same value as modeledElementId
  }
}

/** Defines a set of properties (the *type*) that can be associated with a 2D Graphical Element.
 * @public @preview
 */
export abstract class GraphicalType2d extends TypeDefinitionElement {
  public static override get className(): string { return "GraphicalType2d"; }

  protected constructor(props: TypeDefinitionElementProps, iModel: IModelDb) { super(props, iModel); }

  /** Create a Code for a GraphicalType2d element given a name that is meant to be unique within the scope of the specified DefinitionModel.
   * @param iModel  The IModelDb
   * @param scopeModelId The Id of the DefinitionModel that contains the GraphicalType2d element and provides the scope for its name.
   * @param codeValue The GraphicalType2d name
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.graphicalType2d);
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }
}

/** A recipe that uses a 2D template for creating new instances.
 * @beta
 */
export class TemplateRecipe2d extends RecipeDefinitionElement {
  public static override get className(): string { return "TemplateRecipe2d"; }
  protected constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }

  /** Create a Code for a TemplateRecipe2d given a name that is meant to be unique within the scope of its Model.
   * @param iModelDb The IModelDb
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that contains this TemplateRecipe2d element.
   * @param codeValue The name of the TemplateRecipe2d element.
   */
  public static createCode(iModelDb: IModelDb, definitionModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModelDb.codeSpecs.getByName(BisCodeSpec.templateRecipe2d);
    return new Code({ spec: codeSpec.id, scope: definitionModelId, value: codeValue });
  }

  /** Create a TemplateRecipe2d
   * @param iModelDb The IModelDb
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that contains this TemplateRecipe2d element.
   * @param name The name (Code.value) of the TemplateRecipe2d
   * @returns The newly constructed TemplateRecipe2d
   * @throws [[IModelError]] if there is a problem creating the TemplateRecipe2d
   */
  public static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string, isPrivate?: boolean): TemplateRecipe2d {
    const elementProps: DefinitionElementProps = {
      classFullName: this.classFullName,
      model: definitionModelId,
      code: this.createCode(iModelDb, definitionModelId, name),
      isPrivate,
    };
    return new TemplateRecipe2d(elementProps, iModelDb);
  }
  /** Insert a TemplateRecipe2d and a DrawingModel (sub-model) that will contain the 2d template elements.
   * @param iModelDb The IModelDb
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that contains this TemplateRecipe2d element.
   * @param name The name (Code.value) of the TemplateRecipe2d
   * @returns The Id of the newly inserted TemplateRecipe2d and the PhysicalModel that sub-models it.
   * @throws [[IModelError]] if there is a problem inserting the TemplateRecipe2d or its sub-model.
   */
  public static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, isPrivate?: boolean): Id64String {
    const element = this.create(iModelDb, definitionModelId, name, isPrivate);
    const modeledElementId: Id64String = iModelDb.elements.insertElement(element.toJSON());
    const modelProps: GeometricModel2dProps = {
      classFullName: DrawingModel.classFullName,
      modeledElement: { id: modeledElementId },
      isTemplate: true,
    };
    return iModelDb.models.insertModel(modelProps); // will be the same value as modeledElementId
  }
}

/** An abstract base class for elements that establishes a particular modeling perspective for its parent Subject.
 * Instances are always sub-modeled by a specialization of Model of the appropriate modeling perspective.
 * @see [iModel Information Hierarchy]($docs/bis/guide/data-organization/top-of-the-world), [[Subject]], [[Model]]
 * @public @preview
 */
export abstract class InformationPartitionElement extends InformationContentElement {
  public static override get className(): string { return "InformationPartitionElement"; }
  /** A human-readable string describing the intent of the partition. */
  public description?: string;

  protected constructor(props: InformationPartitionElementProps, iModel: IModelDb) {
    super(props, iModel);
    this.description = props.description;
  }

  public override toJSON(): InformationPartitionElementProps { // This override only specializes the return type
    return super.toJSON() as InformationPartitionElementProps; // Entity.toJSON takes care of auto-handled properties
  }

  /** Create a code that can be used for any subclass of InformationPartitionElement.
   * @param iModelDb The IModelDb
   * @param parentSubjectId The Id of the parent Subject that provides the scope for names of its child InformationPartitionElements.
   * @param codeValue The InformationPartitionElement name
   */
  public static createCode(iModel: IModelDb, parentSubjectId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.informationPartitionElement);
    return new Code({ spec: codeSpec.id, scope: parentSubjectId, value: codeValue });
  }
}

/** A DefinitionPartition element establishes a *Definition* modeling perspective for its parent Subject.
 * A DefinitionPartition is always sub-modeled by a DefinitionModel.
 * @see [[DefinitionModel]]
 * @public @preview
 */
export class DefinitionPartition extends InformationPartitionElement {
  public static override get className(): string { return "DefinitionPartition"; }
}

/** A DocumentPartition element establishes a *Document* modeling perspective for its parent Subject.
 * A DocumentPartition is always sub-modeled by a DocumentListModel.
 * @see [[DocumentListModel]]
 * @public @preview
 */
export class DocumentPartition extends InformationPartitionElement {
  public static override get className(): string { return "DocumentPartition"; }
}

/** A GroupInformationPartition element establishes a *Group Information* modeling perspective for its parent Subject.
 * A GroupInformationPartition is always sub-modeled by a GroupInformationModel.
 * @see [[GroupInformationModel]]
 * @public @preview
 */
export class GroupInformationPartition extends InformationPartitionElement {
  public static override get className(): string { return "GroupInformationPartition"; }
}

/** A GraphicalPartition3d element establishes a *3D Graphical* modeling perspective for its parent Subject.
 * A GraphicalPartition3d is always sub-modeled by a GraphicalModel3d.
 * @note The associated ECClass was added to the BisCore schema in version 1.0.8
 * @see [[GraphicalModel3d]]
 * @public @preview
 */
export class GraphicalPartition3d extends InformationPartitionElement {
  public static override get className(): string { return "GraphicalPartition3d"; }
}

/** An InformationRecordPartition element establishes a *Information Record* modeling perspective for its parent Subject.
 * A InformationRecordPartition is always sub-modeled by an InformationRecordModel.
 * @see [[InformationRecordModel]]
 * @public @preview
 */
export class InformationRecordPartition extends InformationPartitionElement {
  public static override get className(): string { return "InformationRecordPartition"; }
}

/** A LinkPartition element establishes a *Link* modeling perspective for its parent Subject. A LinkPartition is always sub-modeled by a LinkModel.
 * @see [[LinkModel]]
 * @public @preview
 */
export class LinkPartition extends InformationPartitionElement {
  public static override get className(): string { return "LinkPartition"; }
}

/** A PhysicalPartition element establishes a *Physical* modeling perspective for its parent Subject. A PhysicalPartition is always sub-modeled by a PhysicalModel.
 * @see [[PhysicalModel]]
 * @public @preview
 */
export class PhysicalPartition extends InformationPartitionElement {
  public static override get className(): string { return "PhysicalPartition"; }
}

/** A SpatialLocationPartition element establishes a *SpatialLocation* modeling perspective for its parent Subject.
 * A SpatialLocationPartition is always sub-modeled by a SpatialLocationModel.
 * @see [[SpatialLocationModel]]
 * @public @preview
 */
export class SpatialLocationPartition extends InformationPartitionElement {
  public static override get className(): string { return "SpatialLocationPartition"; }
}

/** A SheetIndexPartition element establishes a [[SheetIndex]] modeling perspective for its parent [[Subject]].
 * A SheetIndexPartition is always sub-modeled by a [[SheetIndexModel]].
 * @beta
 */
export class SheetIndexPartition extends InformationPartitionElement {
  public static override get className(): string { return "SheetIndexPartition"; }
}

/** Group Information is an abstract base class for modeling entities whose main purpose is to reference a group of related elements.
 * @public @preview
 */
export abstract class GroupInformationElement extends InformationReferenceElement {
  public static override get className(): string { return "GroupInformationElement"; }
}

/** An information element that specifies a link.
 * @public @preview
 */
export abstract class LinkElement extends InformationReferenceElement {
  public static override get className(): string { return "LinkElement"; }
  /** Create a Code for a LinkElement given a name that is meant to be unique within the scope of the specified Model.
   * @param iModel  The IModelDb
   * @param scopeModelId The Id of the Model that contains the LinkElement and provides the scope for its name.
   * @param codeValue The LinkElement name
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.linkElement);
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }
}

/** An information element that specifies a URL link.
 * @public @preview
 */
export class UrlLink extends LinkElement {
  public static override get className(): string { return "UrlLink"; }
  public description?: string;
  public url?: string;

  protected constructor(props: UrlLinkProps, iModel: IModelDb) {
    super(props, iModel);
    this.description = props.description;
    this.url = props.url;
  }

  /**
   * UrlLink custom HandledProps includes 'description', and 'url'.
   * @inheritdoc
   * @beta
   */
  protected static override readonly _customHandledProps: CustomHandledProperty[] = [
    { propertyName: "description", source: "Class" },
    { propertyName: "url", source: "Class" },
  ];

  /**
   * UrlLink deserializes 'description', and 'url'.
   * @inheritdoc
   * @beta
   */
  public static override deserialize(props: DeserializeEntityArgs): UrlLinkProps {
    const elProps = super.deserialize(props) as UrlLinkProps;
    elProps.description = props.row.description ?? "";
    elProps.url = props.row.url;
    return elProps;
  }

  /**
   * UrlLink serializes 'description', and 'url'.
   * @inheritdoc
   * @beta
   */
  public static override serialize(props: UrlLinkProps, iModel: IModelDb): ECSqlRow {
    const inst = super.serialize(props, iModel);
    inst.description = props.description;
    return inst;
  }

  public override toJSON(): UrlLinkProps {
    const val = super.toJSON() as UrlLinkProps;
    val.description = this.description;
    val.url = this.url;
    return val;
  }
}

/** Represents a folder-like structure that organizes repositories (typically files) in an external system.
 * @note The associated ECClass was added to the BisCore schema in version 1.0.13
 * @alpha
 */
export class FolderLink extends UrlLink {
  public static override get className(): string { return "FolderLink"; }
}

/** An information element that links to a repository.
 * @public @preview
 */
export class RepositoryLink extends UrlLink {
  public static override get className(): string { return "RepositoryLink"; }
  public repositoryGuid?: GuidString;
  /** @note This property was added to the BisCore schema in version 1.0.13 */
  public format?: string;

  protected constructor(props: RepositoryLinkProps, iModel: IModelDb) {
    super(props, iModel);
    this.repositoryGuid = props.repositoryGuid;
    this.format = props.format;
  }

  public override toJSON(): RepositoryLinkProps {
    const val = super.toJSON() as RepositoryLinkProps;
    val.repositoryGuid = this.repositoryGuid;
    val.format = this.format;
    return val;
  }
}

/** An information element that links to an embedded file.
 * @public @preview
 */
export class EmbeddedFileLink extends LinkElement {
  public static override get className(): string { return "EmbeddedFileLink"; }
}

/** A real world entity is modeled as a Role Element when a set of external circumstances define an important
 * role (one that is worth tracking) that is not intrinsic to the entity playing the role. For example,
 * a person can play the role of a teacher or a rock can play the role of a boundary marker.
 * @public @preview
 */
export abstract class RoleElement extends Element {
  public static override get className(): string { return "RoleElement"; }
}

/** A Definition Element that specifies a collection of geometry that is meant to be reused across Geometric
 * Element instances. Leveraging Geometry Parts can help reduce file size and improve display performance.
 * @public @preview
 */
export class GeometryPart extends DefinitionElement {
  public static override get className(): string { return "GeometryPart"; }
  public geom?: GeometryStreamProps;
  public bbox: ElementAlignedBox3d;

  protected constructor(props: GeometryPartProps, iModel: IModelDb) {
    super(props, iModel);
    this.geom = props.geom;
    this.bbox = Range3d.fromJSON(props.bbox);
  }

  /**
   * GeometryPart custom HandledProps includes 'geometryStream', 'bBoxHigh', and 'bBoxLow'.
   * @inheritdoc
   * @beta
   */
  protected static override readonly _customHandledProps: CustomHandledProperty[] = [
    { propertyName: "geometryStream", source: "Class" },
    { propertyName: "bBoxLow", source: "Class" },
    { propertyName: "bBoxHigh", source: "Class" },
  ];

  /**
   * GeometryPart deserializes 'geometryStream', 'bBoxHigh', and 'bBoxLow'.
   * @inheritdoc
   * @beta
   */
  public static override deserialize(props: DeserializeEntityArgs): GeometryPartProps {
    const elProps = super.deserialize(props) as GeometryPartProps;
    const instance = props.row;

    if ("bBoxHigh" in instance && instance.bBoxHigh !== undefined && "bBoxLow" in instance && instance.bBoxLow !== undefined) {
      elProps.bbox = {
        low: [instance.bBoxLow.x, instance.bBoxLow.y, instance.bBoxLow.z],
        high: [instance.bBoxHigh.x, instance.bBoxHigh.y, instance.bBoxHigh.z],
      };
    }

    if (instance.geometryStream) {
      elProps.geom = props.iModel[_nativeDb].convertOrUpdateGeometryPart({
        geom: instance.geometryStream as Uint8Array,
        is2d: false,
        bbox: elProps.bbox,
      }, "GeometryStreamProps", props.options?.element ?? {}).geom as GeometryStreamProps;
    }

    return elProps;
  }

  /**
   * GeometryPart serialize 'geometryStream', 'bBoxHigh', and 'bBoxLow'.
   * @inheritdoc
   * @beta
   */
  public static override serialize(props: GeometryPartProps, iModel: IModelDb): ECSqlRow {
    const inst = super.serialize(props, iModel);

    if (undefined !== props.geom) {
      const source = inst.geometryStream = iModel[_nativeDb].convertOrUpdateGeometryPart({
        geom: props.geom as any,
        is2d: false,
        bbox: props.bbox,
      }, "BinaryStream", {});
      inst.geometryStream = source.geom as Uint8Array;
      if (source.bbox) {
        props.bbox = source.bbox;
      }
    }

    if (undefined !== props.bbox) {
      if (Array.isArray(props.bbox.low)) {
        inst.bBoxLow = { x: props.bbox.low[0], y: props.bbox.low[1], z: props.bbox.low[2] };
      } else {
        inst.bBoxLow = props.bbox.low;
      }
      if (Array.isArray(props.bbox.high)) {
        inst.bBoxHigh = { x: props.bbox.high[0], y: props.bbox.high[1], z: props.bbox.high[2] };
      } else {
        inst.bBoxHigh = props.bbox.high;
      }
    }
    return inst;
  }

  public override toJSON(): GeometryPartProps {
    const val = super.toJSON() as GeometryPartProps;
    val.geom = this.geom;
    val.bbox = this.bbox;
    return val;
  }

  /** Create a Code for a GeometryPart element given a name that is meant to be unique within the scope of the specified DefinitionModel.
   * @param iModel  The IModelDb
   * @param scopeModelId The Id of the DefinitionModel that contains the GeometryPart element and provides the scope for its name.
   * @param codeValue The GeometryPart name
   * @note GeometryPart elements are not required to be named (have a non-empty Code).
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(BisCodeSpec.geometryPart);
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }
}

/** The definition element for a line style
 * @public @preview
 */
export class LineStyle extends DefinitionElement {
  public static override get className(): string { return "LineStyle"; }
  public description?: string;
  public data: string;

  protected constructor(props: LineStyleProps, iModel: IModelDb) {
    super(props, iModel);
    this.description = props.description;
    this.data = props.data;
  }

  /**
   * LineStyle custom HandledProps includes 'data'.
   * @inheritdoc
   * @beta
   */
  protected static override readonly _customHandledProps: CustomHandledProperty[] = [
    { propertyName: "data", source: "Class" },
  ];

  /**
   * LineStyle deserializes 'data'.
   * @inheritdoc
   * @beta
   */
  public static override deserialize(props: DeserializeEntityArgs): LineStyleProps {
    const elProps = super.deserialize(props) as LineStyleProps;
    const instance = props.row;
    elProps.data = instance.data ?? "";
    return elProps;
  }

  /**
   * LineStyle serializes 'data'.
   * @inheritdoc
   * @beta
   */
  public static override serialize(props: LineStyleProps, iModel: IModelDb): ECSqlRow {
    const inst = super.serialize(props, iModel);
    inst.data = props.data;
    return inst;
  }

  /** Create a Code for a LineStyle definition given a name that is meant to be unique within the scope of the specified model.
   * @param iModel The IModel
   * @param scopeModelId The Id of the DefinitionModel that contains the LineStyle and provides the scope for its name.
   * @param codeValue The name of the LineStyle
   * @returns A LineStyle Code
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code {
    return new Code({ spec: iModel.codeSpecs.getByName(BisCodeSpec.lineStyle).id, scope: scopeModelId, value: codeValue });
  }
}

/** Describes how to animate a view of a [[GeometricModel]] to show change over time using a [RenderSchedule.Script]($common).
 * @note This class was introduced in version 01.00.13 of the BisCore ECSchema. It should only be used with [[IModelDb]]s containing that version or newer.
 * @public @preview
 */
export class RenderTimeline extends InformationRecordElement {
  public static override get className(): string { return "RenderTimeline"; }
  /** A human-readable description of the timeline, which may be an empty string. */
  public description: string;
  /** The JSON representation of the instructions for visualizing change over time.
   * @see [RenderSchedule.Script]($common) for the API for working with the script.
   */
  public scriptProps: RenderSchedule.ScriptProps;

  protected constructor(props: RenderTimelineProps, iModel: IModelDb) {
    super(props, iModel);
    this.description = props.description ?? "";
    this.scriptProps = RenderTimeline.parseScriptProps(props.script);
  }

  public static fromJSON(props: RenderTimelineProps, iModel: IModelDb): RenderTimeline {
    return new RenderTimeline(props, iModel);
  }

  public override toJSON(): RenderTimelineProps {
    const props = super.toJSON() as RenderTimelineProps;
    if (this.description.length > 0)
      props.description = this.description;

    props.script = JSON.stringify(this.scriptProps);
    return props;
  }

  /**
   * RenderTimeline deserialize checks if Schedule Script Element Ids need to be omitted, and if so, removes them.
   * @inheritdoc
   * @beta
   */
  public static override deserialize(props: DeserializeEntityArgs): RenderTimelineProps {
    const elProps = super.deserialize(props) as RenderTimelineProps;
    const options = props.options?.element?.renderTimeline;
    // Omit Schedule Script Element Ids if the option is set
    if (options?.omitScriptElementIds && elProps.script) {
      const scriptProps: RenderSchedule.ScriptProps = RenderTimeline.parseScriptProps(elProps.script);
      elProps.script = JSON.stringify(RenderSchedule.Script.removeScheduleScriptElementIds(scriptProps));
    }
    return elProps;
  }

  private static parseScriptProps(json: string): RenderSchedule.ScriptProps {
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  }

  protected override collectReferenceIds(ids: EntityReferenceSet): void {
    super.collectReferenceIds(ids);
    const script = RenderSchedule.Script.fromJSON(this.scriptProps);
    script?.discloseIds(ids);
  }

  /** @alpha */
  protected static override async onCloned(context: IModelElementCloneContext, sourceProps: RenderTimelineProps, targetProps: RenderTimelineProps): Promise<void> {
    await super.onCloned(context, sourceProps, targetProps);
    if (context.isBetweenIModels)
      targetProps.script = JSON.stringify(this.remapScript(context, this.parseScriptProps(targetProps.script)));
  }

  /** Remap Ids when cloning a RenderSchedule.Script between iModels on a DisplayStyle or RenderTimeline.
   * @beta
   */
  public static remapScript(context: IModelElementCloneContext, input: RenderSchedule.ScriptProps): RenderSchedule.ScriptProps {
    const scriptProps: RenderSchedule.ScriptProps = [];
    if (!Array.isArray(input))
      return scriptProps;

    const elementIds = new OrderedId64Array();
    for (const model of input) {
      const modelId = context.findTargetElementId(model.modelId);
      if (!Id64.isValid(modelId))
        continue;

      model.modelId = modelId;
      scriptProps.push(model);
      for (const element of model.elementTimelines) {
        elementIds.clear();
        for (const sourceId of RenderSchedule.ElementTimeline.getElementIds(element.elementIds)) {
          const targetId = context.findTargetElementId(sourceId);
          if (Id64.isValid(targetId))
            elementIds.insert(targetId);
        }

        element.elementIds = CompressedId64Set.compressIds(elementIds);
      }
    }

    return scriptProps;
  }
}

/** Arguments supplied to [[ProjectInformationRecord.create]].
 * @beta
 */
export interface ProjectInformationRecordCreateArgs extends ProjectInformation {
  /** The iModel in which to create the new element. */
  iModel: IModelDb;
  /** The new element's code. Defaults to an empty code. */
  code?: Code;
  /** The Id of the parent [[Subject]] whose project-level properties the ProjectInformationRecord element describes.
   * The ProjectInformationRecord element will reside in the same [[Model]] as the parent Subject.
   */
  parentSubjectId: Id64String;
}

/** Captures project-level properties of the real-world entity represented by its parent [[Subject]].
 * @beta
 */
export class ProjectInformationRecord extends InformationRecordElement {
  public static override get className() { return "ProjectInformationRecord"; }

  /** The properties of the project. */
  public projectInformation: ProjectInformation;

  private constructor(props: ProjectInformationRecordProps, iModel: IModelDb) {
    super(props, iModel);
    this.projectInformation = {
      projectNumber: props.projectNumber,
      projectName: props.projectName,
      location: props.location,
    };
  }

  /** Create a new ProjectInformationRecord element ready to be inserted into the iModel. */
  public static create(args: ProjectInformationRecordCreateArgs): ProjectInformationRecord {
    const subject = args.iModel.elements.getElement<Subject>(args.parentSubjectId);
    if (!(subject instanceof Subject)) {
      throw new Error("ProjectInformationRecord must be a child of a Subject");
    }

    const props: ProjectInformationRecordProps = {
      classFullName: this.classFullName,
      model: subject.model,
      code: args.code ?? Code.createEmpty(),
      parent: new SubjectOwnsProjectInformationRecord(args.parentSubjectId),
      projectName: args.projectName,
      projectNumber: args.projectNumber,
      location: args.location,
    };

    return new this(props, args.iModel);
  }

  public override toJSON(): ProjectInformationRecordProps {
    const props = super.toJSON() as ProjectInformationRecordProps;
    if (undefined !== this.projectInformation.projectNumber) {
      props.projectNumber = this.projectInformation.projectNumber;
    }

    if (undefined !== this.projectInformation.projectName) {
      props.projectName = this.projectInformation.projectName;
    }

    if (undefined !== this.projectInformation.location) {
      props.location = this.projectInformation.location;
    }

    return props;
  }
}
