/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

export default class ECStringConstants {
  // Relationship End
  public static readonly RELATIONSHIP_END_SOURCE: string = "Source";
  public static readonly RELATIONSHIP_END_TARGET: string = "Target";

  // Container Type
  public static readonly CONTAINERTYPE_SCHEMA: string = "Schema";
  public static readonly CONTAINERTYPE_ENTITYCLASS: string = "EntityClass";
  public static readonly CONTAINERTYPE_CUSTOMATTRIBUTECLASS: string = "CustomAttributeClass";
  public static readonly CONTAINERTYPE_STRUCTCLASS: string = "StructClass";
  public static readonly CONTAINERTYPE_RELATIONSHIPCLASS: string = "RelationshipClass";
  public static readonly CONTAINERTYPE_ANYCLASS: string = "AnyClass";

  public static readonly CONTAINERTYPE_PRIMITIVEPROPERTY: string = "PrimitiveProperty";
  public static readonly CONTAINERTYPE_STRUCTPROPERTY: string = "StructProperty";
  public static readonly CONTAINERTYPE_PRIMITIVEARRAYPROPERTY: string = "ArrayProperty";
  public static readonly CONTAINERTYPE_STRUCTARRAYPROPERTY: string = "StructArrayProperty";
  public static readonly CONTAINERTYPE_NAVIGATIONPROPERTY: string = "NavigationProperty";
  public static readonly CONTAINERTYPE_ANYPROPERTY: string = "AnyProperty";

  public static readonly CONTAINERTYPE_SOURCERELATIONSHIPCONSTRAINT: string = "SourceRelationshipConstraint";
  public static readonly CONTAINERTYPE_TARGETRELATIONSHIPCONSTRAINT: string = "TargetRelationshipConstraint";
  public static readonly CONTAINERTYPE_ANYRELATIONSHIPCONSTRAINT: string = "AnyRelationshipConstraint";

  public static readonly CONTAINERTYPE_ANY: string = "Any";
}
