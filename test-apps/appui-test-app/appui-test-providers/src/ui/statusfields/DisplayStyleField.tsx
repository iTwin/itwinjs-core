/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import "./DisplayStyleField.scss";
import classnames from "classnames";
import * as React from "react";
import { Id64String } from "@itwin/core-bentley";
import { DisplayStyle2dState, DisplayStyle3dState, DisplayStyleState, ScreenViewport } from "@itwin/core-frontend";
import { ContentControl, ContentControlActivatedEventArgs, ContentViewManager, FrontstageManager } from "@itwin/appui-react";
import { FooterIndicator } from "@itwin/appui-layout-react";
import { Select, SelectOption } from "@itwin/itwinui-react";
import { AppUiTestProviders } from "../../AppUiTestProviders";
import { CommonProps } from "@itwin/core-react";

/**
 * This component is designed to be specified in a status bar definition to select the display style in the active IModel view.
 * It is used to enable/disable display of shadows.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function DisplayStyleField(props: CommonProps) {
  const [viewport, setViewport] = React.useState<ScreenViewport | undefined>();
  const [displayStyles, setDisplayStyles] = React.useState(() => new Map<Id64String, DisplayStyleState>());
  const [styleEntries, setStyleEntries] = React.useState<SelectOption<string>[]>(() => []);
  const [displayStyleId, setDisplayStyleId] = React.useState("");

  const [label] = React.useState(() => AppUiTestProviders.translate("statusFields.displayStyle.label"));
  const [tooltip] = React.useState(() => AppUiTestProviders.translate("statusFields.displayStyle.tooltip"));

  const setStateFromActiveContent = React.useCallback(async (contentControl?: ContentControl) => {
    if (contentControl && contentControl.viewport) {
      const unnamedPrefix = AppUiTestProviders.translate("SampleApp:statusFields.unnamedDisplayStyle");
      const newDisplayStyles = new Map<Id64String, DisplayStyleState>();
      const view = contentControl.viewport.view;
      const is3d = view.is3d();
      const sqlName: string = is3d ? DisplayStyle3dState.classFullName : DisplayStyle2dState.classFullName;
      const displayStyleProps = await view.iModel.elements.queryProps({ from: sqlName, where: "IsPrivate=FALSE" });
      const newStyleEntries: SelectOption<string>[] = [];
      let emptyNameSuffix = 0;
      for (const displayStyleProp of displayStyleProps) {
        let name = displayStyleProp.code.value!;
        if (0 === name.length) {
          emptyNameSuffix++;
          name = `${unnamedPrefix}-${emptyNameSuffix}`;
        }
        newStyleEntries.push({ value: displayStyleProp.id!, label: name });
        let displayStyle: DisplayStyleState;
        if (is3d)
          displayStyle = new DisplayStyle3dState(displayStyleProp, view.iModel);
        else
          displayStyle = new DisplayStyle2dState(displayStyleProp, view.iModel);
        newDisplayStyles.set(displayStyleProp.id!, displayStyle);
      }

      setDisplayStyles(newDisplayStyles);
      setStyleEntries(newStyleEntries);
      setViewport(contentControl.viewport);
      setDisplayStyleId(contentControl.viewport.view.displayStyle.id);
    }
  }, []);

  React.useEffect(() => {
    const handleContentControlActivatedEvent = (args: ContentControlActivatedEventArgs) => {
      setTimeout(async () => setStateFromActiveContent(args.activeContentControl));
    };

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    setStateFromActiveContent(ContentViewManager.getActiveContentControl());

    return FrontstageManager.onContentControlActivatedEvent.addListener(handleContentControlActivatedEvent);
  }, [setStateFromActiveContent]);

  const handleDisplayStyleSelected = React.useCallback(async (newValue: string) => {
    if (!viewport)
      return;

    const style = displayStyles.get(newValue)!.clone();
    if (style) {
      await style.load();
      viewport.displayStyle = style;
      viewport.invalidateScene();
      viewport.synchWithView();
      setDisplayStyleId(newValue);
    }
  }, [displayStyles, viewport]);

  if (!viewport)
    return null;

  return (
    <FooterIndicator
      className={classnames("uifw-statusFields-displayStyle", props.className)}
      style={props.style}
      isInFooterMode={true}
    >
      <Select options={styleEntries} value={displayStyleId} onChange={handleDisplayStyleSelected}
        title={tooltip} aria-label={label}
        className="uifw-statusFields-displayStyle-selector"
        size="small" />
    </FooterIndicator >
  );
}
