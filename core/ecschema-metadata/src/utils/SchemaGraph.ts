/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { SchemaContext } from "../Context";
import { SchemaMatchType } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaInfo } from "../Interfaces";
import { Schema } from "../Metadata/Schema";
import { SchemaKey } from "../SchemaKey";

/**
 * A schema and it's reference that make up part of a schema cycle
 * @internal
 */
export interface ReferenceCycle {
  schema: SchemaInfo;
  refSchema: SchemaInfo;
}

/**
 * Utility class for detecting cyclic references in a Schema graph.
 * @internal
 */
export class SchemaGraph {
  private _schemas: SchemaInfo[] = [];

  private constructor() { }

  private find(schemaKey: Readonly<SchemaKey>) {
    return this._schemas.find((info: SchemaInfo) => info.schemaKey.matches(schemaKey, SchemaMatchType.Latest));
  }

  /**
   * Detected cyclic references in a schema and throw an exception if a cycle is found.
   */
  public throwIfCycles() {
    const cycles = this.detectCycles();
    if (cycles) {
      const result = cycles.map((cycle) => `${cycle.schema.schemaKey.name} --> ${cycle.refSchema.schemaKey.name}`).join(", ");
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Schema '${this._schemas[0].schemaKey.name}' has reference cycles: ${result}`);
    }
  }

  /**
   * Detected cyclic references in a schema.
   * @returns An array describing the cycle if there is a cycle or undefined if no cycles found.
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

  private detectCycleUtil(schema: SchemaInfo, visited: any, recStack: any, cycles: ReferenceCycle[]): boolean {
    let cycleFound = false;

    if (!visited[schema.schemaKey.name]) {
      visited[schema.schemaKey.name] = true;
      recStack[schema.schemaKey.name] = true;

      for (const refKey of schema.references) {
        const refSchema = this.find(refKey.schemaKey);
        if (undefined === refSchema)
          throw new ECObjectsError(ECObjectsStatus.UnableToLoadSchema, `Could not find the schema info for ref schema ${refKey.schemaKey.toString()} for schema ${schema.schemaKey.toString()}`);
        if (!visited[refKey.schemaKey.name] && this.detectCycleUtil(refSchema, visited, recStack, cycles)) {
          cycles.push({ schema, refSchema });
          cycleFound = true;
        } else if (recStack[refKey.schemaKey.name]) {
          cycles.push({ schema, refSchema });
          cycleFound = true;
        }
      }
    }
    if (!cycleFound)
      recStack[schema.schemaKey.name] = false;

    return cycleFound;
  }

  /**
   * Generates a SchemaGraph for the input schema using the context to find info on referenced schemas.  Use the generateGraphSync if you have the fully loaded Schema.
   * @param schema The SchemaInfo to build the graph from
   * @param context The SchemaContext used to locate info on the referenced schemas
   * @returns A SchemaGraph that can be used to detect schema cycles
   */
  public static async generateGraph(schema: SchemaInfo, context: SchemaContext): Promise<SchemaGraph> {
    const graph = new SchemaGraph();

    const genGraph = async (s: SchemaInfo) => {
      if (graph.find(s.schemaKey))
        return;

      graph._schemas.push(s);

      for (const refSchema of s.references) {
        if (!graph.find(refSchema.schemaKey)) {
          const refInfo = await context.getSchemaInfo(refSchema.schemaKey, SchemaMatchType.LatestWriteCompatible);
          if (undefined === refInfo) {
            throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema,
              `Could not locate the referenced schema, ${refSchema.schemaKey.name}.${refSchema.schemaKey.version.toString()}, of ${s.schemaKey.name} when populating the graph for ${schema.schemaKey.name}`);
          }
          await genGraph(refInfo);
        }
      }
    };

    await genGraph(schema);
    return graph;
  }

  /**
   * Generates a SchemaGraph for the input schema.  Use the generateGraph if you just have schema info.
   * @param schema The Schema to build the graph from.
   * @returns A SchemaGraph that can be used to detect schema cycles
   */
  public static generateGraphSync(schema: Schema): SchemaGraph {
    const graph = new SchemaGraph();

    const genGraph = (s: Schema) => {
      if (graph.find(s.schemaKey))
        return;

      graph._schemas.push(s);

      for (const refSchema of s.references) {
        if (!graph.find(refSchema.schemaKey))
          genGraph(refSchema);
      }
    };

    genGraph(schema);
    return graph;
  }

}

