/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useActiveFrontstageDef, useActiveViewport, WidgetState } from "@itwin/appui-react";
import { ToggleSwitch } from "@itwin/itwinui-react";
import { ViewFlagProps, ViewFlags } from "@itwin/core-common";
import * as React from "react";
import { IModelApp, Viewport } from "@itwin/core-frontend";

export function useWidgetDef(id: string) {
  const frontstageDef = useActiveFrontstageDef();
  return frontstageDef?.findWidgetDef(id);
}
// eslint-disable-next-line @typescript-eslint/naming-convention
export function ToggleCameraItem() {
  const activeViewport = useActiveViewport();
  const [cameraOn, setCameraOn] = React.useState(activeViewport?.isCameraOn);

  React.useEffect(() => {
    const handleViewChanged = (vp: Viewport): void => {
      setCameraOn(vp.isCameraOn);
    };
    return activeViewport?.onChangeView.addListener(handleViewChanged);
  }, [activeViewport]);

  const onToggleCamera = React.useCallback(async () => {
    if (activeViewport) {
      await IModelApp.tools.run("View.ToggleCamera", activeViewport);
      setCameraOn(activeViewport.isCameraOn);
    }
  }, [activeViewport]);

  return (<ToggleSwitch key={"toggleCamera"} label={"Camera"} labelPosition={"right"} onChange={onToggleCamera} checked={cameraOn} />);
}
// eslint-disable-next-line @typescript-eslint/naming-convention
export function ViewFlagItem(flagName: string) {
  const activeViewport = useActiveViewport();

  const flagValue = React.useCallback((name: string, vp?: Viewport) => {
    const props: ViewFlagProps | undefined = vp?.viewFlags.toJSON();
    return (props && (props as any)[name] === undefined ? false : (props as any)[name]);
  }, []);

  const [value, setValue] = React.useState(flagValue(flagName, activeViewport));

  React.useEffect(() => {
    const handleViewChanged = (vp: Viewport): void => {
      const props: ViewFlagProps = vp.viewFlags.toJSON();
      (props as any)[flagName] = (props as any)[flagName] === undefined ? false : (props as any)[flagName];
      const viewFlags = ViewFlags.fromJSON(props);
      vp.viewFlags = viewFlags;
      setValue((props as any)[flagName] === undefined ? false : (props as any)[flagName]);
    };

    return activeViewport?.onChangeView.addListener(handleViewChanged);
  }, [activeViewport, flagName]);

  const onViewFlagChanged = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (activeViewport) {
      const props: ViewFlagProps = activeViewport.viewFlags.toJSON();
      (props as any)[flagName] = (props as any)[flagName] === undefined ? checked : !(props as any)[flagName];
      const viewFlags = ViewFlags.fromJSON(props);
      activeViewport.viewFlags = viewFlags;
      setValue((props as any)[flagName] === undefined ? false : (props as any)[flagName]);
    }
  }, [activeViewport, flagName]);

  const stylizedName = React.useCallback((name: string) => {
    name = name.charAt(0).toUpperCase() + name.slice(1);
    name = name.replace(/([A-Z])/g, " $1").trim();
    return name;
  }, []);

  return (<ToggleSwitch key={flagName} label={stylizedName(flagName)} labelPosition={"right"} onChange={onViewFlagChanged} checked={value} />);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function ViewAttributesWidgetComponent() {
  const widgetDef = useWidgetDef("appui-test-providers:ViewAttributesWidget");
  React.useEffect(() => {
    // using setTimeout to give time for frontstage to load before calling setWidgetState
    setTimeout(() => widgetDef?.setWidgetState(WidgetState.Floating));
  }, [widgetDef]);
  const items: React.ReactElement[] = [];
  items.push(ViewFlagItem("acs"));
  items.push(ToggleCameraItem());
  items.push(ViewFlagItem("noConstruct"));
  items.push(ViewFlagItem("hidEdges"));
  items.push(ViewFlagItem("monochrome"));
  items.push(ViewFlagItem("visEdges"));
  items.push(ViewFlagItem("ambientOcclusion"));
  items.push(ViewFlagItem("shadows"));
  items.push(ViewFlagItem("backgroundMap"));

  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "8px", overflowY: "auto" }}>
      {items}
    </div>
  );
}
