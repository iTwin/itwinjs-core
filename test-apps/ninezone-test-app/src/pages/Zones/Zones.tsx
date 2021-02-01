/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";
import "./Zones.scss";
import * as React from "react";
import { ActionButton, GroupButton, BadgeType } from "@bentley/ui-abstract";
import { ToolbarItem, ToolbarWithOverflow, UiComponents } from "@bentley/ui-components";
import { Point, BadgeUtilities } from "@bentley/ui-core";
import {
  NineZone,
  addPanelWidget,
  addTab,
  createNineZoneState,
  NineZoneStateReducer,
  Footer,
  ToolbarPanelAlignment,
  Direction,
  WidgetPanels,
  TabIdContext,
  useTransientState,
  FloatingWidgets,
  NavigationArea,
  AppButton,
  ToolsArea,
  ScrollableWidgetContent,
  NineZoneLabels,
  NineZoneDispatchContext,
  PanelSide,
  findTab,
  NineZoneContext,
  createPanelsState,
  createHorizontalPanelState,
  WidgetTab,
  TabStateContext,
  createVerticalPanelState,
  isHorizontalPanelSide,
} from "@bentley/ui-ninezone";
import { ToolSettingProps } from "./ToolSetting";
import ToolSettings from "./ToolSettings";

let id = 0;
const getId = () => {
  return id++;
};

const iconNames = ["icon-app-1", "icon-app-2", "icon-smiley-happy", "icon-smiley-neutral", "icon-smiley-sad", "icon-star-hollow", "icon-help-hollow"];
function getChildItem(tool: SimpleTool, index: number): GroupButton | ActionButton {
  if (tool.items) {
    const children = tool.items.map((childTool: SimpleTool, childIndex: number) => {
      return getChildItem(childTool, childIndex);
    });
    return {
      id: `${tool.id}-${index}`,
      itemPriority: index * 10,
      icon: iconNames[index],
      label: tool.id,
      panelLabel: `Panel ${tool.id}`,
      isDisabled: tool.isDisabled,
      isActive: tool.isActive,
      items: children,
    };
  }
  return getActionButtonFromSimpleTool(tool, index);
}

function getToolbarItem(tool: SimpleTool, index: number): ToolbarItem {
  if (tool.panel) {
    return {
      id: `${tool.id}-${index}`,
      itemPriority: index * 10,
      icon: iconNames[index],
      label: tool.id,
      isDisabled: tool.isDisabled,
      isActive: tool.isActive,
      isCustom: true,
      panelContentNode: tool.panel,
    };
  } else if (tool.items) {
    const children = tool.items.map((childTool: SimpleTool, childIndex: number) => {
      return getChildItem(childTool, childIndex);
    });
    return {
      id: `${tool.id}-${index}`,
      itemPriority: index * 10,
      icon: iconNames[index],
      label: tool.id,
      panelLabel: `Panel ${tool.id}`,
      isDisabled: tool.isDisabled,
      isActive: tool.isActive,
      items: children,
    };
  }
  return getActionButtonFromSimpleTool(tool, index);
}

interface SimpleTool {
  readonly id: string;
  readonly isActive?: boolean;
  readonly isDisabled?: boolean;
  readonly isHidden?: boolean;
  readonly panel?: React.ReactNode;
  readonly items?: SimpleTool[];
}

function handleClick() {
  // eslint-disable-next-line no-console
  console.log("click");
}

const getActionButtonFromSimpleTool = (tool: SimpleTool, index: number) => {
  return {
    id: `${tool.id}-${index}`,
    itemPriority: index * 10,
    icon: iconNames[index],
    label: tool.id,
    isDisabled: tool.isDisabled,
    isActive: tool.isActive,
    execute: handleClick,
  };
};

function DemoToolWidget() {
  const horizontalTools = [
    { id: "toolH1" },
    { id: "toolH2", isDisabled: true },
    { id: "toolH3", isActive: true },
    { id: "toolH4" },
    { id: "toolHP1", panel: <div>This is a very long Hello World!</div> },
    { id: "toolHG1", items: [{ id: "toolGi1" }, { id: "toolGi2" }, { id: "toolGi3" }] },
  ];

  const verticalTools = [
    { id: "toolV1" },
    { id: "toolV2", isDisabled: true },
    { id: "toolVG1", items: [{ id: "toolGi1" }, { id: "toolGi2" }, { id: "toolGi3", items: [{ id: "toolngi1" }, { id: "toolngi2" }, { id: "toolngi3" }] }] },
    { id: "toolV3", isActive: true },
    { id: "toolCP1", panel: <div><p>Hello World!</p><p>Hello World!</p><p>Hello World!</p></div> },
    { id: "toolV4" },
  ];

  return <ToolsArea
    button={
      <AppButton icon={<i className="icon icon-home" />}
        onClick={() => { }}
      />
    }

    horizontalToolbar={
      horizontalTools.length > 0 &&
      <ToolbarWithOverflow
        expandsTo={Direction.Bottom}
        overflowExpandsTo={Direction.Right}
        items={horizontalTools.map((tool: SimpleTool, index: number) => getToolbarItem(tool, index))}
        panelAlignment={ToolbarPanelAlignment.Start}
        useDragInteraction
      />
    }

    verticalToolbar={
      verticalTools.length > 0 &&
      <ToolbarWithOverflow
        expandsTo={Direction.Right}
        overflowExpandsTo={Direction.Top}
        items={verticalTools.map((tool: SimpleTool, index: number) => getToolbarItem(tool, index))}
        panelAlignment={ToolbarPanelAlignment.Start}
        useDragInteraction
      />
    }
  />;
}

function DemoNavigationWidget() {
  const horizontalTools = [
    { id: "toolH1" },
    { id: "toolH2", isDisabled: true },
    { id: "toolH3", isActive: true },
    { id: "toolH4" },
    { id: "toolHP1", panel: <div>This is a very long Hello World!</div> },
    { id: "toolHG1", items: [{ id: "toolGi1" }, { id: "toolGi2" }, { id: "toolGi3" }] },
  ];

  const verticalTools = [
    { id: "toolV1" },
    { id: "toolV2", isDisabled: true },
    { id: "toolV3", isActive: true },
    { id: "toolVP1", panel: <div><p>Hello World!</p><p>Hello World!</p><p>Hello World!</p></div> },
    { id: "toolV4" },
  ];

  return <NavigationArea
    horizontalToolbar={
      horizontalTools.length > 0 &&
      <ToolbarWithOverflow
        expandsTo={Direction.Bottom}
        overflowExpandsTo={Direction.Left}
        items={horizontalTools.map((tool: SimpleTool, index: number) => getToolbarItem(tool, index))}
        useDragInteraction
      />
    }

    verticalToolbar={
      verticalTools.length > 0 &&
      <ToolbarWithOverflow
        expandsTo={Direction.Left}
        overflowExpandsTo={Direction.Top}
        items={verticalTools.map((tool: SimpleTool, index: number) => getToolbarItem(tool, index))}
        panelAlignment={ToolbarPanelAlignment.Start}
        useDragInteraction
      />
    }
  />;
}

const useSettings = () => {
  const [settings, setSettings] = React.useState<ReadonlyArray<ToolSettingProps>>(() => [
    {
      id: `Checkbox ${getId()}`,
      type: "checkbox",
    },
    {
      id: `Checkbox ${getId()}`,
      type: "checkbox",
    },
    {
      id: `Select ${getId()}`,
      type: "select",
    },
    {
      id: `Select ${getId()}`,
      type: "select",
    },
    {
      id: `Select ${getId()}`,
      type: "select",
    },
    {
      id: `Select ${getId()}`,
      type: "select",
    },
  ]);
  return React.useMemo(() => ({
    settings,
    remove: () => {
      setSettings([
        ...settings.slice(0, -1),
      ]);
    },
    removeFromStart: () => {
      setSettings([
        ...settings.slice(1),
      ]);
    },
    add: () => {
      setSettings([
        ...settings,
        {
          id: `Checkbox ${getId()}`,
          type: "checkbox",
        },
      ]);
    },
    addToStart: () => {
      setSettings([
        {
          id: `Checkbox ${getId()}`,
          type: "checkbox",
        },
        ...settings,
      ]);
    },
    update: () => {
      const removed = settings[settings.length - 1];
      setSettings([
        ...settings.slice(0, -1),
        {
          ...removed,
          type: "select",
        },
      ]);
    },
  }), [settings]);
};

const page = function () {
  let status = "pending";
  let suspender = UiComponents.initialize({
    registerNamespace: () => ({ name: "", readFinished: Promise.resolve() }),
    translateWithNamespace: () => Promise.resolve(),
  } as any).then(
    () => {
      status = "done";
    },
    (e) => {
      status = "error";
      console.log(e);
    }
  );
  return {
    initialize: () => {
      if (status === "pending")
        throw suspender;
      else if (status === "error")
        throw new Error();
      else if (status === "done")
        return;
    },
  }
}();


function Tab() {
  const { id } = React.useContext(TabStateContext);
  if (id === "leftStart_2")
    return <WidgetTab className="nzdemo-tab-new" badge={BadgeUtilities.getComponentForBadgeType(BadgeType.New)} />;
  else if (id === "leftEnd_1" || id === "leftStart_4")
    return <WidgetTab className="nzdemo-tab-tp" badge={BadgeUtilities.getComponentForBadgeType(BadgeType.TechnicalPreview)} />;
  return <WidgetTab />;
}

const tab = <Tab />;

export default function Zones() {
  page.initialize();
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    return () => {
      document.documentElement.removeAttribute("data-theme");
    };
  }, []);
  const { settings, remove, removeFromStart, add, addToStart, update } = useSettings();
  const settingsStr = React.useMemo(() => JSON.stringify(settings), [settings]);
  const [state, dispatch] = React.useReducer(NineZoneStateReducer, {}, () => {
    let initialState = createNineZoneState({
      panels: createPanelsState({
        top: createHorizontalPanelState("top"),
        left: createVerticalPanelState("left", {
          pinned: false,
        }),
      }),
    });
    initialState = addPanelWidget(initialState, "left", "leftStart", ["leftStart_1", "leftStart_2", "leftStart_3", "leftStart_4"]);
    initialState = addPanelWidget(initialState, "left", "leftMiddle", ["leftMiddle_1"]);
    initialState = addPanelWidget(initialState, "left", "leftEnd", ["leftEnd_1"]);
    initialState = addPanelWidget(initialState, "right", "rightStart", ["rightStart_1"]);
    initialState = addPanelWidget(initialState, "top", "topStart", ["topStart_1"]);
    initialState = addPanelWidget(initialState, "bottom", "bottomStart", ["bottomStart_1"]);
    initialState = addPanelWidget(initialState, "bottom", "bottomMiddle", ["bottomMiddle_1"]);
    initialState = addPanelWidget(initialState, "bottom", "bottomEnd", ["bottomEnd_1"]);
    initialState = addTab(initialState, "leftStart_1", { label: "Tab 1", preferredPanelWidgetSize: "fit-content" });
    initialState = addTab(initialState, "leftStart_2", { label: "Tab 2", preferredPanelWidgetSize: "fit-content" });
    initialState = addTab(initialState, "leftStart_3", { label: "Tab 3" });
    initialState = addTab(initialState, "leftStart_4", { label: "Tab 4" });
    initialState = addTab(initialState, "leftMiddle_1", { label: "Tab 1" });
    initialState = addTab(initialState, "leftEnd_1", { label: "Tab 1 Of Bottom Left Widget" });
    initialState = addTab(initialState, "rightStart_1", { label: "Tab 1" });
    initialState = addTab(initialState, "topStart_1", { label: "Tab 1" });
    initialState = addTab(initialState, "bottomStart_1", { label: "Tab 1" });
    initialState = addTab(initialState, "bottomMiddle_1", { label: "Tab 1", preferredPanelWidgetSize: "fit-content" });
    initialState = addTab(initialState, "bottomEnd_1", { label: "Tab 1" });
    return initialState;
  });
  const labels = React.useMemo<NineZoneLabels>(() => ({
    dockToolSettingsTitle: "Dock to top",
    moreToolSettingsTitle: "More tool settings",
    moreWidgetsTitle: "More widgets",
    pinPanelTitle: "Pin panel",
    sendWidgetHomeTitle: "Send to panel",
    resizeGripTitle: "Resize panel",
    unpinPanelTitle: "Unpin panel",
  }), []);
  const widget = React.useMemo(() => <WidgetContent />, []);
  const toolSettings = React.useMemo(() => <div>{settingsStr}</div>, [settingsStr]);
  const ui = React.useMemo(() => <div className="nzdemo-toolbars">
    <DemoToolWidget />
    <DemoNavigationWidget />
  </div>, []);
  const content = React.useMemo(() => <>
    <button onClick={add}>Add</button>
    <button onClick={addToStart}>Add To Start</button>
    <button onClick={remove}>Remove</button>
    <button onClick={removeFromStart}>Remove From Start</button>
    <button onClick={update}>Update</button>
  </>, [add, addToStart, remove, removeFromStart, update]);
  const nineZone = React.useMemo(() => <>
    <ToolSettings settings={settings} />
    <WidgetPanels
      className="nzdemo-widgetPanels"
      centerContent={ui}
    >
      {content}
    </WidgetPanels>
    <Footer
      isInFooterMode
      className="nzdemo-footer"
    >
      <div className="nzdemo-footer-content">Status Bar</div>
    </Footer>
    <FloatingWidgets />
  </>, [content, ui, settings]);
  return (
    <>
      <div className="nzdemo-header">
        HEADER
      </div>
      <div
        className="nzdemo-zones-zones"
      >
        <NineZone
          dispatch={dispatch}
          labels={labels}
          state={state}
          tab={tab}
          toolSettingsContent={toolSettings}
          widgetContent={widget}
        >
          {nineZone}
        </NineZone>
      </div>
    </>
  );
}

export function WidgetContent() {
  const dispatch = React.useContext(NineZoneDispatchContext);
  const tabId = React.useContext(TabIdContext);
  const side = useWidgetSide();
  const scrollViewRef = React.useRef<HTMLDivElement>(null);
  const scrollPosition = React.useRef(new Point());
  const [state, setState] = React.useState(false);
  const onSave = React.useCallback(() => {
    if (!scrollViewRef.current)
      return;
    scrollPosition.current = new Point(scrollViewRef.current.scrollLeft, scrollViewRef.current.scrollTop);
  }, []);
  const onRestore = React.useCallback(() => {
    if (!scrollViewRef.current)
      return;
    scrollViewRef.current.scrollLeft = scrollPosition.current.x;
    scrollViewRef.current.scrollTop = scrollPosition.current.y;
  }, []);
  useTransientState(onSave, onRestore);
  if (tabId === "leftMiddle_1") {
    return (
      <div className="nzdemo-leftMiddle_1">
        <h2>Tab={tabId}</h2>
        <div className="nzdemo-block">Block 1</div>
        <div className="nzdemo-block">Block 2</div>
        <div className="nzdemo-block">Block 3</div>
      </div>
    );
  }
  return (
    <ScrollableWidgetContent>
      <h2>Tab={tabId}</h2>
      <button onClick={() => setState((prev) => !prev)}>state={String(state)}</button>
      {
        (tabId === "topStart_1" || tabId === "bottomStart_1") && <>
          <button onClick={() => side && isHorizontalPanelSide(side) && dispatch({ type: "PANEL_TOGGLE_SPAN", side })}>span</button>
        </>
      }
      {
        tabId !== "leftStart_1" && <>
          <br />
          <br />
          <div
            className="nzdemo-scroll-view"
            ref={scrollViewRef}
          >
            <div>Entry 1</div>
            <div>Entry 2</div>
            <div>Entry 3</div>
            <div>Entry 4</div>
            <div>Entry 5</div>
            <div>Entry 6</div>
            <div>Entry 7</div>
            <div>Entry 8</div>
            <div>Entry 9</div>
          </div>
        </>
      }
      {
        tabId === "leftStart_2" && <>
          <h1>A</h1>
          <h1>B</h1>
          <h1>C</h1>
          <h1>D</h1>
        </>
      }
    </ScrollableWidgetContent>
  );
}

export function useWidgetSide(): PanelSide | undefined {
  const tabId = React.useContext(TabIdContext);
  const nineZone = React.useContext(NineZoneContext);
  const tabLocation = findTab(nineZone, tabId);
  if (tabLocation && ("side" in tabLocation)) {
    return tabLocation.side;
  }
  return undefined;
}
