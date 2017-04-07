// UTILITY METHODS ----------------------------------------------------------------------------------------------
//const URL_PREFIX = "/";
const URL_PROTOCOL = "http";
const SERVER_ADDR = "localhost";
const SERVER_PORT = "8080";

const URL_PREFIX = URL_PROTOCOL + "://" + SERVER_ADDR + ":" + SERVER_PORT + "/";

const API_VERSION_MAJOR = "3";
const API_VERSION_MINOR = "3";

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

nectarApp.controller('PanelController', function PanelController($scope, $rootScope, $http, $timeout, LoginService, KeyService, SyncService) {
    $scope.init = function() {
        KeyService.downloadServerPublicKey();

        SyncService.syncEverything(LoginService, SyncService, $scope, $rootScope, true, null, null, null);
    };

    $scope.logout = function() {
        LoginService.doLogout(LoginService, $scope, $rootScope);
    };

    $scope.clientsOnline = 0;
    $scope.serverName = SERVER_ADDR;
});
