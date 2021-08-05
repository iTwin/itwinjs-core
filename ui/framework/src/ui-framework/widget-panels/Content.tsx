/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */
import * as React from "react";
import { UiItemsManager } from "@bentley/ui-abstract";
import { ScrollableWidgetContent, TabIdContext } from "@bentley/ui-ninezone";
import { useActiveFrontstageDef } from "../frontstage/Frontstage";
import { WidgetDef } from "../widgets/WidgetDef";
import { UiFramework } from "../UiFramework";

/** @internal */
export function WidgetContent() {
  const widget = useWidgetDef();
  return (
    <ScrollableWidgetContent>
      {widget?.reactNode}
    </ScrollableWidgetContent>
  );
}

/** @internal */
export function useWidgetDef(): WidgetDef | undefined {
  const tabId = React.useContext(TabIdContext);
  const frontstage = useActiveFrontstageDef();
  const [widgetDef, setWidgetDef] = React.useState(frontstage?.findWidgetDef(tabId));

  React.useEffect(() => {
    setWidgetDef(frontstage?.findWidgetDef(tabId));
  }, [frontstage, tabId]);

  React.useEffect(() => {
    // istanbul ignore next
    const handlerActivated = () => {
      setWidgetDef(frontstage?.findWidgetDef(tabId));
    };

    return UiFramework.widgetManager.onWidgetProvidersChanged.addListener(handlerActivated);
  }, [frontstage, tabId]);

  React.useEffect(() => {
    // istanbul ignore next
    const handlerActivated = () => {
      setWidgetDef(frontstage?.findWidgetDef(tabId));
    };

    return UiItemsManager.onUiProviderRegisteredEvent.addListener(handlerActivated);
  }, [frontstage, tabId]);

  return widgetDef;
}
