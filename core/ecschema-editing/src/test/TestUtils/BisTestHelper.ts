/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/naming-convention */

import { Schema, SchemaContext } from "@itwin/ecschema-metadata";

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
    ElementRefersToElements: {
      modifier: "Abstract",
      schemaItemType: "RelationshipClass",
      source: {
        constraintClasses: ["BisCore.Element"],
        multiplicity: "(0..*)",
        polymorphic: true,
        roleLabel: "refers to",
      },
      strength: "referencing",
      strengthDirection: "forward",
      target: {
        constraintClasses: ["BisCore.Element"],
        multiplicity: "(0..*)",
        polymorphic: true,
        roleLabel: "is referenced by",
      },
    },
    ElementDrivesElement: {
      modifier: "None",
      schemaItemType: "RelationshipClass",
      source: {
        constraintClasses: ["BisCore.Element"],
        multiplicity: "(0..*)",
        polymorphic: true,
        roleLabel: "drives",
      },
      strength: "referencing",
      strengthDirection: "forward",
      target: {
        constraintClasses: ["BisCore.Element"],
        multiplicity: "(0..*)",
        polymorphic: true,
        roleLabel: "is driven by",
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
    ClassHasHandler: {
      appliesTo: "Any",
      description: "Applied to an ECClass to indicate that a C++ subclass of DgnDomain::Handler will supply behavior for it at run-time. This custom attribute may only be used by BisCore or other core schemas.",
      modifier: "sealed",
      schemaItemType: "CustomAttributeClass",
    },
  },
};
