import {
  CustomAttribute, CustomAttributeContainerProps, DelayedPromiseWithProps, ECClass, ECName,
  EnumerationProperty, KindOfQuantity, NavigationProperty, PrimitiveProperty,
  primitiveTypeToString,
  Property,
  PropertyCategory, SchemaItemKey, SchemaItemType, StructProperty
} from "@itwin/ecschema-metadata";
import { assert } from "@itwin/core-bentley";
import { SchemaContextEditor } from "./Editor";
import * as Rules from "../Validation/ECRules";
import { MutableArrayProperty } from "./Mutable/MutableArrayProperty";
import { MutableProperty } from "./Mutable/MutableProperty";
import { MutablePrimitiveOrEnumPropertyBase } from "./Mutable/MutablePrimitiveOrEnumProperty";
import { MutableClass } from "./Mutable/MutableClass";
import { MutableStructProperty } from "./Mutable/MutableStructProperty";
import { MutableNavigationProperty } from "./Mutable/MutableNavigationProperty";
import { ECClassSchemaItems } from "./ECClasses";
import { ECEditingStatus, SchemaEditingError } from "./Exception";
import { AnyDiagnostic } from "../Validation/Diagnostic";
import { ECElementSelection } from "./ECElementSelection";
import { ChangeOptions } from "./ChangeInfo/ChangeOptions";
import { ISchemaEditChangeInfo } from "./ChangeInfo/ChangeInfo";
import { RenamePropertyChange } from "./ChangeInfo/RenamePropertyChange";
import { ClassId, CustomAttributeId, PropertyId, PropertyTypeName, SchemaId } from "./SchemaItemIdentifiers";
import { SchemaEditType } from "./SchemaEditType";
import { NumberAttributeChangeInfo } from "./ChangeInfo/NumberAttributeChangeInfo";

type MutablePropertyType = MutableProperty | MutableArrayProperty | MutablePrimitiveOrEnumPropertyBase | MutableNavigationProperty | MutableStructProperty;

/**
 * @alpha
 * A class allowing editing of attributes of the base Property class.
 */
export class Properties {
  public constructor(protected ecClassType: ECClassSchemaItems, protected _schemaEditor: SchemaContextEditor) {
  }

  public async revertChange(changeInfo: ISchemaEditChangeInfo) {
    switch (changeInfo.editType) {
      case SchemaEditType.SetPropertyName:

    }
  }

  public async setName(classKey: SchemaItemKey, propertyName: string, newPropertyName: string, options: ChangeOptions = ChangeOptions.default) {
    let newECName: ECName;
    try {
      newECName = new ECName(newPropertyName);
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.SetPropertyName, new PropertyId(this.ecClassType, classKey, propertyName),
        new SchemaEditingError(ECEditingStatus.InvalidECName, new PropertyId(this.ecClassType, classKey, newPropertyName)));
    }

    const existingProperty = await this.getProperty<MutableProperty>(classKey, propertyName)
      .catch((e: any) => {
        throw new SchemaEditingError(SchemaEditType.SetPropertyName, new PropertyId(this.ecClassType, classKey, propertyName), e);
      });

    // verify property does not already exist in this class
    const localProperty = await existingProperty.class.getProperty(newPropertyName) as MutableProperty;
    if (localProperty) {
      throw new SchemaEditingError(SchemaEditType.SetPropertyName, new PropertyId(this.ecClassType, classKey, propertyName),
        new SchemaEditingError(ECEditingStatus.PropertyAlreadyExists, new PropertyId(this.ecClassType, localProperty.class.key, newPropertyName)));
    }

    // handle property override
    let overridingBaseProperty = false;
    const baseProperty = await existingProperty.class.getProperty(newPropertyName, true) as MutableProperty;
    if (baseProperty) {
      if (!options.allowPropertyOverrides) {
        throw new SchemaEditingError(SchemaEditType.SetPropertyName, new PropertyId(this.ecClassType, classKey, propertyName),
          new SchemaEditingError(ECEditingStatus.PropertyAlreadyExists, new PropertyId(this.ecClassType, baseProperty.class.key, newPropertyName)));
      }

      if (baseProperty.propertyType !== existingProperty.propertyType) {
        throw new SchemaEditingError(SchemaEditType.SetPropertyName, new PropertyId(this.ecClassType, classKey, propertyName),
          new SchemaEditingError(ECEditingStatus.InvalidPropertyType, new PropertyId(this.ecClassType, baseProperty.class.key, newPropertyName), undefined, undefined,
            `Found base Property '${baseProperty.name}' of type '${Properties.propertyTypeToString(baseProperty)}' which is not compatible with type '${Properties.propertyTypeToString(existingProperty)}'`));
      }

      overridingBaseProperty = true;
    }

    const elements = new ECElementSelection(this._schemaEditor, existingProperty.class.schema, existingProperty.class, existingProperty, options);

    if (!options.localChange)
      await ECElementSelection.gatherClassesAndPropertyOverrides(existingProperty.class, elements);

    // Verify that rename will not cause invalid overrides.
    if (!overridingBaseProperty)
      await this.validatePropertyAgainstDerivedProperties(existingProperty.class, existingProperty, newPropertyName, elements.gatheredDerivedClasses, options);

    // Create change info object to allow for edit cancelling and change reversal.
    const changeInfo = new RenamePropertyChange(this._schemaEditor, existingProperty.class, newPropertyName, propertyName, elements, this.revertSetName.bind(this));

    // Callback returns false to cancel the edit.
    if (!(await changeInfo.beginChange()))
      return;

    // Rename base and/or derived properties
    await this.renameAllCollectedOverrides(changeInfo);

    // set local name
    existingProperty.setName(newECName);

    // handle class property map
    (existingProperty.class as MutableClass).deleteProperty(propertyName);
    (existingProperty.class as MutableClass).addProperty(existingProperty);
  }

  /**
   * Sets the property description.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param description The new description to set.
   */
  public async setDescription(classKey: SchemaItemKey, propertyName: string, description: string) {
    const property = await this.getProperty<MutableProperty>(classKey, propertyName)
      .catch((e: any) => {
        throw new SchemaEditingError(SchemaEditType.SetDescription, new PropertyId(this.ecClassType, classKey, propertyName), e);
      });
    property.setDescription(description);
  }

  /**
   * Sets the property label.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param label The new label to set.
   */
  public async setLabel(classKey: SchemaItemKey, propertyName: string, label: string) {
    const property = await this.getProperty<MutableProperty>(classKey, propertyName)
      .catch((e: any) => {
        throw new SchemaEditingError(SchemaEditType.SetLabel, new PropertyId(this.ecClassType, classKey, propertyName), e);
      });
    property.setLabel(label);
  }

  /**
   * Sets the property isReadOnly attribute.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param isReadOnly The new isReadOnly value.
   */
  public async setIsReadOnly(classKey: SchemaItemKey, propertyName: string, isReadOnly: boolean) {
    const property = await this.getProperty<MutableProperty>(classKey, propertyName)
      .catch((e: any) => {
        throw new SchemaEditingError(SchemaEditType.SetIsReadOnly, new PropertyId(this.ecClassType, classKey, propertyName), e);
      });
    property.setIsReadOnly(isReadOnly);
  }

  /**
   * Sets the property priority.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param priority The new priority.
   */
  public async setPriority(classKey: SchemaItemKey, propertyName: string, priority: number) {
    const property = await this.getProperty<MutableProperty>(classKey, propertyName)
      .catch((e: any) => {
        throw new SchemaEditingError(SchemaEditType.SetPriority, new PropertyId(this.ecClassType, classKey, propertyName), e);
      });

    new NumberAttributeChangeInfo(this._schemaEditor, SchemaEditType.SetPriority, priority, property.priority, property);
    property.setPriority(priority);
  }

  /**
   * Sets the property category.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param categoryKey The SchemaItemKey of the property category.
   */
  public async setCategory(classKey: SchemaItemKey, propertyName: string, categoryKey: SchemaItemKey) {
    const property = await this.getProperty<MutableProperty>(classKey, propertyName)
      .catch((e: any) => {
        throw new SchemaEditingError(SchemaEditType.SetCategory, new PropertyId(this.ecClassType, classKey, propertyName), e);
      });

    const category = await this._schemaEditor.lookupSchemaItem<PropertyCategory>(property.class.schema, categoryKey, SchemaItemType.PropertyCategory)
      .catch((e: any) => {
        throw new SchemaEditingError(SchemaEditType.SetCategory, new PropertyId(this.ecClassType, classKey, propertyName), e);
      });

    property.setCategory(new DelayedPromiseWithProps<SchemaItemKey, PropertyCategory>(categoryKey, async () => category));
  }

  /**
   * Sets the KindOfQuantity of a property.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param kindOfQuantityKey The SchemaItemKey of the KindOfQuantity.
   */
  public async setKindOfQuantity(classKey: SchemaItemKey, propertyName: string, kindOfQuantityKey: SchemaItemKey) {
    const property = await this.getProperty<MutableProperty>(classKey, propertyName)
      .catch((e: any) => {
        throw new SchemaEditingError(SchemaEditType.SetKindOfQuantity, new PropertyId(this.ecClassType, classKey, propertyName), e);
      });

    const koq = await this._schemaEditor.lookupSchemaItem<KindOfQuantity>(property.class.schema, kindOfQuantityKey, SchemaItemType.KindOfQuantity)
      .catch((e: any) => {
        throw new SchemaEditingError(SchemaEditType.SetKindOfQuantity, new PropertyId(this.ecClassType, classKey, propertyName), e);
      });

    property.setKindOfQuantity(new DelayedPromiseWithProps<SchemaItemKey, KindOfQuantity>(kindOfQuantityKey, async () => koq));
  }

  /**
   * Adds a CustomAttribute instance to the Property identified by the given SchemaItemKey and property name.
   * @param classKey The SchemaItemKey identifying the class.
   * @param propertyName The name of the property.
   * @param customAttribute The CustomAttribute instance to add.
   */
  public async addCustomAttribute(classKey: SchemaItemKey, propertyName: string, customAttribute: CustomAttribute) {
    const property = await this.getProperty<MutableProperty>(classKey, propertyName)
      .catch((e: any) => {
        throw new SchemaEditingError(SchemaEditType.AddCustomAttributeToProperty, new PropertyId(this.ecClassType, classKey, propertyName), e);
      });

    property.addCustomAttribute(customAttribute);

    const diagnosticsIterable = Rules.validateCustomAttributeInstance(property, customAttribute);

    const diagnostics: AnyDiagnostic[] = [];
    for await (const diagnostic of diagnosticsIterable) {
      diagnostics.push(diagnostic);
    }

    if (diagnostics.length > 0) {
      this.removeCustomAttribute(property, customAttribute);
      throw new SchemaEditingError(SchemaEditType.AddCustomAttributeToProperty, new PropertyId(this.ecClassType, classKey, propertyName),
        new SchemaEditingError(ECEditingStatus.RuleViolation, new CustomAttributeId(customAttribute.className, property)));
    }
  }

  public static propertyTypeToString(property: Property) {
    let typeName = "";

    if (property.isPrimitive()) {
      typeName = primitiveTypeToString(property.primitiveType);
      if (property.isEnumeration())
        typeName = `${typeName} enumeration`;
    } else if (property.isStruct()) {
      typeName = "struct";
    } else if (property.isNavigation()) {
      typeName = "navigation";
    }

    if (property.isArray())
      typeName = `${typeName} array`;

    return typeName;
  }

  /**
   * Removes a CustomAttribute from a property.
   * @param container
   * @param customAttribute
   */
  protected removeCustomAttribute(container: CustomAttributeContainerProps, customAttribute: CustomAttribute) {
    assert(container.customAttributes !== undefined);
    const map = container.customAttributes as Map<string, CustomAttribute>;
    map.delete(customAttribute.className);
  }

  /**
   * Gets the property with the specified name from the class identified by the given key.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property to retrieve.
   */
  protected async getProperty<T extends MutablePropertyType>(classKey: SchemaItemKey, propertyName: string): Promise<T> {
    const mutableClass = await this.getClass(classKey);

    const property = await mutableClass.getProperty(propertyName) as T;
    if (property === undefined) {
      throw new SchemaEditingError(ECEditingStatus.PropertyNotFound, new PropertyId(mutableClass.schemaItemType as ECClassSchemaItems, classKey, propertyName));
    }

    return property;
  }

  private async renameAllCollectedOverrides(renameChangeInfo: RenamePropertyChange): Promise<void> {
    if (!renameChangeInfo.isLocalChange && renameChangeInfo.changeBase && renameChangeInfo.baseProperties) {
      for (const propertyToRename of renameChangeInfo.baseProperties) {
        const property = await this.getPropertyFromId(propertyToRename);
        property.setName(new ECName(renameChangeInfo.newPropertyName))
      }
    }

    if (!renameChangeInfo.isLocalChange && renameChangeInfo.changeDerived && renameChangeInfo.derivedProperties) {
      for (const propertyToRename of renameChangeInfo.derivedProperties) {
        const property = await this.getPropertyFromId(propertyToRename);
        property.setName(new ECName(renameChangeInfo.newPropertyName))
      }
    }
  }

  private async revertSetName(changeInfo: ISchemaEditChangeInfo): Promise<void> {
    const renameInfo = changeInfo as RenamePropertyChange;

    if (renameInfo.baseProperties) {
      for (const propertyId of renameInfo.baseProperties) {
        const ecName = new ECName(renameInfo.oldPropertyName);
        const property = await this.getPropertyFromId(propertyId);
        property.setName(ecName);
      }
    }

    const property = await this.getProperty(renameInfo.modifiedClass.schemaItemKey, renameInfo.newPropertyName) as MutableProperty;
    property.setName(new ECName(renameInfo.oldPropertyName));

    if (renameInfo.derivedProperties) {
      for (const propertyId of renameInfo.derivedProperties) {
        const ecName = new ECName(renameInfo.oldPropertyName);
        const property = await this.getPropertyFromId(propertyId);
        property.setName(ecName);
      }
    }
  }

  private async getPropertyFromId(propertyId: PropertyId): Promise<MutableProperty> {
    return await this.getProperty(propertyId.ecClass.schemaItemKey, propertyId.name) as MutableProperty;
  }

  private async getClass(classKey: SchemaItemKey): Promise<MutableClass> {
    const schema = await this._schemaEditor.getSchema(classKey.schemaKey);
    if (schema === undefined)
      throw new SchemaEditingError(ECEditingStatus.SchemaNotFound, new SchemaId(classKey.schemaKey));

    const ecClass = await schema.getItem(classKey.name);
    if (ecClass === undefined)
      throw new SchemaEditingError(ECEditingStatus.SchemaItemNotFound, new ClassId(this.ecClassType, classKey));

    if (ecClass.schemaItemType !== this.ecClassType) {
      throw new SchemaEditingError(ECEditingStatus.InvalidSchemaItemType, new ClassId(this.ecClassType, classKey));
    }

    return ecClass as MutableClass;
  }

  /** If you are calling for a newly added property, set newName to undefined. If you are renaming a property, set newName. */
  private async validatePropertyAgainstDerivedProperties(baseClass: ECClass, baseProperty: Property, newName: string | undefined, derivedClasses: Map<string, ECClass>, options: ChangeOptions) {
    for (const mapItem of derivedClasses) {
      const derivedClass = mapItem[1];
      // If this is a new property, newName will be undefined, as opposed to renaming a property
      newName = newName ?? baseProperty.name;
      const derivedProperty = await derivedClass.getProperty(newName);
      if (undefined !== derivedProperty) {
        if (!options.allowPropertyOverrides) {
          throw new SchemaEditingError(SchemaEditType.SetPropertyName, new PropertyId(this.ecClassType, baseClass.key, baseProperty),
            new SchemaEditingError(ECEditingStatus.PropertyAlreadyExists, new PropertyId(this.ecClassType, derivedProperty.class.key, derivedProperty)));
        }
        if (baseProperty.propertyType !== derivedProperty.propertyType) {
          throw new SchemaEditingError(SchemaEditType.SetPropertyName, new PropertyId(this.ecClassType, baseClass.key, baseProperty),
            new SchemaEditingError(ECEditingStatus.InvalidPropertyType, new PropertyId(this.ecClassType, derivedClass.key, derivedProperty), undefined, undefined,
              `Found derived Property '${derivedProperty.fullName}' of type '${Properties.propertyTypeToString(derivedProperty)}' which is not compatible with type '${Properties.propertyTypeToString(baseProperty)}'`));
        }
      }
    }
  }
}



/**
 * @alpha
 * A class extending Properties allowing editing of attributes of PrimitiveArrayProperty,
 * EnumerationArrayProperty and StructArrayProperty.
 */
export class ArrayProperties extends Properties {
  public constructor(ecClassType: ECClassSchemaItems, _schemaEditor: SchemaContextEditor) {
    super(ecClassType, _schemaEditor);
  }

  /**
   * Sets the array property minOccurs attribute.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param minOccurs The new minOccurs value.
   */
  public async setMinOccurs(classKey: SchemaItemKey, propertyName: string, minOccurs: number) {
    const property = await this.getProperty<MutableArrayProperty>(classKey, propertyName)
      .catch((e: any) => {
        throw new SchemaEditingError(SchemaEditType.SetMinOccurs, new PropertyId(this.ecClassType, classKey, propertyName), e);
      });
    property.setMinOccurs(minOccurs);
  }

  /**
   * Sets the array property maxOccurs attribute.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param maxOccurs The new maxOccurs value.
   */
  public async setMaxOccurs(classKey: SchemaItemKey, propertyName: string, maxOccurs: number) {
    const property = await this.getProperty<MutableArrayProperty>(classKey, propertyName)
      .catch((e: any) => {
        throw new SchemaEditingError(SchemaEditType.SetMaxOccurs, new PropertyId(this.ecClassType, classKey, propertyName), e);
      });
    property.setMaxOccurs(maxOccurs);
  }

  /**
   * Override to validate that the found property is an ArrayProperty.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   */
  protected override async getProperty<T extends MutablePropertyType>(classKey: SchemaItemKey, propertyName: string): Promise<T> {
    const property = await super.getProperty<MutableArrayProperty>(classKey, propertyName) as T;
    if (!property.isArray()) {
      throw new SchemaEditingError(ECEditingStatus.InvalidPropertyType, new PropertyId(this.ecClassType, classKey, propertyName, PropertyTypeName.ArrayProperty));
    }
    return property;
  }
}

/**
 * @alpha
 * A class extending Properties allowing editing of attributes of PrimitiveProperty and EnumerationProperty.
 */
class PrimitiveOrEnumProperties extends Properties {
  public constructor(ecClassType: ECClassSchemaItems, _schemaEditor: SchemaContextEditor) {
    super(ecClassType, _schemaEditor);
  }

  /**
   * Sets the extendTypeName attribute value.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param extendTypeName The extended type name of the property.
   */
  public async setExtendedTypeName(classKey: SchemaItemKey, propertyName: string, extendedTypeName: string) {
    const property = await this.getProperty<MutablePrimitiveOrEnumPropertyBase>(classKey, propertyName)
      .catch((e: any) => {
        throw new SchemaEditingError(SchemaEditType.SetExtendedTypeName, new PropertyId(this.ecClassType, classKey, propertyName), e);
      });
    property.setExtendedTypeName(extendedTypeName);
  }

  /**
   * Sets the minLength attribute value.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param minLength The minimum length of the property.
   */
  public async setMinLength(classKey: SchemaItemKey, propertyName: string, minLength: number) {
    const property = await this.getProperty<MutablePrimitiveOrEnumPropertyBase>(classKey, propertyName)
      .catch((e: any) => {
        throw new SchemaEditingError(SchemaEditType.SetMinLength, new PropertyId(this.ecClassType, classKey, propertyName), e);
      });
    property.setMinLength(minLength);
  }

  /**
   * Sets the maxLength attribute value.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param maxLength The maximum length of the property.
   */
  public async setMaxLength(classKey: SchemaItemKey, propertyName: string, maxLength: number) {
    const property = await this.getProperty<MutablePrimitiveOrEnumPropertyBase>(classKey, propertyName)
      .catch((e: any) => {
        throw new SchemaEditingError(SchemaEditType.SetMaxLength, new PropertyId(this.ecClassType, classKey, propertyName), e);
      });
    property.setMaxLength(maxLength);
  }

  /**
   * Sets the minValue attribute value.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param minValue The minimum value of the property.
   */
  public async setMinValue(classKey: SchemaItemKey, propertyName: string, minValue: number) {
    const property = await this.getProperty<MutablePrimitiveOrEnumPropertyBase>(classKey, propertyName)
      .catch((e: any) => {
        throw new SchemaEditingError(SchemaEditType.SetMinValue, new PropertyId(this.ecClassType, classKey, propertyName), e);
      });
    property.setMinValue(minValue);
  }

  /**
   * Sets the maxValue attribute value.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param maxValue The maximum value of the property.
   */
  public async setMaxValue(classKey: SchemaItemKey, propertyName: string, maxValue: number) {
    const property = await this.getProperty<MutablePrimitiveOrEnumPropertyBase>(classKey, propertyName)
      .catch((e: any) => {
        throw new SchemaEditingError(SchemaEditType.SetMaxValue, new PropertyId(this.ecClassType, classKey, propertyName), e);
      });
    property.setMaxValue(maxValue);
  }
}

/**
 * @alpha
 * A class extending Properties allowing editing of PrimitiveProperty attributes.
 */
export class PrimitiveProperties extends PrimitiveOrEnumProperties {
  public constructor(ecClassType: ECClassSchemaItems, _schemaEditor: SchemaContextEditor) {
    super(ecClassType, _schemaEditor);
  }

  /**
   * Override to validate that the found property is a PrimitiveProperty.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   */
  protected override async getProperty<T extends MutablePropertyType>(classKey: SchemaItemKey, propertyName: string): Promise<T> {
    const property = await super.getProperty<MutablePrimitiveOrEnumPropertyBase>(classKey, propertyName) as T;
    if (!(property instanceof PrimitiveProperty)) {
      throw new SchemaEditingError(ECEditingStatus.InvalidPropertyType, new PropertyId(this.ecClassType, classKey, propertyName, PropertyTypeName.PrimitiveProperty));
    }
    return property;
  }
}

/**
 * @alpha
 * A class extending Properties allowing editing of EnumerationProperty attributes.
 */
export class EnumerationProperties extends PrimitiveOrEnumProperties {
  public constructor(ecClassType: ECClassSchemaItems, _schemaEditor: SchemaContextEditor) {
    super(ecClassType, _schemaEditor);
  }

  /**
   * Override to validate that the found property is a EnumerationProperty.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   */
  protected override async getProperty<T extends MutablePropertyType>(classKey: SchemaItemKey, propertyName: string): Promise<T> {
    const property = await super.getProperty<MutablePrimitiveOrEnumPropertyBase>(classKey, propertyName) as T;
    if (!(property instanceof EnumerationProperty)) {
      throw new SchemaEditingError(ECEditingStatus.InvalidPropertyType, new PropertyId(this.ecClassType, classKey, propertyName, PropertyTypeName.EnumerationProperty));
    }
    return property;
  }
}

/**
 * @alpha
 * A class extending Properties allowing editing of NavigationProperties attributes.
 */
export class NavigationProperties extends Properties {
  public constructor(ecClassType: ECClassSchemaItems, _schemaEditor: SchemaContextEditor) {
    super(ecClassType, _schemaEditor);
  }

  /**
   * Override to validate that the found property is a NavigationProperty.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   */
  protected override async getProperty<T extends MutablePropertyType>(classKey: SchemaItemKey, propertyName: string): Promise<T> {
    const property = await super.getProperty<MutableNavigationProperty>(classKey, propertyName) as T;
    if (!(property instanceof NavigationProperty)) {
      throw new SchemaEditingError(ECEditingStatus.InvalidPropertyType, new PropertyId(this.ecClassType, classKey, propertyName, PropertyTypeName.NavigationProperty));
    }
    return property;
  }
}

/**
 * @alpha
 * A class extending Properties allowing editing of StructProperty attributes.
 */
export class StructProperties extends Properties {
  public constructor(ecClassType: ECClassSchemaItems, _schemaEditor: SchemaContextEditor) {
    super(ecClassType, _schemaEditor);
  }

  /**
   * Override to validate that the found property is a StructProperty.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   */
  protected override async getProperty<T extends MutablePropertyType>(classKey: SchemaItemKey, propertyName: string): Promise<T> {
    const property = await super.getProperty<MutableStructProperty>(classKey, propertyName) as T;
    if (!(property instanceof StructProperty)) {
      throw new SchemaEditingError(ECEditingStatus.InvalidPropertyType, new PropertyId(this.ecClassType, classKey, propertyName, PropertyTypeName.StructProperty));
    }
    return property;
  }
}

