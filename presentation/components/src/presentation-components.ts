/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Presentation } from "@itwin/presentation-frontend";
import { initializeLocalization, initializePropertyValueRenderers } from "./presentation-components/common/Utils";
import { PRESENTATION_TREE_NODE_KEY } from "./presentation-components/tree/Utils";

/**
 * @module Core
 *
 * @docs-group-description Core
 * Common types used all across ($presentation-components) package.
 */
export * from "./presentation-components/common/IPresentationDataProvider";
export * from "./presentation-components/common/IUnifiedSelectionComponent";
export * from "./presentation-components/common/ContentBuilder";
export * from "./presentation-components/common/ContentDataProvider";
export * from "./presentation-components/DataProvidersFactory";
export * from "./presentation-components/hooks/UseRulesetRegistration";
export * from "./presentation-components/common/Diagnostics";

/**
 * @module Logging
 *
 * @docs-group-description Logging
 * Types related to logging in ($presentation-components) package.
 */
export * from "./presentation-components/ComponentsLoggerCategory";

/**
 * @module Properties
 *
 * @docs-group-description Properties
 * Presentation-specific [Properties]($components-react:Properties).
 */
export * from "./presentation-components/properties/InstanceKeyValueRenderer";

/**
 * @module PropertyGrid
 *
 * @docs-group-description PropertyGrid
 * Presentation features for [PropertyGrid]($components-react) component.
 */
export * from "./presentation-components/propertygrid/DataProvider";
export * from "./presentation-components/propertygrid/FavoritePropertiesDataFilterer";
export * from "./presentation-components/propertygrid/UseUnifiedSelection";

/**
 * @module FavoriteProperties
 *
 * @docs-group-description FavoriteProperties
 * Presentation features for [Favorite properties]($components-react:Favorite).
 */
export * from "./presentation-components/favorite-properties/DataProvider";

/**
 * @module Table
 *
 * @docs-group-description Table
 * Presentation features for [Table]($components-react) component.
 */
export * from "./presentation-components/table/DataProvider";
export * from "./presentation-components/table/WithUnifiedSelection";

/**
 * @module Tree
 *
 * @docs-group-description Tree
 * Presentation features for [Tree]($components-react:Tree) component.
 */
export * from "./presentation-components/tree/DataProvider";
export * from "./presentation-components/tree/IPresentationTreeDataProvider";
export * from "./presentation-components/tree/FilteredDataProvider";
export * from "./presentation-components/tree/controlled/UseUnifiedSelection";
export * from "./presentation-components/tree/controlled/UseControlledTreeFiltering";
export * from "./presentation-components/tree/controlled/TreeHooks";
export * from "./presentation-components/tree/controlled/PresentationTreeNodeRenderer";
export { PRESENTATION_TREE_NODE_KEY };

/**
 * @module Viewport
 *
 * @docs-group-description Viewport
 * Presentation features for [ViewportComponent]($imodel-components-react).
 */
export * from "./presentation-components/viewport/WithUnifiedSelection";

/**
 * @module DisplayLabels
 *
 * @docs-group-description DisplayLabels
 * Types related to display labels.
 */
export * from "./presentation-components/labels/LabelsProvider";

/**
 * @module UnifiedSelection
 *
 * @docs-group-description UnifiedSelection
 * Utilities for working with [Unified Selection]($docs/presentation/unified-selection/index.md) within [React](https://reactjs.org/) components.
 */
export * from "./presentation-components/unified-selection/UnifiedSelectionContext";

Presentation.registerInitializationHandler(initializeLocalization);
Presentation.registerInitializationHandler(initializePropertyValueRenderers);
