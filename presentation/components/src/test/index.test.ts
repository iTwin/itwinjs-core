/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as chaiJestSnapshot from "chai-jest-snapshot";
import chaiSubset from "chai-subset";
import * as enzyme from "enzyme";

// configure chai
chai.use(chaiSubset);

// configure enzyme (testing utils for React)
enzyme.configure({ adapter: new (require("@wojtekmaj/enzyme-adapter-react-17/build"))() }); // eslint-disable-line @typescript-eslint/no-var-requires
chaiJestSnapshot.addSerializer(require("enzyme-to-json/serializer")); // eslint-disable-line @typescript-eslint/no-var-requires
