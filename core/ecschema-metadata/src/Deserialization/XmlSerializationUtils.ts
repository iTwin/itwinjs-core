/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { PrimitiveType, primitiveTypeToString } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import type { CustomAttribute } from "../Metadata/CustomAttribute";
import type { CustomAttributeClass } from "../Metadata/CustomAttributeClass";
import type { ArrayProperty, EnumerationProperty, PrimitiveOrEnumPropertyBase, PrimitiveProperty, Property, StructProperty } from "../Metadata/Property";
import type { Schema } from "../Metadata/Schema";

/**
 * Namespace holding utility functions for serializing EC types to the EC XML format.
 * @beta
 */
export namespace XmlSerializationUtils {
  /**
   * Serializes a CustomAttribute instance to the EC XML format.
   * @param fullName The full name of the CustomAttribute (qualified by schema name).
   * @param customAttribute The CustomAttribute instance to serialize.
   * @param schemaDoc The Xml Document object holding the serialized EC Schema.
   * @param schema The Schema object being serialized.
   * @beta
   */
  export async function writeCustomAttribute(fullName: string, customAttribute: CustomAttribute, schemaDoc: Document, schema: Schema): Promise<Element> {
    const caClass = await schema.lookupItem(fullName) as CustomAttributeClass;
    if (!caClass)
      throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `The class '${fullName}' could not be found in the current schema context.`);

    const nameAndNamespace = await resolveCustomAttributeNamespace(fullName, schema);
    const caElement = schemaDoc.createElement(nameAndNamespace[0]);

    if (nameAndNamespace[1])
      caElement.setAttribute("xmlns", nameAndNamespace[1]);

    if (!caClass.properties)
      return caElement;

    for (const property of caClass.properties)
      await writeInstanceProperty(property, customAttribute, caElement, schemaDoc);

    return caElement;
  }

  /**
   * Serializes an EC Property instance to the EC XML format.
   * @param propertyClass The Property metadata object.
   * @param instance The Property instance.
   * @param instanceElement The XML Element that will contain the serialized property instance.
   * @param schemaDoc The Xml Document object holding the serialized EC Schema.
   * @beta
   */
  export async function writeInstanceProperty(propertyClass: Property, instance: any, instanceElement: Element, schemaDoc: Document): Promise<void> {
    const propertyValue = instance[propertyClass.name];
    if (propertyValue === undefined)
      return;

    const propertyElement = schemaDoc.createElement(propertyClass.name);
    instanceElement.appendChild(propertyElement);

    if (propertyClass.isArray()) {
      await writeArrayProperty(propertyClass, propertyValue, propertyElement, schemaDoc);
    } else if (propertyClass.isPrimitive()) {
      await writePrimitiveProperty(propertyClass, propertyValue, propertyElement);
    } else if (propertyClass.isStruct()) {
      await writeStructProperty(propertyClass, propertyValue, propertyElement, schemaDoc);
    }
  }

  /**
   * Serializes an EC ArrayProperty instance to the EC XML format.
   * @param propertyClass The Property metadata object.
   * @param propertyValue An array holding the property values.
   * @param arrayElement The XML Element that will contain the serialized property instance.
   * @param schemaDoc The Xml Document object holding the serialized EC Schema.
   * @beta
   */
  export async function writeArrayProperty(propertyClass: ArrayProperty, propertyValue: any[], arrayElement: Element, schemaDoc: Document): Promise<void> {
    if (propertyClass.isPrimitive()) {
      const typeString = primitiveTypeToString(propertyClass.primitiveType);
      for (const value of propertyValue) {
        const entryElement = schemaDoc.createElement(typeString);
        await writePrimitiveProperty(propertyClass, value, entryElement);
        arrayElement.appendChild(entryElement);
      }
    }

    if (propertyClass.isStruct()) {
      for (const value of propertyValue) {
        const structElement = schemaDoc.createElement(propertyClass.structClass.name);
        arrayElement.appendChild(structElement);
        await writeStructProperty(propertyClass, value, structElement, schemaDoc);
      }
    }
  }

  /**
   * Serializes an EC StructProperty instance to the EC XML format.
   * @param propertyClass The Property metadata object.
   * @param propertyValue The struct object holding the property values.
   * @param structElement The XML Element that will contain the serialized property instance.
   * @param schemaDoc The Xml Document object holding the serialized EC Schema.
   * @beta
   */
  export async function writeStructProperty(propertyClass: StructProperty, propertyValue: any, structElement: Element, schemaDoc: Document): Promise<void> {
    const structClass = propertyClass.structClass;
    if (!structClass.properties)
      return;

    for (const propertyMetadata of structClass.properties)
      await writeInstanceProperty(propertyMetadata, propertyValue, structElement, schemaDoc);
  }

  /**
   * Serializes an EC PrimitiveProperty instance to the EC XML format.
   * @param propertyClass The Property metadata object.
   * @param propertyValue The struct object holding the property values.
   * @param propertyElement The XML Element that will contain the serialized property instance.
   * @beta
   */
  export async function writePrimitiveProperty(propertyClass: PrimitiveOrEnumPropertyBase, propertyValue: any, propertyElement: Element): Promise<void> {
    let primitiveType: PrimitiveType;
    if (propertyClass.isEnumeration()) {
      const enumeration = await (propertyClass as EnumerationProperty).enumeration;
      if (!enumeration)
        throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `The enumeration on property class '${propertyClass.fullName}' could not be found in the current schema context.`);

      if (enumeration.type === undefined)
        throw new ECObjectsError(ECObjectsStatus.InvalidType, `The enumeration on property class '${propertyClass.fullName}' has an invalid primitive type.`);

      primitiveType = enumeration.type;
    } else
      primitiveType = (propertyClass as PrimitiveProperty).primitiveType;

    switch (primitiveType) {
      case PrimitiveType.String:
        propertyElement.textContent = propertyValue;
        return;
      case PrimitiveType.Boolean:
        propertyElement.textContent = (propertyValue as boolean) ? "True" : "False";
        return;
      case PrimitiveType.Integer:
      case PrimitiveType.Double:
      case PrimitiveType.Long:
        propertyElement.textContent = propertyValue.toString();
        return;
      case PrimitiveType.DateTime:
        propertyElement.textContent = (propertyValue as Date).getTime().toString();
        return;
      case PrimitiveType.Point2d:
        propertyElement.textContent = `${propertyValue.x},${propertyValue.y}`;
        return;
      case PrimitiveType.Point3d:
        propertyElement.textContent = `${propertyValue.x},${propertyValue.y},${propertyValue.z}`;
        return;
      case PrimitiveType.IGeometry:
      case PrimitiveType.Binary:
        propertyElement.textContent = propertyValue;
        return;
      default:
        throw new ECObjectsError(ECObjectsStatus.InvalidPrimitiveType, `The property '${propertyClass.fullName}' has an invalid primitive type.`);
    }
  }

  export function createXmlTypedName(currentSchema: Schema, typeSchema: Schema, typeName: string) {
    if (currentSchema.schemaKey.matches(typeSchema.schemaKey))
      return typeName;

    // Alias is required in Spec. It could be undefined (technically), so
    // throw until fixed.
    if (typeSchema.alias === undefined)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaAlias, `The schema '${typeSchema.name}' has an invalid alias.`);

    return `${typeSchema.alias}:${typeName}`;
  }

  async function resolveCustomAttributeNamespace(caName: string, schema: Schema): Promise<[string, string | undefined]> {
    const nameParts = caName.split(".");
    if (nameParts.length === 1)
      return [caName, undefined];

    const attributeSchema = nameParts[0].toUpperCase() === schema.name.toUpperCase() ? schema : await schema.getReference(nameParts[0]);
    if (!attributeSchema)
      throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Unable to resolve the namespace for CustomAttribute '${caName}' because the referenced schema '${nameParts[0]}' could not be located.`);

    return [nameParts[1], `${nameParts[0]}.${attributeSchema.schemaKey.version.toString()}`];
  }
}
