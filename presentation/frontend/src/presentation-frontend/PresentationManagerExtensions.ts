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
export interface PresentationManagerProvider {
  getContentObservable(
    requestOptions: GetContentRequestOptions & MultipleValuesRequestOptions,
  ): Promise<{ descriptor: Descriptor; total: number; items: Observable<Item> } | undefined>;
}

/**
 * This class contains additional functionality of PresentationManager that shouldn't be exposed to the API.
 * @internal
 */
export class PresentationManagerExtensions {
  private static _provider?: PresentationManagerProvider;

  public static set provider(provider: PresentationManagerProvider) {
    this._provider = provider;
  }

  public static async getContentObservable(
    requestOptions: GetContentRequestOptions & MultipleValuesRequestOptions,
  ): Promise<{ descriptor: Descriptor; total: number; items: Observable<Item> } | undefined> {
    return this._provider!.getContentObservable(requestOptions);
  }
}
