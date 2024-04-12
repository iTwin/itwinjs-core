import { ECClass, ECName, ECObjectsError, ECObjectsStatus, SchemaItemKey, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { MutableArrayProperty } from "./Mutable/MutableArrayProperty";
import { MutableProperty } from "./Mutable/MutableProperty";
import { MutablePrimitiveOrEnumPropertyBase } from "./Mutable/MutablePrimitiveOrEnumProperty";
import { MutableClass } from "./Mutable/MutableClass";

type MutablePropertyType = MutableProperty | MutableArrayProperty | MutablePrimitiveOrEnumPropertyBase;

/**
 * @alpha
 * A class allowing editing of attributes of the base Property class.
 */
export class Properties {
  public constructor(protected _schemaEditor: SchemaContextEditor) { }

  public async setName(classKey: SchemaItemKey, propertyName: string, newPropertyName: string) {
    const newName = new ECName(newPropertyName);

    const existingProperty = await this.getProperty<MutableProperty>(classKey, propertyName);

    const baseProperty = await existingProperty.class.getProperty(newPropertyName, true) as MutableProperty;
    if (baseProperty)
      throw new Error(`An ECProperty with the name ${newPropertyName} already exists in the class ${baseProperty.class.name}.`);

    // Handle derived classes
    const derivedProperties: Array<MutableProperty> = [];
    const derivedClasses = await this.findDerivedClasses(existingProperty.class as MutableClass);
    for (const derivedClass of derivedClasses) {
      if (await derivedClass.getProperty(newPropertyName))
        throw new Error(`An ECProperty with the name ${newPropertyName} already exists in the class ${derivedClass.fullName}.`);

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
    const property = await this.getProperty<MutableProperty>(classKey, propertyName);
    property.setDescription(description);
  }

  /**
   * Sets the property label.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param label The new label to set.
   */
  public async setLabel(classKey: SchemaItemKey, propertyName: string, label: string) {
    const property = await this.getProperty<MutableProperty>(classKey, propertyName);
    property.setLabel(label);
  }

  /**
   * Sets the property isReadOnly attribute.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param isReadOnly The new isReadOnly value.
   */
  public async setIsReadOnly(classKey: SchemaItemKey, propertyName: string, isReadOnly: boolean) {
    const property = await this.getProperty<MutableProperty>(classKey, propertyName);
    property.setIsReadOnly(isReadOnly);
  }

  /**
   * Sets the property priority.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param priority The new priority.
   */
  public async setPriority(classKey: SchemaItemKey, propertyName: string, priority: number) {
    const property = await this.getProperty<MutableProperty>(classKey, propertyName);
    property.setPriority(priority);
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

  /**
   * Gets the property with the specified name from the class identified by the given key.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property to retrieve.
   */
  protected async getProperty<T extends MutablePropertyType>(classKey: SchemaItemKey, propertyName: string): Promise<T> {
    const mutableClass = await this.getClass(classKey);

    const property = await mutableClass.getProperty(propertyName) as T;
    if (property === undefined) {
      // TODO: Update error
      throw new Error(`An ECProperty with the name ${propertyName} could not be found in the class ${classKey.fullName}.`);
    }

    return property;
  }

  private async getClass(classKey: SchemaItemKey): Promise<MutableClass> {
    const schema = await this._schemaEditor.getSchema(classKey.schemaKey);
    if (schema === undefined)
      throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema,`Schema Key ${classKey.schemaKey.toString(true)} not found in context`);

    const ecClass = await schema.getItem(classKey.name);
    if (ecClass === undefined)
      throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Class ${classKey.name} was not found in schema ${classKey.schemaKey.toString(true)}`);

    if (!(ecClass instanceof ECClass)) {
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaItemType, `Schema item type not supported`);
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
  public constructor(_schemaEditor: SchemaContextEditor) {
    super(_schemaEditor);
  }

  /**
   * Sets the array property minOccurs attribute.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param minOccurs The new minOccurs value.
   */
  public async setMinOccurs(classKey: SchemaItemKey, propertyName: string, minOccurs: number) {
    const property = await this.getProperty<MutableArrayProperty>(classKey, propertyName);
    property.setMinOccurs(minOccurs);
  }

  /**
   * Sets the array property maxOccurs attribute.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param maxOccurs The new maxOccurs value.
   */
  public async setMaxOccurs(classKey: SchemaItemKey, propertyName: string, maxOccurs: number) {
    const property = await this.getProperty<MutableArrayProperty>(classKey, propertyName);
    property.setMaxOccurs(maxOccurs);
  }
}

/**
 * @alpha
 * A class extending Properties allowing editing of attributes of PrimitiveProperty and EnumerationProperty.
 */
class PrimitiveOrEnumProperties extends Properties {
  public constructor(_schemaEditor: SchemaContextEditor) {
    super(_schemaEditor);
  }

  /**
   * Sets the extendTypeName attribute value.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param extendTypeName The extended type name of the property.
   */
  public async setExtendedTypeName(classKey: SchemaItemKey, propertyName: string, extendedTypeName: string) {
    const property = await this.getProperty<MutablePrimitiveOrEnumPropertyBase>(classKey, propertyName);
    property.setExtendedTypeName(extendedTypeName);
  }

  /**
   * Sets the minLength attribute value.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param minLength The minimum length of the property.
   */
  public async setMinLength(classKey: SchemaItemKey, propertyName: string, minLength: number) {
    const property = await this.getProperty<MutablePrimitiveOrEnumPropertyBase>(classKey, propertyName);
    property.setMinLength(minLength);
  }

  /**
   * Sets the maxLength attribute value.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param maxLength The maximum length of the property.
   */
  public async setMaxLength(classKey: SchemaItemKey, propertyName: string, maxLength: number) {
    const property = await this.getProperty<MutablePrimitiveOrEnumPropertyBase>(classKey, propertyName);
    property.setMaxLength(maxLength);
  }

  /**
   * Sets the minValue attribute value.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param minValue The minimum value of the property.
   */
  public async setMinValue(classKey: SchemaItemKey, propertyName: string, minValue: number) {
    const property = await this.getProperty<MutablePrimitiveOrEnumPropertyBase>(classKey, propertyName);
    property.setMinValue(minValue);
  }

  /**
   * Sets the maxValue attribute value.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param maxValue The maximum value of the property.
   */
  public async setMaxValue(classKey: SchemaItemKey, propertyName: string, maxValue: number) {
    const property = await this.getProperty<MutablePrimitiveOrEnumPropertyBase>(classKey, propertyName);
    property.setMaxValue(maxValue);
  }
}

/**
 * @alpha
 * A class extending Properties allowing editing of PrimitiveProperty attributes.
 */
export class PrimitiveProperties extends PrimitiveOrEnumProperties {
  public constructor(_schemaEditor: SchemaContextEditor) {
    super(_schemaEditor);
  }
}

/**
 * @alpha
 * A class extending Properties allowing editing of EnumerationProperty attributes.
 */
export class EnumerationProperties extends PrimitiveOrEnumProperties {
  public constructor(_schemaEditor: SchemaContextEditor) {
    super(_schemaEditor);
  }
}

