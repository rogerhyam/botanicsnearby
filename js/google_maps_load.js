(function (global) {
    "use strict";
 
    function onDeviceReady () {
        document.addEventListener("online", onOnline, false);
        document.addEventListener("resume", onResume, false);
        loadMapsApi();
    }
 
    function onOnline () {
        loadMapsApi();
    }
 
    function onResume () {
        loadMapsApi();
    }
 
    function loadMapsApi () {
        
        if (navigator.connection.type === Connection.NONE || (global.google !== undefined && global.google.maps)) {
                return;
        }
        
        $.getScript('https://maps.googleapis.com/maps/api/js?key=AIzaSyDFhrG5sFcydNTBtXJES8zkKtGaimp7k5c&sensor=true&callback=onMapsApiLoaded');
        
    }
    
    global.onMapsApiLoaded = function () {
        
        console.log("Google Maps Loaded");
        
        // as soon as we have a map we can 
        // create some icons to use
        
        rbgeNearby.person_icon_on = {  
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#0000ff',
                fillOpacity: 0.8,
                strokeColor: '#0000ff',
                strokeWeight: 3,
                strokeOpacity: 0.8,
                scale: 8
         }
        rbgeNearby.person_icon_off = {  
                 path: google.maps.SymbolPath.CIRCLE,
                 fillColor: '#0000ff',
                 fillOpacity: 0.1,
                 strokeColor: '#0000ff',
                 strokeWeight: 3,
                 strokeOpacity: 0.8,
                 scale: 8
        }
        
    };
 
    document.addEventListener("deviceready", onDeviceReady, false);
    
    // if no cordova just load it
    if(typeof global.cordova == 'undefined'){
        $.getScript('https://maps.googleapis.com/maps/api/js?key=AIzaSyDFhrG5sFcydNTBtXJES8zkKtGaimp7k5c&sensor=true&callback=onMapsApiLoaded');
    }
    
})(window);