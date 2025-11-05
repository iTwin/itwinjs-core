/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { AnyPropertyProps, ClassProps, CustomAttributeClassProps, MixinProps, RelationshipClassProps, RelationshipConstraintProps } from "../Deserialization/JsonProps";
import { containerTypeToString, CustomAttributeContainerType } from "../ECObjects";
import { SchemaItemParser } from "./SchemaItemParsers";
import { parseCustomAttribute } from "./SchemaParser";

type MutablePropertyProps = {
  -readonly [K in keyof AnyPropertyProps]: AnyPropertyProps[K]
};

type MutableClassProps = {
  -readonly [K in keyof ClassProps]: ClassProps[K]
};

/**
 * Parses ClassProps JSON returned from an ECSql query and returns the correct ClassProps JSON.
 * This is necessary as a small amount information (ie. CustomAttribute data) returned from the
 * iModelDb is in a different format than is required for a ClassProps JSON object.
 * @internal
 */
export class ClassParser extends SchemaItemParser {
  /**
   * Parses the given ClassProps JSON returned from an ECSql query.
   * @param data The ClassProps JSON as returned from an iModelDb.
   * @returns The corrected ClassProps Json.
   */
  public override async parse(data: ClassProps): Promise<ClassProps> {
    const props = await super.parse(data) as MutableClassProps;
    if (props.properties) {
      if (props.properties.length === 0)
        delete props.properties;
      else
        this.parseProperties(props.properties);
    }

    return props;
  }

  private parseProperties(propertyProps: AnyPropertyProps[]) {
    for (const props of propertyProps as MutablePropertyProps[]) {
      props.customAttributes = props.customAttributes && props.customAttributes.length > 0 ? props.customAttributes.map((attr: any) => { return parseCustomAttribute(attr); }) : undefined;
      if (!props.customAttributes)
        delete props.customAttributes;
    }
  }
}

type MutableMixinProps = {
  -readonly [K in keyof MixinProps]: MixinProps[K]
};

/**
 * Parses the given MixinProps JSON returned from an ECSql query.
 * @param data The MixinProps JSON as returned from an iModelDb.
 * @returns The corrected MixinProps Json.
 * @internal
 */
export class MixinParser extends ClassParser {
  /**
   * Parses the given MixinProps JSON returned from an ECSql query.
   * @param data The MixinProps JSON as returned from an iModelDb.
   * @returns The corrected MixinProps Json.
   */
  public override async parse(data: MixinProps): Promise<MixinProps> {
    const props = await super.parse(data) as MutableMixinProps;
    if (!props.customAttributes)
      delete props.customAttributes;

    return props;
  }
}

type MutableCustomAttributeClassProps = {
  -readonly [K in keyof CustomAttributeClassProps]: CustomAttributeClassProps[K]
};

/**
 * Parses the given CustomAttributeClassProps JSON returned from an ECSql query.
 * @param data The CustomAttributeClassProps JSON as returned from an iModelDb.
 * @returns The corrected CustomAttributeClassProps Json.
 * @internal
 */
export class CustomAttributeClassParser extends ClassParser {
  /**
   * Parses the given CustomAttributeClassProps JSON returned from an ECSql query.
   * @param data The CustomAttributeClassProps JSON as returned from an iModelDb.
   * @returns The corrected CustomAttributeClassProps Json.
   */
  public override async parse(data: CustomAttributeClassProps): Promise<CustomAttributeClassProps> {
    const props = await super.parse(data) as MutableCustomAttributeClassProps;
    props.appliesTo = props.appliesTo ? containerTypeToString(props.appliesTo as any as number) : CustomAttributeContainerType[CustomAttributeContainerType.Any];
    return props;
  }
}

type MutableRelationshipConstraintProps = {
  -readonly [K in keyof RelationshipConstraintProps]: RelationshipConstraintProps[K]
};

/**
 * Parses the given RelationshipClassProps JSON returned from an ECSql query.
 * @param data The RelationshipClassProps JSON as returned from an iModelDb.
 * @returns The corrected RelationshipClassProps Json.
 * @internal
 */
export class RelationshipClassParser extends ClassParser {
  /**
   * Parses the given RelationshipClassProps JSON returned from an ECSql query.
   * @param data The RelationshipClassProps JSON as returned from an iModelDb.
   * @returns The corrected RelationshipClassProps Json.
   */
  public override async parse(data: RelationshipClassProps): Promise<RelationshipClassProps> {
    const props = await super.parse(data) as RelationshipClassProps;
    const source = props.source as MutableRelationshipConstraintProps;
    const target = props.target as MutableRelationshipConstraintProps;

    if (source) {
      source.customAttributes = source.customAttributes ? source.customAttributes.map((attr: any) => { return parseCustomAttribute(attr); }) : undefined;
      if (!source.customAttributes)
        delete source.customAttributes;
    }

    if (target) {
      target.customAttributes = target.customAttributes ? target.customAttributes.map((attr: any) => { return parseCustomAttribute(attr); }) : undefined;
      if (!target.customAttributes)
        delete target.customAttributes;
    }

    return props;
  }
}