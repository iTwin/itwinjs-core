
import { UserManagerSettings } from "oidc-client";

const oidcSettings: UserManagerSettings = {
  authority: "https://qa-imsoidc.bentley.com/",
  client_id: "imodeljs-spa-test-2686",
  redirect_uri: "http://localhost:3000/signin-oidc",
  response_type: "id_token token",
  scope: "openid email profile organization feature_tracking imodelhub rbac-service context-registry-service",
};

export default oidcSettings;
