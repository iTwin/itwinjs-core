/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ScreenViewport } from "@bentley/imodeljs-frontend";
import { RelativePosition } from "@bentley/ui-abstract";
import { OutsideClickEvent, Popup, useOnOutsideClick, WebFontIcon } from "@bentley/ui-core";
import { SubLayersPanel } from "./SubLayersTree";
import { StyleMapLayerSettings } from "../Interfaces";
import { MapLayersUiItemsProvider } from "../MapLayersUiItemsProvider";

// cSpell:ignore droppable Sublayer

/** @internal */
export interface SubLayersPopupButtonProps {
  mapLayerSettings: StyleMapLayerSettings;
  activeViewport: ScreenViewport;
}

/** @internal */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function SubLayersPopupButton({ mapLayerSettings, activeViewport }: SubLayersPopupButtonProps) {

  const [showSubLayersLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:SubLayers.Show"));
  const [hideSubLayersLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:SubLayers.Hide"));
  const [popupOpen, setPopupOpen] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const togglePopup = React.useCallback(() => {
    setPopupOpen(!popupOpen);
  }, [popupOpen]);

  const onOutsideClick = React.useCallback(() => {
    setPopupOpen(false);
  }, []);

  const isOutsideEvent = React.useCallback((e: OutsideClickEvent) => {
    // if clicking on button that open panel - don't trigger outside click processing
    return !!buttonRef.current && (e.target instanceof Node) && !buttonRef.current.contains(e.target);
  }, []);

  const panelRef = useOnOutsideClick<HTMLDivElement>(onOutsideClick, isOutsideEvent);

  return (
    <>
      <button ref={buttonRef} className="map-manager-item-sub-layer-button" title={popupOpen ? hideSubLayersLabel : showSubLayersLabel}
        onClick={togglePopup}>
        <WebFontIcon iconName="icon-layers" />
      </button>
      <Popup
        isOpen={popupOpen}
        position={RelativePosition.BottomRight}
        onClose={onOutsideClick}
        target={buttonRef.current}
      >
        <div className="map-transparency-popup-panel">
          <div ref={panelRef} className="map-manager-sublayer-panel">
            <SubLayersPanel mapLayer={mapLayerSettings} viewport={activeViewport} />
          </div>
        </div>
      </Popup >
    </>
  );
}
