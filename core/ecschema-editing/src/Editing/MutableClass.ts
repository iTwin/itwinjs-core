/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  CustomAttribute,
  ECClass,
  ECClassModifier,
  Enumeration,
  EnumerationArrayProperty,
  EnumerationProperty,
  PrimitiveArrayProperty,
  PrimitiveProperty,
  PrimitiveType,
  Property,
  StructArrayProperty,
  StructClass,
  StructProperty,
} from "@bentley/ecschema-metadata";

/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutableStructClass extends StructClass {
  public abstract setDisplayLabel(displayLabel: string): void;
}

/**
 * Hackish approach that works like a "friend class" so we can access protected members without making them public.
 * @internal
 */
export abstract class MutableClass extends ECClass {
  public abstract addCustomAttribute(customAttribute: CustomAttribute): void;
  public abstract setModifier(modifier: ECClassModifier): void;
  public abstract createPrimitiveProperty(name: string, primitiveType: PrimitiveType): Promise<PrimitiveProperty>;
  public abstract createPrimitiveProperty(name: string, primitiveType: Enumeration): Promise<EnumerationProperty>;
  public abstract createPrimitiveProperty(name: string, primitiveType?: string | PrimitiveType | Enumeration): Promise<Property>;

  public abstract createPrimitivePropertySync(name: string, primitiveType: PrimitiveType): PrimitiveProperty;
  public abstract createPrimitivePropertySync(name: string, primitiveType: Enumeration): EnumerationProperty;
  public abstract createPrimitivePropertySync(name: string, primitiveType?: string | PrimitiveType | Enumeration): Property;

  public abstract createPrimitiveArrayProperty(name: string, primitiveType: PrimitiveType): Promise<PrimitiveArrayProperty>;
  public abstract createPrimitiveArrayProperty(name: string, primitiveType: Enumeration): Promise<EnumerationArrayProperty>;
  public abstract createPrimitiveArrayProperty(name: string, primitiveType?: string | PrimitiveType | Enumeration): Promise<Property>;

  public abstract createPrimitiveArrayPropertySync(name: string, primitiveType: PrimitiveType): PrimitiveArrayProperty;
  public abstract createPrimitiveArrayPropertySync(name: string, primitiveType: Enumeration): EnumerationArrayProperty;
  public abstract createPrimitiveArrayPropertySync(name: string, primitiveType?: string | PrimitiveType | Enumeration): Property;

  public abstract createStructProperty(name: string, structType: string | StructClass): Promise<StructProperty>;
  public abstract createStructPropertySync(name: string, structType: string | StructClass): StructProperty;

  public abstract createStructArrayProperty(name: string, structType: string | StructClass): Promise<StructArrayProperty>;
  public abstract createStructArrayPropertySync(name: string, structType: string | StructClass): StructArrayProperty;
}
