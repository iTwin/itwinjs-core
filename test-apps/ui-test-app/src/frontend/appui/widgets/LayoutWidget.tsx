/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@itwin/core-frontend";
import {
  FrontstageDef, FrontstageManager, StagePanelState, useActiveFrontstageDef,
} from "@itwin/appui-react";
import { SpecialKey, StagePanelLocation, WidgetState } from "@itwin/appui-abstract";
import { NumberInput, RectangleProps } from "@itwin/core-react";
import { Button, Input, Select, SelectOption } from "@itwin/itwinui-react";

function usePanelDef(location: StagePanelLocation) {
  const frontstageDef = useActiveFrontstageDef();
  return frontstageDef?.getStagePanelDef(location);
}

function usePanelSize(location: StagePanelLocation) {
  const panelDef = usePanelDef(location);
  const [size, setSize] = React.useState(panelDef?.size);
  React.useEffect(() => {
    setSize(panelDef?.size);
  }, [panelDef]);
  React.useEffect(() => {
    const remove = FrontstageManager.onPanelSizeChangedEvent.addListener((e) => {
      if (e.panelDef.location === location)
        setSize(e.size);
    });
    return remove;
  }, [location]);
  return size;
}

function usePanelState(location: StagePanelLocation) {
  const panelDef = usePanelDef(location);
  const [state, setState] = React.useState(panelDef?.panelState);
  React.useEffect(() => {
    setState(panelDef?.panelState);
  }, [panelDef]);
  React.useEffect(() => {
    const remove = FrontstageManager.onPanelStateChangedEvent.addListener((e) => {
      if (e.panelDef.location === location)
        setState(e.panelState);
    });
    return remove;
  }, [location]);
  return state;
}

function usePanelInfo(location: StagePanelLocation) {
  const panelDef = usePanelDef(location);
  const state = usePanelState(location);
  const size = usePanelSize(location);
  const [pinned] = React.useState(panelDef?.pinned);
  const [resizable] = React.useState(panelDef?.resizable);
  return {
    size,
    pinned,
    resizable,
    state,
  };
}

function PanelInfo({
  location,
}: {
  location: StagePanelLocation;
}) {
  const { size, pinned, resizable, state } = usePanelInfo(location);
  return (
    <>
      <div>size={size}px</div>
      <div>pinned={String(pinned)}</div>
      <div>resizable={String(resizable)}</div>
      {state !== undefined && <div>state={StagePanelState[state]}</div>}
    </>
  );
}

function PanelSelect({
  location,
  onChange,
}: {
  location: StagePanelLocation;
  onChange(location: StagePanelLocation): void;
}) {
  const [options] = React.useState<Array<SelectOption<string>>>([
    { label: StagePanelLocation[StagePanelLocation.Left], value: StagePanelLocation[StagePanelLocation.Left] },
    { label: StagePanelLocation[StagePanelLocation.Top], value: StagePanelLocation[StagePanelLocation.Top] },
    { label: StagePanelLocation[StagePanelLocation.Right], value: StagePanelLocation[StagePanelLocation.Right] },
    { label: StagePanelLocation[StagePanelLocation.Bottom], value: StagePanelLocation[StagePanelLocation.Bottom] },
  ]);
  return (
    <Select style={{ width: "160px" }}
      options={options}
      value={StagePanelLocation[location]}
      onChange={(value) => {
        const newLocation = StagePanelLocation[value as keyof typeof StagePanelLocation];
        onChange(newLocation);
      }}
    />
  );
}

function WidgetSelect({
  id,
  onChange,
}: {
  id: string;
  onChange(id: string): void;
}) {
  const frontstageDef = useActiveFrontstageDef();
  const [options, setOptions] = React.useState<Array<SelectOption<string>>>([]);
  React.useEffect(() => {
    if (!frontstageDef) {
      setOptions([]);
      return;
    }
    const newOptions = [];
    for (const zoneDef of frontstageDef.zoneDefs) {
      newOptions.push(...zoneDef.widgetDefs.map((w) => ({ label: w.id, value: w.id })));
    }
    for (const panelDef of frontstageDef.panelDefs) {
      newOptions.push(...panelDef.widgetDefs.map((w) => ({ label: w.id, value: w.id })));
    }
    setOptions(newOptions);
  }, [frontstageDef]);
  return (
    <Select style={{ width: "160px" }}
      options={options}
      value={id}
      onChange={(value) => {
        onChange(value);
      }}
    />
  );
}

function SelectPanelInfo() {
  const [location, setLocation] = React.useState(StagePanelLocation.Right);
  return (
    <>
      <PanelSelect
        location={location}
        onChange={(l) => setLocation(l)}
      />
      <b> panel</b>
      <PanelInfo location={location} />
    </>
  );
}

function SelectWidgetInfo() {
  const [id, setId] = React.useState("RightStart2");
  return (
    <>
      <WidgetSelect
        id={id}
        onChange={(i) => setId(i)}
      />
      <b> widget</b>
      <WidgetInfo id={id} />
    </>
  );
}

function useWidgetDef(id: string) {
  const frontstageDef = useActiveFrontstageDef();
  return frontstageDef?.findWidgetDef(id);
}

function useWidgetState(id: string) {
  const widgetDef = useWidgetDef(id);
  const [state, setState] = React.useState(widgetDef?.state);
  React.useEffect(() => {
    setState(widgetDef?.state);
  }, [widgetDef]);
  React.useEffect(() => {
    const remove = FrontstageManager.onWidgetStateChangedEvent.addListener((e) => {
      if (e.widgetDef.id === id)
        setState(e.widgetState);
    });
    return remove;
  }, [id]);
  return state;
}

function WidgetInfo({
  id,
}: {
  id: string;
}) {
  const state = useWidgetState(id);
  const frontstageDef = useActiveFrontstageDef();
  const widgetDef = useWidgetDef(id);

  const [isFloating, setIsFloating] = React.useState(frontstageDef ? frontstageDef.isFloatingWidget(id) : false);
  const [isPopout, setIsPopout] = React.useState(frontstageDef ? frontstageDef.isPopoutWidget(id) : false);
  React.useEffect(() => {
    setIsFloating(frontstageDef ? frontstageDef.isFloatingWidget(id) : false);
    setIsPopout(frontstageDef ? frontstageDef.isPopoutWidget(id) : false);

    return FrontstageManager.onFrontstageNineZoneStateChangedEvent.addListener((e) => {
      if (e.frontstageDef === frontstageDef) {
        setIsFloating(frontstageDef ? frontstageDef.isFloatingWidget(id) : false);
        setIsPopout(frontstageDef ? frontstageDef.isPopoutWidget(id) : false);
      }
    });
  }, [frontstageDef, id]);

  const handleDockClick = React.useCallback(() => {
    frontstageDef!.dockWidgetContainer(id);
  }, [frontstageDef, id]);

  const [xPos, setXPos] = React.useState(50);
  const [yPos, setYPos] = React.useState(100);

  const handleFloatClick = React.useCallback(() => {
    frontstageDef!.floatWidget(id, { x: xPos, y: yPos });
  }, [frontstageDef, id, xPos, yPos]);

  const handlePopoutClick = React.useCallback(() => {
    frontstageDef!.popoutWidget(id, { x: xPos, y: yPos });
  }, [frontstageDef, id, xPos, yPos]);

  const handleXChanged = React.useCallback((value: number | undefined) => {
    if (undefined !== value)
      setXPos(value);
  }, []);

  const handleYChanged = React.useCallback((value: number | undefined) => {
    if (undefined !== value)
      setYPos(value);
  }, []);

  return (
    <>
      {state !== undefined && <div>state={WidgetState[state]}</div>}
      {<div>Location={isFloating ? "Floating" : isPopout ? "Pop-out" : "Panel"}</div>}
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex" }}>
          <span>X:</span>
          <NumberInput style={{ width: "60px" }} disabled={isFloating} value={xPos} step={5} onChange={handleXChanged} />
        </div>
        <div style={{ display: "flex" }}>
          <span>Y:</span>
          <NumberInput style={{ width: "60px" }} disabled={isFloating} value={yPos} step={5} onChange={handleYChanged} />
        </div>
        <Button disabled={isFloating} onClick={handleFloatClick} >Float</Button>
        <Button disabled={isPopout || !widgetDef?.canPopout} onClick={handlePopoutClick} >Pop Out</Button>
      </div>
      <Button disabled={!(isFloating || isPopout)} onClick={handleDockClick} >Dock</Button>
    </>
  );
}

function FrontstageControls() {
  return (
    <>
      <b>Frontstage controls</b>
      <br />
      <button onClick={() => {
        const frontstageDef = FrontstageManager.activeFrontstageDef;
        frontstageDef?.restoreLayout();
      }}>Restore layout</button>
    </>
  );
}

function PanelStateSelect({
  state,
  onChange,
}: {
  state: StagePanelState | undefined;
  onChange(state: StagePanelState): void;
}) {
  const [options] = React.useState<Array<SelectOption<string>>>([
    { label: StagePanelState[StagePanelState.Open], value: StagePanelState[StagePanelState.Open] },
    { label: StagePanelState[StagePanelState.Minimized], value: StagePanelState[StagePanelState.Minimized] },
    { label: StagePanelState[StagePanelState.Off], value: StagePanelState[StagePanelState.Off] },
  ]);
  return (
    <Select style={{ width: "160px" }}
      placeholder="State"
      options={options}
      value={state === undefined ? "placeholder" : StagePanelState[state]}
      onChange={(value) => {
        const newState = StagePanelState[value as keyof typeof StagePanelState];
        onChange(newState);
      }}
    />
  );
}

function WidgetStateSelect({
  state,
  onChange,
}: {
  state: WidgetState | undefined;
  onChange(state: WidgetState): void;
}) {
  const [options] = React.useState([
    { label: WidgetState[WidgetState.Open], value: WidgetState[WidgetState.Open] },
    { label: WidgetState[WidgetState.Closed], value: WidgetState[WidgetState.Closed] },
    { label: WidgetState[WidgetState.Hidden], value: WidgetState[WidgetState.Hidden] },
    { label: WidgetState[WidgetState.Unloaded], value: WidgetState[WidgetState.Unloaded] },
  ]);
  return (
    <Select style={{ width: "160px" }}
      placeholder="State"
      options={options}
      value={state === undefined ? "placeholder" : WidgetState[state]}
      onChange={(value) => {
        const newState = WidgetState[value as keyof typeof WidgetState];
        onChange(newState);
      }}
    />
  );
}

function PanelControls({
  location,
}: {
  location: StagePanelLocation;
}) {
  const [state, setState] = React.useState<StagePanelState | undefined>(undefined);
  const [sizeValue, setSizeValue] = React.useState<string>("");
  const handleSubmitValue = () => {
    setSizeValue("");
    const frontstageDef = FrontstageManager.activeFrontstageDef;
    const panelDef = frontstageDef?.getStagePanelDef(location);
    if (!panelDef)
      return;
    if (sizeValue === "")
      return;
    panelDef.size = Number(sizeValue);
  };
  return (
    <>
      <Input
        type="number"
        placeholder="Size"
        value={sizeValue}
        style={{
          display: "inline-block",
          width: "auto",
        }}
        onChange={(e) => {
          setSizeValue(e.target.value);
        }}
        onBlur={handleSubmitValue}
        onKeyDown={(e) => {
          switch (e.key) {
            case SpecialKey.Enter: {
              handleSubmitValue();
              break;
            }
            case SpecialKey.Escape: {
              setSizeValue("");
              break;
            }
          }
        }}
      />
      <button onClick={() => {
        const frontstageDef = FrontstageManager.activeFrontstageDef;
        const panelDef = frontstageDef?.getStagePanelDef(location);
        if (!panelDef)
          return;
        panelDef.size = undefined;
      }}>setSize(undefined)</button>
      <br />
      <PanelStateSelect
        state={state}
        onChange={(newState) => {
          setState(undefined);
          const frontstageDef = FrontstageManager.activeFrontstageDef;
          const panelDef = frontstageDef?.getStagePanelDef(location);
          if (!panelDef)
            return;
          panelDef.panelState = newState;
        }}
      />
    </>
  );
}

function WidgetControls({
  id,
}: {
  id: string;
}) {
  const [state, setState] = React.useState<WidgetState | undefined>(undefined);
  return (
    <>
      <WidgetStateSelect
        state={state}
        onChange={(s) => {
          setState(undefined);
          const frontstageDef = FrontstageManager.activeFrontstageDef;
          const widgetDef = frontstageDef?.findWidgetDef(id);
          widgetDef?.setWidgetState(s);
        }}
      />
      <br />
      <button onClick={() => {
        const frontstageDef = FrontstageManager.activeFrontstageDef;
        const widgetDef = frontstageDef?.findWidgetDef(id);
        widgetDef?.show();
      }}>Show</button>
      <button onClick={() => {
        const frontstageDef = FrontstageManager.activeFrontstageDef;
        const widgetDef = frontstageDef?.findWidgetDef(id);
        widgetDef?.expand();
      }}>Expand</button>
    </>
  );
}

function SelectPanelControls() {
  const [location, setLocation] = React.useState(StagePanelLocation.Right);
  return (
    <>
      <PanelSelect
        location={location}
        onChange={(l) => setLocation(l)}
      />
      <b> panel controls</b>
      <br />
      <PanelControls location={location} />
    </>
  );
}

function SelectWidgetControls() {
  const [id, setId] = React.useState("RightStart2");
  return (
    <>
      <WidgetSelect
        id={id}
        onChange={(i) => setId(i)}
      />
      <b> widget controls</b>
      <br />
      <WidgetControls id={id} />
    </>
  );
}

const widgetContentStyle: React.CSSProperties = {
  padding: "5px",
  boxSizing: "border-box",
};

function WidgetContent(props: React.PropsWithChildren<{}>) {
  return (
    <div style={widgetContentStyle}>
      {props.children}
    </div>
  );
}

export function LayoutControls() {
  return (
    <WidgetContent>
      <SelectPanelControls />
      <br />
      <br />
      <SelectWidgetControls />
      <br />
      <br />
      <FrontstageControls />
    </WidgetContent>
  );
}

export function LayoutInfo() {
  return (
    <WidgetContent>
      <SelectPanelInfo />
      <br />
      <SelectWidgetInfo />
    </WidgetContent>
  );
}

function FloatingWidgetSelect({
  id,
  onChange,
  allIds,
}: {
  id?: string;
  onChange?(id: string): void;
  allIds: string[];
}) {
  const [options, setOptions] = React.useState<Array<SelectOption<string>>>([]);
  React.useEffect(() => {

    if (0 === allIds.length) {
      setOptions([]);
      return;
    }
    const newOptions = [];
    for (const floatingWidgetId of allIds) {
      newOptions.push({ label: floatingWidgetId, value: floatingWidgetId });
    }
    setOptions(newOptions);
  }, [allIds]);

  return (
    <Select style={{ width: "360px" }}
      options={options}
      value={id}
      onChange={(value) => {
        onChange && onChange(value);
      }}
    />
  );
}

function getFloatingWidgetContainerBounds(frontstageDef: FrontstageDef | undefined, floatingWidgetId: string | undefined) {
  const defaultBounds = { left: 0, right: 0, top: 0, bottom: 0 };
  const foundBounds = frontstageDef?.getFloatingWidgetContainerBounds(floatingWidgetId ?? "");
  return foundBounds ?? defaultBounds;
}

export function FloatingLayoutInfo() {
  const frontstageDef = useActiveFrontstageDef();
  const [floatingIds, setFloatingIds] = React.useState(() => frontstageDef ? frontstageDef.getFloatingWidgetContainerIds() : []);
  const [floatingWidgetId, setFloatingWidgetId] = React.useState<string | undefined>(floatingIds?.length ? floatingIds[0] : undefined);
  const [bounds, setBounds] = React.useState<RectangleProps>(() => getFloatingWidgetContainerBounds(frontstageDef, floatingWidgetId));
  React.useEffect(() => {
    return FrontstageManager.onFrontstageNineZoneStateChangedEvent.addListener((e) => {
      if (e.frontstageDef === frontstageDef) {
        const allIds = frontstageDef ? frontstageDef.getFloatingWidgetContainerIds() : [];
        setFloatingIds(allIds);
        let widgetId = floatingWidgetId;
        if (!floatingWidgetId || !allIds.includes(floatingWidgetId)) {
          widgetId = allIds.length ? allIds[0] : undefined;
          setFloatingWidgetId(widgetId);
        }
        // give time for DOM to be updated
        setImmediate(() => {
          setBounds(getFloatingWidgetContainerBounds(frontstageDef, widgetId));
        });
      }
    });
  }, [frontstageDef, floatingWidgetId]);

  const handleWidgetIdChanged = React.useCallback((widgetId: string) => {
    setFloatingWidgetId(widgetId);
    setBounds(getFloatingWidgetContainerBounds(frontstageDef, widgetId));
  }, [frontstageDef]);

  const handleBoundsChanged = React.useCallback((side: "left" | "top" | "bottom" | "right", value: number) => {
    if (floatingWidgetId && frontstageDef) {
      const newBounds = { ...bounds };
      switch (side) {
        case "left":
          newBounds.left = value;
          break;
        case "right":
          newBounds.right = value;
          break;
        case "top":
          newBounds.top = value;
          break;
        case "bottom":
          newBounds.bottom = value;
          break;
      }
      // setBounds(newBounds);
      frontstageDef.setFloatingWidgetContainerBounds(floatingWidgetId, newBounds);
    }
  }, [bounds, floatingWidgetId, frontstageDef]);

  const [widgetIdToLocate, setWidgetIdToLocate] = React.useState<string | undefined>();
  const handleSetWidgetIdToLocate = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setWidgetIdToLocate(e.target.value);
  }, []);

  const handleLookup = React.useCallback(() => {
    if (widgetIdToLocate && frontstageDef) {
      const containerId = frontstageDef.getFloatingWidgetContainerIdByWidgetId(widgetIdToLocate);
      const briefMessage = containerId ? `ContainerId='${containerId}' for WidgetId='${widgetIdToLocate}'` :
        `No Floating Container found for WidgetId='${widgetIdToLocate}'`;
      const info = new NotifyMessageDetails(OutputMessagePriority.Info, briefMessage, undefined, OutputMessageType.Toast);
      IModelApp.notifications.outputMessage(info);
    }
  }, [frontstageDef, widgetIdToLocate]);

  return (
    <WidgetContent>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", rowGap: "4px", columnGap: "8px", alignItems: "center" }} >
        <span style={{ textAlign: "end" }} >Container Id:</span>
        <FloatingWidgetSelect allIds={floatingIds} id={floatingWidgetId} onChange={handleWidgetIdChanged} />
        <span style={{ textAlign: "end" }} >Left:</span>
        <NumberInput containerStyle={{ width: "80px" }} value={bounds.left} step={5} onChange={(value) => handleBoundsChanged("left", value ?? 0)} />
        <span style={{ textAlign: "end" }} >Top:</span>
        <NumberInput containerStyle={{ width: "80px" }} value={bounds.top} step={5} onChange={(value) => handleBoundsChanged("top", value ?? 0)} />
        <span style={{ textAlign: "end" }} >Right:</span>
        <NumberInput containerStyle={{ width: "80px" }} value={bounds.right} step={5} onChange={(value) => handleBoundsChanged("right", value ?? 0)} />
        <span style={{ textAlign: "end" }} >Bottom:</span>
        <NumberInput containerStyle={{ width: "80px" }} value={bounds.bottom} step={5} onChange={(value) => handleBoundsChanged("bottom", value ?? 0)} />
        <Input placeholder="Enter Widget Id to find" onChange={handleSetWidgetIdToLocate} defaultValue={widgetIdToLocate} />
        <Button styleType="high-visibility" style={{ width: "160px" }} disabled={!widgetIdToLocate} onClick={handleLookup} >Lookup ContainerId</Button>
      </div>
    </WidgetContent>
  );
}
