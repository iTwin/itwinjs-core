/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Guid } from "@itwin/core-bentley";
import { IModelConnection } from "@itwin/core-frontend";
import {
  Content,
  ContentSpecificationTypes,
  createContentTraverser,
  DefaultContentDisplayTypes,
  IContentVisitor,
  InstanceKey,
  KeySet,
  ProcessPrimitiveValueProps,
  Ruleset,
  RuleTypes,
  StartArrayProps,
  StartStructProps,
  Value,
} from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import {
  buildTestIModelConnection,
  importSchema,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
} from "../../IModelSetupUtils.js";
import { collect } from "../../Utils.js";
import { describeContentTestSuite } from "./Utils.js";

/**
 * A node in the tree produced by `TraversedContentBuilder`. Container nodes (structs and arrays)
 * have `children`, while primitive nodes carry their raw value.
 */
interface TraversedNode {
  label: string;
  rawValue?: Value;
  children: TraversedNode[];
}

/**
 * A visitor that records the structure produced by traversing content, without relying on any
 * formatted (display) values. It captures the hierarchy of struct and array properties so that a
 * test can assert their members are traversed correctly when formatting is disabled.
 */
class TraversedContentBuilder implements IContentVisitor {
  private _root: TraversedNode[] = [];
  private _stack: TraversedNode[][] = [this._root];

  public getResult(): TraversedNode[] {
    return this._root;
  }

  private get _current(): TraversedNode[] {
    return this._stack[this._stack.length - 1];
  }

  public startContent(): boolean {
    return true;
  }
  public finishContent(): void {}

  public processFieldHierarchies(): void {}

  public startItem(): boolean {
    this._root = [];
    this._stack = [this._root];
    return true;
  }
  public finishItem(): void {}

  public startCategory(): boolean {
    return true;
  }
  public finishCategory(): void {}

  public startField(): boolean {
    return true;
  }
  public finishField(): void {}

  public startStruct(props: StartStructProps): boolean {
    const node: TraversedNode = { label: props.hierarchy.field.label, children: [] };
    this._current.push(node);
    this._stack.push(node.children);
    return true;
  }
  public finishStruct(): void {
    this._stack.pop();
  }

  public startArray(props: StartArrayProps): boolean {
    const node: TraversedNode = { label: props.hierarchy.field.label, children: [] };
    this._current.push(node);
    this._stack.push(node.children);
    return true;
  }
  public finishArray(): void {
    this._stack.pop();
  }

  public processMergedValue(): void {}
  public processPrimitiveValue(props: ProcessPrimitiveValueProps): void {
    // When formatting is omitted, there should be no display value for primitive properties.
    expect(props.displayValue).to.be.undefined;
    this._current.push({ label: props.field.label, rawValue: props.rawValue, children: [] });
  }
}

function findNode(nodes: TraversedNode[], label: string): TraversedNode {
  const node = nodes.find((n) => n.label === label);
  if (!node) {
    throw new Error(`Node "${label}" not found. Available nodes: [${nodes.map((n) => `"${n.label}"`).join(", ")}]`);
  }
  return node;
}

describeContentTestSuite("Content traversal without formatting", () => {
  const ruleset: Ruleset = {
    id: Guid.createValue(),
    rules: [
      {
        ruleType: RuleTypes.Content,
        specifications: [{ specType: ContentSpecificationTypes.SelectedNodeInstances }],
      },
    ],
  };

  it("traverses primitive, array, struct and struct-array properties from unformatted content", async function () {
    let elementKey!: InstanceKey;
    const imodel = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
      const schema = importSchema(
        this,
        db,
        `
          <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
          <ECStructClass typeName="MyStruct">
            <ECProperty propertyName="StringMember" typeName="string" />
            <ECProperty propertyName="IntMember" typeName="int" />
          </ECStructClass>
          <ECEntityClass typeName="TestElement">
            <BaseClass>bis:PhysicalElement</BaseClass>
            <ECProperty propertyName="StringProperty" typeName="string" />
            <ECArrayProperty propertyName="StringArrayProperty" typeName="string" />
            <ECStructProperty propertyName="StructProperty" typeName="MyStruct" />
            <ECStructArrayProperty propertyName="StructArrayProperty" typeName="MyStruct" />
          </ECEntityClass>
        `,
      );
      const model = insertPhysicalModelWithPartition({ db, codeValue: "model" });
      const category = insertSpatialCategory({ db, codeValue: "category" });
      elementKey = insertPhysicalElement({
        db,
        classFullName: schema.items.TestElement.fullName,
        modelId: model.id,
        categoryId: category.id,
        ["StringProperty"]: "test string",
        ["StringArrayProperty"]: ["a", "b"],
        ["StructProperty"]: { ["StringMember"]: "member string", ["IntMember"]: 123 },
        ["StructArrayProperty"]: [
          { ["StringMember"]: "x", ["IntMember"]: 1 },
          { ["StringMember"]: "y", ["IntMember"]: 2 },
        ],
      });
    });

    const content = await getUnformattedContent(imodel, elementKey);

    // Verify content was retrieved without formatting - items must not carry display values.
    expect(content.contentSet).to.have.lengthOf(1);
    expect(content.contentSet[0].displayValues).to.deep.eq({});

    const builder = new TraversedContentBuilder();
    createContentTraverser(builder)(content.descriptor, content.contentSet);
    const result = builder.getResult();

    // Primitive property.
    expect(findNode(result, "StringProperty").rawValue).to.eq("test string");

    // Primitive array property - one array node with two primitive items.
    const stringArray = findNode(result, "StringArrayProperty");
    expect(stringArray.children.map((c) => c.rawValue)).to.deep.eq(["a", "b"]);

    // Struct property - one struct node with two member primitives.
    const struct = findNode(result, "StructProperty");
    expect(findNode(struct.children, "StringMember").rawValue).to.eq("member string");
    expect(findNode(struct.children, "IntMember").rawValue).to.eq(123);

    // Struct-array property - one array node with two struct items, each with two members.
    const structArray = findNode(result, "StructArrayProperty");
    expect(structArray.children).to.have.lengthOf(2);
    const [firstStruct, secondStruct] = structArray.children;
    expect(findNode(firstStruct.children, "StringMember").rawValue).to.eq("x");
    expect(findNode(firstStruct.children, "IntMember").rawValue).to.eq(1);
    expect(findNode(secondStruct.children, "StringMember").rawValue).to.eq("y");
    expect(findNode(secondStruct.children, "IntMember").rawValue).to.eq(2);
  });

  async function getUnformattedContent(imodel: IModelConnection, key: InstanceKey): Promise<Content> {
    const keys = new KeySet([key]);
    const descriptor = await Presentation.presentation.getContentDescriptor({
      imodel,
      rulesetOrId: ruleset,
      keys,
      displayType: DefaultContentDisplayTypes.PropertyPane,
    });
    expect(descriptor).to.not.be.undefined;
    const content = await Presentation.presentation
      .getContentIterator({ imodel, rulesetOrId: ruleset, keys, descriptor: descriptor!, omitFormattedValues: true })
      .then(async (x) => x && new Content(x.descriptor, await collect(x.items)));
    expect(content).to.not.be.undefined;
    return content!;
  }
});
