# AccessToken

An application must have an [AccessToken]($imodeljs-clients) to access an iModel on the iModelHub. AccessTokens are JSON Web Tokens, and based on the OAuth 2.0 protocol. The iModel.js API uses the OAuth 2.0 protocol for both authentication and authorization. The implementation conforms to the [OpenID Connect](https://openid.net/connect/) specification, and is built on [IdentityServer4](http://docs.identityserver.io/en/release/) framework, an officially [certified](https://openid.net/certification/) implementation of OpenID Connect.

## Using OAuth 2.0 to Access iModel.js APIs
The API supports common OAuth 2.0 scenarios of Web Frontend Applications, Agent or Service Applications, Desktop and Mobile Applications. All applications need to follow the same basic pattern:

### 1. Register the application to obtain OAuth 2.0 credentials.
Use the [developer registration page](https://imodeljs.github.io/iModelJs-docs-output/getting-started/#developer-registration) to register your applications and get the credentials. In the case of Frontend, Desktop and Mobile Applications, the credentials will include just a Client Id. In the case of Agent or Service Applications it will include a client Id, client secret, a service user name and a service user password.

### 2. Obtain an access token from the Bentley Authorization Server
Before your application can access an iModel on the iModelHub, it must obtain an access token that grants the required access. The way you make the request depends on the application you are building.

For Web Frontend Applications, the means of authenticating the user is commonly referred to as an "implicit" flow. You will use the iModel.js OpenID Connect Frontend API that will internally redirect the browser to the Bentley Authorization Server. The user then logs in through the browser, and is shown a *user consent* screen and asked whether they are willing to grant permissions that your application is requesting. Once the user grants the permission, the Bentley Authorization Server sends your application an access token.

For Agent or Service Applications, since a browser is not involved, you would be using the iModel.js OpenID Connect Backend API that makes web service requests to obtain the access token.

### 3. Send the access token through the iModel.Js API

After obtaining an access token, the application is then required to pass that through any iModel.js frontend or backend API that take the AccessToken parameter.

### 4. Refresh the access token

AccessTokens have a limited lifetime, typically an hour. The application needs to refresh access tokens using the API when the tokens are about to expire, and ensure that it will remain valid for the duration of the API call.

The imodelJs API calls required to refresh the access token are different in Web Frontend Applications and Agent or Service Applications.

