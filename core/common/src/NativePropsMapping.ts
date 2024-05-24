/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AngleProps, XYProps, XYZProps } from "@itwin/core-geometry";
import { ElementLoadOptions, ElementProps, GeometricElementProps, GeometryPartProps, RelatedElementProps, RenderTimelineProps, SubCategoryProps } from "./ElementProps";
import { SpatialViewDefinitionProps, ViewDefinition2dProps, ViewDefinition3dProps, ViewDefinitionProps } from "./ViewProps";
import { Base64EncodedString } from "./Base64EncodedString";
import { CompressedId64Set } from "@itwin/core-bentley";

type NativeInterfaceMapping =
| [NativeElementProps, ElementProps]
| [NativeViewDefinitionProps, ViewDefinitionProps]
| [NativeViewDefinition2dProps, ViewDefinition2dProps]
| [NativeViewDefinition3dProps, ViewDefinition3dProps]
| [NativeSpatialViewDefinitionProps, SpatialViewDefinitionProps]
| [NativeGeometricElementProps, GeometricElementProps]
| [NativeSubCategoryProps, SubCategoryProps]
| [NativeGeometryPartProps, GeometryPartProps]
| [NativeRenderTimelineProps, RenderTimelineProps];

/** Type that maps a native interface to its corresponding props interface. This helps ensure type safety when mapping native elements to their props.
 * @internal */
export type NativeInterfaceMap<T> = Extract<NativeInterfaceMapping, [unknown, T]>[0];

type NativeElementProps = Omit<ElementProps, "model" | "code" | "classFullName" | "jsonProperties" | "isInstanceOfEntity"> & {
  model: RelatedElementProps;
  className: string;
  codeValue?: string;
  codeSpec: RelatedElementProps;
  codeScope: RelatedElementProps;
  jsonProperties?: string;
  lastMod: string;
};
type NativeViewDefinitionProps = NativeElementProps & Pick<ViewDefinitionProps, "isPrivate" | "description" | "jsonProperties"> & {
  categorySelector: RelatedElementProps;
  displayStyle: RelatedElementProps;
};
type NativeViewDefinition2dProps = NativeViewDefinitionProps & Pick<ViewDefinition2dProps, "origin" | "delta" | "angle"> & {
  baseModel: RelatedElementProps;
};
type NativeViewDefinition3dProps = NativeViewDefinitionProps & Pick<ViewDefinition3dProps, "jsonProperties" | "origin" | "extents"> & {
  isCameraOn: boolean; focusDistance: number; lensAngle: number; eyePoint: XYZProps;
  yaw?: AngleProps; pitch?: AngleProps; roll?: AngleProps;
};
type NativeSpatialViewDefinitionProps = NativeViewDefinition3dProps & {
  modelSelector: RelatedElementProps;
};
type NativeGeometricElementProps = NativeElementProps & {
  category: RelatedElementProps;
  geometryStream?: Base64EncodedString;
} & (
  { origin: XYProps, bBoxLow: XYProps, bBoxHigh?: XYProps, rotation: AngleProps } |
  { origin: XYZProps, bBoxLow: XYZProps, bBoxHigh?: XYZProps, yaw?: AngleProps, pitch?: AngleProps, roll?: AngleProps }
);
type NativeGeometryPartProps = NativeElementProps & { bBoxLow: XYZProps, bBoxHigh?: XYZProps, geometryStream?: Base64EncodedString } ;
type NativeSubCategoryProps = NativeElementProps & Pick<SubCategoryProps, "isPrivate" | "description"> & {
  properties?: string;
};
type NativeRenderTimelineProps = NativeElementProps & Pick<RenderTimelineProps, "script">;

function mapBinaryProperties(props: { [key: string]: any }): { [key: string]: any } {
  for (const key of Object.keys(props)) {
    const val = props[key];

    if (typeof val === "string") {
      if (Base64EncodedString.hasPrefix(val)) {
        props[key] = Base64EncodedString.toUint8Array(val);
      }
    } else if (typeof val === "object" && val !== null) {
      props[key] = mapBinaryProperties(val);
    }
  }
  return props;
}
function mapRelatedElementProps(props: RelatedElementProps): RelatedElementProps {
  const { id, relClassName } = props;
  return { id, relClassName: relClassName?.replace(".", ":")  };
}
function mapElementProps(props: NativeElementProps, loadProps?: ElementLoadOptions): ElementProps {
  const { model, parent, codeValue, codeScope, codeSpec, className, jsonProperties, federationGuid, id, userLabel, ...rest } = props;
  return {
    code: { scope: codeScope.id,  spec: codeSpec.id, value: codeValue },
    model: model.id,
    parent: parent ? mapRelatedElementProps(parent) : undefined,
    classFullName: className.replace(".", ":"),
    id,
    federationGuid,
    userLabel,
    jsonProperties: jsonProperties
      ? JSON.parse(jsonProperties, (key, value) => {
        if (value === null)
          return undefined;
        if (key === "subCategory") // we would ideally make this more specific. should only apply for jsonProperties.styles.subCategoryOvr[i].subCategory
          return `0x${(+value).toString(16)}`;
        if (key === "excludedElements" && loadProps?.displayStyle?.compressExcludedElementIds !== true)  // we would ideally make this more specific. should only apply for jsonProperties.styles.excludedElements
          return CompressedId64Set.decompressArray(value);
        if (key === "elementIds" && loadProps?.displayStyle?.omitScheduleScriptElementIds === true) // we would ideally make this more specific. should only apply for jsonProperties.styles.scheduleScript[i].elementTimelines[i].elementIds
          return "";
        return value;
      })
      : undefined,
    ...(loadProps?.onlyBaseProperties ? {} : mapBinaryProperties(rest)),
  };
}

/** Function to map native Bis.Element properties to ElementProps.
     * @param props A JSON representation of the native element properties.
     * @param loadProps Load options to match the expected element representation.
     * @returns The JSON representation of the mapped element properties.
     * @internal
     */
export function mapNativeElementProps<T extends ElementProps>(props: NativeInterfaceMap<T>, loadProps?: ElementLoadOptions): T {
  if ((!loadProps?.wantGeometry || !loadProps?.wantBRepData) && "geometryStream" in props)
    delete props.geometryStream; // Removing it here to remove excessive binary property mapping

  const element = mapElementProps(props, loadProps) as any;

  if (loadProps?.onlyBaseProperties)
    return element as T;

  delete element.lastMod;

  // ViewDefinitionProps
  if ("categorySelector" in props && props.categorySelector !== undefined) {
    element.categorySelectorId = props.categorySelector.id;
    element.displayStyleId = props.displayStyle.id;
    delete element.categorySelector;
    delete element.displayStyle;
  }

  // ViewDefinition2dProps
  if ("baseModel" in props && props.baseModel !== undefined) {
    element.baseModelId = props.baseModel.id;
    delete element.baseModel;
  }

  // ViewDefinition3dProps
  if ("isCameraOn" in props && props.isCameraOn !== undefined) {
    element.cameraOn = props.isCameraOn;
    element.camera = { eye: props.eyePoint, focusDist: props.focusDistance, lens: props.lensAngle };
    element.angles = { yaw: props.yaw, roll: props.roll, pitch: props.pitch },

    delete element.isCameraOn;
    delete element.eyePoint;
    delete element.focusDistance;
    delete element.lensAngle;
    delete element.yaw;
    delete element.roll;
    delete element.pitch;
  }

  // SpatialViewDefinitionProps
  if ("modelSelector" in props && props.modelSelector !== undefined) {
    element.modelSelectorId = props.modelSelector.id;
    delete element.modelSelector;
  }

  // GeometryPartProps and partially GeometricElementProps
  if ("bBoxHigh" in props && props.bBoxHigh !== undefined && "bBoxLow" in props && props.bBoxLow !== undefined) {
    element.bbox = { low: element.bBoxLow, high: element.bBoxHigh };
    delete element.bBoxLow;
    delete element.bBoxHigh;
    delete element.geometryStream;
  }

  // GeometricElementProps
  if ("category" in props && props.category !== undefined) {
    element.category = props.category.id;
    element.placement = ("rotation" in props) ? {
      origin: props.origin,
      bbox: element.bbox, // already tackled in GeometryPartProps handling
      angle: props.rotation,
    } : {
      origin: props.origin,
      bbox: element.bbox,
      angles: { yaw: props.yaw, roll: props.roll, pitch: props.pitch },
    };
    delete element.origin;
    delete element.rotation;
    delete element.yaw;
    delete element.roll;
    delete element.pitch;
    delete element.bbox;
  }

  // SubCategoryProps
  if ("properties" in props && !!props.properties) {
    element.appearance = JSON.parse(props.properties);
    delete element.properties;
  }

  // RenderTimelineProps
  if ("script" in props && !!props.script) {
    element.script = loadProps?.renderTimeline?.omitScriptElementIds !== true ? props.script :
      JSON.stringify(JSON.parse(props.script, (key, value) => {
        if (key === "elementIds") // we need to make this more specific. should only apply for script[i].elementTimelines[i].elementIds
          return "";
        return value;
      }));
  }

  return element as T;
}
