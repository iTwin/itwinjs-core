/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import classnames from "classnames";
import * as React from "react";
import { ToolbarOrientation, ToolbarUsage } from "@itwin/appui-abstract";
import { ToolbarComposer } from "../toolbar/ToolbarComposer";
import { ToolWidgetComposer } from "./ToolWidgetComposer";
import { useUiVisibility } from "../hooks/useUiVisibility";

/**
 * Props for [[ContentToolWidgetComposer]].
 * @public
 */
export interface ContentToolWidgetComposerProps {
  /** If default backstage button is desired use <BackstageAppButton />. */
  cornerButton?: React.ReactNode;
}

/**
 * ContentToolWidgetComposer composes a Tool Widget with no tools defined by default. UiItemsProviders
 * are used to populate the toolbars. See [[StandardContentToolsProvider]].
 * @example
 * ToolWidget with no corner button
 * ```
 * <ContentToolWidgetComposer />
 * ```
 * ToolWidget with corner button
 * ```
 * const cornerButton = <BackstageAppButton icon={"icon-bentley-systems"} />;
 * <ContentToolWidgetComposer cornerButton={cornerButton} />
 * ```
 * ToolWidget with custom corner button
 * ```
 * const cornerButton = <BackstageAppButton icon={"icon-bentley-systems"}
 *   label="Toggle Backstage display",
 *   execute={() => BackstageManager.getBackstageToggleCommand().execute()} />;
 * <ContentToolWidgetComposer cornerButton={cornerButton} />
 * ```
 *
 * BackstageCornerButton,
 * @public
 */
export function ContentToolWidgetComposer(props: ContentToolWidgetComposerProps) {
  const { cornerButton } = props;
  const uiIsVisible = useUiVisibility();
  // istanbul ignore next
  const className = classnames(
    !uiIsVisible && "nz-hidden",
  );
  return (
    <ToolWidgetComposer className={className}
      cornerItem={cornerButton}
      horizontalToolbar={<ToolbarComposer items={[]} usage={ToolbarUsage.ContentManipulation} orientation={ToolbarOrientation.Horizontal} />} // eslint-disable-line deprecation/deprecation
      verticalToolbar={<ToolbarComposer items={[]} usage={ToolbarUsage.ContentManipulation} orientation={ToolbarOrientation.Vertical} />} // eslint-disable-line deprecation/deprecation
    />
  );
}
