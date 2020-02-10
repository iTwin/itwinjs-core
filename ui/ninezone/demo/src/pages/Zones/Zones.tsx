/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";
import * as React from "react";
import ToolSettings from "./ToolSettings";
import { ToolSettingProps } from "./ToolSetting";
import { WidgetPanels, useWidgetPanelsApi } from "@src/widget-panels/Panels";
import { Panes } from "@src/widget-panels/Panes";
import { WidgetPanelSide, isHorizontalWidgetPanelSide } from "@src/widget-panels/Panel";
import { Widget } from "@src/widget/Widget";
import { WidgetTab } from "@src/widget/Tab";
import "./Zones.scss";

let id = 0;
const getId = () => {
  return id++;
};

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
  return {
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
  };
};

export default function Zones() {
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    return () => {
      document.documentElement.removeAttribute("data-theme");
    };
  }, []);
  const { settings, remove, removeFromStart, add, addToStart, update } = useSettings();
  const [panels, panelsApi] = useWidgetPanelsApi();

  return (
    <React.StrictMode>
      <div
        className="nzdemo-zones-zones"
      >
        <WidgetPanels
          className="nzdemo-widgetPanels"
          panels={panels}
          leftContent={<WidgetPanelContent
            onCollapse={() => panels.left.toggleCollapse()}
            onPin={() => panelsApi.left.setPinned(!panels.left.pinned)}
            pinned={panels.left.pinned}
            side="left"
          />}
          rightContent={<WidgetPanelContent
            onCollapse={() => panels.right.toggleCollapse()}
            onPin={() => panelsApi.right.setPinned(!panels.right.pinned)}
            pinned={panels.right.pinned}
            side="right"
          />}
          topContent={<WidgetPanelContent
            onCollapse={() => panels.top.toggleCollapse()}
            onPin={() => panelsApi.top.setPinned(!panels.top.pinned)}
            onSpan={() => panelsApi.top.setSpan(!panels.top.span)}
            pinned={panels.top.pinned}
            side="top"
            span={panels.top.span}
          />}
          bottomContent={<WidgetPanelContent
            onCollapse={() => panels.bottom.toggleCollapse()}
            onPin={() => panelsApi.bottom.setPinned(!panels.bottom.pinned)}
            onSpan={() => panelsApi.bottom.setSpan(!panels.bottom.span)}
            pinned={panels.bottom.pinned}
            side="bottom"
            span={panels.bottom.span}
          />}
        >
          <button onClick={add}>Add</button>
          <button onClick={addToStart}>Add To Start</button>
          <button onClick={remove}>Remove</button>
          <button onClick={removeFromStart}>Remove From Start</button>
          <button onClick={update}>Update</button>
        </WidgetPanels>
        <ToolSettings
          settings={settings}
        />
      </div>
    </React.StrictMode>
  );
}

interface WidgetPanelContentProps {
  side: WidgetPanelSide;
  pinned: boolean;
  span?: boolean;
  onCollapse: () => void;
  onPin: () => void;
  onSpan?: () => void;
}

function WidgetPanelContent(props: WidgetPanelContentProps) {
  const [activeTab1, setActiveTab1] = React.useState<1 | 2 | 3>(1);
  const [activeTab2, setActiveTab2] = React.useState<1 | 2>(1);
  const isHorizontal = isHorizontalWidgetPanelSide(props.side);
  return (
    <Panes
      horizontal={isHorizontal}
    >
      <Widget
        tabs={
          <>
            <WidgetTab
              active={activeTab1 === 1}
              onClick={() => {
                setActiveTab1(1);
              }}
            >
              Comments
            </WidgetTab>
            <WidgetTab
              active={activeTab1 === 2}
              onClick={() => setActiveTab1(2)}
            >
              Participants
            </WidgetTab>
            <WidgetTab
              active={activeTab1 === 3}
              onClick={() => setActiveTab1(3)}
            >
              Active
            </WidgetTab>
          </>
        }
      >
        {props.side}
        <button
          onClick={props.onPin}
        >
          pinned={String(props.pinned)}
        </button>
        {props.onSpan && <button
          onClick={props.onSpan}
        >
          span={String(!!props.span)}
        </button>}
        <button
          onClick={props.onCollapse}
        >
          collapse
      </button>
      </Widget>
      <Widget
        tabs={
          <>
            <WidgetTab
              active={activeTab2 === 1}
              onClick={() => setActiveTab2(1)}
            >
              Mid
            </WidgetTab>
            <WidgetTab
              active={activeTab2 === 2}
              onClick={() => setActiveTab2(2)}
            >
              Mid1
            </WidgetTab>
          </>
        }
      />
      <Widget
        tabs={
          <WidgetTab
            active
          >
            Last
          </WidgetTab>
        }
      />
    </Panes>
  );
}
