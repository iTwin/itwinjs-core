/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IContentVisitor, ProcessMergedValueProps, ProcessPrimitiveValueProps, traverseContentItem, Value } from "@itwin/presentation-common";
import { initialize, terminate } from "../IntegrationTests";
import { IModelDb, SnapshotDb } from "@itwin/core-backend";
import { Presentation } from "@itwin/presentation-backend";

describe("Learning Snippets", () => {
  let imodel: IModelDb;

  before(async () => {
    await initialize();
    imodel = SnapshotDb.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
  });

  after(async () => {
    imodel.close();
    await terminate();
  });

  describe("Presentation manager (backend)", () => {
    describe("getElementProperties", () => {
      it("retrieves element properties with custom content parser", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Backend.GetElementProperties.WithCustomContentParser
        interface RawPrimitivePropertiesSet {
          [propertyLabel: string]: Value;
        }
        class RawPrimitivePropertiesBuilder implements IContentVisitor {
          private _curr: RawPrimitivePropertiesSet = {};

          public getResult() {
            return this._curr;
          }

          public startContent() {
            return true;
          }
          public finishContent() {}

          public processFieldHierarchies() {}

          public startItem() {
            this._curr = {};
            return true;
          }
          public finishItem() {}

          public startCategory() {
            // TODO: handle properties' categorization here
            return true;
          }
          public finishCategory() {}

          public startField() {
            return true;
          }
          public finishField() {}

          public startStruct() {
            // TODO: handle struct properties here. Returning `false` omits them from result.
            return false;
          }
          public finishStruct() {}

          public startArray() {
            // TODO: handle array properties here. Returning `false` omits them from result.
            return false;
          }
          public finishArray() {}

          public processMergedValue(props: ProcessMergedValueProps) {
            this._curr[props.mergedField.label] = undefined;
          }
          public processPrimitiveValue(props: ProcessPrimitiveValueProps) {
            let rawValue: string | number | boolean | undefined;
            if (Value.isNavigationValue(props.rawValue)) {
              rawValue = props.rawValue.id;
            } else if (Value.isPrimitive(props.rawValue)) {
              rawValue = props.rawValue;
            }
            this._curr[props.field.label] = rawValue;
          }
        }
        const result = await Presentation.getManager().getElementProperties({
          imodel,
          contentParser(descriptor, item) {
            const builder = new RawPrimitivePropertiesBuilder();
            traverseContentItem(builder, descriptor, item);
            return builder.getResult();
          },
          elementClasses: ["BisCore:PhysicalPartition"],
        });
        // __PUBLISH_EXTRACT_END__
        const batches = await fromAsync(result.iterator());
        expect(batches).to.have.lengthOf(1);
        const firstBatch = batches[0];
        expect(firstBatch)
          .to.have.lengthOf(1)
          .and.to.containSubset([
            {
              ["Model"]: "0x1",
              ["Code"]: "Properties_60InstancesWithUrl2",
              ["User Label"]: undefined,
              ["Description"]: undefined,
            },
          ]);
      });
    });
  });
});

async function fromAsync<T>(source: Iterable<T> | AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of source) {
    items.push(item);
  }
  return items;
}
