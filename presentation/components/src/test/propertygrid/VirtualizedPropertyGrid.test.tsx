/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { PropertyRecord } from "@itwin/appui-abstract";
import type {
  CategorizedPropertyItem, IPropertyDataProvider, PropertyCategory,
  PropertyCategoryRendererProps, PropertyData} from "@itwin/components-react";
import { FlatGridItemType, PrimitivePropertyRenderer, PropertyCategoryRendererManager, PropertyDataChangeEvent, PropertyValueRendererManager, VirtualizedPropertyGridWithDataProvider,
} from "@itwin/components-react";
import { Orientation } from "@itwin/core-react";
import { render } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import type { PresentationPropertyDataProvider } from "../../presentation-components/propertygrid/DataProvider";
import { createPrimitiveStringProperty } from "../_helpers/Properties";

describe("Category renderer customization", () => {
  describe("documentation snippets", () => {
    function setupDataProvider(): IPropertyDataProvider {
      const rootCategory1: PropertyCategory = {
        name: "test_category",
        label: "test_category",
        expand: true,
        renderer: { name: "my_custom_renderer" },
      };
      return {
        onDataChanged: new PropertyDataChangeEvent(),
        getData: async (): Promise<PropertyData> => ({
          label: PropertyRecord.fromString("test_label"),
          description: "test_description",
          categories: [rootCategory1],
          records: {
            [rootCategory1.name]: [createPrimitiveStringProperty("rootCategory1Property", "Test", "Test")],
          },
          reusePropertyDataState: true,
        }),
      };
    }

    afterEach(() => {
      PropertyCategoryRendererManager.defaultManager.removeRenderer("my_custom_renderer");
    });

    it("works with most basic custom category renderer", async () => {
      // __PUBLISH_EXTRACT_START__ Presentation.Customization.BasicCategoryRenderer
      PropertyCategoryRendererManager.defaultManager.addRenderer("my_custom_renderer", () => MyCustomRenderer);

      const MyCustomRenderer: React.FC<PropertyCategoryRendererProps> = (props) => {
        const primitiveItems = props.categoryItem
          .getChildren()
          .filter((item) => item.type === FlatGridItemType.Primitive) as CategorizedPropertyItem[];

        return (
          <>
            {primitiveItems.map((item) => {
              return (
                <PrimitivePropertyRenderer
                  key={item.key}
                  propertyRecord={item.derivedRecord}
                  valueElement={PropertyValueRendererManager.defaultManager.render(item.derivedRecord)}
                  orientation={props.gridContext.orientation}
                />
              );
            })}
          </>
        );
      };
      // __PUBLISH_EXTRACT_END__

      const dataProvider = setupDataProvider();
      const { findByText } = render(
        <VirtualizedPropertyGridWithDataProvider
          dataProvider={dataProvider}
          width={500}
          height={1200}
          orientation={Orientation.Horizontal}
        />,
      );
      expect(await findByText("rootCategory1Property")).not.to.be.null;
    });

    it("compiles PropertyRecord to InstanceKey sample", () => {
      function useInstanceKeys(props: PropertyCategoryRendererProps): void {
        const [_, setInstanceKeys] = React.useState<unknown>();
        // __PUBLISH_EXTRACT_START__ Presentation.Customization.PropertyRecordToInstanceKey
        // <Somewhere within MyCustomRenderer component>
        React.useEffect(
          () => {
            void (async () => {
              const properties = props.categoryItem.getChildren() as CategorizedPropertyItem[];
              const dataProvider = props.gridContext.dataProvider as PresentationPropertyDataProvider;
              const instanceKeys = properties.map(async ({ derivedRecord }) => dataProvider.getPropertyRecordInstanceKeys(derivedRecord));
              setInstanceKeys(await Promise.all(instanceKeys));
            })();
          },
          // eslint-disable-next-line react-hooks/exhaustive-deps
          [],
        );
        // __PUBLISH_EXTRACT_END__
      }

      const stubProps = {
        categoryItem: { getChildren() { return []; } },
        gridContext: { dataProvider: { async getPropertyRecordInstanceKeys() { return []; } } },
      };
      renderHook(() => useInstanceKeys(stubProps as any));
    });
  });
});
