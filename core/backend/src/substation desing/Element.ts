/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {  Id64String } from "@bentley/bentleyjs-core";
import {
  DefinitionElement,  FunctionalComponentElement, FunctionalModel, IModelDb, PhysicalElement, PhysicalElementIsOfType, PhysicalModel, PhysicalType,
  TemplateRecipe3d,
} from "../imodeljs-backend";
import {
  Code, CodeScopeProps, CodeSpec, DefinitionElementProps, ElementAspectProps, ElementProps, FunctionalElementProps, GeometricModel3dProps, ModelProps,
  PhysicalElementProps, PhysicalTypeProps, RelatedElement, RelatedElementProps,
} from "@bentley/imodeljs-common";

/** Enum containing the full class names from the Substation schema.
 * @note This is a temporary solution - generally each class should have it's domain class implementation.
 */
export enum SubstationFullClassNames {
  ElectricalEquipmentDefinition = "Substation:ElectricalEquipmentDefinition",

  // Definition - Type relationships
  PhysicalTypeReference = "Substation:PhysicalTypeReference",

  // Types
  ElectricalPhysicalType = "Substation:ElectricalPhysicalType",
  DistributionTransformerPhysicalType = "Substation:DistributionTransformerPhysicalType",
  DisconnectingCircuitBreakerPhysicalType = "Substation:DisconnectingCircuitBreakerPhysicalType",
  SurgeArresterPhysicalType = "Substation:SurgeArresterPhysicalType",

  // Recipes
  ElectricalPhysicalRecipe = "Substation:ElectricalPhysicalRecipe",

  // Physical Recipe contents // Physical geometry-oriented
  ElectricalGeometry3d = "Substation:ElectricalGeometry3d",
  ElectricalAnchorPoint3d = "Substation:ElectricalAnchorPoint3d",

  // Physical/Functional bases
  ElectricalPhysicalEquipment = "Substation:ElectricalPhysicalEquipment",
  ElectricalFunctionalEquipment = "Substation:ElectricalFunctionalEquipment",

  // Physical
  DistributionTransformer = "Substation:DistributionTransformer",
  DisconnectingCircuitBreaker = "Substation:DisconnectingCircuitBreaker",
  SurgeArrester = "Substation:SurgeArrester",

  // Concrete Functional
  DistributionTransformerFunctional = "Substation:DistributionTransformerFunctional",
  DisconnectingCircuitBreakerFunctional = "Substation:DisconnectingCircuitBreakerFunctional",
  SurgeArresterFunctional = "Substation:SurgeArresterFunctional",

  // Aspects
  CompatibleEquipmentDefinition = "Substation:CompatibleEquipmentDefinition",
}

export enum BisFullClassNames {
  PhysicalTypeHasTemplateRecipe = "BisCore:PhysicalTypeHasTemplateRecipe",
}

/** Enum containing the names of the standard CodeSpec created by this domain.
 * @note It is a best practice is to use a namespace to ensure CodeSpec uniqueness.
 */
export enum CodeSpecName {
  DefinitionContainer = "BisCore.DefinitionContainer", // eslint-disable-line no-shadow
  ElectricalEquipment = "Substation:ElectricalEquipment",
  ElectricalEquipmentDefinition = "Substation:ElectricalEquipmentDefinition",
  ElectricalFunctionalEquipment = "Substation:ElectricalFunctionalEquipment",
  ElectricalPhysicalType = "Substation:ElectricalPhysicalType",
  ElectricalPhysicalRecipe = "Substation:ElectricalPhysicalRecipe",
  PhysicalContainer = "Substation:PhysicalContainer",
  FunctionalContainer = "Substation:FunctionalContainer",
  DefinitionGroup = "BisCore:DefinitionGroup",
}

export type EquipmentDefinitionHasPhysicalTypeProps = RelatedElementProps;

/** Relates a [[ElectricalEquipmentDefinition]] to its [[PhysicalType]]
 * @public
 */
export class PhysicalTypeReference extends RelatedElement implements EquipmentDefinitionHasPhysicalTypeProps {
  public static classFullName = SubstationFullClassNames.PhysicalTypeReference;

  public constructor(id: Id64String, relClassName: string = SubstationFullClassNames.PhysicalTypeReference) {
    super({ id, relClassName });
  }

  public static fromJSON(json: EquipmentDefinitionHasPhysicalTypeProps): PhysicalTypeReference {
    return new PhysicalTypeReference(super.fromJSON(json)!.id);
  }
}

export interface ElectricalEquipmentDefinitionProps extends DefinitionElementProps {
  physicalType: EquipmentDefinitionHasPhysicalTypeProps;
}

/** The Substation:ElectricalEquipmentDefinition class representation.
 */
export class ElectricalEquipmentDefinition extends DefinitionElement implements ElectricalEquipmentDefinitionProps {
  /** @internal */
  public static get classFullName(): string { return SubstationFullClassNames.ElectricalEquipmentDefinition; }
  public static get className(): string { return "ElectricalEquipmentDefinition"; }
  public static get schemaName(): string { return "Substation"; }
  // TODO - figure out how to 'dereference' the real types correctly...
  // public physicalType: ElectricalPhysicalType;

  public physicalType: EquipmentDefinitionHasPhysicalTypeProps;

  public constructor(props: ElectricalEquipmentDefinitionProps, iModel: IModelDb) {
    super(props, iModel);

    this.physicalType = PhysicalTypeReference.fromJSON(props.physicalType);
  }

  /** Create a Code for a ElectricalEquipmentDefinition given a name that is meant to be unique within the scope of its Model.
   * @param iModelDb The IModelDb
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that contains this ElectricalEquipmentDefinition element.
   * @param codeValue The name of the ElectricalEquipmentDefinition element.
   */
  public static createCode(iModelDb: IModelDb, definitionModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModelDb.codeSpecs.getByName(CodeSpecName.ElectricalEquipmentDefinition);
    return new Code({ spec: codeSpec.id, scope: definitionModelId, value: codeValue });
  }

  /** Create a ElectricalEquipmentDefinition
   * @param iModelDb The IModelDb.
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that contains this ElectricalEquipmentDefinition element.
   * @param name The name (Code.value) of the ElectricalEquipmentDefinition.
   * @param physicalTypeId The Physical Type to associate this EquipmentDefinition with (via PhysicalTypeReference).
   * @param userLabel The User Label for this Equipment Definition.
   * @param isPrivate If true, don't show this DefinitionElement in user interface lists.
   * @returns The newly constructed ElectricalEquipmentDefinition
   * @throws [[IModelError]] if there is a problem creating the ElectricalEquipmentDefinition
   */
  public static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string, physicalTypeId: Id64String, userLabel?: string, isPrivate?: boolean): ElectricalEquipmentDefinition {
    const elementProps: ElectricalEquipmentDefinitionProps = {
      classFullName: this.classFullName,
      model: definitionModelId,
      code: this.createCode(iModelDb, definitionModelId, name),
      isPrivate,
      physicalType: new PhysicalTypeReference(physicalTypeId),
      userLabel,
    };
    return new ElectricalEquipmentDefinition(elementProps, iModelDb);
  }

  /** Insert a ElectricalEquipmentDefinition into the specified definition model.
   * @param iModelDb The IModelDb.
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that contains this ElectricalEquipmentDefinition element.
   * @param name The name (Code.value) of the ElectricalEquipmentDefinition.
   * @param physicalTypeId The Physical Type to associate this EquipmentDefinition with (via PhysicalTypeReference).
   * @param userLabel The User Label for this Equipment Definition.
   * @param isPrivate If true, don't show this DefinitionElement in user interface lists.
   * @returns The Id of the newly inserted ElectricalEquipmentDefinition.
   * @throws [[IModelError]] if there is a problem inserting the ElectricalEquipmentDefinition.
   */
  public static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, physicalTypeId: Id64String, userLabel?: string, isPrivate?: boolean): Id64String {
    const element = this.create(iModelDb, definitionModelId, name, physicalTypeId, userLabel, isPrivate);
    return iModelDb.elements.insertElement(element);
  }
}

export enum SymbolType {
  Layout_3D = "3D Layout",
  Schematic = "Schematic",
  SingleLine = "SingleLine"
}

interface ElectricalPhysicalTypeAspectProps extends ElementAspectProps {
  /** Equipment definition code e.g. ACME Breaker */
  equipmentDefinitionCode: string;
  /** 3D or 2D symbol */
  symbolType: SymbolType;
}

export interface PhysicalTypeProperties {
  [key: string]: string;
}

export type ElectricalPhysicalTypeDefinesElectricalEquipmentDefinition = RelatedElementProps;

export interface ElectricalPhysicalTypeProps extends PhysicalTypeProps {
  /** The full class name of a Physical Element that matches this type. */
  physicalClassName: string;
}

/** The Substation:ElectricalPhysicalType class representation.
 */
export class ElectricalPhysicalType extends PhysicalType implements PhysicalTypeProps {
  /** @internal */
  public static get classFullName(): string { return SubstationFullClassNames.ElectricalPhysicalType; }
  public static get className(): string { return "ElectricalPhysicalType"; }
  public static get schemaName(): string { return "Substation"; }
  public physicalClassName: string;

  public constructor(props: ElectricalPhysicalTypeProps, iModel: IModelDb) {
    super(props, iModel);
    this.physicalClassName = props.physicalClassName;
  }

  /** Create a Code for a ElectricalPhysicalType given a name that is meant to be unique within the scope of its Model.
 * @param iModelDb The IModelDb
 * @param definitionModelId The Id of the [DefinitionModel]($backend) that contains this ElectricalPhysicalType element.
 * @param codeValue The name of the ElectricalPhysicalType element.
 */
  public static createCode(iModelDb: IModelDb, definitionModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModelDb.codeSpecs.getByName(CodeSpecName.ElectricalPhysicalType);
    return new Code({ spec: codeSpec.id, scope: definitionModelId, value: codeValue });
  }

  /** Create a ElectricalPhysicalType
   * @param iModelDb The IModelDb
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that contains this ElectricalPhysicalType element.
   * @param codeValue The name (Code.Value) of the ElectricalPhysicalType.
   * @param templateRecipeId The Template Recipe to be used for this Physical Type.
   * @param className The non-fully-qualified Physical Type Class to be used then creating this PhysicalType element (a subclass of ElectricalPhysicalType).
   * @param physicalClassName The Physical Class to be used then instantiating the Equipment being placed. It's stored as a string, and used for the target Physical element.
   * @param props Properties for given PhysicalType.
   * @param isPrivate If true, don't show this DefinitionElement in user interface lists.
   * @returns The newly constructed ElectricalPhysicalType
   * @throws [[IModelError]] if there is a problem creating the ElectricalPhysicalType
   */
  public static create(iModelDb: IModelDb, definitionModelId: Id64String, codeValue: string, templateRecipeId: Id64String | undefined, className: string,
    physicalClassName: string, props?: PhysicalTypeProperties | undefined, isPrivate?: boolean): ElectricalPhysicalType {

    const classFullName = `${this.schemaName}:${className}`;
    const elementProps: ElectricalPhysicalTypeProps = {
      ...props,
      classFullName,
      model: definitionModelId,
      code: this.createCode(iModelDb, definitionModelId, codeValue),
      isPrivate,
      recipe: templateRecipeId === undefined ? undefined : { id: templateRecipeId, relClassName: BisFullClassNames.PhysicalTypeHasTemplateRecipe },
      physicalClassName: physicalClassName.startsWith(this.schemaName) ? physicalClassName : `${this.schemaName}:${physicalClassName}`,
    };

    return new class extends ElectricalPhysicalType {
      public static get classFullName() { return classFullName; }
      public static get className() { return className; }
    }(elementProps, iModelDb);
  }

  /** Insert a ElectricalPhysicalType into the specified definition model.
   * @param iModelDb The IModelDb
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that contains this ElectricalPhysicalType element.
   * @param codeValue The name (Code.Value) of the ElectricalPhysicalType.
   * @param templateRecipeId The Template Recipe to be used for this Physical Type.
   * @param className The non-fully-qualified Physical Type Class to be used then creating this PhysicalType element (a subclass of ElectricalPhysicalType).
   * @param physicalClassName The Physical Class to be used then instantiating the Equipment being placed. It's stored as a string, and used for the target Physical element.
   * @param isPrivate If true, don't show this DefinitionElement in user interface lists.
   * @returns The Id of the newly inserted ElectricalPhysicalType.
   * @throws [[IModelError]] if there is a problem inserting the ElectricalPhysicalType.
   */
  public static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, templateRecipeId: Id64String | undefined, className: string,
    physicalClassName: string, props?: PhysicalTypeProperties | undefined, isPrivate?: boolean): Id64String {
    const element = this.create(iModelDb, definitionModelId, name, templateRecipeId, className, physicalClassName, props, isPrivate);
    return iModelDb.elements.insertElement(element);
  }

  /**
   * Insert aspects for given physical type,
   * @param iModelDb The IModelDb
   * @param physicalTypeId The Id of the Physical Type that will contain the aspects.
   * @param equipmentDefinitionCode The name (Code.Value) of the ElectricalEquipmentDefinition which relates with this Physical Type.
   * @param symbolType The type of symbol.
   * @throws [[IModelError]] if there is a problem inserting the Aspects.
   */
  public static insertCompatibleEquipmentDefinitionAspect(iModelDb: IModelDb, physicalTypeId: Id64String, equipmentDefinitionCode: string, symbolType: SymbolType) {
    const aspectProps: ElectricalPhysicalTypeAspectProps = {
      classFullName: SubstationFullClassNames.CompatibleEquipmentDefinition,
      element: { id: physicalTypeId, relClassName: "BisCore:ElementOwnsMultiAspects" },
      equipmentDefinitionCode,
      symbolType,
    };

    return iModelDb.elements.insertAspect(aspectProps);
  }
}

/** The Substation:ElectricalEquipmentFunctional class representation.
 */
export class ElectricalFunctionalEquipment extends FunctionalComponentElement implements FunctionalElementProps {
  /** @internal */
  public static get classFullName(): string { return SubstationFullClassNames.ElectricalFunctionalEquipment; }
  public static get className(): string { return "ElectricalEquipmentFunctional"; }
  public static get schemaName(): string { return "Substation"; }

  public constructor(props: FunctionalElementProps, iModel: IModelDb) {
    super(props, iModel);
  }

  /** Create a Code for a ElectricalFunctionalEquipment given a name that is meant to be unique within the scope of its Model.
 * @param iModelDb The IModelDb
 * @param functionalModelId The Id of the [DefinitionModel]($backend) that contains this ElectricalFunctionalEquipment element.
 * @param codeValue The name of the ElectricalFunctionalEquipment element.
 */
  public static createCode(iModelDb: IModelDb, functionalModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModelDb.codeSpecs.getByName(CodeSpecName.ElectricalFunctionalEquipment);
    return new Code({ spec: codeSpec.id, scope: functionalModelId, value: codeValue });
  }

  /** Create a ElectricalFunctionalEquipment
   * @param iModelDb The IModelDb
   * @param functionalModelId The Id of the [FunctionalModel]($backend) that contains this ElectricalFunctionalEquipment element.
   * @param codeValue The name (Code.Value) of the ElectricalFunctionalEquipment
   * @param className The non-fully-qualified Functional Class to be used then creating this Functional element (a subclass of ElectricalFunctionalEquipment).
   * @returns The newly constructed ElectricalFunctionalEquipment
   * @throws [[IModelError]] if there is a problem creating the ElectricalFunctionalEquipment
   */
  public static create(iModelDb: IModelDb, functionalModelId: Id64String, codeValue: string, className: string): ElectricalFunctionalEquipment {
    const classFullName = `${this.schemaName}:${className}`;
    const elementProps: FunctionalElementProps = {
      classFullName,
      model: functionalModelId,
      code: this.createCode(iModelDb, functionalModelId, codeValue),
    };

    return new class extends ElectricalFunctionalEquipment {
      public static get classFullName() { return classFullName; }
      public static get className() { return className; }
    }(elementProps, iModelDb);
  }

  /** Insert a ElectricalFunctionalEquipment into the specified definition model.
   * @param iModelDb The IModelDb
   * @param functionalModelId The Id of the [DefinitionModel]($backend) that contains this ElectricalFunctionalEquipment element.
   * @param codeValue The name (Code.Value) of the ElectricalFunctionalEquipment
   * @param className The non-fully-qualified Functional Class to be used then creating this Functional element (a subclass of ElectricalFunctionalEquipment).
   * @returns The Id of the newly inserted ElectricalFunctionalEquipment.
   * @throws [[IModelError]] if there is a problem inserting the ElectricalFunctionalEquipment.
   */
  public static insert(iModelDb: IModelDb, functionalModelId: Id64String, codeValue: string, className: string): Id64String {
    const element = this.create(iModelDb, functionalModelId, codeValue, className);
    return iModelDb.elements.insertElement(element);
  }
}

/** The Substation:ElectricalPhysicalRecipe class representation.
 * @public
 */
export class ElectricalPhysicalRecipe extends TemplateRecipe3d {
  /** @internal */
  public static get classFullName(): string { return SubstationFullClassNames.ElectricalPhysicalRecipe; }
  public static get className(): string { return "ElectricalPhysicalRecipe"; }
  public static get schemaName(): string { return "Substation"; }

  public constructor(props: ElementProps, iModel: IModelDb) {
    super(props, iModel);
  }

  /** Create a Code for a ElectricalPhysicalRecipe given a name that is meant to be unique within the scope of its Model.
   * @param iModelDb The IModelDb
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that contains this ElectricalPhysicalRecipe element.
   * @param codeValue The name of the ElectricalPhysicalRecipe element.
   */
  public static createCode(iModelDb: IModelDb, definitionModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModelDb.codeSpecs.getByName(CodeSpecName.ElectricalPhysicalRecipe);
    return new Code({ spec: codeSpec.id, scope: definitionModelId, value: codeValue });
  }

  /** Create a ElectricalPhysicalRecipe
   * @param iModelDb The IModelDb
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that contains this ElectricalPhysicalRecipe element.
   * @param name The name (Code.value) of the ElectricalPhysicalRecipe
   * @returns The newly constructed ElectricalPhysicalRecipe
   * @throws [[IModelError]] if there is a problem creating the ElectricalPhysicalRecipe
   */
  public static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string, isPrivate?: boolean): ElectricalPhysicalRecipe {
    const elementProps: DefinitionElementProps = {
      classFullName: this.classFullName,
      model: definitionModelId,
      code: this.createCode(iModelDb, definitionModelId, name),
      isPrivate,
    };
    return new ElectricalPhysicalRecipe(elementProps, iModelDb);
  }

  /** Insert a ElectricalPhysicalRecipe and a PhysicalModel (sub-model) that will contain the 3d template elements.
   * @param iModelDb The IModelDb
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that contains this ElectricalPhysicalRecipe element.
   * @param name The name (Code.value) of the ElectricalPhysicalRecipe
   * @returns The Id of the newly inserted ElectricalPhysicalRecipe and the PhysicalModel that sub-models it.
   * @throws [[IModelError]] if there is a problem inserting the ElectricalPhysicalRecipe or its sub-model.
   */
  public static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, isPrivate?: boolean): Id64String {
    const element = this.create(iModelDb, definitionModelId, name, isPrivate);
    const modeledElementId: Id64String = iModelDb.elements.insertElement(element);
    const modelProps: GeometricModel3dProps = {
      classFullName: PhysicalModel.classFullName,
      modeledElement: { id: modeledElementId },
      isTemplate: true,
    };
    return iModelDb.models.insertModel(modelProps); // will be the same value as modeledElementId
  }
}

export class ElectricalPhysicalEquipment extends PhysicalElement implements PhysicalElementProps {
  /** @internal */
  public static get classFullName(): string { return SubstationFullClassNames.ElectricalPhysicalEquipment; }
  public static get className(): string { return "ElectricalPhysicalEquipment"; }
  public static get schemaName(): string { return "Substation"; }

  constructor(props: PhysicalElementProps, iModel: IModelDb) {
    super(props, iModel);
  }

  /** Create a Code for a ElectricalPhysicalEquipment given a name that is meant to be unique within the scope of its Model.
 * @param iModelDb The IModelDb.
 * @param physicalModelId The Id of the [PhysicalModel]($backend) that contains this ElectricalPhysicalEquipment element.
 * @param codeValue The code value of the ElectricalPhysicalEquipment element.
 */
  public static createCode(iModelDb: IModelDb, physicalModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModelDb.codeSpecs.getByName(CodeSpecName.ElectricalEquipment);
    return new Code({ spec: codeSpec.id, scope: physicalModelId, value: codeValue });
  }

  /** Create a ElectricalPhysicalEquipment
 * @param iModelDb The IModelDb.
 * @param physicalModelId The Id of the [PhysicalModel]($backend) that contains this ElectricalPhysicalEquipment element.
 * @param codeValue The code value of the ElectricalPhysicalEquipment.
 * @param categoryId The Spatial Category to be used for this Physical element.
 * @param physicalTypeId The Physical Type to be used for this Physical element.
 * @param className The non-fully-qualified Physical Class to be used then creating this Physical element (a subclass of ElectricalEquipment).
 * @param userLabel The User Label for this Equipment.
 * @returns The newly constructed ElectricalPhysicalEquipment.
 * @throws [[IModelError]] if there is a problem creating the ElectricalPhysicalEquipment
 */
  public static create(iModelDb: IModelDb, physicalModelId: Id64String, codeValue: string, categoryId: string, physicalTypeId: Id64String, className: string, userLabel?: string) {
    const classFullName = `${this.schemaName}:${className}`;
    const elementProps: PhysicalElementProps = {
      classFullName,
      model: physicalModelId,
      code: this.createCode(iModelDb, physicalModelId, codeValue),
      category: categoryId,
      userLabel,
      typeDefinition: new PhysicalElementIsOfType(physicalTypeId),
    };
    return new class extends ElectricalPhysicalEquipment {
      public static get classFullName() { return classFullName; }
      public static get className() { return className; }
    }(elementProps, iModelDb) as ElectricalPhysicalEquipment;
  }

  /** Insert a ElectricalPhysicalEquipment into the specified definition model.
 * @param iModelDb The IModelDb
 * @param physicalModelId The Id of the [PhysicalModel]($backend) that contains this ElectricalPhysicalEquipment element.
 * @param codeValue The code value of the ElectricalPhysicalEquipment.
 * @param categoryId The Spatial Category to be used for this Physical element.
 * @param physicalTypeId The Physical Type to be used for this Physical element.
 * @param className The non-fully-qualified Physical Class to be used then creating this Physical element (a subclass of ElectricalEquipment).
 * @param userLabel The User Label for this Equipment.
 * @returns The Id of the newly inserted ElectricalPhysicalEquipment.
 * @throws [[IModelError]] if there is a problem inserting the ElectricalPhysicalEquipment.
 */
  public static insert(iModelDb: IModelDb, physicalModelId: Id64String, codeValue: string, categoryId: string, physicalTypeId: Id64String, className: string, userLabel?: string): Id64String {
    const element = this.create(iModelDb, physicalModelId, codeValue, categoryId, physicalTypeId, className, userLabel);
    return iModelDb.elements.insertElement(element);
  }
}

export class PhysicalContainer extends DefinitionElement {
  /** @internal */
  public static get className(): string { return "PhysicalContainer"; }
  public static get schemaName(): string { return "Substation"; }
  /** @internal */
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
  /** Create a Code for a PhysicalContainer given a name that is meant to be unique within the scope of its Model.
   * @param iModelDb The IModelDb.
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that contains this PhysicalContainer element.
   * @param codeValue The name of the PhysicalContainer element.
   */
  public static createCode(iModelDb: IModelDb, definitionModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModelDb.codeSpecs.getByName(CodeSpecName.PhysicalContainer);
    return new Code({ spec: codeSpec.id, scope: definitionModelId, value: codeValue });
  }

  /** Create a PhysicalContainer
   * @param iModelDb The IModelDb.
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that contains this PhysicalContainer element.
   * @param name The name (Code.Value) of the PhysicalContainer.
   * @returns The newly constructed PhysicalContainer.
   * @throws [[IModelError]] if there is a problem creating the PhysicalContainer.
   */
  public static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string, isPrivate?: boolean): PhysicalContainer {
    const elementProps: DefinitionElementProps = {
      classFullName: this.classFullName,
      model: definitionModelId,
      code: this.createCode(iModelDb, definitionModelId, name),
      isPrivate,
    };
    return new PhysicalContainer(elementProps, iModelDb);
  }

  /** Insert a PhysicalContainer and a PhysicalModel (sub-model) that will contain the 3d template elements.
   * @param iModelDb The IModelDb.
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that contains this PhysicalContainer element.
   * @param name The name (Code.Value) of the PhysicalContainer.
   * @returns The Id of the newly inserted PhysicalContainer and the PhysicalModel that sub-models it.
   * @throws [[IModelError]] if there is a problem inserting the PhysicalContainer or its sub-model.
   */
  public static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, isPrivate?: boolean): Id64String {
    const element = this.create(iModelDb, definitionModelId, name, isPrivate);
    const modeledElementId: Id64String = iModelDb.elements.insertElement(element);
    const modelProps: GeometricModel3dProps = {
      classFullName: PhysicalModel.classFullName,
      modeledElement: { id: modeledElementId },
      isTemplate: true,
    };
    return iModelDb.models.insertModel(modelProps); // will be the same value as modeledElementId
  }
}

export class FunctionalContainer extends DefinitionElement {
  /** @internal */
  public static get className(): string { return "FunctionalContainer"; }
  public static get schemaName(): string { return "Substation"; }
  /** @internal */
  public constructor(props: ElementProps, iModel: IModelDb) { super(props, iModel); }
  /** Create a Code for a FunctionalContainer given a name that is meant to be unique within the scope of its Model.
   * @param iModelDb The IModelDb.
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that contains this FunctionalContainer element.
   * @param codeValue The name of the FunctionalContainer element.
   */
  public static createCode(iModelDb: IModelDb, definitionModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModelDb.codeSpecs.getByName(CodeSpecName.FunctionalContainer);
    return new Code({ spec: codeSpec.id, scope: definitionModelId, value: codeValue });
  }

  /** Create a FunctionalContainer
   * @param iModelDb The IModelDb.
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that contains this FunctionalContainer element.
   * @param name The name (Code.value) of the FunctionalContainer.
   * @returns The newly constructed FunctionalContainer.
   * @throws [[IModelError]] if there is a problem creating the FunctionalContainer.
   */
  public static create(iModelDb: IModelDb, definitionModelId: Id64String, name: string, isPrivate?: boolean): FunctionalContainer {
    const elementProps: DefinitionElementProps = {
      classFullName: this.classFullName,
      model: definitionModelId,
      code: this.createCode(iModelDb, definitionModelId, name),
      isPrivate,
    };
    return new FunctionalContainer(elementProps, iModelDb);
  }

  /** Insert a FunctionalContainer and a FunctionalModel (sub-model) that will contain the 3d template elements.
   * @param iModelDb The IModelDb.
   * @param definitionModelId The Id of the [DefinitionModel]($backend) that contains this FunctionalContainer element.
   * @param name The name (Code.value) of the FunctionalContainer.
   * @returns The Id of the newly inserted FunctionalContainer and the FunctionalModel that sub-models it.
   * @throws [[IModelError]] if there is a problem inserting the FunctionalContainer or its sub-model.
   */
  public static insert(iModelDb: IModelDb, definitionModelId: Id64String, name: string, isPrivate?: boolean): Id64String {
    const element = this.create(iModelDb, definitionModelId, name, isPrivate);
    const modeledElementId: Id64String = iModelDb.elements.insertElement(element);
    const modelProps: ModelProps = {
      classFullName: FunctionalModel.classFullName,
      modeledElement: { id: modeledElementId },
      isTemplate: true,
    };
    return iModelDb.models.insertModel(modelProps); // will be the same value as modeledElementId
  }
}

/**
 * Dynamic element props.
 * These props are intended to be used in insertElement/updateElement operations.
 *
 * Since there's 100+ Substation Classes, with different properties, we're not planning to have explicit ts wrappers for all of them.
 * Also, most of insert/update operations would have a 'generalized' input (e.g. an array of properties to update).
 *
 * In a sense these are not 'dynamic', as in they are strongly typed in the schema - we just don't have explicit props.
 *
 * A code sample would be:
 *    const elementProps = iModelDb.elements.getElementProps(placedBreakerEquipmentId);
      const dynamicProps: DynamicElementProps = {
        ...elementProps,
        ...typeSpecificProps, // of type { [key: string]: any }
      };
      iModelDb.elements.updateElement(dynamicProps);

  Or, properties could be set on the `dynamicProps` like so:
      dynamicProps[propName] = propValue;
 */
export interface DynamicElementProps extends ElementProps {
  [key: string]: any;
}
