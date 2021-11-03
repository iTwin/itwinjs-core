/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import "./ViewSelectorPanel.scss";
import { ContentViewManager, getListPanel, ListItem, ListItemType, SupportsViewSelectorChange, UiFramework, useActiveViewport, ViewUtilities } from "@itwin/appui-react";
import { IModelApp, IModelConnection, Viewport } from "@itwin/core-frontend";

export function ViewSelectorPanel() {
  const activeViewport = useActiveViewport();
  const activeImodelConnection = React.useMemo(() => activeViewport?.iModel, [activeViewport]);
  const [viewContainers, setViewContainers] = React.useState<ListItem[]>([]);
  const [activeViewId, setActiveViewId] = React.useState(activeViewport?.view.id);

  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("mounting ViewSelectorPanel");
    return () => {
      // eslint-disable-next-line no-console
      console.log("unmounting ViewSelectorPanel");
    };
  }, []);

  React.useEffect(() => {
    async function fetchViewData() {
      const views3d: ListItem[] = [];
      const views2d: ListItem[] = [];
      const sheets: ListItem[] = [];

      if (activeImodelConnection) {
        const query = { wantPrivate: false };
        const specs = await activeImodelConnection.views.getViewList(query);

        specs.forEach((spec: IModelConnection.ViewSpec) => {
          const viewItem: ListItem = {
            id: spec.id,
            key: spec.id,
            name: spec.name,
            enabled: undefined !== activeViewId ? activeViewId === spec.id : false,
            type: ListItemType.Item,
          };
          const className = ViewUtilities.getBisBaseClass(spec.class);
          if (ViewUtilities.isSpatial(className))
            views3d.push(viewItem);
          else if (ViewUtilities.isDrawing(className))
            views2d.push(viewItem);
          else if (ViewUtilities.isSheet(className))
            sheets.push(viewItem);
        });

        const containers: ListItem[] = [];
        if (views3d.length) {
          const views3dContainer: ListItem = {
            id: "views3dContainer",
            key: "views3dContainer",
            name:
              IModelApp.localization.getLocalizedStringWithNamespace(UiFramework.localizationNamespace, "savedViews.spatialViews"),
            enabled: false,
            type: ListItemType.Container,
            children: views3d,
          };
          containers.push(views3dContainer);
        }

        if (views2d.length) {
          const views2dContainer: ListItem = {
            key: "views2dContainer",
            id: "views2dContainer",
            name:
              IModelApp.localization.getLocalizedStringWithNamespace(UiFramework.localizationNamespace, "savedViews.drawings"),
            enabled: false,
            type: ListItemType.Container,
            children: views2d,
          };
          containers.push(views2dContainer);
        }

        if (sheets.length) {
          const sheetContainer: ListItem = {
            key: "sheetContainer",
            id: "sheetContainer",
            name:
              IModelApp.localization.getLocalizedStringWithNamespace(UiFramework.localizationNamespace, "savedViews.sheets"),
            enabled: false,
            type: ListItemType.Container,
            children: sheets,
          };
          containers.push(sheetContainer);
        }
        setViewContainers(containers);
      }
    }

    fetchViewData(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }, [activeImodelConnection, activeViewId]);

  React.useEffect(() => {
    const handleViewChanged = (vp: Viewport): void => {
      const newContainers = viewContainers.map((item) => {
        if (item.type !== ListItemType.Container) {
          return item;
        } else {
          const newContainer = item.children!.map((childItem) => {
            return { ...childItem, enabled: vp.view.id === childItem.id } as ListItem;
          });
          return { ...item, children: newContainer };
        }
      });
      setViewContainers(newContainers ?? []);
      setActiveViewId(vp.view.id);
    };
    return activeViewport?.onChangeView.addListener(handleViewChanged);
  }, [activeViewId, activeViewport, viewContainers]);

  const handleSetEnabled = React.useCallback(async (item: ListItem, enabled: boolean) => {
    if (!enabled)
      return;

    const activeContentControl = ContentViewManager.getActiveContentControl() as unknown as SupportsViewSelectorChange;
    if (activeContentControl?.supportsViewSelectorChange && item.id) {
      // Load the view state using the viewSpec's ID
      const viewState = await activeImodelConnection?.views.load(item.id);
      if (viewState)
        await activeContentControl.processViewSelectorChange(activeImodelConnection!, item.id, viewState, item.name!);
    }
  }, [activeImodelConnection]);

  const panel = React.useMemo(() => getListPanel({
    title: "Views", items: viewContainers,
    setEnabled: handleSetEnabled,
  }), [handleSetEnabled, viewContainers]);

  return (
    <div className="uitestapp-popup-view-panel-container">
      {panel}
    </div>
  );
}

