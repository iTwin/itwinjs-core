/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */
import * as React from "react";
import { UiItemsManager } from "@itwin/appui-abstract";
import { ScrollableWidgetContent, TabIdContext } from "@itwin/appui-layout-react";
import { useActiveFrontstageDef } from "../frontstage/Frontstage";
import { WidgetDef } from "../widgets/WidgetDef";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { FrontstageNineZoneStateChangedEventArgs } from "../frontstage/FrontstageDef";
import { useRefState } from "@itwin/core-react";

function ExternalContentHost(props: { attachToDom: ((container: HTMLElement) => void) | undefined }) {
  const { attachToDom } = props;
  const [containerRef, container] = useRefState<HTMLDivElement>();
  React.useEffect(() => {
    if (container && attachToDom)
      attachToDom(container);
  }, [attachToDom, container]);

  return <div data-item-id="widget-attachment-node" ref={containerRef} />;
}

/** @internal */
export function WidgetContent() {
  const widget = useWidgetDef();
  const reactNode = widget?.reactNode;
  const attachToDom = widget?.attachToDom;

  // istanbul ignore next
  const itemId = widget?.id ?? widget?.label ?? "unknown";
  const children = React.useMemo(() => {
    if (attachToDom) {
      return <ExternalContentHost attachToDom={attachToDom} />;
    } else {
      return reactNode;
    }
  }, [reactNode, attachToDom]);
  return (
    <ScrollableWidgetContent itemId={itemId}>
      {children}
    </ScrollableWidgetContent>
  );
}

/** @internal */
export function useWidgetDef(): WidgetDef | undefined {
  const tabId = React.useContext(TabIdContext);
  const frontstage = useActiveFrontstageDef();
  const [widgetDef, setWidgetDef] = React.useState(() => frontstage?.findWidgetDef(tabId));

  React.useEffect(() => {
    const listener = (args: FrontstageNineZoneStateChangedEventArgs) => {
      // istanbul ignore next
      if (args.frontstageDef !== frontstage || !frontstage || frontstage.isStageClosing || frontstage.isApplicationClosing)
        return;
      setWidgetDef(frontstage.findWidgetDef(tabId));
    };
    return FrontstageManager.onFrontstageNineZoneStateChangedEvent.addListener(listener);
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
