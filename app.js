// UTILITY METHODS ----------------------------------------------------------------------------------------------
//const URL_PREFIX = "/";
const URL_PROTOCOL = "http";
const SERVER_ADDR = "localhost";
const SERVER_PORT = "8080";

const URL_PREFIX = URL_PROTOCOL + "://" + SERVER_ADDR + ":" + SERVER_PORT + "/";

const API_VERSION_MAJOR = "5";
var API_VERSION_MINOR = "1";

const OPERATION_STATUS_IDLE = 0;
const OPERATION_STATUS_IN_PROGRESS = 1;
const OPERATION_STATUS_SUCCESS = 2;
const OPERATION_STATUS_FAILED = 3;

const OPERATION_DO_UPDATE = 0;
const OPERATION_INSTALL_PACKAGE = 1;
const OPERATION_UPDATE_CLIENT_EXECUTABLE = 2;
const OPERATION_SET_TIMEZONE = 20;
const OPERATION_SET_HOSTNAME = 21;
const OPERATION_DEPLOY_SCRIPT = 30;
const OPERATION_DO_SHUTDOWN = 40;
const OPERATION_DO_REBOOT = 41;
const OPERATION_BROADCAST_MESSAGE = 50;

var SERVER_SOFTWARE = "Unknown";
var SERVER_SOFTWARE_VERSION = "Unknown";

function doInitalRequest() {
    $.get(
        URL_PREFIX + 'nectar/api/infoRequest'
    ).done(function(data, status, xhr) {
        var json = KJUR.jws.JWS.readSafeJSONString(xhr.responseText);

        if(json["apiVersionMajor"] != API_VERSION_MAJOR) {
            $('#noticeAlert').hide();
            $('#warnAlert').hide();
            $('#failureAlert').show();

            document.getElementById("failureAlertText").innerHTML = "Server [Major] API version (" +
                        json["apiVersionMajor"] + ") does not match ours (" + API_VERSION_MAJOR + ")";
            return;
        } else if(json["apiVersionMinor"] != API_VERSION_MINOR) {
            $('#failureAlert').hide();
            $('#warnAlert').show();

            document.getElementById("warnAlertText").innerHTML = "Warning: Server [Minor] API version (" +
                        json["apiVersionMinor"] + ") does not match ours (" + API_VERSION_MINOR + ")";
            API_VERSION_MINOR = json["apiVersionMinor"].toString();
        }

        SERVER_SOFTWARE = json["software"];
        SERVER_SOFTWARE_VERSION = json["softwareVersion"];

        document.getElementById("noticeAlertText").innerHTML = "Successfully contacted server for inital check";
    }).fail(function(xhr, textStatus, errorThrown) {
        $('#noticeAlert').hide();
        $('#warnAlert').show();
        document.getElementById("warnAlertText").innerHTML = "Failed to connect to server for inital check!";
    });
}

function convertStateToFriendly(state) {
    switch(state) {
        case 0:
            return "Online";
        case 1:
            return "Offline";
        case 2:
            return "Sleeping";
        case 3:
            return "Restarting";
        case 4:
            return "Unknown";
    }
}

// ANGULAR -------------------------------------------------------------------------------------------------------

var nectarApp = angular.module('nectarWebApp', ["ngSanitize", "ngRoute"], function($httpProvider) {
    $httpProvider.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';

    /**
        FROM: https://stackoverflow.com/questions/19254029/angularjs-http-post-does-not-send-data
    * The workhorse; converts an object to x-www-form-urlencoded serialization.
    * @param {Object} obj
    * @return {String}
    */
    var param = function(obj) {
        var query = '', name, value, fullSubName, subName, subValue, innerObj, i;

        for(name in obj) {
            value = obj[name];

            if(value instanceof Array) {
                for(i=0; i<value.length; ++i) {
                    subValue = value[i];
                    fullSubName = name + '[' + i + ']';
                    innerObj = {};
                    innerObj[fullSubName] = subValue;
                    query += param(innerObj) + '&';
                }
            } else if(value instanceof Object) {
                for(subName in value) {
                    subValue = value[subName];
                    fullSubName = name + '[' + subName + ']';
                    innerObj = {};
                    innerObj[fullSubName] = subValue;
                    query += param(innerObj) + '&';
                }
            } else if(value !== undefined && value !== null)
                query += encodeURIComponent(name) + '=' + encodeURIComponent(value) + '&';
            }

        return query.length ? query.substr(0, query.length - 1) : query;
    };

    // Override $http service's default transformRequest
    $httpProvider.defaults.transformRequest = [function(data) {
        return angular.isObject(data) && String(data) !== '[object File]' ? param(data) : data;
    }];
});

registerServices(nectarApp); // appServices.js

nectarApp.config(['$routeProvider', function($routeProvider){
    $routeProvider
    .when("/", {
        templateUrl : "login.html",
        requireLogin : false,
    })
    .when("/panel", {
        templateUrl : "panel.html",
        requireLogin : true
    });
}]).run(function($rootScope, $location, $timeout, $routeParams, $anchorScroll, LoginService, SyncService){
    $rootScope.changeView = function(view) {
        $location.path(view); // path not hash
    };

    $rootScope.scrollTo = function(id) {
        var old = $location.hash();
        $location.hash(id);
        $anchorScroll();
        //reset to old to keep any additional routing logic from kicking in
        $location.hash(old);
    };

    $rootScope.$on('$routeChangeStart', function (event, next) {
        if(next.requireLogin && !LoginService.getUserLoggedIn()) {
            console.log("No access to panel: not logged in.");

            alert("You need to be logged in as an administrator to see this page!");
            event.preventDefault();

            $timeout(function () {
                $rootScope.changeView("/");
            }, 500);
        }
    });
});

nectarApp.controller('exitController', function exitController($scope, $window, $rootScope, $http, LoginService) {
    $scope.onExit = function() {
        if(LoginService.getUserLoggedIn())
            LoginService.doLogout(LoginService, $scope, $rootScope);
    };

    $window.onbeforeunload = $scope.onExit;
});

nectarApp.controller('LoginController', function LoginController($scope, $location, $rootScope, $http, LoginService, KeyService, SyncService) {
    $scope.init = function() {
        $('#successAlert').hide();
        $('#warnAlert').hide();
        $('#failureAlert').hide();

        if(LoginService.getUserLoggedIn() === true) {
            // Redirect to panel if already logged in.
            alert("You are already logged in, redirecting to panel...");
            $rootScope.changeView("/panel");
        } else {
            doInitalRequest($http);
        }

        KeyService.downloadServerPublicKey();
    }

    $scope.doLogin = function(login) {
        //alert("Login Status: " + LoginService.getUserLoggedIn());
        LoginService.doLogin(login, LoginService, KeyService, SyncService, $scope, $rootScope);
        //$scope.loginInformation = angular.copy(login);
    };
});

nectarApp.controller('PanelController', function PanelController($scope, $rootScope, $http, $timeout, LoginService, KeyService, SyncService, ServerOperationsService) {
    $scope.init = function() {
        $("#clientPanelFailureAlert").hide();

        $("#clientViewInfoAlert").hide();
        $("#clientViewSuccessAlert").hide();
        $("#clientViewFailureAlert").hide();

        $('#userPanelSuccessAlert').hide();
        $('#userPanelFailureAlert').hide();

        KeyService.downloadServerPublicKey();

        SyncService.syncEverything(LoginService, SyncService, $scope, $rootScope, $timeout, true, null, null, null, null);
    };

    $scope.logout = function() {
        LoginService.doLogout(LoginService, $scope, $rootScope);
    };

    $scope.regenerateClientViewData = function(doApply) {
        var json = SyncService.getLastClientSyncJSONData();
        var newTableData = [];

        // Generate table data for each client

        for(var client in json) {
            var state = json[client]["state"];
            var hostname = json[client]["hostname"];
            if(json[client]["peerInfo"] != null) {// Check if the server send Peer information for the client
                var os = json[client]["peerInfo"]["systemInfo"]["os"];
                var cpu = json[client]["peerInfo"]["systemInfo"]["cpu"];

                var software = json[client]["peerInfo"]["software"];
                var softwareVersion = json[client]["peerInfo"]["softwareVersion"];
            } else
                var os, cpu, software, softwareVersion = "N/A";

            var updates;
            var securityUpdates;

            var operationCount = "N/A";
            var operationStatus = -1;
            var operationStatusStr = "N/A";
            var operationMessage = "N/A";

            var signedInUser = "None";

            if(state === 0) { // Update counts, operation information are only avaliable if the client is online.
                operationCount = json[client]["operationCount"];
                operationStatus = json[client]["operationStatus"];
                operationMessage = json[client]["operationMessage"];

                if(operationStatus === OPERATION_STATUS_IDLE)
                    operationStatusStr = "IDLE";
                else if(operationStatus === OPERATION_STATUS_SUCCESS)
                    operationStatusStr = "Success";
                else if(operationStatus === OPERATION_STATUS_FAILED)
                    operationStatusStr = "Failed";
                else if(operationStatus === OPERATION_STATUS_IN_PROGRESS) {
                    operationStatusStr = "In Progress";
                    operationMessage = "Processing...";
                }

                updates = json[client]["updates"];
                securityUpdates = json[client]["securityUpdates"];

                if(updates < 0)
                    updates = "N/A";
                if(securityUpdates < 0)
                    securityUpdates = "N/A";

                if(json[client]["signedInUser"] !== "null")
                    signedInUser = json[client]["signedInUser"];
            } else {
                updates = "?";
                securityUpdates = "?";
            }

            var rowColor = "";
            // Set the row's background based on the client state
            switch(state) {
                case 0:
                    rowColor = "success";
                    break;
                case 1:
                    rowColor = "warning";
                    break;
                case 2:
                    rowColor = "info";
                    break;
                case 3:
                    rowColor = "active";
                    break;
                case 4:
                    rowColor = "danger";
                    break;
            }

            var osTd = os;
            switch(os) {
                case "linux":
                    osTd = "<img src=\"assets/linux-logo.png\" /> Linux";
                    break;
                case "win32":
                case "win64":
                    osTd = "<img src=\"assets/win10-logo.png\" /> Windows";
                    break;
            }

            newTableData.push({
                software: software,
                softwareVersion: softwareVersion,
                uuid: client,
                hostname: hostname,
                state: convertStateToFriendly(state),
                stateInt: state,
                os: osTd,
                osStr: os,
                cpu: cpu,
                updates: updates,
                securityUpdates: securityUpdates,
                operationCount: operationCount,
                operationStatus: operationStatus,
                operationStatusStr: operationStatusStr,
                operationMessage: operationMessage,
                signedInUser: signedInUser,
                trClass: rowColor
            });
        }

        if(doApply) {
            $scope.$apply(function() {
                $scope.clientViewData = newTableData;
            });
        } else {
            $scope.clientViewData = newTableData;
        }
        //$scope.clientViewData = newTableData;
    }

// ================================== OPEN MODAL FUNCTIONS =================================================

    $scope.openClientsViewModal = function() {
        $("#clientViewInfoAlert").hide();
        $("#clientViewSuccessAlert").hide();
        $("#clientViewFailureAlert").hide();

        $("#modalClientView").modal("toggle");
        console.log("Opened client view modal.");

        $scope.regenerateClientViewData(false);
    };

    $scope.openClientSingle = function(client) {
        $("#modalClientView").modal("toggle"); // Close client view modal

        $scope.selectedClient = client;

        $("#modalClientViewSingle").modal("toggle"); // Open single client view
    };

    $scope.openClientRegisterModal = function() {
        $("#modalClientRegister").modal("toggle");
        console.log("Opened client register modal.");
    };

    $scope.openUserCreateModal = function() {
        $("#modalUserCreate").modal("toggle");
        console.log("Opened user create modal.");
    };

    $scope.openRemoveUserModal = function() {
        $("#modalUserRemove").modal("toggle");
        console.log("opened user remove modal.");
    };

// ================================== MODAL BUTTON FUNCTIONS =================================================

    $scope.deleteClient = function(uuid, hostname) {
        console.log("Opening confirm modal for deleting client " + uuid);

        $("#modalClientView").modal("toggle"); // Close Client View modal

        $scope.deletingClientHostname = hostname;
        $scope.deletingClientUUID = uuid;

        $("#modalClientViewDeleteClient").modal("toggle"); // Open Confirm dialog
    };

    $scope.confirmDeleteClient = function(uuid) {
        console.log("Got confirmation, Deleting client " + uuid);

        $("#modalClientViewDeleteClient").modal("toggle"); // Close confirm dialog
        $("#modalClientView").modal("toggle"); // Re-open client view modal.

        document.getElementById("clientViewInfoAlertText").innerHTML = "Deleting client...";
        $("#clientViewInfoAlert").show();

        ServerOperationsService.removeClient(LoginService, $scope, $rootScope, uuid);
    };

    $scope.registerClient = function() {
        ServerOperationsService.registerClient(LoginService, $scope, $rootScope); // Register the client

        $("#modalClientRegister").modal("toggle"); // Close modal
    };

    $scope.createNewUser = function(userData) {
        if(userData === null) return; // Check if they didn't enter anything
        if(userData.username == "") return;
        if(userData.password == "") return;
        if(userData.isAdmin == null) userData.isAdmin = false; // If the user never checks the box it is undefined

        ServerOperationsService.registerUser(LoginService, $scope, $rootScope, userData);

        $("#modalUserCreate").modal("toggle");
    };

    $scope.removeUser = function(userData) {
        if(userData === null) return;
        if(userData.username == "") return;

        ServerOperationsService.removeUser(LoginService, $scope, $rootScope, userData);

        $("#modalUserRemove").modal("toggle");
    };

    $scope.updateAllClients = function() {
        $("#clientViewInfoAlert").hide();
        $("#clientViewSuccessAlert").hide();
        $("#clientViewFailureAlert").hide();

        document.getElementById("clientViewInfoAlertText").innerHTML = "Sending update signal to all connected clients...";
        $("#clientViewInfoAlert").show();

        var targets = [];
        for(var i = 0; i < $scope.clientViewData.length; i++) {
            if($scope.clientViewData[i].stateInt !== 0) // Skip clients which are not connected
                continue;

            if($scope.clientViewData[i].updates < 1) // Skip clients which don't have avaliable updates
                continue;

            targets.push($scope.clientViewData[i].uuid);
        }

        ServerOperationsService.addOperationToQueue(LoginService, $scope, $rootScope, OPERATION_DO_UPDATE, targets, {}, function(success, errorText) {
            if(success) {
                $("#clientViewInfoAlert").hide();

                document.getElementById("clientViewSuccessAlertText").innerHTML = "Successfully sent update signal to all connected clients!";
                $("#clientViewSuccessAlert").show();
            } else {
                $("#clientViewInfoAlert").hide();

                document.getElementById("clientViewFailureAlertText").innerHTML = "Failed to send update signal! \"" + errorText + "\"";
                $("#clientViewFailureAlert").show();
            }
        });
    };

    $scope.changeHostname = function(selectedClient) {
        console.log("Opening change hostname modal for client " + selectedClient.uuid);

        $("#modalClientViewSingle").modal("toggle"); // Close Single Client View modal

        $("#modalClientChangeHostname").modal("toggle"); // Open change hostname modal
    };

    $scope.changeTimezone = function(selectedClient) {
        console.log("Opening change timezone modal for client " + selectedClient.uuid);

        $("#modalClientViewSingle").modal("toggle"); // Close Single Client View modal

        $("#modalClientChangeTimezone").modal("toggle"); // Open change timezone modal
    };

    $scope.doChangeHostname = function(newHostname) {
        console.log("Switching hostname for " + $scope.selectedClient.uuid + " to " + newHostname);

        $("#modalClientChangeHostname").modal("toggle"); // Close change hostname modal
        $("#modalClientView").modal("toggle"); // Open Client View modal

        $("#clientViewInfoAlert").hide();
        $("#clientViewSuccessAlert").hide();
        $("#clientViewFailureAlert").hide();

        document.getElementById("clientViewInfoAlertText").innerHTML = "Sending change hostname signal...";
        $("#clientViewInfoAlert").show();

        ServerOperationsService.addOperationToQueue(LoginService, $scope, $rootScope, OPERATION_SET_HOSTNAME, [$scope.selectedClient.uuid], { hostname: newHostname }, function(success, errorText) {
            if(success) {
                $("#clientViewInfoAlert").hide();

                document.getElementById("clientViewSuccessAlertText").innerHTML = "Successfully sent change hostname signal!";
                $("#clientViewSuccessAlert").show();
            } else {
                $("#clientViewInfoAlert").hide();

                document.getElementById("clientViewFailureAlertText").innerHTML = "Failed to send change hostname signal! \"" + errorText + "\"";
                $("#clientViewFailureAlert").show();
            }
        });
    };

    $scope.doChangeTimezone = function(newTimezone) {
        console.log("Switching timezone for " + $scope.selectedClient.uuid + " to " + newTimezone);

        $("#modalClientChangeTimezone").modal("toggle"); // Close change timezone modal
        $("#modalClientView").modal("toggle"); // Open Client View modal

        $("#clientViewInfoAlert").hide();
        $("#clientViewSuccessAlert").hide();
        $("#clientViewFailureAlert").hide();

        document.getElementById("clientViewInfoAlertText").innerHTML = "Sending change timezone signal...";
        $("#clientViewInfoAlert").show();

        ServerOperationsService.addOperationToQueue(LoginService, $scope, $rootScope, OPERATION_SET_TIMEZONE, [$scope.selectedClient.uuid], { timezone: newTimezone }, function(success, errorText) {
            if(success) {
                $("#clientViewInfoAlert").hide();

                document.getElementById("clientViewSuccessAlertText").innerHTML = "Successfully sent change timezone signal!";
                $("#clientViewSuccessAlert").show();
            } else {
                $("#clientViewInfoAlert").hide();

                document.getElementById("clientViewFailureAlertText").innerHTML = "Failed to send change timezone signal! \"" + errorText + "\"";
                $("#clientViewFailureAlert").show();
            }
        });
    };

    // Scope Variables Init

    $scope.clientsOnline = 0;
    $scope.serverName = SERVER_ADDR;

    $scope.serverSoftware = SERVER_SOFTWARE;
    $scope.serverSoftwareVersion = SERVER_SOFTWARE_VERSION;

    $scope.timezoneOptions = [];

    // Set the timezone selection dropdown content based on timezones.txt
    // Timezones are presented in the Windows format to be more user friendly
    $.get(
        "timezones.txt"
    ).done(function(data, status, xhr) {
        console.log("Server returned " + xhr.status + " for timezones.txt");

        var lines = xhr.responseText.split("\n");
        for(line in lines) {
            if(lines[line].length < 2) continue;
            $scope.timezoneOptions.push({name: lines[line]});
        }
    }).fail(function(xhr, textStatus, errorThrown) {
        console.error("Failed to get timezones.txt from server, returned: " + xhr.status);
        alert("Could not get list of timezones from server, returned: " + xhr.status + " " + xhr.statusText);
    });
});
