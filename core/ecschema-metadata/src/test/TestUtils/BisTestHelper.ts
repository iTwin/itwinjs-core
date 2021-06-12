/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { SchemaContext } from "../../Context";
import { Schema } from "../../Metadata/Schema";

/* eslint-disable @typescript-eslint/naming-convention */

export class BisTestHelper {
  public static async getNewContext(): Promise<SchemaContext> {
    const context = new SchemaContext();
    await Schema.fromJson(coreCustomAttributesSchema, context);
    await Schema.fromJson(bisCoreSchema, context);

    return context;
  }
}

const coreCustomAttributesSchema = {
  $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  name: "CoreCustomAttributes",
  alias: "CoreCA",
  version: "01.00.01",
  description: "Custom attributes to indicate core EC concepts, may include struct classes intended for use in core custom attributes.",
  items: {
    Deprecated: {
      appliesTo: "Any",
      description: "Identifies a schema or item within a schema as deprecated.  Deprecated things should not be used.",
      modifier: "sealed",
      schemaItemType: "CustomAttributeClass",
    },
  },
};

const bisCoreSchema = {
  $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  alias: "bis",
  name: "BisCore",
  version: "01.00.01",
  label: "BIS Core",
  references: [
    {
      name: "CoreCustomAttributes",
      version: "01.00.01",
    },
  ],
  items: {
    Element: {
      modifier: "abstract",
      schemaItemType: "EntityClass",
    },
    Model: {
      modifier: "abstract",
      schemaItemType: "EntityClass",
    },
    IParentElement: {
      appliesTo: "BisCore.Element",
      description: "An interface that indicates that this Element is capable of being a parent (owning child Elements). This interface is mutually exclusive with ISubModeledElement.",
      label: "Parent Element",
      schemaItemType: "Mixin",
    },
    ISubModeledElement: {
      appliesTo: "BisCore.Element",
      description: "An interface which indicates that an Element can be broken down or described by a (sub) Model.  This interface is mutually exclusive with IParentElement.",
      label: "Modellable Element",
      schemaItemType: "Mixin",
    },
    ElementAspect: {
      modifier: "abstract",
      schemaItemType: "EntityClass",
    },
    ElementMultiAspect: {
      modifier: "abstract",
      schemaItemType: "EntityClass",
    },
    ElementUniqueAspect: {
      baseClass: "BisCore.ElementAspect",
      modifier: "abstract",
      schemaItemType: "EntityClass",
    },
    ElementOwnsMultiAspects: {
      modifier: "none",
      schemaItemType: "RelationshipClass",
      source: {
        constraintClasses: ["BisCore.Element"],
        multiplicity: "(1..1)",
        polymorphic: true,
        roleLabel: "owns",
      },
      strength: "embedding",
      strengthDirection: "forward",
      target: {
        constraintClasses: ["BisCore.ElementMultiAspect"],
        multiplicity: "(0..*)",
        polymorphic: true,
        roleLabel: "is owned by",
      },
    },
    ElementOwnsUniqueAspect: {
      modifier: "none",
      schemaItemType: "RelationshipClass",
      source: {
        constraintClasses: ["BisCore.Element"],
        multiplicity: "(1..1)",
        polymorphic: true,
        roleLabel: "owns",
      },
      strength: "embedding",
      strengthDirection: "forward",
      target: {
        constraintClasses: ["BisCore.ElementUniqueAspect"],
        multiplicity: "(0..*)",
        polymorphic: true,
        roleLabel: "is owned by",
      },
    },
    PhysicalModel: {
      modifier: "none",
      schemaItemType: "EntityClass",
    },
    SpatialLocationModel: {
      modifier: "none",
      schemaItemType: "EntityClass",
    },
    GroupInformationModel: {
      modifier: "none",
      schemaItemType: "EntityClass",
    },
    InformationRecordModel: {
      modifier: "none",
      schemaItemType: "EntityClass",
    },
    DefinitionModel: {
      modifier: "none",
      schemaItemType: "EntityClass",
    },
    DocumentListModel: {
      modifier: "none",
      schemaItemType: "EntityClass",
    },
    LinkModel: {
      modifier: "none",
      schemaItemType: "EntityClass",
    },
  },
};
