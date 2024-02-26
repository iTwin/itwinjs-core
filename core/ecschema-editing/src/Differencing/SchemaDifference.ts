/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Differencing
 */

import { SchemaChanges } from "../Validation/SchemaChanges";
import { SchemaComparer } from "../Validation/SchemaComparer";
import { SchemaDifferenceConflict } from "./SchemaConflicts";
import { SchemaDiagnosticVisitor } from "./SchemaDiagnosticVisitor";
import type {
  AnyEnumerator, AnyPropertyProps, AnySchemaItemProps, RelationshipConstraintProps, Schema,
  SchemaProps, SchemaReferenceProps,
} from "@itwin/ecschema-metadata";

/**
 * @internal
 */
export type DifferenceType = "add" | "modify";

/**
 * @internal
 */
export namespace SchemaDifference {
  /**
   * Creates a [[SchemaDifference]] for two given schemas.
   * @param targetSchema  The schema the differences gets merged into.
   * @param sourceSchema  The schema to get merged in the target.
   * @returns             An [[SchemaDifference]] object.
   */
  export async function fromSchemas(targetSchema: Schema, sourceSchema: Schema): Promise<SchemaDifferences> {
    const changesList: SchemaChanges[] = [];
    const schemaComparer = new SchemaComparer({ report: changesList.push.bind(changesList) });
    await schemaComparer.compareSchemas(sourceSchema, targetSchema);

    return fromSchemaChanges(targetSchema, changesList[0]);
  }

  /**
   * Creates a [[SchemaDifference]] for a given [[SchemaChanges]] report.
   * @param targetSchema
   * @param schemaChanges   A changes report of two schemas.
   * @returns               An [[SchemaDifference]] object.
   */
  export async function fromSchemaChanges(targetSchema: Schema, schemaChanges: SchemaChanges): Promise<SchemaDifferences> {
    const schemaDifference: SchemaDifferences = {
      sourceSchemaName: schemaChanges.schema.schemaKey.toString(),
      targetSchemaName: targetSchema.schemaKey.toString(),
      changes: [],
      conflicts: [],
    };

    const visitor = new SchemaDiagnosticVisitor(schemaDifference);
    for(const diagnostic of schemaChanges.allDiagnostics) {
      visitor.visit(diagnostic);
    }

    return schemaDifference;
  }
}

type MutualPartial<T> = {
  -readonly [P in keyof T]?: T[P];
};

/**
 * @internal
 */
export interface SchemaDifferences {

  readonly sourceSchemaName: string;
  readonly targetSchemaName: string;

  readonly changes: AnySchemaDifference[];
  readonly conflicts: SchemaDifferenceConflict[];
}

export type AnySchemaDifference = SchemaDifference | SchemaItemDifference | SchemaPropertyDifference | SchemaReferenceDifference | SchemaEnumeratorDifference | SchemaClassMixinDifference | SchemaRelationshipConstraintDifference | SchemaRelationshipConstraintClassDifference;

export interface SchemaDifference {
  changeType: "modify";
  item: "schema";
  path?: undefined;
  json: MutualPartial<SchemaProps>;
}

export interface SchemaItemDifference<T extends AnySchemaItemProps = AnySchemaItemProps> {
  changeType: "add" | "modify" | "remove";
  item: string;
  path?: string;
  json: MutualPartial<T>;
}

export interface SchemaPropertyDifference<T extends AnyPropertyProps = AnyPropertyProps> {
  changeType: "add" | "modify" | "remove";
  item: string;
  path: string;
  json: MutualPartial<T>;
}

export interface SchemaReferenceDifference {
  changeType: "add" | "modify" | "remove";
  item: "schema";
  path: "$references";
  json: MutualPartial<SchemaReferenceProps>;
}

export interface SchemaEnumeratorDifference {
  changeType: "add" | "modify" | "remove";
  item: string;
  path: string;
  json: MutualPartial<AnyEnumerator>;
}

export interface SchemaClassMixinDifference {
  changeType: "modify";
  item: string;
  path: "$mixins";
  json: string[];
}

export interface SchemaRelationshipConstraintDifference {
  changeType: "modify";
  item: string;
  path: string;
  json: MutualPartial<RelationshipConstraintProps>;
}

export interface SchemaRelationshipConstraintClassDifference {
  changeType: "modify";
  item: string;
  path: string;
  json: string[];
}
