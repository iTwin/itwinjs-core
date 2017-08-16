"use strict";
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const IModel_1 = require("./IModel");
const Assert_1 = require("@bentley/bentleyjs-core/lib/Assert");
const JsonUtils_1 = require("@bentley/bentleyjs-core/lib/JsonUtils");
const Entity_1 = require("./Entity");
/** The Id and relationship class of an Element that is related to another Element */
class RelatedElement {
    constructor(id, relClass) {
        this.id = id;
        this.relClass = relClass;
    }
    static fromJSON(json) {
        return json ? new RelatedElement(new IModel_1.Id(json.id), JsonUtils_1.JsonUtils.asString(json.relClass)) : undefined;
    }
}
exports.RelatedElement = RelatedElement;
/** An element within an iModel. */
class Element extends Entity_1.Entity {
    /** constructor for Element. */
    constructor(props) {
        super(props);
        this.id = new IModel_1.Id(props.id);
        this.code = new IModel_1.Code(props.code);
        this.model = new IModel_1.Id(props.model);
        this.parent = RelatedElement.fromJSON(props.parent);
        this.federationGuid = props.federationGuid;
        this.userLabel = props.userLabel;
        this.jsonProperties = props.jsonProperties ? props.jsonProperties : {};
    }
    /** Get the metadata for the Entity of this element. */
    getClassMetaData() {
        return __awaiter(this, void 0, void 0, function* () { return this.iModel.classMetaDataRegistry.get(this.schemaName, this.className); });
    }
    getUserProperties() { if (!this.jsonProperties.UserProps)
        this.jsonProperties.UserProps = {}; return this.jsonProperties.UserProps; }
    setUserProperties(nameSpace, value) { this.getUserProperties()[nameSpace] = value; }
    removeUserProperties(nameSpace) { delete this.getUserProperties()[nameSpace]; }
    /** Query for the child elements of this element. */
    queryChildren() {
        return __awaiter(this, void 0, void 0, function* () {
            const { error, result: rows } = yield this.iModel.executeQuery("SELECT ECInstanceId as id FROM " + Element.sqlName + " WHERE Parent.Id=" + this.id.toString()); // WIP: need to bind!
            if (error || !rows) {
                Assert_1.assert(false);
                return Promise.resolve([]);
            }
            const childIds = [];
            JSON.parse(rows).forEach((row) => childIds.push(new IModel_1.Id(row.id))); // WIP: executeQuery should return eCInstanceId as a string
            return Promise.resolve(childIds);
        });
    }
    /** Get the Model that modeling this Element (if it exists). That is, the model that is beneath this element in the hierarchy. */
    getSubModel() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.id.equals(this.iModel.elements.rootSubjectId))
                return { result: undefined };
            return this.iModel.models.getModel({ id: this.id });
        });
    }
}
exports.Element = Element;
/** A Geometric element. All geometry held by a GeometricElement is positioned relative to its placement. */
class GeometricElement extends Element {
    constructor(props) {
        super(props);
        this.category = new IModel_1.Id(props.category);
        this.geom = IModel_1.GeometryStream.fromJSON(props.geom);
    }
}
exports.GeometricElement = GeometricElement;
/** A RelatedElement that describes the type definition of an element. */
class TypeDefinition extends RelatedElement {
    constructor(definitionId, relationshipClass) { super(definitionId, relationshipClass); }
}
exports.TypeDefinition = TypeDefinition;
/** A Geometric 3d element. */
class GeometricElement3d extends GeometricElement {
    constructor(props) {
        super(props);
        this.placement = IModel_1.Placement3d.fromJSON(props.placement);
        if (props.typeDefinition)
            this.typeDefinition = TypeDefinition.fromJSON(props.typeDefinition);
    }
}
exports.GeometricElement3d = GeometricElement3d;
/** A Geometric 2d element. */
class GeometricElement2d extends GeometricElement {
    constructor(props) {
        super(props);
        this.placement = IModel_1.Placement2d.fromJSON(props.placement);
        if (props.typeDefinition)
            this.typeDefinition = TypeDefinition.fromJSON(props.typeDefinition);
    }
}
exports.GeometricElement2d = GeometricElement2d;
class SpatialElement extends GeometricElement3d {
    constructor(props) { super(props); }
}
exports.SpatialElement = SpatialElement;
class PhysicalElement extends SpatialElement {
    constructor(props) { super(props); }
}
exports.PhysicalElement = PhysicalElement;
class PhysicalPortion extends PhysicalElement {
    constructor(props) { super(props); }
}
exports.PhysicalPortion = PhysicalPortion;
/** A SpatialElement that identifies a tracked real word 3-dimensional location but has no mass and cannot be touched.
 *  Examples include grid lines, parcel boundaries, and work areas.
 */
class SpatialLocationElement extends SpatialElement {
    constructor(props) { super(props); }
}
exports.SpatialLocationElement = SpatialLocationElement;
/** A SpatialLocationPortion represents an arbitrary portion of a larger SpatialLocationElement that will be broken down in
 *  more detail in a separate (sub) SpatialLocationModel.
 */
class SpatialLocationPortion extends SpatialLocationElement {
    constructor(props) { super(props); }
}
exports.SpatialLocationPortion = SpatialLocationPortion;
/** An InformationContentElement identifies and names information content.
 * @see InformationCarrierElement
 */
class InformationContentElement extends Element {
    constructor(props) { super(props); }
}
exports.InformationContentElement = InformationContentElement;
class InformationReferenceElement extends InformationContentElement {
    constructor(props) { super(props); }
}
exports.InformationReferenceElement = InformationReferenceElement;
class Subject extends InformationReferenceElement {
    constructor(props) { super(props); }
}
exports.Subject = Subject;
/** A Document is an InformationContentElement that identifies the content of a document.
 * The realized form of a document is called a DocumentCarrier (different class than Document).
 * For example, a will is a legal document. The will published into a PDF file is an ElectronicDocumentCopy.
 * The will printed onto paper is a PrintedDocumentCopy.
 * In this example, the Document only identifies, names, and tracks the content of the will.
 */
class Document extends InformationContentElement {
    constructor(props) { super(props); }
}
exports.Document = Document;
class Drawing extends Document {
    constructor(props) { super(props); }
}
exports.Drawing = Drawing;
class SectionDrawing extends Drawing {
    constructor(props) { super(props); }
}
exports.SectionDrawing = SectionDrawing;
/** An InformationCarrierElement is a proxy for an information carrier in the physical world.
 *  For example, the arrangement of ink on a paper document or an electronic file is an information carrier.
 *  The content is tracked separately from the carrier.
 *  @see InformationContentElement
 */
class InformationCarrierElement extends Element {
    constructor(props) { super(props); }
}
exports.InformationCarrierElement = InformationCarrierElement;
/** An information element whose main purpose is to hold an information record. */
class InformationRecordElement extends InformationContentElement {
    constructor(props) { super(props); }
}
exports.InformationRecordElement = InformationRecordElement;
/** A DefinitionElement resides in (and only in) a DefinitionModel. */
class DefinitionElement extends InformationContentElement {
    constructor(props) { super(props); }
}
exports.DefinitionElement = DefinitionElement;
class TypeDefinitionElement extends DefinitionElement {
    constructor(props) { super(props); }
}
exports.TypeDefinitionElement = TypeDefinitionElement;
class RecipeDefinitionElement extends DefinitionElement {
    constructor(props) { super(props); }
}
exports.RecipeDefinitionElement = RecipeDefinitionElement;
/** A PhysicalType typically corresponds to a @em type of physical object that can be ordered from a catalog.
 *  The PhysicalType system is also a database normalization strategy because properties that are the same
 *  across all instances are stored with the PhysicalType versus being repeated per PhysicalElement instance.
 */
class PhysicalType extends TypeDefinitionElement {
    constructor(props) { super(props); }
}
exports.PhysicalType = PhysicalType;
/** The SpatialLocationType system is a database normalization strategy because properties that are the same
 *  across all instances are stored with the SpatialLocationType versus being repeated per SpatialLocationElement instance.
 */
class SpatialLocationType extends TypeDefinitionElement {
    constructor(props) { super(props); }
}
exports.SpatialLocationType = SpatialLocationType;
class TemplateRecipe3d extends RecipeDefinitionElement {
    constructor(props) { super(props); }
}
exports.TemplateRecipe3d = TemplateRecipe3d;
class GraphicalType2d extends TypeDefinitionElement {
    constructor(props) { super(props); }
}
exports.GraphicalType2d = GraphicalType2d;
class TemplateRecipe2d extends RecipeDefinitionElement {
    constructor(props) { super(props); }
}
exports.TemplateRecipe2d = TemplateRecipe2d;
class InformationPartitionElement extends InformationContentElement {
    constructor(props) { super(props); }
}
exports.InformationPartitionElement = InformationPartitionElement;
/** A DefinitionPartition provides a starting point for a DefinitionModel hierarchy
 *  @note DefinitionPartition elements only reside in the RepositoryModel
 */
class DefinitionPartition extends InformationPartitionElement {
    constructor(props) { super(props); }
}
exports.DefinitionPartition = DefinitionPartition;
/** A DocumentPartition provides a starting point for a DocumentListModel hierarchy
 *  @note DocumentPartition elements only reside in the RepositoryModel
 */
class DocumentPartition extends InformationPartitionElement {
    constructor(props) { super(props); }
}
exports.DocumentPartition = DocumentPartition;
/** A GroupInformationPartition provides a starting point for a GroupInformationModel hierarchy
 *  @note GroupInformationPartition elements only reside in the RepositoryModel
 */
class GroupInformationPartition extends InformationPartitionElement {
    constructor(props) { super(props); }
}
exports.GroupInformationPartition = GroupInformationPartition;
/** An InformationRecordPartition provides a starting point for a InformationRecordModel hierarchy
 *  @note InformationRecordPartition elements only reside in the RepositoryModel
 */
class InformationRecordPartition extends InformationPartitionElement {
    constructor(props) { super(props); }
}
exports.InformationRecordPartition = InformationRecordPartition;
/** A PhysicalPartition provides a starting point for a PhysicalModel hierarchy
 *  @note PhysicalPartition elements only reside in the RepositoryModel
 */
class PhysicalPartition extends InformationPartitionElement {
    constructor(props) { super(props); }
}
exports.PhysicalPartition = PhysicalPartition;
/** A SpatialLocationPartition provides a starting point for a SpatialLocationModel hierarchy
 *  @note SpatialLocationPartition elements only reside in the RepositoryModel
 */
class SpatialLocationPartition extends InformationPartitionElement {
    constructor(props) { super(props); }
}
exports.SpatialLocationPartition = SpatialLocationPartition;
/** A GroupInformationElement resides in (and only in) a GroupInformationModel. */
class GroupInformationElement extends InformationReferenceElement {
    constructor(props) { super(props); }
}
exports.GroupInformationElement = GroupInformationElement;
/** Abstract base class for roles played by other (typically physical) elements.
 *  For example:
 *  - <i>Lawyer</i> and <i>employee</i> are potential roles of a person
 *  - <i>Asset</i> and <i>safety hazard</i> are potential roles of a PhysicalElement
 */
class RoleElement extends Element {
    constructor(props) { super(props); }
}
exports.RoleElement = RoleElement;
/** A LinkPartition provides a starting point for a LinkModel hierarchy */
class LinkPartition extends InformationPartitionElement {
    constructor(props) { super(props); }
}
exports.LinkPartition = LinkPartition;
