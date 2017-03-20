const API_VERSION_MAJOR = "3";
const API_VERSION_MINOR = "1";

var nectarApp = angular.module('nectarWebApp', ["ngRoute"]);

nectarApp.service('LoginService', function($http) {
    var userIsLoggedIn = false;

    this.setUserLoggedIn = function(value){
        userIsLoggedIn = value;
    };

    this.getUserLoggedIn = function() {
        return userIsLoggedIn;
    };
    
    this.doLogin = function(login) {
        $http({
            method: 'GET',
            url: '/nectar/api/v/' + API_VERSION_MAJOR + "/" + API_VERSION_MINOR + "/session/managementTokenRequest?"
            + "username=" + login.username + "&password=" + login.password
            // TODO
        }).then(function successCallback(response) {
        // this callback will be called asynchronously
        // when the response is available
        }, function errorCallback(response) {
            
        });
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

nectarApp.controller('LoginController', function LoginController($scope, $location, $rootScope, LoginService) {
    $scope.loginInformation = { };
    $scope.loginStatus = LoginService.getUserLoggedIn();
    
    $scope.changeView = function(view){
        $location.path(view); // path not hash
    };
    $scope.doLogin = function(login) {
        //alert("Login Status: " + LoginService.getUserLoggedIn());
        LoginService.doLogin(login);
        //$scope.loginInformation = angular.copy(login);
    };
});