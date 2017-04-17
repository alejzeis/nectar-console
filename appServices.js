function registerServices(nectarApp) {
    nectarApp.service('KeyService', function($http, $timeout) {
        this.downloadServerPublicKey = function() {
            $.get(
                "serverPublicKey.pem"
            ).done(function(data, status, xhr) {
                console.log("Server returned " + xhr.status + " for serverPublicKey.pem");

                sessionStorage.serverPublicKeyStr = xhr.responseText;
            }).fail(function(xhr, textStatus, errorThrown) {
                console.error("Failed to get serverPublicKey.pem from server, returned: " + xhr.status);
                alert("Could not get server public key from server, returned: " + xhr.status + " " + xhr.statusText);
            });
        };

        this.getServerPublicKeyStr = function() {
            return sessionStorage.serverPublicKeyStr;
        };
    });

    nectarApp.service('LoginService', function($http, $timeout) {
        this.setUserLoggedIn = function(value){
            localStorage.userIsLoggedIn = value;
        };

        this.getUserLoggedIn = function() {
            return localStorage.userIsLoggedIn == 'true';
        };

        this.getSessionToken = function() {
            return localStorage.sessionToken;
        };

        this.setSessionToken = function(token) {
            localStorage.sessionToken = token;
        }

        this.requestNewToken = function(login, LoginService, KeyService, SyncService, $scope, $rootScope) {
            console.log("Requesting new token...");

            $.post(URL_PREFIX + 'nectar/api/v/' + API_VERSION_MAJOR + "/" + API_VERSION_MINOR + "/session/mgmtTokenRequest",
                {
                    username: login.user,
                    password: login.password
                }
            ).done(function(data, status, xhr) {
                console.log("Got response for mgmtTokenRequest SUCCESS: " + xhr.status + " " + xhr.statusText);

                var pubKey = KEYUTIL.getKey(KeyService.getServerPublicKeyStr());
                var isValid = KJUR.jws.JWS.verifyJWT(xhr.responseText, pubKey, {alg: ['ES384']});
                if(!isValid) {
                    console.error("Session token returned is invalid!");
                    alert("Failed to verify session token returned from server, CONNECTION IS NOT SECURE.");
                    return;
                }

                var payload = KJUR.jws.JWS.readSafeJSONString(b64utoutf8(xhr.responseText.split(".")[1]));

                LoginService.setSessionToken(xhr.responseText);
                LoginService.setUserLoggedIn(true);

                console.log("Will get new token at: " + (payload.expires + 750));
                $timeout(function () {
                    LoginService.requestNewToken(login, LoginService, KeyService, $scope, $rootScope);
                }, payload.expires + 750);
            }).fail(function(xhr, textStatus, errorThrown) {
                // TODO: seperate messages based on status code
                console.error("Got response for mgmtTokenRequest FAILURE: " + xhr.status + " " + xhr.statusText);

                $('#successAlert').hide();

                document.getElementById("failureAlertText").innerHTML = "Failed to login to server! Please check your username and password.";
                $('#failureAlert').show();
            });
        }

        this.doLogin = function(login, LoginService, KeyService, SyncService, $scope, $rootScope) {
            $.post(URL_PREFIX + 'nectar/api/v/' + API_VERSION_MAJOR + "/" + API_VERSION_MINOR + "/session/mgmtTokenRequest",
                {
                    username: login.user,
                    password: login.password
                }
            ).done(function(data, status, xhr) {
                console.log("Got response for mgmtTokenRequest SUCCESS: " + xhr.status + " " + xhr.statusText);

                var pubKey = KEYUTIL.getKey(KeyService.getServerPublicKeyStr());
                var isValid = KJUR.jws.JWS.verifyJWT(xhr.responseText, pubKey, {alg: ['ES384']});
                if(!isValid) {
                    console.error("Session token returned is invalid!");
                    $('#successAlert').hide();

                    document.getElementById("failureAlertText").innerHTML = "CONNECTION IS NOT SECURE: Server returned invalid session token.";
                    $('#failureAlert').show();
                    return;
                } else {
                    LoginService.setSessionToken(xhr.responseText);
                    LoginService.setUserLoggedIn(true);

                    $('#noticeAlert').hide();
                    $('#warnAlert').hide();
                    $('#failureAlert').hide();

                    document.getElementById("successAlertText").innerHTML = "Successfully logged in! Redirecting to panel...";
                    $('#successAlert').show();

                    var payload = KJUR.jws.JWS.readSafeJSONString(b64utoutf8(xhr.responseText.split(".")[1]));

                    $timeout(function () {
                        $rootScope.changeView("panel");
                    }, 1000);

                    console.log("Will get new token at: " + (payload.expires + 750));
                    $timeout(function () {
                        LoginService.requestNewToken(login, LoginService, KeyService, $scope, $rootScope);
                    }, payload.expires + 750);
                }
            }).fail(function(xhr, textStatus, errorThrown) {
                // TODO: seperate messages based on status code
                console.error("Got response for mgmtTokenRequest FAILURE: " + xhr.status + " " + xhr.statusText);

                $('#successAlert').hide();

                document.getElementById("failureAlertText").innerHTML = "Failed to login to server! Please check your username and password.";
                $('#failureAlert').show();
            });
        };

        this.doLogout = function(LoginService, $scope, $rootScope) {
            if(LoginService.getUserLoggedIn() === false) return;

            $.get(URL_PREFIX + 'nectar/api/v/' + API_VERSION_MAJOR + "/" + API_VERSION_MINOR + "/session/mgmtLogout?token=" + LoginService.getSessionToken())
            .done(function(data, status, xhr) {
                console.log("Got response for mgmtLogout SUCCESS: " + xhr.status + " " + xhr.statusText);

                LoginService.setUserLoggedIn(false);
                LoginService.setSessionToken("");

                $timeout(function () {
                    $rootScope.changeView("/");
                }, 1000);
            }).fail(function(xhr, textStatus, errorThrown) {
                // TODO: seperate messages based on status code
                console.error("Got response for mgmtLogout FAILURE: " + xhr.status + " " + xhr.statusText);

                alert("Failed to logout! (" + xhr.status + " " + xhr.statusText + ")");

                LoginService.setUserLoggedIn(false);
                LoginService.setSessionToken("");

                $rootScope.changeView("");
            });
        };
    });

    nectarApp.service('SyncService', function($http, $timeout) {

        // Sync data from the server, update charts with client information, etc.
        this.syncEverything = function(LoginService, SyncService, $scope, $rootScope, $timeout, inital, clientsChart, updatesChart, operationsChart, usersChart) {
            if(!LoginService.getUserLoggedIn()) return;

            syncUsers(LoginService, SyncService, $scope, $rootScope, $timeout, inital, clientsChart, updatesChart, operationsChart, usersChart);
        }
    });

    nectarApp.service('ServerOperationsService', function() {
        this.registerUser = function(LoginService, $scope, $rootScope, userData) {
            if(!LoginService.getUserLoggedIn()) return;

            $.post(URL_PREFIX + 'nectar/api/v/' + API_VERSION_MAJOR + "/" + API_VERSION_MINOR + "/auth/registerUser",
                {
                    token: LoginService.getSessionToken(),
                    user: userData.username,
                    password: userData.password,
                    admin: userData.isAdmin
                }
            ).done(function(data, status, xhr) {
                console.log("Got response for registerUser SUCCESS: " + xhr.status + " " + xhr.statusText);

                $('#userPanelFailureAlert').hide();

                document.getElementById("userPanelSuccessAlertText").innerHTML = "Successfully created new user!";
                $('#userPanelSuccessAlert').show();
            }).fail(function(xhr, textStatus, errorThrown) {
                // TODO: seperate messages based on status code
                console.error("Got response for registerUser FAILURE: " + xhr.status + " " + xhr.statusText);

                $('#userPanelSuccessAlert').hide();

                document.getElementById("userPanelFailureAlertText").innerHTML = "Failed to create user! \"" + xhr.responseText + "\"";
                $('#userPanelFailureAlert').show();
            });
        };
    });
}
