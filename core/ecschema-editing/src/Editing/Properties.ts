import { CustomAttribute, CustomAttributeContainerProps, DelayedPromiseWithProps, ECClass, ECName,
  EnumerationProperty, NavigationProperty, PrimitiveProperty,
  PropertyCategory, SchemaItemKey, SchemaItemType, StructProperty } from "@itwin/ecschema-metadata";
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
import { ECEditingStatus, PropertyTypeName, SchemaEditingError, schemaItemIdentifier } from "./Exception";
import { AnyDiagnostic } from "../Validation/Diagnostic";

type MutablePropertyType = MutableProperty | MutableArrayProperty | MutablePrimitiveOrEnumPropertyBase | MutableNavigationProperty | MutableStructProperty;

/**
 * @alpha
 * A class allowing editing of attributes of the base Property class.
 */
export class Properties {
  public constructor(protected ecClassType: ECClassSchemaItems, protected _schemaEditor: SchemaContextEditor) {
  }

  public async setName(classKey: SchemaItemKey, propertyName: string, newPropertyName: string) {
    let newName: ECName;
    try {
      newName = new ECName(newPropertyName);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.SetPropertyNameFailed, schemaItemIdentifier(this.ecClassType, classKey, propertyName),
        new SchemaEditingError(ECEditingStatus.InvalidECName, schemaItemIdentifier(this.ecClassType, classKey, newPropertyName)));
    }

    const existingProperty = await this.getProperty<MutableProperty>(classKey, propertyName)
      .catch((e: any) => {
        throw new SchemaEditingError(ECEditingStatus.SetPropertyNameFailed, schemaItemIdentifier(this.ecClassType, classKey, propertyName), e);
      });

    const baseProperty = await existingProperty.class.getProperty(newPropertyName, true) as MutableProperty;
    if (baseProperty) {
      throw new SchemaEditingError(ECEditingStatus.SetPropertyNameFailed, schemaItemIdentifier(this.ecClassType, classKey, propertyName),
        new SchemaEditingError(ECEditingStatus.PropertyAlreadyExists, schemaItemIdentifier(this.ecClassType, baseProperty.class.key, newPropertyName)));
    }

    // Handle derived classes
    const derivedProperties: Array<MutableProperty> = [];
    const derivedClasses = await this.findDerivedClasses(existingProperty.class as MutableClass);
    for (const derivedClass of derivedClasses) {
      if (await derivedClass.getProperty(newPropertyName)) {
        throw new SchemaEditingError(ECEditingStatus.SetPropertyNameFailed, schemaItemIdentifier(this.ecClassType, classKey, propertyName),
          new SchemaEditingError(ECEditingStatus.PropertyAlreadyExists, schemaItemIdentifier(this.ecClassType, derivedClass.key, newPropertyName)));
      }

      const propertyOverride = await derivedClass.getProperty(propertyName) as MutableProperty;
      // If found the property is overridden in the derived class.
      if (propertyOverride)
        derivedProperties.push(propertyOverride);
    }

    // Re-name the overridden property in all derived classes
    derivedProperties.forEach((prop: MutableProperty) => {
      prop.setName(newName);
    });

    existingProperty.setName(newName);
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
        throw new SchemaEditingError(ECEditingStatus.SetDescriptionFailed, schemaItemIdentifier(this.ecClassType, classKey, propertyName), e);
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
        throw new SchemaEditingError(ECEditingStatus.SetLabelFailed, schemaItemIdentifier(this.ecClassType, classKey, propertyName), e);
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
        throw new SchemaEditingError(ECEditingStatus.SetIsReadOnlyFailed, schemaItemIdentifier(this.ecClassType, classKey, propertyName), e);
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
        throw new SchemaEditingError(ECEditingStatus.SetPriorityFailed, schemaItemIdentifier(this.ecClassType, classKey, propertyName), e);
      });
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
        throw new SchemaEditingError(ECEditingStatus.SetCategoryFailed, schemaItemIdentifier(this.ecClassType, classKey, propertyName), e);
      });

    const category = await property.class.schema.lookupItem<PropertyCategory>(categoryKey);
    if (category === undefined) {
      throw new SchemaEditingError(ECEditingStatus.SetCategoryFailed, schemaItemIdentifier(this.ecClassType, classKey, propertyName),
        new SchemaEditingError(ECEditingStatus.SchemaItemNotFound, schemaItemIdentifier(SchemaItemType.PropertyCategory, categoryKey)));
    }

    property.setCategory(new DelayedPromiseWithProps<SchemaItemKey, PropertyCategory>(categoryKey, async () => category));
    return { itemKey: classKey, propertyName };
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
        throw new SchemaEditingError(ECEditingStatus.AddCustomAttributeToPropertyFailed, schemaItemIdentifier(this.ecClassType, classKey, propertyName), e);
      });

    property.addCustomAttribute(customAttribute);

    const diagnosticsIterable = Rules.validateCustomAttributeInstance(property, customAttribute);

    const diagnostics: AnyDiagnostic[] = [];
    for await (const diagnostic of diagnosticsIterable) {
      diagnostics.push(diagnostic);
    }

    if (diagnostics.length > 0) {
      this.removeCustomAttribute(property, customAttribute);
      throw new SchemaEditingError(ECEditingStatus.AddCustomAttributeToPropertyFailed, schemaItemIdentifier(this.ecClassType, classKey, propertyName),
        new SchemaEditingError(ECEditingStatus.RuleViolation, schemaItemIdentifier(this.ecClassType, classKey, propertyName)));
    }
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
      throw new SchemaEditingError(ECEditingStatus.PropertyNotFound, schemaItemIdentifier(mutableClass.schemaItemType, classKey, propertyName));
    }

    return property;
  }

  private async findDerivedClasses(mutableClass: MutableClass): Promise<Array<MutableClass>>{
    const derivedClasses: Array<MutableClass> = [];

    for await (const schemaItem of this._schemaEditor.schemaContext.getSchemaItems()) {
      if(ECClass.isECClass(schemaItem) && await schemaItem.is(mutableClass)) {
        if (!mutableClass.key.matches(schemaItem.key)) {
          derivedClasses.push(schemaItem as MutableClass);
        }
      }
    }

    return derivedClasses;
  }

  private async getClass(classKey: SchemaItemKey): Promise<MutableClass> {
    const schema = await this._schemaEditor.getSchema(classKey.schemaKey);
    if (schema === undefined)
      throw new SchemaEditingError(ECEditingStatus.SchemaNotFound, {schemaKey: classKey.schemaKey});

    const ecClass = await schema.getItem(classKey.name);
    if (ecClass === undefined)
      throw new SchemaEditingError(ECEditingStatus.SchemaItemNotFound, schemaItemIdentifier(this.ecClassType, classKey));

    if (ecClass.schemaItemType !== this.ecClassType){
      throw new SchemaEditingError(ECEditingStatus.InvalidSchemaItemType,schemaItemIdentifier(this.ecClassType, classKey));
    }

    return ecClass as MutableClass;
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
        throw new SchemaEditingError(ECEditingStatus.SetMinOccursFailed, schemaItemIdentifier(this.ecClassType, classKey, propertyName), e);
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
        throw new SchemaEditingError(ECEditingStatus.SetMaxOccursFailed, schemaItemIdentifier(this.ecClassType, classKey, propertyName), e);
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
    if (!property.isArray()){
      throw new SchemaEditingError(ECEditingStatus.InvalidPropertyType, schemaItemIdentifier(this.ecClassType, classKey, propertyName, PropertyTypeName.ArrayProperty));
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
        throw new SchemaEditingError(ECEditingStatus.SetExtendedTypeNameFailed, schemaItemIdentifier(this.ecClassType, classKey, propertyName), e);
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
        throw new SchemaEditingError(ECEditingStatus.SetMinLengthFailed, schemaItemIdentifier(this.ecClassType, classKey, propertyName), e);
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
        throw new SchemaEditingError(ECEditingStatus.SetMaxLengthFailed, schemaItemIdentifier(this.ecClassType, classKey, propertyName), e);
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
        throw new SchemaEditingError(ECEditingStatus.SetMinValueFailed, schemaItemIdentifier(this.ecClassType, classKey, propertyName), e);
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
        throw new SchemaEditingError(ECEditingStatus.SetMaxValueFailed, schemaItemIdentifier(this.ecClassType, classKey, propertyName), e);
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
    if (!(property instanceof PrimitiveProperty)){
      throw new SchemaEditingError(ECEditingStatus.InvalidPropertyType, schemaItemIdentifier(this.ecClassType, classKey, propertyName, PropertyTypeName.PrimitiveProperty));
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
    if (!(property instanceof EnumerationProperty)){
      throw new SchemaEditingError(ECEditingStatus.InvalidPropertyType, schemaItemIdentifier(this.ecClassType, classKey, propertyName, PropertyTypeName.EnumerationProperty));
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
    if (!(property instanceof NavigationProperty)){
      throw new SchemaEditingError(ECEditingStatus.InvalidPropertyType, schemaItemIdentifier(this.ecClassType, classKey, propertyName, PropertyTypeName.NavigationProperty));
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
    if (!(property instanceof StructProperty)){
      throw new SchemaEditingError(ECEditingStatus.InvalidPropertyType, schemaItemIdentifier(this.ecClassType, classKey, propertyName, PropertyTypeName.StructProperty));
    }
    return property;
  }
}

