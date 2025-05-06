/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DynamicGraphicsRequest2dProps, DynamicGraphicsRequest3dProps, ElementGeometry, FlatBufferGeometryStream } from "@itwin/core-common";
import { IModelDb } from "../IModelDb";
import { Id64String } from "@itwin/core-bentley";

/** @packageDocumentation
 * @module Strokers
 */

export interface StrokerResults {
  graphics?: Uint8Array;
}

export interface StrokerResultOptions {
  wantGraphics?: boolean;
}

export type StrokerGraphicsRequestProps = (Omit<DynamicGraphicsRequest2dProps, "geometry"> | Omit<DynamicGraphicsRequest3dProps, "geometry">);

export abstract class Stroker<T> {
  protected _iModel: IModelDb;
  protected _builder: ElementGeometry.Builder;

  public get builder(): ElementGeometry.Builder { return this._builder; }

  public constructor(iModel: IModelDb, builder?: ElementGeometry.Builder) {
    this._iModel = iModel;
    this._builder = builder ?? new ElementGeometry.Builder();
  };

  // get rid of undefined, throw error instead; remove JsonGeometryStream
  public abstract createGeometry(props: T, category?: Id64String, subCategory?: Id64String): FlatBufferGeometryStream;

  public async computeLayoutResults(props: T, requestProps: StrokerGraphicsRequestProps, options?: StrokerResultOptions): Promise<StrokerResults> {
    if (undefined === options || options?.wantGraphics) {
      const geometry = this.createGeometry(props, requestProps.categoryId);
      const graphics = await this.requestGraphics(geometry, requestProps);
      return { graphics };
    }

    return {};
  };

  // TODO
  // protected abstract getStyles(props: T): StrokerResults | undefined;

  protected async requestGraphics(geometry: FlatBufferGeometryStream, requestProps: StrokerGraphicsRequestProps): Promise<Uint8Array | undefined> {
    const request = {
      ...requestProps,
      geometry,
    }

    return this._iModel.generateElementGraphics(request);
  }
}