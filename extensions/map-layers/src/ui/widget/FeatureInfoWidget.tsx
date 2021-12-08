/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { PropertyGrid} from "@itwin/components-react";
import { FillCentered, Orientation } from "@itwin/core-react";

import { FeatureInfoDataProvider, MapFeatureInfoLoadState } from "./FeatureInfoDataProvider";
import { ProgressRadial } from "@itwin/itwinui-react";
import { MapFeatureInfoOptions } from "../Interfaces";

interface MapFeatureInfoWidgetProps {
  featureInfoOpts?: MapFeatureInfoOptions;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function MapFeatureInfoWidget(props: MapFeatureInfoWidgetProps) {

  const [dataProvider] = React.useState<FeatureInfoDataProvider>(new FeatureInfoDataProvider());
  const [loadingData, setLoadingData] = React.useState<boolean>(false);

  const handleLoadStateChange = (state: MapFeatureInfoLoadState) => {
    setLoadingData(state === MapFeatureInfoLoadState.DataLoadStart);
  };

  React.useEffect(() => {
    if (props.featureInfoOpts?.showLoadProgressAnimation) {
      dataProvider.onDataLoadStateChanged.addListener(handleLoadStateChange);
      return () => {
        dataProvider.onDataLoadStateChanged.removeListener(handleLoadStateChange);
      };
    }
    return;

  }, [dataProvider.onDataLoadStateChanged, props.featureInfoOpts?.showLoadProgressAnimation]);

  if (loadingData) {
    return (<FillCentered><ProgressRadial indeterminate={true}></ProgressRadial></FillCentered>);
  } else {
    return (<PropertyGrid dataProvider={dataProvider} orientation={Orientation.Vertical} isPropertySelectionEnabled={props.featureInfoOpts?.propertyGridOptions?.isPropertySelectionEnabled} />);
  }
}

// export class MapFeatureInfoWidget extends React.Component {
//   private _dataProvider: FeatureInfoDataProvider;

//   constructor(props: any) {
//     super(props);

//     this._dataProvider = new FeatureInfoDataProvider();
//   }

//   public override render() {
//     return (
//       <PropertyGrid dataProvider={this._dataProvider} orientation={Orientation.Vertical} isPropertySelectionEnabled={true} />
//     );
//   }
// }
