/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AngleProps, XYProps, XYZProps } from "@itwin/core-geometry";
import { ElementProps, GeometricElementProps, GeometryPartProps, RelatedElementProps, SubCategoryProps } from "./ElementProps";
import { SpatialViewDefinitionProps, ViewDefinition2dProps, ViewDefinition3dProps, ViewDefinitionProps } from "./ViewProps";
import { Base64EncodedString } from "./Base64EncodedString";

type NativeInterfaceMapping =
| [NativeElementProps, ElementProps]
| [NativeViewDefinitionProps, ViewDefinitionProps]
| [NativeViewDefinition2dProps, ViewDefinition2dProps]
| [NativeViewDefinition3dProps, ViewDefinition3dProps]
| [NativeSpatialViewDefinitionProps, SpatialViewDefinitionProps]
| [NativeGeometricElementProps, GeometricElementProps]
| [NativeSubCategoryProps, SubCategoryProps]
| [NativeGeometryPartProps, GeometryPartProps];

export type NativeInterfaceMap<T> = Extract<NativeInterfaceMapping, [unknown, T]>[0];

type NativeElementProps = Omit<ElementProps, "model" | "code" | "classFullName" | "jsonProperties"> & {
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
type NativeViewDefinition3dProps = NativeViewDefinitionProps & Pick<ViewDefinition3dProps, "jsonProperties" | "cameraOn" | "camera" | "angles" | "origin" | "extents">;
type NativeSpatialViewDefinitionProps = NativeViewDefinition3dProps & {
  modelSelector: RelatedElementProps;
};
type NativeGeometricElementProps = NativeElementProps & {
  category: RelatedElementProps;
  geometryStream: Base64EncodedString;
} & (
  { origin: XYProps, bBoxLow: XYProps, bBoxHigh?: XYProps, rotation: AngleProps } |
  { origin: XYZProps, bBoxLow: XYZProps, bBoxHigh?: XYZProps, yaw?: AngleProps, pitch?: AngleProps, roll?: AngleProps }
);
type NativeGeometryPartProps = NativeElementProps & { bBoxLow: XYZProps, bBoxHigh?: XYZProps, geometryStream: Base64EncodedString } ;
type NativeSubCategoryProps = NativeElementProps & Pick<SubCategoryProps, "isPrivate" | "description"> & {
  properties?: string;
};

function mapAllProperties(props: { [key: string]: any }): { [key: string]: any } {
  for (const key of Object.keys(props)) {
    const val = props[key];

    // binary property mappings
    if (typeof val === "string") {
      if (Base64EncodedString.hasPrefix(val)) {
        props[key] = Base64EncodedString.toUint8Array(val);
      }
      // coordinate property alignments
    } else if (isCoordinateProps(val)) {
      props[key] = mapCoordinatesProps(val);
    } else if (typeof val === "object" && val !== null) {
      props[key] = mapAllProperties(val);
    } else if (Array.isArray(val)) {
      for (const [index, value] of val.entries()) {
        if (Base64EncodedString.hasPrefix(value)) {
          props[key][index] = Base64EncodedString.toUint8Array(value);
        } else if (isCoordinateProps(val)) {
          props[key][index] = mapCoordinatesProps(val);
        } else if (typeof val === "object" && val !== null) {
          props[key][index] = mapAllProperties(value);
        }
      }
    }
  }
  return props;
}
function isCoordinateProps(value: unknown): value is XYZProps | XYProps {
  if (Array.isArray(value)) {
    return value.length <= 3 && value.every(Number.isFinite);
  } else if (typeof value === "object" && value !== null) {
    const obj = value as { [key: string]: unknown };
    return "x" in obj && "y" in obj && (typeof obj.x === "number" || obj.x === undefined) && (typeof obj.y === "number" || obj.y === undefined) && ("z" in obj ? (typeof obj.z === "number" || obj.z === undefined) : true);
  }
  return false;
}
function mapCoordinatesProps(props: XYZProps | XYProps): XYZProps | XYProps {
  if (Array.isArray(props))
    return props;

  if (props.x !== undefined && props.y !== undefined) {
    if ("z" in props && props.z !== undefined)
      return [props.x, props.y, props.z];
    else
      return [props.x, props.y];
  }
  return props;
}
function mapRelatedElementProps(props: RelatedElementProps): RelatedElementProps {
  const { id, relClassName } = props;
  return { id, relClassName: relClassName?.replace(".", ":")  };
}
function mapElementProps(props: NativeElementProps): ElementProps {
  const { model, parent, codeValue, codeScope, codeSpec, className, jsonProperties, ...rest } = props;
  return {
    code: { scope: codeScope.id,  spec: codeSpec.id, value: codeValue },
    model: model.id,
    parent: parent ? mapRelatedElementProps(parent) : undefined,
    classFullName: className.replace(".", ":"),
    jsonProperties: jsonProperties ? JSON.parse(jsonProperties) : undefined,
    ...mapAllProperties(rest),
  };
}

export function mapNativeElementProps<T extends ElementProps>(props: NativeInterfaceMap<T>): T {
  const element = mapElementProps(props) as any;

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

  // SpatialViewDefinitionProps
  if ("modelSelector" in props && props.modelSelector !== undefined) {
    element.modelSelectorId = props.modelSelector.id;
    delete element.modelSelector;
  }

  // GeometryPartProps and partially GeometricElementProps
  if ("bBoxHigh" in props && props.bBoxHigh !== undefined && "bBoxLow" in props && props.bBoxLow !== undefined) {
    element.bbox = { low: element.bBoxLow, high: element.bBoxHigh };
    element.geom = element.geometryStream; // TODO: map UInt8Array to GeometryStreamProps
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
  if ("properties" in props && props.properties !== undefined) {
    element.appearance = JSON.parse(props.properties);
    delete element.properties;
  }

  return element as T;
}
