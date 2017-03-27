// UTILITY METHODS ----------------------------------------------------------------------------------------------
//const URL_PREFIX = "/";
const URL_PREFIX = "http://localhost:8080/";

const API_VERSION_MAJOR = "3";
const API_VERSION_MINOR = "2";

function doInitalRequest($http) {
    $http({
        method: 'GET',
        url: URL_PREFIX + 'nectar/api/infoRequest'
    }).then(function successCallback(response) {
        document.getElementById("noticeAlertText").innerHTML = "Successfully contacted server for inital check";
    }, function errorCallback(response) {
        $('#noticeAlert').hide();
        $('#warnAlert').show();
        document.getElementById("warnAlertText").innerHTML = "Failed to connect to server for inital check!";
    });
}

// ANGULAR -------------------------------------------------------------------------------------------------------

var nectarApp = angular.module('nectarWebApp', ["ngRoute"], function($httpProvider) {
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
        sessionStorage.userIsLoggedIn = value;
    };

    this.getUserLoggedIn = function() {
        return sessionStorage.userIsLoggedIn == 'true';
    };

    this.getSessionToken = function() {
        return sessionStorage.sessionToken;
    };

    this.setSessionToken = function(token) {
        sessionStorage.sessionToken = token;
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

            LoginService.setSessionToken("");
            LoginService.setUserLoggedIn(false);

            $timeout(function () {
                $rootScope.changeView("/");
            }, 1000);
        }).fail(function(xhr, textStatus, errorThrown) {
            // TODO: seperate messages based on status code
            console.error("Got response for mgmtLogout FAILURE: " + xhr.status + " " + xhr.statusText);

            alert("Failed to logout! (" + xhr.status + " " + xhr.statusText + ")");

            LoginService.setSessionToken("");
            LoginService.setUserLoggedIn(false);

            $rootScope.changeView("");
        });
    };
});

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
}]).run(function($rootScope, $location, $timeout, LoginService){
    $rootScope.changeView = function(view){
        $location.path(view); // path not hash
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

nectarApp.controller('LoginController', function LoginController($scope, $location, $rootScope, $http, LoginService, KeyService) {
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
        LoginService.doLogin(login, LoginService, KeyService, $scope, $rootScope);
        //$scope.loginInformation = angular.copy(login);
    };
});

nectarApp.controller('PanelController', function PanelController($scope, $rootScope, $http, LoginService, KeyService) {
    $scope.init = function() {
        KeyService.downloadServerPublicKey();
    };

    $scope.logout = function() {
        LoginService.doLogout(LoginService, $scope, $rootScope);
    };
});
