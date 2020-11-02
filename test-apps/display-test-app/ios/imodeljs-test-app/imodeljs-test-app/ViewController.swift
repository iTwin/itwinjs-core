/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import UIKit
import WebKit

class ViewController: UIViewController, WKUIDelegate, WKNavigationDelegate, UIDocumentPickerDelegate {
    private var webView : WKWebView? = nil


    func setupBackend () {
        let host = IModelJsHost.sharedInstance() as! IModelJsHost
        let bundlePath = Bundle.main.bundlePath;
        let mainPath = bundlePath.appending ("/Assets/main.js");
        let main = URL(fileURLWithPath: mainPath);
        let client = MobileAuthorizationClient(viewController: self);
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
            queryParam.append("&signInForStandalone=true")
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
    @IBAction func onOpenSnapshotIModel(_ sender: Any) {
        pickSnapshot();
    }
    func pickSnapshot(){
        let picker = UIDocumentPickerViewController(documentTypes: ["com.bentley.app.bim"], in: .open);
        picker.modalPresentationStyle = .fullScreen;
        picker.allowsMultipleSelection = false;
        picker.directoryURL = getDocumentsDirectory();
        picker.delegate = self;
        self.present(picker, animated: true);
    }
    
    func getDocumentsDirectory() -> URL {
        let paths = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
        let documentsDirectory = paths[0]
        return documentsDirectory
    }
    
    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        setupFrontend(bimFile: nil);
    }

    
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentAt url: URL) {
        setupFrontend(bimFile: url)
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupBackend()

    }

}

