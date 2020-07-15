ntlm.js
======
Javascript implementation of Microsoft NTLM authentication over HTTP. Gives you the possibility to do that AJAX NTLM
you've always wanted.

Usage
------
    Ntlm.setCredentials('domain', 'username', 'password');
    var url = 'http://myserver.com/secret.txt';

    if (Ntlm.authenticate(url)) {
        var request = new XMLHttpRequest();
        request.open('GET', url, false);
        request.send(null);
        console.log(request.responseText);
        // => My super secret message stored on server.
    }

Setup
------
On the server side, the following CORS HTTP Response headers are required:
* Access-Control-Allow-Headers: Authorization
* Access-Control-Allow-Methods: GET, OPTIONS
* Access-Control-Allow-Origin: *
* Access-Control-Expose-Headers: WWW-Authenticate

Known issues
-----
Since the IIS isn't built (??) to support CORS, it will react in a most unfortunate way when receiving a
preflight OPTION request (HTTP 401). The remedy for this is to use your own module or disable security checks
in the browser.

References
------
* http://www.innovation.ch/personal/ronald/ntlm.html
* http://download.microsoft.com/download/a/e/6/ae6e4142-aa58-45c6-8dcf-a657e5900cd3/[MS-NLMP].pdf
* http://download.microsoft.com/download/a/e/6/ae6e4142-aa58-45c6-8dcf-a657e5900cd3/[MS-NTHT].pdf
