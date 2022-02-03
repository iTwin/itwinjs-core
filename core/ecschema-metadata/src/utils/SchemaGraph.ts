/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Schema } from "../Metadata/Schema";

/** @beta */
export interface ReferenceCycle {
  schema: Schema;
  refSchema: Schema;
}

/**
 * Utility class for detecting cyclic references in a Schema graph.
 * @beta
 */
export class SchemaGraph {
  private _schemas: Schema[] = [];

  /**
   * Initializes a new SchemaGraph instance.
   * @param schema The schema to analyze.
   */
  public constructor(schema: Schema) {
    this.populateGraph(schema);
  }

  /**
   * Detected cyclic references in a schema.
   * @returns True if a cycle is found.
   */
  public detectCycles(): ReferenceCycle[] | undefined {
    const visited = {};
    const recStack = {};
    const cycles: ReferenceCycle[] = [];

    for (const schema of this._schemas) {
      if (this.detectCycleUtil(schema, visited, recStack, cycles)) {
        return cycles.length > 0 ? cycles : undefined;
      }
    }

    return undefined;
  }

  private detectCycleUtil(schema: Schema, visited: any, recStack: any, cycles: ReferenceCycle[]): boolean {
    let cycleFound = false;

    if (!visited[schema.name]) {
      visited[schema.name] = true;
      recStack[schema.name] = true;

      for (const refSchema of schema.references) {
        if (!visited[refSchema.name] && this.detectCycleUtil(refSchema, visited, recStack, cycles)) {
          cycles.push({schema, refSchema});
          cycleFound = true;
        } else if (recStack[refSchema.name]) {
          cycles.push({schema, refSchema});
          cycleFound = true;
        }
      }
    }
    if (!cycleFound)
      recStack[schema.name] = false;

    return cycleFound;
  }

  private populateGraph(schema: Schema) {
    if (this._schemas.includes(schema))
      return;

    this._schemas.push(schema);

    for (const refSchema of schema.references) {
      this.populateGraph(refSchema);
    }
  }
}
