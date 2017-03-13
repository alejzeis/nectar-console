var nectarApp = angular.module('nectarWebApp', ["ngRoute"]);

nectarApp.service('LoginService', function() {
   var userIsLoggedIn = false;

    this.setUserLoggedIn = function(value){
        userIsLoggedIn = value;
    };

    this.getUserLoggedIn = function() {
        return userIsLoggedIn;
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
        alert(LoginService.getUserLoggedIn());
        //$scope.loginInformation = angular.copy(login);
        /*$http({
            method: 'GET',
            url: '/'
        }).then(function successCallback(response) {
        // this callback will be called asynchronously
        // when the response is available
        }, function errorCallback(response) {
        // called asynchronously if an error occurs
        // or server returns response with an error status.
        });*/
    };
});