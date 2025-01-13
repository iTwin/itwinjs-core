/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BentleyStatus } from "@itwin/core-bentley";
import { IModelError } from "@itwin/core-common";
import { GLTimerResult, GLTimerResultCallback } from "../RenderSystem";
import { System } from "./System";

class DisjointTimerExtension {
  private _e: any; // EXT_disjoint_timer_query, not available in lib.dom.d.ts
  private _context: WebGL2RenderingContext;

  public constructor(system: System) {
    this._e = system.disjointTimerQuery;
    this._context = system.context;
  }

  public get isSupported(): boolean { return this._e !== undefined; }

  public didDisjointEventHappen(): boolean {
    return this._context.getParameter(this._e.GPU_DISJOINT_EXT);
  }

  public createQuery(): WebGLQuery { return this._context.createQuery() as WebGLQuery; }
  public deleteQuery(q: WebGLQuery) { this._context.deleteQuery(q); }

  public beginQuery(q: WebGLQuery) { this._context.beginQuery(this._e.TIME_ELAPSED_EXT, q); }
  public endQuery() { this._context.endQuery(this._e.TIME_ELAPSED_EXT); }

  public isResultAvailable(q: WebGLQuery): boolean {
    return this._context.getQueryParameter(q, this._context.QUERY_RESULT_AVAILABLE);
  }
  public getResult(q: WebGLQuery): number {
    return this._context.getQueryParameter(q, this._context.QUERY_RESULT);
  }
}

interface QueryEntry {
  label: string;
  query: WebGLQuery;
  siblingQueries?: WebGLQuery[]; // For when the main query is broken up into pieces by intermittent child queries.
  children?: QueryEntry[];
}

/** Record GPU hardware queries to profile independent of CPU.
 *
 * This is a wrapper around EXT_disjoint_timer_query. The extension should be available in the following browsers:
 *  * Chrome 67 and later
 *  * Chromium-based Edge
 *  * Firefox (with webgl.enable-privileged-extensions set to true in about:config)
 *
 * EXT_disjoint_timer_query only supports one active query per context without nesting. This wrapper keeps an internal stack to make
 * nesting work.
 *
 * The extension API makes timestamps look like a better solution than disjoint timers, but they are not actually supported.
 * See https://bugs.chromium.org/p/chromium/issues/detail?id=595172
 * @internal
 */
export class GLTimer {
  private _extension: DisjointTimerExtension;
  private _queryStack: QueryEntry[];
  private _resultsCallback?: GLTimerResultCallback;

  private constructor(system: System) {
    this._extension = new DisjointTimerExtension(system);
    this._queryStack = [];
    this._resultsCallback = undefined;
  }

  // This class is necessarily a singleton per context because of the underlying extension it wraps.
  // System is expected to call create in its constructor.
  public static create(system: System): GLTimer {
    return new GLTimer(system);
  }

  public get isSupported(): boolean { return this._extension.isSupported; }

  public set resultsCallback(callback: GLTimerResultCallback | undefined) {
    if (this._queryStack.length !== 0)
      throw new IModelError(BentleyStatus.ERROR, "Do not set resultsCallback when a frame is already being drawn");

    this._resultsCallback = callback;
  }

  public beginOperation(label: string) {
    if (!this._resultsCallback)
      return;

    this.pushQuery(label);
  }

  public endOperation() {
    if (!this._resultsCallback)
      return;
    if (this._queryStack.length === 0)
      throw new IModelError(BentleyStatus.ERROR, "Mismatched calls to beginOperation/endOperation");

    this.popQuery();
  }

  public beginFrame() {
    if (!this._resultsCallback)
      return;
    if (this._queryStack.length !== 0)
      throw new IModelError(BentleyStatus.ERROR, "Already recording timing for a frame");

    const query = this._extension.createQuery();
    this._extension.beginQuery(query);
    this._queryStack.push({ label: "Total", query, children: [] });
  }

  public endFrame() {
    if (!this._resultsCallback)
      return;
    if (this._queryStack.length !== 1)
      throw new IModelError(BentleyStatus.ERROR, "Missing at least one endOperation call");

    this._extension.endQuery();
    const root = this._queryStack.pop()!;
    const userCallback = this._resultsCallback;

    const queryCallback = () => {
      if (this._extension.didDisjointEventHappen()) {
        // Have to throw away results for this frame after disjoint event occurs.
        this.cleanupAfterDisjointEvent(root);
        return;
      }

      // It takes one or more frames for results to become available.
      // Only checking time for root since it will always be the last query completed.
      // If there are any sibling queries then we will just check the last one.
      const finalQuery = (undefined === root.siblingQueries ? root.query : root.siblingQueries[root.siblingQueries.length-1]);
      if (!this._extension.isResultAvailable(finalQuery)) {
        setTimeout(queryCallback, 0);
        return;
      }

      const processQueryEntry = (queryEntry: QueryEntry): GLTimerResult => {
        const time = this._extension.getResult(queryEntry.query);
        this._extension.deleteQuery(queryEntry.query);

        const result: GLTimerResult = { label: queryEntry.label, nanoseconds: time };

        if (undefined !== queryEntry.siblingQueries) {
          for (const sib of queryEntry.siblingQueries) {
            const sibTime = this._extension.getResult(sib);
            this._extension.deleteQuery(sib);
            result.nanoseconds += sibTime;
          }
          queryEntry.siblingQueries = undefined;
        }

        if (queryEntry.children === undefined)
          return result;

        result.children = [];
        for (const child of queryEntry.children) {
          const childResult = processQueryEntry(child);
          result.children.push(childResult);
          result.nanoseconds += childResult.nanoseconds;
        }
        return result;
      };

      userCallback(processQueryEntry(root));
    };
    setTimeout(queryCallback, 0);
  }

  private cleanupAfterDisjointEvent(queryEntry: QueryEntry) {
    this._extension.deleteQuery(queryEntry.query);
    if (undefined !== queryEntry.siblingQueries) {
      for (const sib of queryEntry.siblingQueries)
        this._extension.deleteQuery(sib);
      queryEntry.siblingQueries = undefined;
    }
    if (!queryEntry.children)
      return;
    for (const child of queryEntry.children)
      this.cleanupAfterDisjointEvent(child);
  }

  private pushQuery(label: string) {
    this._extension.endQuery();

    const query = this._extension.createQuery();
    this._extension.beginQuery(query);

    const activeQuery = this._queryStack[this._queryStack.length - 1];
    const queryEntry: QueryEntry = { label, query };
    this._queryStack.push(queryEntry);

    if (activeQuery.children === undefined)
      activeQuery.children = [queryEntry];
    else
      activeQuery.children.push(queryEntry);
  }

  private popQuery() {
    this._extension.endQuery();
    this._queryStack.pop();

    const lastStackIndex = this._queryStack.length - 1;
    const activeQuery = this._queryStack[lastStackIndex];
    if (undefined === activeQuery.siblingQueries)
      activeQuery.siblingQueries = [];
    const newQuery = this._extension.createQuery();
    activeQuery.siblingQueries.push(newQuery);
    this._extension.beginQuery(newQuery);
  }
}
