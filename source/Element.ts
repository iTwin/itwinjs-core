/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Code, CodeProps, GeometryStream, Placement3d, Placement2d } from "./IModel";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { BentleyPromise } from "@bentley/bentleyjs-core/lib/Bentley";
import { DgnDbStatus } from "@bentley/imodeljs-dgnplatform/lib/DgnDb";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { Entity, EntityProps } from "./Entity";
import { EntityMetaData } from "./EntityMetaData";
import { Model } from "./Model";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id64";

/** The Id and relationship class of an Element that is related to another Element */
export class RelatedElement {
  constructor(public id: Id64, public relClass?: string) { }
  public static fromJSON(json?: any): RelatedElement | undefined {
    return json ? new RelatedElement(new Id64(json.id), JsonUtils.asString(json.relClass)) : undefined;
  }
}

export interface ElementProps extends EntityProps {
  model: Id64 | string;
  code: CodeProps;
  id: Id64 | string;
  parent?: RelatedElement;
  federationGuid?: string;
  userLabel?: string;
  jsonProperties?: any;
}

/** An element within an iModel. */
export class Element extends Entity {
  public model: Id64;
  public code: Code;
  public parent?: RelatedElement;
  public federationGuid?: string;
  public userLabel?: string;
  public jsonProperties: any;

  /** constructor for Element. */
  constructor(props: ElementProps) {
    super(props);
    this.id = new Id64(props.id);
    this.code = new Code(props.code);
    this.model = new Id64(props.model);
    this.parent = RelatedElement.fromJSON(props.parent);
    this.federationGuid = props.federationGuid;
    this.userLabel = props.userLabel;
    this.jsonProperties = props.jsonProperties ? props.jsonProperties : {};
  }

  /** Get the metadata for the Entity of this element. */
  public async getClassMetaData(): Promise<EntityMetaData | undefined> { return this.iModel.classMetaDataRegistry.get(this.schemaName, this.className); }

  public getUserProperties(): any { if (!this.jsonProperties.UserProps) this.jsonProperties.UserProps = {}; return this.jsonProperties.UserProps; }
  public setUserProperties(nameSpace: string, value: any) { this.getUserProperties()[nameSpace] = value; }
  public removeUserProperties(nameSpace: string) { delete this.getUserProperties()[nameSpace]; }

  /** Query for the child elements of this element. */
  public async queryChildren(): Promise<Id64[]> {
    const { error, result: rows } = await this.iModel.executeQuery("SELECT ECInstanceId as id FROM " + Element.sqlName + " WHERE Parent.Id=" + this.id.toString()); // WIP: need to bind!
    if (error || !rows) {
      assert(false);
      return Promise.resolve([]);
    }

    const childIds: Id64[] = [];
    JSON.parse(rows).forEach((row: any) => childIds.push(new Id64(row.id))); // WIP: executeQuery should return eCInstanceId as a string
    return Promise.resolve(childIds);
  }

  /** Get the Model that modeling this Element (if it exists). That is, the model that is beneath this element in the hierarchy. */
  public async getSubModel(): BentleyPromise<DgnDbStatus, Model | undefined> {
    if (this.id.equals(this.iModel.elements.rootSubjectId))
      return { result: undefined };

    return this.iModel.models.getModel({ id: this.id });
  }
}

/** Properties of a GeometricElement */
export interface GeometricElementProps extends ElementProps {
  category?: Id64 | string;
  geom?: GeometryStream;
}

/** A Geometric element. All geometry held by a GeometricElement is positioned relative to its placement. */
export class GeometricElement extends Element {
  public category: Id64;
  public geom?: GeometryStream;
  public constructor(props: GeometricElementProps) {
    super(props);
    this.category = new Id64(props.category);
    this.geom = GeometryStream.fromJSON(props.geom);
  }
}

/** A RelatedElement that describes the type definition of an element. */
export class TypeDefinition extends RelatedElement {
  constructor(definitionId: Id64, relationshipClass?: string) { super(definitionId, relationshipClass); }
}

/** Properties that define a GeometricElement3d */
export interface GeometricElement3dProps extends GeometricElementProps {
  placement?: Placement3d;
  typeDefinition?: TypeDefinition;
}

/** A Geometric 3d element. */
export class GeometricElement3d extends GeometricElement {
  public placement: Placement3d;
  public typeDefinition?: TypeDefinition;

  public constructor(props: GeometricElement3dProps) {
    super(props);
    this.placement = Placement3d.fromJSON(props.placement);
    if (props.typeDefinition)
      this.typeDefinition = TypeDefinition.fromJSON(props.typeDefinition);
  }
}

/** Properties that define a GeometricElement2d */
export interface GeometricElement2dProps extends GeometricElementProps {
  placement?: Placement2d;
  typeDefinition?: TypeDefinition;
}

/** A Geometric 2d element. */
export class GeometricElement2d extends GeometricElement {
  public placement: Placement2d;
  public typeDefinition?: TypeDefinition;

  public constructor(props: GeometricElement2dProps) {
    super(props);
    this.placement = Placement2d.fromJSON(props.placement);
    if (props.typeDefinition)
      this.typeDefinition = TypeDefinition.fromJSON(props.typeDefinition);
  }
}

export class SpatialElement extends GeometricElement3d {
  public constructor(props: GeometricElement3dProps) { super(props); }
}

export class PhysicalElement extends SpatialElement {
  public constructor(props: GeometricElement3dProps) { super(props); }
}

export class PhysicalPortion extends PhysicalElement {
  public constructor(props: GeometricElement3dProps) { super(props); }
}

/** A SpatialElement that identifies a tracked real word 3-dimensional location but has no mass and cannot be touched.
 *  Examples include grid lines, parcel boundaries, and work areas.
 */
export class SpatialLocationElement extends SpatialElement {
  public constructor(props: GeometricElement3dProps) { super(props); }
}

/** A SpatialLocationPortion represents an arbitrary portion of a larger SpatialLocationElement that will be broken down in
 *  more detail in a separate (sub) SpatialLocationModel.
 */
export class SpatialLocationPortion extends SpatialLocationElement {
  public constructor(props: GeometricElement3dProps) { super(props); }
}

/** An InformationContentElement identifies and names information content.
 * @see InformationCarrierElement
 */
export class InformationContentElement extends Element {
  constructor(props: ElementProps) { super(props); }
}

export class InformationReferenceElement extends InformationContentElement {
  public constructor(props: ElementProps) { super(props); }
}

export class Subject extends InformationReferenceElement {
  public constructor(props: ElementProps) { super(props); }
}

/** A Document is an InformationContentElement that identifies the content of a document.
 * The realized form of a document is called a DocumentCarrier (different class than Document).
 * For example, a will is a legal document. The will published into a PDF file is an ElectronicDocumentCopy.
 * The will printed onto paper is a PrintedDocumentCopy.
 * In this example, the Document only identifies, names, and tracks the content of the will.
 */
export class Document extends InformationContentElement {
  constructor(props: ElementProps) { super(props); }
}

export class Drawing extends Document {
  constructor(props: ElementProps) { super(props); }
}

export class SectionDrawing extends Drawing {
  constructor(props: ElementProps) { super(props); }
}

/** An InformationCarrierElement is a proxy for an information carrier in the physical world.
 *  For example, the arrangement of ink on a paper document or an electronic file is an information carrier.
 *  The content is tracked separately from the carrier.
 *  @see InformationContentElement
 */
export class InformationCarrierElement extends Element {
  constructor(props: ElementProps) { super(props); }
}

/** An information element whose main purpose is to hold an information record. */
export class InformationRecordElement extends InformationContentElement {
  constructor(props: ElementProps) { super(props); }
}

/** A DefinitionElement resides in (and only in) a DefinitionModel. */
export class DefinitionElement extends InformationContentElement {
  constructor(props: ElementProps) { super(props); }
}

export class TypeDefinitionElement extends DefinitionElement {
  public recipe?: RelatedElement;
  constructor(props: ElementProps) { super(props); }
}

export class RecipeDefinitionElement extends DefinitionElement {
  constructor(props: ElementProps) { super(props); }
}

/** A PhysicalType typically corresponds to a @em type of physical object that can be ordered from a catalog.
 *  The PhysicalType system is also a database normalization strategy because properties that are the same
 *  across all instances are stored with the PhysicalType versus being repeated per PhysicalElement instance.
 */
export class PhysicalType extends TypeDefinitionElement {
  constructor(props: ElementProps) { super(props); }
}

/** The SpatialLocationType system is a database normalization strategy because properties that are the same
 *  across all instances are stored with the SpatialLocationType versus being repeated per SpatialLocationElement instance.
 */
export class SpatialLocationType extends TypeDefinitionElement {
  constructor(props: ElementProps) { super(props); }
}

export class TemplateRecipe3d extends RecipeDefinitionElement {
  constructor(props: ElementProps) { super(props); }
}

export class GraphicalType2d extends TypeDefinitionElement {
  constructor(props: ElementProps) { super(props); }
}

export class TemplateRecipe2d extends RecipeDefinitionElement {
  constructor(props: ElementProps) { super(props); }
}

export class InformationPartitionElement extends InformationContentElement {
  constructor(props: ElementProps) { super(props); }
}

/** A DefinitionPartition provides a starting point for a DefinitionModel hierarchy
 *  @note DefinitionPartition elements only reside in the RepositoryModel
 */
export class DefinitionPartition extends InformationPartitionElement {
  constructor(props: ElementProps) { super(props); }
}

/** A DocumentPartition provides a starting point for a DocumentListModel hierarchy
 *  @note DocumentPartition elements only reside in the RepositoryModel
 */
export class DocumentPartition extends InformationPartitionElement {
  constructor(props: ElementProps) { super(props); }
}

/** A GroupInformationPartition provides a starting point for a GroupInformationModel hierarchy
 *  @note GroupInformationPartition elements only reside in the RepositoryModel
 */
export class GroupInformationPartition extends InformationPartitionElement {
  constructor(props: ElementProps) { super(props); }
}

/** An InformationRecordPartition provides a starting point for a InformationRecordModel hierarchy
 *  @note InformationRecordPartition elements only reside in the RepositoryModel
 */
export class InformationRecordPartition extends InformationPartitionElement {
  constructor(props: ElementProps) { super(props); }
}

/** A PhysicalPartition provides a starting point for a PhysicalModel hierarchy
 *  @note PhysicalPartition elements only reside in the RepositoryModel
 */
export class PhysicalPartition extends InformationPartitionElement {
  constructor(props: ElementProps) { super(props); }
}

/** A SpatialLocationPartition provides a starting point for a SpatialLocationModel hierarchy
 *  @note SpatialLocationPartition elements only reside in the RepositoryModel
 */
export class SpatialLocationPartition extends InformationPartitionElement {
  constructor(props: ElementProps) { super(props); }
}

/** A GroupInformationElement resides in (and only in) a GroupInformationModel. */
export class GroupInformationElement extends InformationReferenceElement {
  constructor(props: ElementProps) { super(props); }
}

/** Abstract base class for roles played by other (typically physical) elements.
 *  For example:
 *  - <i>Lawyer</i> and <i>employee</i> are potential roles of a person
 *  - <i>Asset</i> and <i>safety hazard</i> are potential roles of a PhysicalElement
 */
export class RoleElement extends Element {
  constructor(props: ElementProps) { super(props); }
}

/** A LinkPartition provides a starting point for a LinkModel hierarchy */
export class LinkPartition extends InformationPartitionElement {
  constructor(props: ElementProps) { super(props); }
}
