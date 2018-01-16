// tslint:disable:no-var-requires
import { app as electron } from "electron";
import { Gateway } from "@bentley/imodeljs-backend/lib/common/Gateway";
import ECPresentationGatewayDefinition from "@bentley/ecpresentation-backend/lib/common/ECPresentationGatewayDefinition";
import ECPresentationGateway from "@bentley/ecpresentation-backend/lib/backend/ECPresentationGateway";
import app from "./MyAppBackend";

if (electron) {
  require("./electron/ElectronMain");
} else {
  require("./web/WebServer");
}

// makes no sense, but we have to do this here because Gateways are registered as classes and not instances which we can set up
const ecpGateway = Gateway.getImplementationForGateway(ECPresentationGatewayDefinition) as ECPresentationGateway;
ecpGateway.setManager(app.presentation);
