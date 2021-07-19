/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import UIKit
import WebKit

class ProxyAuthClient : NSObject, AuthorizationClient {
    var expiresAt = 1614644192978.124;
    var startsAt = 1614640594109.5281;
    var userToken = "...";

    func initialize(_ requestContext: ClientRequestContext?, settings authSettings: AuthSettings, onComplete completion: @escaping AuthorizationClientCallback) {
        completion(requestContext ?? ClientRequestContext(), nil);
    }
    func sign(in requestContext: ClientRequestContext?, onComplete completion: @escaping AuthorizationClientCallback) {
        completion(requestContext ?? ClientRequestContext(), nil);
        raiseOnUserStateChanged(token: userToken, err: nil);
    }
    func signOut(_ requestContext: ClientRequestContext?, onComplete completion: @escaping AuthorizationClientCallback) {
        let ctx = requestContext ?? ClientRequestContext();
        completion(ctx, nil);
        raiseOnUserStateChanged(token: userToken, err: nil);
    }
    func wrapTokenInJson(token: String?) -> String? {
        var jsonString: String? = nil;
        if (token != nil) {
            let jsonDic : [String: Any] = [
                "tokenString": token!,
                "expiresAt" : expiresAt,
                "startsAt" : startsAt,
            ];
            do {
                let jsonData = try JSONSerialization.data(withJSONObject: jsonDic, options: []);
                jsonString = String(data: jsonData, encoding: String.Encoding.ascii)!;
            } catch {}
        }
        return jsonString;
    }
    func raiseOnUserStateChanged(token: String?, err:Error?) -> Void {
        let jToken = wrapTokenInJson(token: token);
        if (onUserStateChanged != nil) {
            onUserStateChanged!(jToken, err);
        }
    }
    func getAccessToken(_ requestContext: ClientRequestContext?, onComplete completion: @escaping AccessTokenCallback) {
        let jToken = wrapTokenInJson(token: userToken);
        completion(requestContext ?? ClientRequestContext(), jToken, nil);
    }
    func resumeExternalUserAgentFlow(_ url: URL) -> Bool {
        return true;
    }

    var onUserStateChanged: UserStateChanged?
    var isAuthorized: Bool {
        get {
            return true;
        }
    }
}

class MainViewController: UIViewController, WKUIDelegate, WKNavigationDelegate {
    private var webView : WKWebView? = nil
    private var timer = Timer()
    func setupBackend () {
        let host = IModelJsHost.sharedInstance();
        let bundlePath = Bundle.main.bundlePath;
        let mainPath = bundlePath.appending ("/Assets/main.js");
        let main = URL(fileURLWithPath: mainPath);
        let client = MobileAuthorizationClient(viewController: self);
        // let client = ProxyAuthClient();
        host.loadBackend(main, withAuthClient: client,withInspect: true)
    }

    func setupFrontend (bimFile: URL?) {

        let config = WKWebViewConfiguration()
        let wwwRoot = URL.init(fileURLWithPath: String(format: "%@/Assets/www", Bundle.main.resourcePath!))
        config.setURLSchemeHandler(AssetHandler(root: wwwRoot), forURLScheme: "imodeljs")
        self.webView = WKWebView(frame: .zero, configuration: config)

        webView!.translatesAutoresizingMaskIntoConstraints = false
        self.view.addSubview(self.webView!)
        webView!.uiDelegate = self
        webView!.navigationDelegate = self
        NSLayoutConstraint.activate([
            self.webView!.leftAnchor.constraint(equalTo: self.view.leftAnchor),
            self.webView!.bottomAnchor.constraint(equalTo: self.view.bottomAnchor),
            self.webView!.rightAnchor.constraint(equalTo: self.view.rightAnchor),
            self.webView!.topAnchor.constraint(equalTo: self.view.topAnchor),
            ])

        self.view.setNeedsLayout()

        let host = IModelJsHost.sharedInstance();

        // let frontProvider = "http://192.168.1.242:3000";

        let frontProvider = "imodeljs://app";

        var queryParam = String(format: "#port=%u&platform=ios", host.getPort());
        if (bimFile != nil) {
            let encodedPath = bimFile?.path.replacingOccurrences(of: "/", with: "%2F");
            queryParam.append("&standalone=true");
            queryParam.append("&iModelName=" + encodedPath!);
        }

        let url = URL.init(string: frontProvider + queryParam);
        let req = URLRequest(url: url!);
        self.webView!.load(req)
        host.register(self.webView!);
    }
    /// Show alert for webkit alert
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {

        let alert = UIAlertController(title: message, message: nil, preferredStyle: .alert);
        alert.addAction(UIAlertAction(title: "OK", style: .cancel,
                                      handler: {
                                        action in completionHandler();
        }));

        self.present(alert, animated: true);
      }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupBackend()
        timer = Timer.scheduledTimer(withTimeInterval: 2, repeats: false, block: { (Timer) in
            self.setupFrontend(bimFile: nil);
        })
    }

}


