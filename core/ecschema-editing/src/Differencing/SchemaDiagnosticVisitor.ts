/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Differencing
 */
import type { AnyDiagnostic } from "../Validation/Diagnostic";
import { SchemaCompareCodes } from "../Validation/SchemaCompareDiagnostics";
import { AnyECType, AnyEnumerator, CustomAttribute, ECClass, EntityClass, Mixin, Property, PropertyProps, Schema, SchemaItem, schemaItemTypeToString } from "@itwin/ecschema-metadata";
import { ClassDifference, CustomAttributeDifference, DifferenceType, EntityClassDifference, EnumerationDifference, PropertyDifference, SchemaDifference, SchemaItemDifference } from "./SchemaDifference";

/**
 * @internal
 */
export class SchemaDiagnosticVisitor {

  private readonly _differenceReport: SchemaDifference;

  constructor(differenceReport: SchemaDifference) {
    this._differenceReport = differenceReport;
  }

  private addSchemaItem(sourceObject: SchemaItem, changeType: DifferenceType): SchemaItemDifference {
    if(this._differenceReport.items === undefined) {
      this._differenceReport.items = {};
    }

    return this._differenceReport.items[sourceObject.name] = {
      schemaItemName:   sourceObject.name,
      schemaItemType:   schemaItemTypeToString(sourceObject.schemaItemType),
      schemaChangeType: changeType,
      sourceObject,
    };
  }

  private getItemDifference<T extends SchemaItemDifference=SchemaItemDifference>(schemaItem: SchemaItem): T {
    if(this._differenceReport.items === undefined) {
      this._differenceReport.items = {};
    }

    const difference = this._differenceReport.items[schemaItem.name];
    return (difference || this.addSchemaItem(schemaItem, "changed")) as T;
  }

  private getPropertyDifference(property: Property): PropertyDifference {
    const classDifference = this.getItemDifference<ClassDifference>(property.class);
    if(classDifference.properties === undefined) {
      classDifference.properties = {};
    }

    return classDifference.properties[property.name] || (classDifference.properties[property.name] = {
      schemaChangeType: "changed",
      sourceObject:     property,
      name:             property.name,
    });
  }

  private getCustomAttributeContainer(ecSchemaObject: AnyECType): { customAttributes?: CustomAttributeDifference[] } {
    if(ecSchemaObject instanceof Schema) {
      return this._differenceReport;
    }
    if(ecSchemaObject instanceof ECClass) {
      return this.getItemDifference(ecSchemaObject);
    }
    if(ecSchemaObject instanceof Property) {
      return this.getPropertyDifference(ecSchemaObject);
    }
    throw new Error("The given type is not a supported custom attribute container.");
  }

  /**
   * Visitor function to process the schema change diagnostic object.
   * @internal
   */
  public visit(diagnostic: AnyDiagnostic) {
    switch(diagnostic.code) {
      case SchemaCompareCodes.SchemaDelta:
        return this.visitChangedSchemaProperties(diagnostic);

      case SchemaCompareCodes.SchemaReferenceMissing:
        return this.visitSchemaReference(diagnostic, "missing");
      case SchemaCompareCodes.SchemaReferenceDelta:
        return this.visitSchemaReference(diagnostic, "changed");

      case SchemaCompareCodes.SchemaItemMissing:
        return this.visitMissingSchemaItem(diagnostic);

      case SchemaCompareCodes.SchemaItemDelta:
      case SchemaCompareCodes.ClassDelta:
      case SchemaCompareCodes.ConstantDelta:
      case SchemaCompareCodes.CustomAttributeClassDelta:
      case SchemaCompareCodes.EnumerationDelta:
      case SchemaCompareCodes.FormatDelta:
      case SchemaCompareCodes.InvertedUnitDelta:
      case SchemaCompareCodes.KoqDelta:
      case SchemaCompareCodes.MixinDelta:
      case SchemaCompareCodes.PhenomenonDelta:
      case SchemaCompareCodes.PropertyCategoryDelta:
      case SchemaCompareCodes.RelationshipDelta:
      case SchemaCompareCodes.UnitDelta:
        return this.visitChangedSchemaItem(diagnostic);

      case SchemaCompareCodes.EnumeratorDelta:
        return this.visitChangedEnumerator(diagnostic);
      case SchemaCompareCodes.EnumeratorMissing:
        return this.visitMissingEnumerator(diagnostic);

      case SchemaCompareCodes.BaseClassDelta:
        return this.visitMissingBaseClass(diagnostic);
      case SchemaCompareCodes.EntityMixinMissing:
        return this.visitMissingMixinOnClass(diagnostic);
      case SchemaCompareCodes.PropertyDelta:
        return this.visitChangedProperty(diagnostic);
      case SchemaCompareCodes.PropertyMissing:
        return this.visitMissingProperty(diagnostic);

      case SchemaCompareCodes.CustomAttributeInstanceClassMissing:
        return this.visitMissingCustomAttributeInstance(diagnostic);

      // Currently not handled...
      case SchemaCompareCodes.RelationshipConstraintClassMissing:
      case SchemaCompareCodes.RelationshipConstraintDelta:
      case SchemaCompareCodes.FormatUnitMissing:
      case SchemaCompareCodes.PresentationUnitMissing:
      case SchemaCompareCodes.UnitLabelOverrideDelta:
        break;
    }
    return;
  }

  private visitChangedSchemaProperties(diagnostic: AnyDiagnostic) {
    // Only label and description are taken from the source schema. If the schema name or alias
    // differs, those are ignored for now.
    const [propertyName, propertyValue] = diagnostic.messageArgs as [string, any];
    switch(propertyName) {
      case "label":       return this._differenceReport.label = propertyValue;
      case "description": return this._differenceReport.description = propertyValue;
    }
  }

  private visitMissingSchemaItem(diagnostic: AnyDiagnostic) {
    this.addSchemaItem(diagnostic.ecDefinition as SchemaItem, "missing");
  }

  private visitChangedSchemaItem(diagnostic: AnyDiagnostic) {
    const difference: { [name: string]: any } = this.getItemDifference(diagnostic.ecDefinition as SchemaItem);
    const [propertyName, propertyValue] = diagnostic.messageArgs! as [string, any];
    if(propertyName !== "schemaItemType" && propertyValue !== undefined) {
      difference[propertyName] = propertyValue;
    }
  }

  private visitMissingEnumerator(diagnostic: AnyDiagnostic) {
    const enumeration = this.getItemDifference<EnumerationDifference>(diagnostic.ecDefinition as SchemaItem);
    if(enumeration.enumerators === undefined) {
      enumeration.enumerators = {};
    }

    const [enumerator] = diagnostic.messageArgs as [AnyEnumerator];
    enumeration.enumerators[enumerator.name] = {
      schemaChangeType: "missing",
      sourceObject:     enumerator,
      name:             enumerator.name,
    };
  }

  private visitChangedEnumerator(diagnostic: AnyDiagnostic) {
    const enumeration = this.getItemDifference<EnumerationDifference>(diagnostic.ecDefinition as SchemaItem);
    if(enumeration.enumerators === undefined) {
      enumeration.enumerators = {};
    }

    const [enumerator, propertyName, propertyValue] = diagnostic.messageArgs as [AnyEnumerator, keyof AnyEnumerator, any];
    const enumeratorDifference = enumeration.enumerators[enumerator.name] || (enumeration.enumerators[enumerator.name] = {
      schemaChangeType: "changed",
      sourceObject:     enumerator,
      name:             enumerator.name,
    });

    if(propertyName !== "name" && propertyValue !== undefined) {
      enumeratorDifference[propertyName] = propertyValue;
    }
  }

  private visitMissingProperty(diagnostic: AnyDiagnostic) {
    const property = diagnostic.ecDefinition as Property;
    const classDifference = this.getItemDifference<ClassDifference>(property.class);
    if(classDifference.properties === undefined) {
      classDifference.properties = {};
    }

    classDifference.properties[property.name] = {
      schemaChangeType: "missing",
      sourceObject:     property,
      name:             property.name,
    };
  }

  private visitChangedProperty(diagnostic: AnyDiagnostic) {
    const property = diagnostic.ecDefinition as Property;
    const propertyDifference = this.getPropertyDifference(property);

    const [propertyName, propertyValue] = diagnostic.messageArgs as [keyof PropertyProps, any];
    if(propertyName !== "name" && propertyValue !== undefined) {
      propertyDifference[propertyName] = propertyValue;
    }
  }

  private visitMissingBaseClass(diagnostic: AnyDiagnostic) {
    const classDifference = this.getItemDifference<ClassDifference>(diagnostic.ecDefinition as SchemaItem);
    const [baseClass] = diagnostic.messageArgs as [EntityClass];
    classDifference.baseClass = baseClass.fullName;
  }

  private visitMissingMixinOnClass(diagnostic: AnyDiagnostic) {
    const classDifference = this.getItemDifference<EntityClassDifference>(diagnostic.ecDefinition as SchemaItem);
    if(classDifference.mixins === undefined) {
      classDifference.mixins = [];
    }

    const [mixin] = diagnostic.messageArgs as [Mixin];
    classDifference.mixins.push(mixin.fullName);
  }

  private visitSchemaReference(diagnostic: AnyDiagnostic, changeType: DifferenceType) {
    if(this._differenceReport.references === undefined) {
      this._differenceReport.references = [];
    }

    const [referencedSchema] = diagnostic.messageArgs as [Schema];
    this._differenceReport.references.push({
      schemaChangeType: changeType,
      sourceObject: referencedSchema,
      name:         referencedSchema.name,
      version:      referencedSchema.schemaKey.version.toString(),
    });
  }

  private visitMissingCustomAttributeInstance(diagnostic: AnyDiagnostic) {
    const customAttributeContainer = this.getCustomAttributeContainer(diagnostic.ecDefinition);
    if(customAttributeContainer.customAttributes === undefined) {
      customAttributeContainer.customAttributes = [];
    }

    const [customAttribute] = diagnostic.messageArgs as [CustomAttribute];
    customAttributeContainer.customAttributes.push({
      schemaChangeType: "missing",
      sourceObject:     customAttribute,
      ...customAttribute,
    });
  }
}
