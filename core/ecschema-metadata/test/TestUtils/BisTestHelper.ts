/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { SchemaContext } from "../../src/Context";
import { Schema } from "../../src/Metadata/Schema";

export class BisTestHelper {
  private static _schema: Schema;

  public static get bisSchema(): Schema {
    if (!this._schema) {
      this._schema = Schema.fromJsonSync(bisCoreSchema);
    }

    return this._schema;
  }

  public static async getContext(): Promise<SchemaContext> {
    const context = new SchemaContext();
    await context.addSchema(this.bisSchema);
    return context;
  }
}

const bisCoreSchema = {
  $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  alias: "bis",
  name: "BisCore",
  version: "01.00.01",
  label: "BIS Core",
  items: {
    Element: {
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
        constraintClasses: [ "BisCore.Element" ],
        multiplicity: "(1..1)",
        polymorphic: true,
        roleLabel: "owns",
      },
      strength: "embedding",
      strengthDirection: "forward",
      target: {
        constraintClasses: [ "BisCore.ElementMultiAspect" ],
        multiplicity: "(0..*)",
        polymorphic: true,
        roleLabel: "is owned by",
      },
    },
    ElementOwnsUniqueAspect: {
      modifier: "none",
      schemaItemType: "RelationshipClass",
      source: {
        constraintClasses: [ "BisCore.Element" ],
        multiplicity: "(1..1)",
        polymorphic: true,
        roleLabel: "owns",
      },
      strength: "embedding",
      strengthDirection: "forward",
      target: {
        constraintClasses: [ "BisCore.ElementUniqueAspect" ],
        multiplicity: "(0..*)",
        polymorphic: true,
        roleLabel: "is owned by",
      },
    },
  },
};
