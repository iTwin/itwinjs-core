/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { SnapMode } from "@bentley/imodeljs-frontend";
import { DisplayTestApp } from "./App";
import { createComboBox } from "@bentley/frontend-devtools";

const multiSnapModes = [
  SnapMode.NearestKeypoint,
  SnapMode.Nearest,
  SnapMode.Intersection,
  SnapMode.MidPoint,
  SnapMode.Origin,
  SnapMode.Center,
  SnapMode.Bisector,
];

const multiSnapMode = -1;

function changeSnapModes(value: SnapMode): void {
  if (multiSnapMode !== value) {
    DisplayTestApp.setActiveSnapMode(value);
  } else {
    DisplayTestApp.setActiveSnapModes(multiSnapModes);
  }
}

export function addSnapModes(container: HTMLElement): HTMLElement {
  const cb = createComboBox({
    name: "Snap Mode: ",
    id: "snapModes",
    parent: container,
    value: SnapMode.NearestKeypoint,
    handler: (select: HTMLSelectElement) => changeSnapModes(Number.parseInt(select.value, 10)),
    entries: [
      { name: "Keypoint", value: SnapMode.NearestKeypoint },
      { name: "Nearest", value: SnapMode.Nearest },
      { name: "Center", value: SnapMode.Center },
      { name: "Origin", value: SnapMode.Origin },
      { name: "Intersection", value: SnapMode.Intersection },
      { name: "Multi-snap", value: multiSnapMode },
    ],
  });

  return cb.div;
}
