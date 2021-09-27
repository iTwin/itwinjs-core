/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { BackgroundMapWithProviderProps } from "./BackgroundMapSettings";

/** Describes the type of background map displayed by a [[DisplayStyle]]
 * @see [[BackgroundMapProps]]
 * @see [[DisplayStyleSettingsProps]]
 * @public
 */
export enum BackgroundMapType {
  Street = 1,
  Aerial = 2,
  Hybrid = 3,
}

/** The current set of supported background map providers.
 * @public
 */
export type BackgroundMapProviderName = "BingProvider" | "MapBoxProvider";

export interface BackgroundMapProviderProps {
  /** default "BingProvider" */
  name?: BackgroundMapProviderName;
  /** default Hybrid */
  type?: BackgroundMapType;
}

export class BackgroundMapProvider {
  public readonly name: BackgroundMapProviderName;
  public readonly type: BackgroundMapType;

  private constructor(name: BackgroundMapProviderName, type: BackgroundMapType) {
    this.name = name;
    this.type = type;
  }

  public static fromJSON(props: BackgroundMapProviderProps): BackgroundMapProvider {
    const name: BackgroundMapProviderName = props.name === "MapBoxProvider" ? props.name : "BingProvider";
    let type;
    switch (props.type) {
      case BackgroundMapType.Street:
      case BackgroundMapType.Aerial:
        type = props.type;
        break;
      default:
        type = BackgroundMapType.Hybrid;
        break;
    }

    return new BackgroundMapProvider(name, type);
  }

  public toJSON(): BackgroundMapProviderProps {
    return { name: this.name, type: this.type };
  }

  /** @internal */
  public static fromBackgroundMapProps(props: BackgroundMapWithProviderProps): BackgroundMapProvider {
    // eslint-disable-next-line deprecation/deprecation
    return this.fromJSON({ name: props.providerName as BackgroundMapProviderName, type: props.providerData?.mapType });
  }
}

