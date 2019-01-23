/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { AnyClass, AnyECType } from "../Interfaces";
import { AnyProperty } from "../Metadata/Property";
import { RelationshipConstraint } from "../Metadata/RelationshipClass";
import { CustomAttributeContainerProps } from "../Metadata/CustomAttribute";
import { Schema } from "../Metadata/Schema";
import { SchemaItem } from "../Metadata/SchemaItem";

/**
 * Defines the unique identifiers for all diagnostic types used
 * during schema validation.
 */
export enum DiagnosticCode {
  SCHEMA_RULE_BASE = 0x9858,
  SCHEMA_ITEM_RULE_BASE = 0x98BC,
  CLASS_RULE_BASE = 0x9920,
  PROPERTY_RULE_BASE = 0x9984,
  ENTITY_RULE_BASE = 0x99E8,
  STRUCT_RULE_BASE = 0x9A4C,
  MIXIN_RULE_BASE = 0x9AB0,
  RELATIONSHIP_RULE_BASE = 0x9B14,
  REL_CONSTRAINT_RULE_BASE = 0x9B78,
  CA_CLASS_RULE_BASE = 0x9BDC,
  CA_CONTAINER_RULE_BASE = 0x9C40,
  ENUM_RULE_BASE = 0x9CA4,
  KOQ_RULE_BASE = 0x9D08,
  PROP_CATEGORY_RULE_BASE = 0x9D6C,
  FORMAT_RULE_BASE = 0x9DD0,
  UNIT_RULE_BASE = 0x9E34,
  INVERTED_UNIT_RULE_BASE = 0x9E98,
  UNIT_SYSTEM_RULE_BASE = 0x9EFC,
  PHENOMENON_RULE_BASE = 0x9F60,
  CONSTANT_RULE_BASE = 0x9A4C,

  // Schema Diagnostics
  SchemaXmlVersionMustBeTheLatest = SCHEMA_RULE_BASE + 1,
  SchemaReferencesOldStandardSchema = SCHEMA_RULE_BASE + 2,
  SchemaWithDynamicInNameMustHaveDynamicSchemaCA = SCHEMA_RULE_BASE + 3,
  SchemaClassDisplayLabelMustBeUnique = SCHEMA_RULE_BASE + 4,

  // SchemaItem Diagnostics
  // ...

  // Class Diagnostics
  BaseClassIsSealed = CLASS_RULE_BASE + 1,
  BaseClassOfDifferentType = CLASS_RULE_BASE + 2,

  // Property Diagnostics
  IncompatibleValueTypePropertyOverride = PROPERTY_RULE_BASE + 1,
  IncompatibleTypePropertyOverride = PROPERTY_RULE_BASE + 2,
  IncompatibleUnitPropertyOverride = PROPERTY_RULE_BASE + 3,

  // EntityClass Diagnostics
  MixinAppliedToClassMustDeriveFromConstraint = ENTITY_RULE_BASE + 1,
  EntityClassMustDeriveFromBisHierarchy = ENTITY_RULE_BASE + 2,
  EntityClassMayNotInheritSameProperty = ENTITY_RULE_BASE + 3,
  ElementMultiAspectMustHaveCorrespondingRelationship = ENTITY_RULE_BASE + 4,
  ElementUniqueAspectMustHaveCorrespondingRelationship = ENTITY_RULE_BASE + 5,
  EntityClassesCannotDeriveFromIParentElementAndISubModeledElement = ENTITY_RULE_BASE + 6,

  // StructClass Diagnostics
  // ...

  // Mixin Rule Diagnostics
  MixinsCannotOverrideInheritedProperties = MIXIN_RULE_BASE + 1,

  // Relationship Rule Diagnostics
  AbstractConstraintMustNarrowBaseConstraints = RELATIONSHIP_RULE_BASE + 1,
  DerivedConstraintsMustNarrowBaseConstraints = RELATIONSHIP_RULE_BASE + 2,
  ConstraintClassesDeriveFromAbstractContraint = RELATIONSHIP_RULE_BASE + 3,

  // RelationshipConstraint Diagnostics
  AtLeastOneConstraintClassDefined = REL_CONSTRAINT_RULE_BASE + 1,
  AbstractConstraintMustExistWithMultipleConstraints = REL_CONSTRAINT_RULE_BASE + 2,

  // CustomAttribute Diagnostics
  // ...

  // CustomAttributeContainer Diagnostics
  CustomAttributeNotOfConcreteClass = CA_CONTAINER_RULE_BASE + 1,

  // Enumeration Diagnostics
  InvalidEnumerationType = ENUM_RULE_BASE + 1,

  // KindOfQuantity Diagnostics
  // ...

  // PropertyCategory Diagnostics
  // ...

  // Unit Diagnostics
  // ...

  // InvertedUnit Diagnostics
  // ...

  // UnitSystem Diagnostics
  // ...

  // Phenomenon Diagnostics
  // ...

  // Constant Diagnostics
  // ...
}

/** Defines the possible diagnostic types. */
export const enum DiagnosticType {
  None,
  Schema,
  SchemaItem,
  Property,
  CustomAttributeContainer,
  RelationshipConstraint,
}

/** Defines the possible diagnostic categories. */
export const enum DiagnosticCategory {
  Warning,
  Error,
  Suggestion,
  Message,
}

/**
 * The interface implemented by all diagnostics used during schema validation.
 */
export interface IDiagnostic<TYPE extends AnyECType, ARGS extends any[]> {
  /** The diagnostic category (error, warning, etc...). Value is static across all instances. */
  category: DiagnosticCategory;
  /** The unique identifier of the diagnostic type. Value is static across all instances. */
  code: DiagnosticCode;
  /** The key used to lookup message translations. Value is static across all instances. */
  key: string;
  /** The context type of diagnostic (schema, schema item, property, etc...). Value is static across all instances. */
  diagnosticType: DiagnosticType;
  /** The unformatted message text associated with the diagnostic. Value is static across all instances. */
  messageText: string;
  /** The arguments used when formatted the diagnostic instance's message. */
  messageArgs: ARGS;
  /** The EC object associated with the diagnostic instance. */
  ecDefinition: TYPE;
}

/** Type which encapsulates all possible diagnostics. */
export type AnyDiagnostic = IDiagnostic<AnyECType, any[]>;

/**
 * The abstract base class for all [[IDiagnostic]] implementations.
 */
export abstract class BaseDiagnostic<TYPE extends AnyECType, ARGS extends any[]> implements IDiagnostic<TYPE, ARGS> {
  /**
   * Initializes a new BaseDiagnostic.
   * @param ecDefinition The EC object to associate with the diagnostic.
   * @param messageArgs The arguments used when formatting the diagnostic message.
   */
  constructor(ecDefinition: TYPE, messageArgs: ARGS) {
    this.ecDefinition = ecDefinition;
    this.messageArgs = messageArgs;
  }

  /** Gets the category of the diagnostic. */
  public abstract get category(): DiagnosticCategory;
  /** Gets the unique identifier of the diagnostic type. */
  public abstract get code(): DiagnosticCode;
  /** Gets the key used to lookup message translations. */
  public abstract get key(): string;
  /** Gets the context type of the diagnostic (schema, schema item, property, etc...) */
  public abstract get diagnosticType(): DiagnosticType;
  /** Gets the message associated with the diagnostic. */
  public abstract get messageText(): string;

  /** The EC object to associate with the diagnostic. */
  public ecDefinition: TYPE;
  /** The arguments used when formatting the diagnostic message.  */
  public messageArgs: ARGS;
}

/**
 * An [[IDiagnostic]] implementation used for [[Schema]] diagnostics.
 */
export abstract class SchemaDiagnostic<ARGS extends any[]> extends BaseDiagnostic<Schema, ARGS> {
  public static diagnosticType = DiagnosticType.SchemaItem;

  constructor(schema: Schema, messageArgs: ARGS) {
    super(schema, messageArgs);
  }

  public get diagnosticType(): DiagnosticType { return DiagnosticType.Schema; }
}

/**
 * An [[IDiagnostic]] implementation used for [[SchemaItem]] diagnostics.
 */
export abstract class SchemaItemDiagnostic<TYPE extends AnyECType, ARGS extends any[]> extends BaseDiagnostic<TYPE, ARGS> {
  public static diagnosticType = DiagnosticType.SchemaItem;

  constructor(ecDefinition: TYPE, messageArgs: ARGS) {
    super(ecDefinition, messageArgs);
  }

  public get diagnosticType(): DiagnosticType { return DiagnosticType.SchemaItem; }
}

/**
 * An [[IDiagnostic]] implementation used for [[ECClass]] diagnostics.
 */
export abstract class ClassDiagnostic<ARGS extends any[]> extends SchemaItemDiagnostic<AnyClass, ARGS> {
  constructor(ecClass: AnyClass, messageArgs: ARGS) {
    super(ecClass, messageArgs);
  }
}

/**
 * An [[IDiagnostic]] implementation used for [[Property]] diagnostics.
 */
export abstract class PropertyDiagnostic<ARGS extends any[]> extends BaseDiagnostic<AnyProperty, ARGS> {
  constructor(property: AnyProperty, messageArgs: ARGS) {
    super(property, messageArgs);
  }

  public get diagnosticType(): DiagnosticType { return DiagnosticType.Property; }
}

/**
 * An [[IDiagnostic]] implementation used for [[RelationshipConstraint]] diagnostics.
 */
export abstract class RelationshipConstraintDiagnostic<ARGS extends any[]> extends BaseDiagnostic<RelationshipConstraint, ARGS> {
  constructor(constraint: RelationshipConstraint, messageArgs: ARGS) {
    super(constraint, messageArgs);
  }

  public get diagnosticType(): DiagnosticType { return DiagnosticType.RelationshipConstraint; }
}

/**
 * An [[IDiagnostic]] implementation used for [[CustomAttributeContainerProps]] diagnostics.
 */
export abstract class CustomAttributeContainerDiagnostic<ARGS extends any[]> extends BaseDiagnostic<CustomAttributeContainerProps, ARGS> {
  constructor(container: CustomAttributeContainerProps, messageArgs: ARGS) {
    super(container, messageArgs);
  }

  public get diagnosticType(): DiagnosticType { return DiagnosticType.CustomAttributeContainer; }
}

/**
 * Helper method for creating [[SchemaDiagnostic]] child classes.
 * @param code The [DiagnosticCode] that uniquely identifies the type of diagnostic.
 * @param messageText The message to associate with the diagnostic class.
 * @param category The [[DiagnosticCategory]] to associate with the diagnostic class.
 */
export function createSchemaDiagnosticClass<ARGS extends any[]>(code: DiagnosticCode, messageText: string, category: DiagnosticCategory = DiagnosticCategory.Error) {
  return class extends SchemaDiagnostic<ARGS> {
    public get code(): DiagnosticCode { return code; }
    public get key(): string { return DiagnosticCode[code]; }
    public get category(): DiagnosticCategory { return category; }
    public get messageText(): string { return messageText; }
  };
}

/**
 * Helper method for creating [[SchemaItemDiagnostic]] child classes.
 * @param code The [DiagnosticCode] that uniquely identifies the type of diagnostic.
 * @param messageText The message to associate with the diagnostic class.
 * @param category The [[DiagnosticCategory]] to associate with the diagnostic class.
 */
export function createSchemaItemDiagnosticClass<ITEM extends SchemaItem, ARGS extends any[]>(code: DiagnosticCode, messageText: string, category: DiagnosticCategory = DiagnosticCategory.Error) {
  return class extends SchemaItemDiagnostic<ITEM, ARGS> {
    public get code(): DiagnosticCode { return code; }
    public get key(): string { return DiagnosticCode[code]; }
    public get category(): DiagnosticCategory { return category; }
    public get messageText(): string { return messageText; }
  };
}

/**
 * Helper method for creating [[ClassDiagnostic]] child classes.
 * @param code The [DiagnosticCode] that uniquely identifies the type of diagnostic.
 * @param messageText The message to associate with the diagnostic class.
 * @param category The [[DiagnosticCategory]] to associate with the diagnostic class.
 */
export function createClassDiagnosticClass<ARGS extends any[]>(code: DiagnosticCode, messageText: string, category: DiagnosticCategory = DiagnosticCategory.Error) {
  return class extends ClassDiagnostic<ARGS> {
    public get code(): DiagnosticCode { return code; }
    public get key(): string { return DiagnosticCode[code]; }
    public get category(): DiagnosticCategory { return category; }
    public get messageText(): string { return messageText; }
  };
}

/**
 * Helper method for creating [[PropertyDiagnostic]] child classes.
 * @param code The [DiagnosticCode] that uniquely identifies the type of diagnostic.
 * @param messageText The message to associate with the diagnostic class.
 * @param category The [[DiagnosticCategory]] to associate with the diagnostic class.
 */
export function createPropertyDiagnosticClass<ARGS extends any[]>(code: DiagnosticCode, messageText: string, category: DiagnosticCategory = DiagnosticCategory.Error) {
  return class extends PropertyDiagnostic<ARGS> {
    public get code(): DiagnosticCode { return code; }
    public get key(): string { return DiagnosticCode[code]; }
    public get category(): DiagnosticCategory { return category; }
    public get messageText(): string { return messageText; }
  };
}

/**
 * Helper method for creating [[RelationshipConstraintDiagnostic]] child classes.
 * @param code The [DiagnosticCode] that uniquely identifies the type of diagnostic.
 * @param messageText The message to associate with the diagnostic class.
 * @param category The [[DiagnosticCategory]] to associate with the diagnostic class.
 */
export function createRelationshipConstraintDiagnosticClass<ARGS extends any[]>(code: DiagnosticCode, messageText: string, category: DiagnosticCategory = DiagnosticCategory.Error) {
  return class extends RelationshipConstraintDiagnostic<ARGS> {
    public get code(): DiagnosticCode { return code; }
    public get key(): string { return DiagnosticCode[code]; }
    public get category(): DiagnosticCategory { return category; }
    public get messageText(): string { return messageText; }
  };
}

/**
 * Helper method for creating [[CustomAttributeContainerDiagnostic]] child classes.
 * @param code The [DiagnosticCode] that uniquely identifies the type of diagnostic.
 * @param messageText The message to associate with the diagnostic class.
 * @param category The [[DiagnosticCategory]] to associate with the diagnostic class.
 */
export function createCustomAttributeContainerDiagnosticClass<ARGS extends any[]>(code: DiagnosticCode, messageText: string, category: DiagnosticCategory = DiagnosticCategory.Error) {
  return class extends CustomAttributeContainerDiagnostic<ARGS> {
    public get code(): DiagnosticCode { return code; }
    public get key(): string { return DiagnosticCode[code]; }
    public get category(): DiagnosticCategory { return category; }
    public get messageText(): string { return messageText; }
  };
}
