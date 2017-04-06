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
                alert("Could not get server public key from server, returned: " + xhr.status + " " + xhr.statusText)
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

        this.requestNewToken = function(login, LoginService, KeyService, $scope, $rootScope) {
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

                $timeout(function () {
                    LoginService.requestNewToken(login, LoginService, KeyService, $scope, $rootScope);
                }, payload.expires + 500);
            }).fail(function(xhr, textStatus, errorThrown) {
                // TODO: seperate messages based on status code
                console.error("Got response for mgmtTokenRequest FAILURE: " + xhr.status + " " + xhr.statusText);

                $('#successAlert').hide();

                document.getElementById("failureAlertText").innerHTML = "Failed to login to server! Please check your username and password.";
                $('#failureAlert').show();
            });
        }

        this.doLogin = function(login, LoginService, KeyService, $scope, $rootScope) {
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

                    $timeout(function () {
                        LoginService.requestNewToken(login, LoginService, KeyService, $scope, $rootScope);
                    }, payload.expires + 500);
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
        this.syncEverything = function(LoginService, SyncService, $scope, $rootScope, inital, clientsChart, updatesChart, operationsChart) {
            if(!LoginService.getUserLoggedIn()) return;

            $.get(URL_PREFIX + 'nectar/api/v/' + API_VERSION_MAJOR + "/" + API_VERSION_MINOR + "/query/queryClients?token=" + LoginService.getSessionToken())
            .done(function(data, status, xhr) {
                console.log("Got response for queryClients SUCCESS: " + xhr.status + " " + xhr.statusText);

                var json = KJUR.jws.JWS.readSafeJSONString(xhr.responseText);
                var data = constructChartData(json, $scope);

                if(inital) {
                    var clientsCtx = document.getElementById("clientsChart");
                    var updatesCtx = document.getElementById("updatesChart");
                    var operationsCtx = document.getElementById("operationsChart");

                    clientsChart = new Chart(clientsCtx, {
                        type: 'pie',
                        data: {
                            labels: [
                                "Online",
                                "Shutdown",
                                "Sleeping",
                                "Restarting",
                                "Unknown"
                            ],
                            datasets: [
                                {
                                    data: data.stateData,
                                    backgroundColor: [
                                        "#20f718",
                                        "#35f4ff",
                                        "#e1ff77",
                                        "#ffd334",
                                        "#FF6384"
                                    ],
                                    hoverBackgroundColor: [
                                        "#20f718",
                                        "#35f4ff",
                                        "#e1ff77",
                                        "#ffd334",
                                        "#FF6384"
                                    ]
                                }
                            ]
                        },
                        options: {
                            animation:{
                                animateScale: true
                            }
                        }
                    });

                    updatesChart = new Chart(updatesCtx, {
                        type: 'pie',
                        data: {
                            labels: [
                                "Up to date",
                                "Updates Needed"
                            ],
                            datasets: [
                                {
                                    data: data.updatesData,
                                    backgroundColor: [
                                        "#20f718",
                                        "#ffd334",
                                    ],
                                    hoverBackgroundColor: [
                                        "#20f718",
                                        "#ffd334",
                                    ]
                                }
                            ]
                        },
                        options: {
                            animation:{
                                animateScale: true
                            }
                        }
                    });

                    operationsChart = new Chart(operationsCtx, {
                        type: 'pie',
                        data: {
                            labels: [
                                "Idle",
                                "Processing"
                            ],
                            datasets: [
                                {
                                    data: data.operationsData,
                                    backgroundColor: [
                                        "#20f718",
                                        "#b784ff",
                                    ],
                                    hoverBackgroundColor: [
                                        "#20f718",
                                        "#b784ff",
                                    ]
                                }
                            ]
                        },
                        options: {
                            animation:{
                                animateScale: true
                            }
                        }
                    });
                } else {
                    clientsChart.data.datasets[0].data = data.stateData;
                    clientsChart.update();

                    updatesChart.data.datasets[0].data = data.updatesData;
                    updatesChart.update();

                    operationsChart.data.datasets[0].data = data.operationsData;
                    operationsChart.update();
                }

                $timeout(function() {
                    SyncService.syncEverything(LoginService, SyncService, $scope, $rootScope, false, clientsChart, updatesChart, operationsChart);
                }, 5000); // Sync every 5 seconds
            }).fail(function(xhr, textStatus, errorThrown) {
                // TODO: seperate messages based on status code
                console.error("Got response for queryClients FAILURE: " + xhr.status + " " + xhr.statusText);

                alert("Failed to query server! (" + xhr.status + " " + xhr.statusText + ")");

                $timeout(function() {
                    SyncService.syncEverything(LoginService, SyncService, $scope, $rootScope, false, clientsChart, updatesChart, operationsChart);
                }, 5000); // Sync every 5 seconds
            });
        }
    });
}

function constructChartData(json, $scope) {
    var data = [0, 0, 0, 0, 0];
    var updatesNeeded = [0, 0];
    var operations = [0, 0];

    var clientsOnline = 0;

    for (var client in json) {
        var state = json[client]["state"];

        switch(state) {
            case 0:
                clientsOnline++;
            case 1:
            case 2:
            case 3:
            case 4:
                data[state]++;

                if(json[client]["updates"] !== null && json[client]["updates"] > 0) {
                    updatesNeeded[1]++;
                } else updatesNeeded[0]++;

                if(json[client]["operationStatus"] !== null && json[client]["operationStatus"] === 0) {
                    operations[0]++;
                } else if(json[client]["operationStatus"] !== null && json[client]["operationStatus"] === 1) operations[1]++;
                break;
        }
    }

    $scope.clientsOnline = clientsOnline;

    return {stateData: data, updatesData: updatesNeeded, operationsData: operations};
}
