/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Observable } from "rxjs";
import { GetContentRequestOptions, MultipleValuesRequestOptions } from "./PresentationManager";
import { Descriptor, Item } from "@itwin/presentation-common";

/**
 * Provider of PresentationManager functionality.
 * @internal
 */
export interface PresentationManagerInternalImpl {
  getContentObservable(
    requestOptions: GetContentRequestOptions & MultipleValuesRequestOptions,
  ): Promise<{ descriptor: Descriptor; total: number; items: Observable<Item> } | undefined>;
}

/**
 * This class contains additional functionality of PresentationManager that shouldn't be exposed to the API.
 * @internal
 */
export class PresentationManagerInternal {
  constructor(private readonly _impl: PresentationManagerInternalImpl) {}

  public async getContentObservable(
    requestOptions: GetContentRequestOptions & MultipleValuesRequestOptions,
  ): Promise<{ descriptor: Descriptor; total: number; items: Observable<Item> } | undefined> {
    return this._impl.getContentObservable(requestOptions);
  }
}
