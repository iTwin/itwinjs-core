/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import classnames from "classnames";
import * as React from "react";
import { ToolbarOrientation, ToolbarUsage } from "@bentley/ui-abstract";
import { ToolbarComposer } from "../toolbar/ToolbarComposer";
import { ToolWidgetComposer } from "./ToolWidgetComposer";
import { useUiVisibility } from "./BasicToolWidget";

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
 * @public
 */
export interface ContentToolWidgetComposerProps {
  /** If default backstage button is desired use <BackstageAppButton />. */
  cornerButton?: React.ReactNode;
}

/** Default Tool Widget for standard "review" applications. Provides standard tools to review, and measure elements.
 * This definition will also show a overflow button if there is not enough room to display all the toolbar buttons.
 * @public
 */
export function ContentToolWidgetComposer(props: ContentToolWidgetComposerProps) {
  const { cornerButton } = props;
  const uiIsVisible = useUiVisibility();
  const className = classnames(
    !uiIsVisible && "nz-hidden",
  );

  return (
    <ToolWidgetComposer className={className}
      cornerItem={cornerButton}
      horizontalToolbar={<ToolbarComposer items={[]} usage={ToolbarUsage.ContentManipulation} orientation={ToolbarOrientation.Horizontal} />}
      verticalToolbar={<ToolbarComposer items={[]} usage={ToolbarUsage.ContentManipulation} orientation={ToolbarOrientation.Vertical} />}
    />
  );
}
