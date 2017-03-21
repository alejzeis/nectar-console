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

nectarApp.service('LoginService', function($http) {
    var userIsLoggedIn = false;

    this.setUserLoggedIn = function(value){
        userIsLoggedIn = value;
    };

    this.getUserLoggedIn = function() {
        return userIsLoggedIn;
    };

    this.doLogin = function(login) {
        $.post(URL_PREFIX + 'nectar/api/v/' + API_VERSION_MAJOR + "/" + API_VERSION_MINOR + "/session/mgmtTokenRequest",
            {
                username: login.user,
                password: login.password
            }
        ).done(function(data, status, xhr) {
            console.log("Got response for mgmtTokenRequest SUCCESS: " + data.status + " " + data.statusText);

            $('#noticeAlert').hide();
            $('#warnAlert').hide();
            $('#failureAlert').hide();

            document.getElementById("successAlertText").innerHTML = "Successfully logged in! Redirecting to panel...";
            $('#successAlert').show();
        }).fail(function(data, status, xhr) {
            // TODO: seperate messages based on status code
            console.error("Got response for mgmtTokenRequest FAILURE: " + data.status + " " + data.statusText);

            $('#successAlert').hide();

            document.getElementById("failureAlertText").innerHTML = "Failed to login to server! Please check your username and password.";
            $('#failureAlert').show();
        });
        /*
        $http({
            method: 'POST',
            url: URL_PREFIX + 'nectar/api/v/' + API_VERSION_MAJOR + "/" + API_VERSION_MINOR + "/session/mgmtTokenRequest",
            data: {
                username: login.user,
                password: login.password
            }
        }).success(function successCallback(response) {
            $('#noticeAlert').hide();
            $('#warnAlert').hide();
            $('#failureAlert').hide();

            console.log("Login success!");

            document.getElementById("successAlertText").innerHTML = "Successfully logged in! Redirecting to panel...";
            $('#successAlert').show();
        }).error(function errorCallback(response) {
            $('#successAlert').hide();

            console.log("Failed to login into server! (server returned: " + response.status + " \"" + response.body + "\")");
            document.getElementById("failureAlertText").innerHTML = "Failed to login to server! Please check your username and password.";
            $('#failureAlert').show();
        });*/
    };
});

nectarApp.config(['$routeProvider', function($routeProvider){
    $routeProvider
    .when("/", {
        templateUrl : "login.html",
        requireLogin : false
    })
    .when("/panel", {
        templateUrl : "panel.html",
        requireLogin : true
    });
}]).run(function($rootScope, LoginService){
    $rootScope.$on('$routeChangeStart', function (event, next) {
        if(next.requireLogin && !LoginService.getUserLoggedIn()) {
            alert("You need to be authenticated to see this page!");
            event.preventDefault();
        }
    });
});

nectarApp.controller('LoginController', function LoginController($scope, $location, $rootScope, $http, LoginService) {
    $scope.loginInformation = { };
    $scope.loginStatus = LoginService.getUserLoggedIn();

    $scope.init = function() {
        $('#successAlert').hide();
        $('#warnAlert').hide();
        $('#failureAlert').hide();

        doInitalRequest($http);
    }

    $scope.changeView = function(view){
        $location.path(view); // path not hash
    };
    $scope.doLogin = function(login) {
        //alert("Login Status: " + LoginService.getUserLoggedIn());
        LoginService.doLogin(login);
        //$scope.loginInformation = angular.copy(login);
    };
});
