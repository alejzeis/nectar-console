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

        var lastClientSyncJSONData;

        this.getLastClientSyncJSONData = function() {
            return lastClientSyncJSONData;
        };

        this.setLastClientSyncJSONData = function(data) {
            lastClientSyncJSONData = data;
        };

        // Sync data from the server, update charts with client information, etc.
        this.syncEverything = function(LoginService, SyncService, $scope, $rootScope, $timeout, inital, clientsChart, updatesChart, operationsChart, usersChart) {
            if(!LoginService.getUserLoggedIn()) return;

            syncUsers(LoginService, SyncService, $scope, $rootScope, $timeout, inital, clientsChart, updatesChart, operationsChart, usersChart, function() {
                $scope.regenerateClientViewData(true);
            });
        }
    });

    nectarApp.service('ServerOperationsService', function() {
        this.registerClient = function(LoginService, $scope, $rootScope) {
            if(!LoginService.getUserLoggedIn()) return;

            $.post(URL_PREFIX + 'nectar/api/v/' + API_VERSION_MAJOR + "/" + API_VERSION_MINOR + "/auth/registerClient",
                {
                    token: LoginService.getSessionToken(),
                    clientInfo: "{}" // TODO: Send client info and implement server-side
                }
            ).done(function(data, status, xhr) {
                console.log("Got response for registerClient SUCCESS: " + xhr.status + " " + xhr.statusText);

                $('#clientPanelFailureAlert').hide();

                var json = KJUR.jws.JWS.readSafeJSONString(xhr.responseText);

                $scope.$apply(function() {
                    $scope.newClientUUID = json.uuid;
                    $scope.newClientAuth = json.auth;
                });

                $('#modalClientRegisterResult').modal("toggle");
            }).fail(function(xhr, textStatus, errorThrown) {
                // TODO: seperate messages based on status code
                console.error("Got response for registerClient FAILURE: " + xhr.status + " " + xhr.statusText);

                document.getElementById("clientPanelFailureAlertText").innerHTML = "Failed to register client! \"" + xhr.responseText + "\"";
                $('#clientPanelFailureAlert').show();
            });
        };

        this.removeClient = function(LoginService, $scope, $rootScope, uuid) {
            if(!LoginService.getUserLoggedIn()) return;

            $.get(URL_PREFIX + 'nectar/api/v/' + API_VERSION_MAJOR + "/" + API_VERSION_MINOR + "/auth/removeClient?token="
                + LoginService.getSessionToken() + "&uuid=" + uuid
            ).done(function(data, status, xhr) {
                console.log("Got response for removeUser SUCCESS: " + xhr.status + " " + xhr.statusText);

                $("#clientViewInfoAlert").hide();
                $("#clientViewFailureAlert").hide();

                document.getElementById("clientViewSuccessAlertText").innerHTML = "Successfully deleted the client!";
                $("#clientViewSuccessAlert").show();

                $scope.$apply(function() {
                    $scope.regenerateClientViewData();
                    console.log("regenerated.");
                });
            }).fail(function(xhr, textStatus, errorThrown) {
                console.error("Got response for removeUser FAILURE: " + xhr.status + " " + xhr.statusText);

                $("#clientViewInfoAlert").hide();
                $("#clientViewSuccessAlert").hide();

                document.getElementById("clientViewFailureAlertText").innerHTML = "Failed to delete client! \"" + xhr.responseText + "\"";
                $("#clientViewFailureAlert").show();
            });
        };

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

        this.removeUser = function(LoginService, $scope, $rootScope, userData) {
            $.get(URL_PREFIX + 'nectar/api/v/' + API_VERSION_MAJOR + "/" + API_VERSION_MINOR + "/auth/removeUser?token="
                    + LoginService.getSessionToken() + "&user=" + userData.username
            ).done(function(data, status, xhr) {
                console.log("Got response for removeUser SUCCESS: " + xhr.status + " " + xhr.statusText);

                $('#userPanelFailureAlert').hide();

                document.getElementById("userPanelSuccessAlertText").innerHTML = "Successfully removed user!";
                $('#userPanelSuccessAlert').show();
            }).fail(function(xhr, textStatus, errorThrown) {
                // TODO: seperate messages based on status code
                console.error("Got response for removeUser FAILURE: " + xhr.status + " " + xhr.statusText);

                $('#userPanelSuccessAlert').hide();

                document.getElementById("userPanelFailureAlertText").innerHTML = "Failed to remove user! \"" + xhr.responseText + "\"";
                $('#userPanelFailureAlert').show();
            });
        };

        this.addOperationToQueue = function(LoginService, $scope, $rootScope, opId, targets, additionalData, cb) {
            var opData = {
                id: opId,
                targets: targets,
                additionalData: additionalData
            };

            $.post(URL_PREFIX + 'nectar/api/v/' + API_VERSION_MAJOR + "/" + API_VERSION_MINOR + "/operation/addToQueue",
                {
                    token: LoginService.getSessionToken(),
                    opData: utf8tob64u(JSON.stringify(opData))
                }
            ).done(function(data, status, xhr) {
                console.log("Got response for addToQueue SUCCESS: " + xhr.status + " " + xhr.statusText);

                cb(true);
            }).fail(function(xhr, textStatus, errorThrown) {
                // TODO: seperate messages based on status code
                console.error("Got response for addToQueue FAILURE: " + xhr.status + " " + xhr.statusText);

                cb(false, xhr.responseText);
            });
        };
    });
}
