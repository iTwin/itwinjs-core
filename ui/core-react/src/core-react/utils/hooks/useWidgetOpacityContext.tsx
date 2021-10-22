/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import * as React from "react";

/** Properties for [[WidgetOpacityContext]]
 * @internal
 */
export interface WidgetOpacityContextProps {
  readonly onElementRef: (elementRef: React.RefObject<Element>) => void;
  readonly proximityScale: number;
}

/**
 * Context used by Widgets and child components to process opacity changes based on mouse proximity.
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const WidgetOpacityContext = React.createContext<WidgetOpacityContextProps>({
  onElementRef: /* istanbul ignore next */ (_elementRef: React.RefObject<Element>) => void {},
  proximityScale: 1.0,
});

/** Hook for using [[WidgetOpacityContext]]
 * @internal
 */
export function useWidgetOpacityContext() {
  return React.useContext(WidgetOpacityContext);
}
