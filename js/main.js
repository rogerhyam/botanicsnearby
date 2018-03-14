
// two vars vary for dev
var is_live = true;
if(is_live){
    rbgeNearby.root_url = 'https://stories.rbge.org.uk/';
    rbgeNearby.location_ok_accuracy = 20; // this will do to stop the retrieving location
}else{
    rbgeNearby.root_url = 'https://192.168.7.144/';
    rbgeNearby.location_ok_accuracy = 200; // this will do to stop the retrieving location
}

rbgeNearby.location_current = false;
rbgeNearby.location_error = false;
rbgeNearby.location_inaccurate = false;
rbgeNearby.location_last_update = 0; // timestamp of when it was updated

rbgeNearby.location_watcher = false; // the watcher reporting the location (when running)
rbgeNearby.location_timer = false; // a timer that will stop the location_watcher after a set period

rbgeNearby.post_current = false; // holds the currently selected post.

rbgeNearby.posts_data_gps = false; // data loaded from call with gps points
rbgeNearby.posts_data_beacon = false; // data loaded from call with beacon uri

rbgeNearby.cat_current = 'nearby'; // if all fails we default to the nearby category
rbgeNearby.last_refresh = 0;
rbgeNearby.map = false;
rbgeNearby.map_post_markers = new Array();
rbgeNearby.map_person_marker = false;
rbgeNearby.map_display_all = false; // whether map displays current marker or all available.

rbgeNearby.track_person_icon_timer = false;
rbgeNearby.track_watcher = false;
rbgeNearby.track_timer = false;

rbgeNearby.beacons = {};
rbgeNearby.beacon_current = false;
rbgeNearby.beacon_found_timestamp = -1;

rbgeNearby.last_location_submitted = false;

rbgeNearby.cordova_ready = false;

rbgeNearby.media_player = false;

/*
    Mother of events for cordova to check everything is loaded
*/
document.addEventListener("deviceready", function(){
    
    console.log('device ready');
    
    rbgeNearby.cordova_ready = true;
    
    // first thing we do is check where we are
    rbgeNearby.updateLocation(true);
    
}, false);

/*
    When we come back from a nap
*/
document.addEventListener("resume", function(){
    // setTimeout is for iOS bug
    setTimeout(function() {
        // update the location because the could have moved
        rbgeNearby.updateLocation(true);
    }, 0);
}, false);


/*
    Home page - Categories List
*/
$(document).on("pagecreate","#cats-page",function(){ 
   

   $("#cats-page-map-button").on('click', function(){
       rbgeNearby.map_display_all = true;
   });

   // will be re-enabled when we know we have a location
   $('#cats-page-map-button').addClass('ui-disabled');
   

});

$(document).on("pageshow","#cats-page",function(){
    
    //console.log("show cats page");
    
    rbgeNearby.loadCategories();   
    
    if(typeof google === 'undefined') console.log("google is undefined!");
    
    
    // if we have a person location then we can enable the map button
    if(typeof google != 'undefined' && rbgeNearby.location_current && rbgeNearby.location_current.latitude && rbgeNearby.location_current.longitude){
        $('#cats-page-map-button').removeClass('ui-disabled'); 
    }else{
        $('#cats-page-map-button').addClass('ui-disabled'); 
    }
    
    // we forget the posts we may have loaded with a topic
    rbgeNearby.posts_data_gps = false;
    rbgeNearby.posts_data_beacon = false;
    
    // start looking for a location
    rbgeNearby.updateLocation(false);
    //console.log('page show..');
    
});


/* 
    Points Page List the points in this category
*/

$(document).on("pagecreate","#points-page",function(){ 
   
   $('#nearby-refresh-button').on('click', function(){rbgeNearby.updateLocation(true)});
   $('#nearby-refresh-button').addClass('ui-disabled'); // enable it when needed
   
   $("#index-page-map-button").on('click', function(){
       rbgeNearby.map_display_all = true;
   });
   
   $('#index-page-map-button').addClass('ui-disabled'); // will be re-enabled on list update
   
   // listen to taps on the location message
   // $('#nearby-status-message').on('click', rbgeNearby.tagLocation);
   
});

$(document).on("pageshow","#points-page",function(){

    rbgeNearby.loadDataGps(); // need to load what we have while we fetch location
    rbgeNearby.updateLocation(true); // once location is known it will update display again.
    
    // the status message is visible so we start it updating
    rbgeNearby.updateStatusMessage();

});

$(document).on("pagehide","#points-page",function(){
    
    // stop the status message updating
    if(rbgeNearby.status_message_timer){
        clearTimeout(rbgeNearby.status_message_timer);
        rbgeNearby.status_message_timer = false;
    }
    
});

$(document).on("pagecreate","#about-page",function(){ 
  
   
});

$(document).on("pagecreate","#post-page",function(){ 
    $("#post-page-map-button").on('click', function(){
        rbgeNearby.map_display_all = false; // only display one item on the map
    });
    $("#post-page-back-button").on('click', function(){
        rbgeNearby.map_display_all = true; // if we are heading back to a map possibly
    });
});

/*
    Before we show the post page we need to populate it
*/
$(document).on("pagebeforeshow","#post-page",function(){
    
    var post = rbgeNearby.post_current;
    
    //console.log(post);

    var pp = $('#nearby-post-page-content');
    pp.empty();
    
    var img = $('<img></img>');
    img.attr('src', post.large_url);
    img.addClass('nearby-post-image');
    pp.append(img);
    
    var h2 = $('<h2></h2>');
    h2.html(post.title);
    pp.append(h2);
    
    var proximity = rbgeNearby.getDistanceFromLatLonInKm(
        post.latitude,
        post.longitude,
        rbgeNearby.location_current.latitude,
        rbgeNearby.location_current.longitude
    );

    proximity = Math.round(proximity * 1000);

    // scan tags for "proximity-required-10m"
    var proximity_message = false;
    if(typeof post['tags'] != 'undefined'){
        for (var i=0; i < post['tags'].length; i++) {
            var tag = post['tags'][i];
            var re = /Proximity Required ([0-9]+)m/i;
            var m = tag.name.match(re);
            if(m){
                proximity_message = "<p>Sorry you must be within " + m[1] + "m of '" + post.title + "' to access this content.</p><p>You are currently " + proximity + "m away.</p><p>Use the map to navigate closer.</p>";
                break;
            }        
        }
    }
    
    // mp3 player if we have mp3
    if(post.mp3 && !proximity_message){
        
        var wrapper = $('<div id="nearby-mp3-controls" ></div>');
        pp.append(wrapper);
        
        var fieldset = $('<fieldset data-role="controlgroup" data-type="horizontal"></fieldset>');
        wrapper.append(fieldset);

        var start = $('<a href="#" id="nearby-audio-start-btn" class="ui-btn ui-icon-audio ui-btn-icon-left">Start</a>');
        start.on('click', rbgeNearby.toggleAudio);
        fieldset.append(start);
        
        var back = $('<a href="#" id="nearby-audio-back-btn" class="ui-btn ui-icon-carat-l ui-btn-icon-left">Back 20"</a>');
        back.on('click', rbgeNearby.skipBackAudio);
        fieldset.append(back);

        var restart = $('<a href="#" id="nearby-audio-restart-btn" class="ui-btn ui-icon-back ui-btn-icon-left">Restart</a>');
        restart.on('click', rbgeNearby.restartAudio);
        fieldset.append(restart);
        
        // set the source on the audio object
        $('#nearby-audio').attr('src', post.mp3);
        
    }
    
    var div = $('<div></div>');
    div.addClass('nearby-post-text');
    if(proximity_message){
        div.append(proximity_message);
    }else{
        div.append(post.body);
    }
    
    pp.append(div);
    
    pp.enhanceWithin();
    
    // we also turn the map button on/off depending on if this thing is mappable or not
    if(post.latitude && post.longitude){
        $('#post-page-map-button').removeClass('ui-disabled');
    }else{
        $('#post-page-map-button').addClass('ui-disabled');
    }
    
    
});

$(document).on("pagehide","#post-page",function(){
    rbgeNearby.stopAudio();
});

/*
 * Google Maps documentation: http://code.google.com/apis/maps/documentation/javascript/basics.html
 * Geolocation documentation: http://dev.w3.org/geo/api/spec-source.html
 */
$(document).on( "pagecreate", "#map-page", function() {
    $('#nearby-track-button').on('click', rbgeNearby.toggleTracking);
});

$(document).on("pageshow","#map-page",function(){
    
    // we have two very different approaches depending on if there is a current 
    // post present or not
    if(rbgeNearby.map_display_all) rbgeNearby.initMapForMultiplePosts();
    else rbgeNearby.initMapForPost();
    
    // just to make sure the map renders right
    google.maps.event.trigger(rbgeNearby.map, 'resize');
    
});

$(document).on("pagehide","#map-page",function(){
    rbgeNearby.stopTracking();
});

rbgeNearby.updateLocation = function(refreshDisplay){
    
    console.log('updateLocation');
    
    // are we on cordova?
    if(typeof cordova !== 'undefined'){
        
        // are we fully loaded
        if(!rbgeNearby.cordova_ready){
            //console.log('cordova not loaded yet');
            return;
        }
        
        // we have cordova so kick off a beacon search
        rbgeNearby.updateLocationBeacon(refreshDisplay);
        
    }
    
    // we got this far so we can update the GPS
    rbgeNearby.updateLocationGps(refreshDisplay);
        
}

rbgeNearby.updateLocationGps = function(refreshDisplay){
    
    console.log('- updateLocationGps');

     // only ever create a new one if the old one is set to false
     if(rbgeNearby.location_watcher === false){

             rbgeNearby.location_watcher = navigator.geolocation.watchPosition(

                          // success
                          function(position){
                              console.log('success being called');
                    
                             // only do something if we are given a new position
                             // if not keep watching
                             if(
                                 rbgeNearby.location_current
                                 && rbgeNearby.location_current.longitude == position.coords.longitude
                                 && rbgeNearby.location_current.latitude == position.coords.latitude
                                 && rbgeNearby.location_current.accuracy == position.coords.accuracy
                             ){
                                 return;
                             }

                              // got to here so it is useable.
                              rbgeNearby.location_error = false;
                              rbgeNearby.location_current = position.coords;
                              rbgeNearby.location_last_update = Date.now();
                              if(typeof google != 'undefined') $('#cats-page-map-button').removeClass('ui-disabled');                       

                              // if we are less than Ym we can stop
                              if (position.coords.accuracy < rbgeNearby.location_ok_accuracy){
                                  rbgeNearby.location_inaccurate = false;
                                  rbgeNearby.stopGps();
                                  if(refreshDisplay) rbgeNearby.loadDataGps();
                              }else{
                                  console.log('location inaccurate');
                                  rbgeNearby.location_inaccurate = true;
                              }

                          },

                          // outright failure!
                          function(error){
                              console.log(error);
                              rbgeNearby.location_current = false;
                              $('#cats-page-map-button').addClass('ui-disabled');
                              rbgeNearby.location_error = true;
                              return;
                          },

                          // options
                          {
                            enableHighAccuracy: true, 
                            maximumAge        : 10 * 1000, 
                            timeout           : 10 * 1000
                          }

             );
     
             
            // we run the location for maximum of 10 secs
           
            rbgeNearby.location_timer = setTimeout(function(){
                      console.log("firing location timeout");

                      console.log("killing this one it");
                      console.log(rbgeNearby.location_watcher);
                      navigator.geolocation.clearWatch(rbgeNearby.location_watcher);
                      rbgeNearby.location_watcher = false;

                      rbgeNearby.stopGps();
                      if(refreshDisplay) rbgeNearby.loadDataGps();

            }, 10 * 1000);
       
             
     } // end test for watcher
     
    
}

rbgeNearby.updateLocationBeacon = function(refreshDisplay){
    rbgeNearby.startBeaconScan();
}


rbgeNearby.stopGps = function(){
            
    // stop the watcher if it is running
    if(rbgeNearby.location_watcher){
        //console.log(rbgeNearby.location_watcher)
        navigator.geolocation.clearWatch(rbgeNearby.location_watcher);
        rbgeNearby.location_watcher = false;
    }
    
    // we may have a timer running to time out the gps
    if(rbgeNearby.location_timer){
        clearTimeout(rbgeNearby.location_timer);
        rbgeNearby.location_timer = false;
    }
    
    // enable the button again
    $('#nearby-refresh-button').removeClass('ui-disabled');

}

rbgeNearby.loadCategories = function(){
    
    // Firstly we warn if there isn't a data connection
    if(rbgeNearby.cordova_ready && navigator.connection.type === Connection.NONE){
        alert('Warning: There is no data connection.');
        return;
    }
    
    // get the root category first
    $.getJSON( rbgeNearby.root_url + "wp-json/wp/v2/categories?slug=nearby", function( parents ){

        // then call for its children
        if(parents.length > 0){
            $.getJSON( rbgeNearby.root_url + "wp-json/wp/v2/categories?parent=" + parents[0].id, function( cats ) {
                
                
                // write the list items
                var cat_list = $('#nearby-cats-list');
                cat_list.empty();
                
                // add in all the child categories
                for (var i=0; i < cats.length; i++) {
                                    
                    var cat = cats[i];
                                        
                    if(cat.slug == 'place') continue;
                    
                    var li = $('<li></li>');
                    li.data('nearby-cat-slug', cat.slug);
                    li.data('nearby-cat-name', cat.name);
                    li.addClass('nearby-cat-li');
                    
                    var a = $('<a></a>');
                    li.append(a);
                    a.href
                    a.attr('href', '#points-page');
                    a.attr('data-transition', "slide");
                    a.on('click', function(){
                        //console.log($(this).parent().data('nearby-cat-slug'));
                        rbgeNearby.cat_current = $(this).parent().data('nearby-cat-slug');
                        $("#points-page h1").html($(this).parent().data('nearby-cat-name'));                        
                    });
            
                    cat_list.append(li);
                    
                    var img = $('<img></img>');
                    img.attr('src', cat.meta.cat_image_url);
                    a.append(img);

                    var h2 = $('<h2>'+ cat.name + '</h2>');
                    a.append(h2);
              
                    var p = $('<p></p>');
                    a.append(p);
                    p.html(cat.description);
                    
                    var span = $('<span class="ui-li-count"></span>');
                    a.append(span);
                    span.html(cat.count)
                    
                    cat_list.listview('refresh');
                    $('#nearby-status-footer').show();
                };
                
            });
        }
        
    });
    
}

rbgeNearby.initMapForPost = function(){
    
    //console.log(rbgeNearby.location_current);
    
    // we should never get here without a current location but if we do then the app may well hang
    // so this is a safetynet 
    if(!rbgeNearby.location_current || !rbgeNearby.location_current.latitude || !rbgeNearby.location_current.longitude){
           alert('Location Error');
           return;
    }
    
    var post_pos = new google.maps.LatLng(rbgeNearby.post_current.latitude, rbgeNearby.post_current.longitude);
    var person_pos = new google.maps.LatLng(rbgeNearby.location_current.latitude, rbgeNearby.location_current.longitude);
    
    var options = {
        zoom: 16,
        center: post_pos,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    
    //console.log(options);
    
    // create the map if we need one
    if(!rbgeNearby.map){
        rbgeNearby.map = new google.maps.Map(document.getElementById("map-canvas"), options);
        console.log('new map');
    }else{
        rbgeNearby.map.setOptions(options);
        console.log('map exists');   
    }
    
    // post marker position and title
    rbgeNearby.clearMapPostMarkers();
    rbgeNearby.addMapPostMarker(rbgeNearby.post_current);
    
    // person marker position and title
    rbgeNearby.setMapPersonMarker(person_pos);
    
    // are they both on the map at the default resolution?
    var bounds = new google.maps.LatLngBounds();
    bounds.extend(rbgeNearby.map_post_markers[0].getPosition());
    bounds.extend(rbgeNearby.map_person_marker.getPosition());
    
    /*
        in order to set bounds so that the post is in the centre but
        the person location is also visible we need to calculate a "mirror" point
        on the other side of the post point
    */
    
    var post_lat = parseFloat(rbgeNearby.post_current.latitude);
    var person_lat = parseFloat(rbgeNearby.location_current.latitude);
    if(post_lat > person_lat){
        var mlat = post_lat + Math.abs(post_lat - person_lat);
    }else{
        var mlat = post_lat - Math.abs(post_lat - person_lat);
    }

    var post_lon = parseFloat(rbgeNearby.post_current.longitude);
    var person_lon = parseFloat(rbgeNearby.location_current.longitude);
    if(post_lon > person_lon){
        var mlon = post_lon + Math.abs(post_lon - person_lon);
    }else{
        var mlon = post_lon - Math.abs(post_lon - person_lon);
    }

    bounds.extend(new google.maps.LatLng(mlat, mlon));
    
    rbgeNearby.map.fitBounds(bounds);
    
    // just to make sure the map renders right
    google.maps.event.trigger(rbgeNearby.map, 'resize');
    
    // start tracking if we are not
    rbgeNearby.toggleTracking();
}

rbgeNearby.initMapForMultiplePosts = function(){
    
    //console.log(rbgeNearby.location_current);
    
    // we should never get here without a current location but if we do then the app may well hang
    // so this is a safetynet 
    if(!rbgeNearby.location_current || !rbgeNearby.location_current.latitude || !rbgeNearby.location_current.longitude){
           alert('Location Error');
           return;
    }
    
    var bounds = new google.maps.LatLngBounds();
    
    var person_pos = new google.maps.LatLng(rbgeNearby.location_current.latitude, rbgeNearby.location_current.longitude);
    bounds.extend(person_pos);
    
    //console.log(person_pos);
    
    // initial center is person - we change this later
    var options = {
        zoom: 16,
        center: person_pos,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    
    // create the map if we need one
    if(!rbgeNearby.map){
        rbgeNearby.map = new google.maps.Map(document.getElementById("map-canvas"), options);
    }else{
        rbgeNearby.map.setOptions(options);
    }
    
    //console.log(rbgeNearby.map);
    
    // add markers for all the gps posts we have
    rbgeNearby.clearMapPostMarkers();
    
    if(rbgeNearby.posts_data_gps && rbgeNearby.posts_data_gps.posts){
        for (var i=0; i <  rbgeNearby.posts_data_gps.posts.length; i++) {
            var post =  rbgeNearby.posts_data_gps.posts[i];
            if(isNaN(post.latitude))  continue;
            if(isNaN(post.longitude)) continue;
            var post_pos = new google.maps.LatLng(post.latitude, post.longitude);
            bounds.extend(post_pos);
            rbgeNearby.addMapPostMarker(post);
        }
    }
    
    // Does this NEED TO DETECT DUPLICATES IN BEACON AND GPS RESULTS?
    // or not bother because the markers will obscure one another...
    if(rbgeNearby.posts_data_beacon && rbgeNearby.posts_data_gps.posts){
        for (var i=0; i <  rbgeNearby.posts_data_beacon.posts.length; i++) {
            var post =  rbgeNearby.posts_data_beacon.posts[i];
            if(post.latitude && post.longitude){
                var post_pos = new google.maps.LatLng(post.latitude, post.longitude);
                if(isNaN(post.latitude))  continue;
                if(isNaN(post.longitude)) continue;
                bounds.extend(post_pos);
                rbgeNearby.addMapPostMarker(post);
            }
        }
    }
    
    // person marker position 
    rbgeNearby.setMapPersonMarker(person_pos);
    
    // just to make sure the map renders right
    google.maps.event.trigger(rbgeNearby.map, 'resize');
       
    // if we have added no markers (except the person) then the bounds 
    // will be tiny so leave the zoom level as default and don't zoom to the bounds
    if(rbgeNearby.map_post_markers && rbgeNearby.map_post_markers.length > 0){
        rbgeNearby.map.fitBounds(bounds);
        rbgeNearby.map.panToBounds(bounds);
    }
    
    // start tracking if we are not
    rbgeNearby.toggleTracking();
    
}

rbgeNearby.setMapPersonMarker = function(position){
    
    if(!rbgeNearby.map_person_marker){
        rbgeNearby.map_person_marker =new google.maps.Marker({
            map: rbgeNearby.map,
            position: position,
            icon: rbgeNearby.person_icon_on
        });
        
    }else{
        rbgeNearby.map_person_marker.setOptions({
            position: position
        });
    }
    
}

rbgeNearby.addMapPostMarker = function(post){
    
    var post_pos = new google.maps.LatLng(post.latitude, post.longitude);
    
    var marker = new google.maps.Marker({
        position: post_pos,
        map: rbgeNearby.map,
        title: post.title,
        nearby_post: post
    });
    
    marker.addListener('click', function() {
        
        //console.log(this['nearby_post']);
        
        // set it as the current post
        rbgeNearby.post_current = this['nearby_post'];
        
        
        // change to the post view page (always backwards?) forwards if it is multiple markers
        $( ":mobile-pagecontainer" ).pagecontainer( "change", "#post-page", { transition: "slide" } );
        
        
        
    });
    
    rbgeNearby.map_post_markers.push(marker);
    
}

rbgeNearby.clearMapPostMarkers = function(){
    
    if(rbgeNearby.map_post_markers.length > 0){
        for (var i=0; i < rbgeNearby.map_post_markers.length; i++) {
            rbgeNearby.map_post_markers[i].setMap(null);
        };
    }
    
    rbgeNearby.map_post_markers = new Array();
    
}


/*
    once we have a location we are happy
    with we call this to load the data
*/
rbgeNearby.loadDataGps = function(){
    
    console.log("load data GPS");
    
    // What if we don't have a location yet? What do we display.
    // Lets arbitrarily default to Inverleith House.
    var url;
    if(typeof rbgeNearby.location_current.latitude == 'undefined' ){
        url = rbgeNearby.root_url + "wp-json/rbge_geo_tag/v1/nearby"
            + "?category=" + rbgeNearby.cat_current 
            + "&lat=" + 55.9650178
            + "&lon=" + -3.210175 
            + "&key=" + rbgeNearby.rbge_api_key;
    }else{
        url = rbgeNearby.root_url + "wp-json/rbge_geo_tag/v1/nearby"
            + "?category=" + rbgeNearby.cat_current 
            + "&lat=" + rbgeNearby.location_current.latitude
            + "&lon=" + rbgeNearby.location_current.longitude 
            + "&key=" + rbgeNearby.rbge_api_key;
    }

    $.getJSON(url, 
        function( data ) {
            rbgeNearby.posts_data_gps = data;
            rbgeNearby.updateDisplayGps();
        }
    );
    
}

/* called after data has been loaded */
rbgeNearby.updateDisplayGps = function(){
    
    console.log("update display GPS");
   
    var post_list = $('#nearby-post-list');
    
    // clear out all the list items
    post_list.find('.nearby-post-gps-li').remove();

    //console.log( rbgeNearby.posts_data_gps.posts);
    
    for (var i=0; i <  rbgeNearby.posts_data_gps.posts.length; i++) {

        var post =  rbgeNearby.posts_data_gps.posts[i];
        
        // don't add it if it is already there via beacon
        if($('*[data-nearby-post-id="'+ post.id +'"]').length > 0){
            continue;
        } 

        var li = $('<li></li>');
        li.data('nearby-post-index', i);
        li.attr('data-nearby-post-id', post.id);
        li.addClass('nearby-post-gps-li');
        post_list.append(li);
        
        var a = $('<a></a>');
        a.attr('href', '#post-page');
        a.attr('data-transition', "slide");
        a.data('nearby-post-index', i);
        a.on('click', function(){
            rbgeNearby.post_current =  rbgeNearby.posts_data_gps.posts[$(this).data('nearby-post-index')];
        });
        li.append(a);

        var img = $('<img></img>');
        img.attr('src', post.thumbnail_url);
        a.append(img);

        var h2 = $('<h2>'+ post.title   +'</h2>');
        a.append(h2);
        
        a.append(rbgeNearby.getDistanceP(post));
    
    }// end loop
   
    post_list.listview('refresh');
    
    // enable category picking again
    $('#nearby-cats-li').removeClass('ui-disabled');
    
}

rbgeNearby.getDistanceP = function(post){
    
    var p = $('<p></p>');
    p.addClass('nearby-post-distance')
    
    var proximity = rbgeNearby.getDistanceFromLatLonInKm(
        post.latitude,
        post.longitude,
        rbgeNearby.location_current.latitude,
        rbgeNearby.location_current.longitude
    );

    if(Math.round(proximity) > 1){
        var unit = 'km';
        var d = Math.round(proximity);
    }else{
        var unit = 'metres';
        var d = Math.round(proximity* 1000);
    }
    
    // add in a direction
    if(d > 0){
        
        // this is mapable so turn the mapping button on
        $('#index-page-map-button').removeClass('ui-disabled');
        
        var accuracy = Math.round(rbgeNearby.location_current.accuracy);

        p.html( d.toLocaleString() + ' ' + unit +' (&#177; '+ accuracy.toLocaleString() + ' metres) away' );

    }else{
       p.html('-');
    }
    
    return p;
}

/* 
 * - - - - - - -  B E A C O N S - - - - - - - - 
 */

rbgeNearby.startBeaconScan = function(){
     
     // do nothing if no plugin detected
     if(!window.evothings){
         console.log('No evothings plugin - not scanning for beacons');
         return;
     } 
     
     console.log('Scanning for beacons');
     rbgeNearby.beacons = {};
     rbgeNearby.beacon_current = false;
     rbgeNearby.beacon_found_timestamp = -1;
     evothings.eddystone.startScan(rbgeNearby.beaconFound, rbgeNearby.beaconScanError);
     
     // we give up scanning for beacons if we have been going for 30 seconds
     rbgeNearby.beacon_timer = setTimeout(function(){
         rbgeNearby.stopBeaconScan();
     }, 30000);

}

rbgeNearby.stopBeaconScan = function(){
    console.log('Stopping beacon scan');
    evothings.eddystone.stopScan();
    clearTimeout(rbgeNearby.beacon_timer);
    rbgeNearby.beacon_timer = false;
    rbgeNearby.processBeacons();
}

rbgeNearby.processBeacons = function(){
    
    console.log('Processing beacons');
    
    // order the beacons by signal strength
    var beaconList = [];
    for (var key in rbgeNearby.beacons){
        beaconList.push(rbgeNearby.beacons[key]);
    }
    beaconList.sort(function(beacon1, beacon2)
    {
        return rbgeNearby.mapBeaconRSSI(beacon1.rssi) < rbgeNearby.mapBeaconRSSI(beacon2.rssi);
    });
    
    // try loading the first in the list
    if(beaconList.length > 0){
        // try loading data for the first beacon
        rbgeNearby.loadDataForBeacon(beaconList.shift());
    }else{
        // If we have no beacons we should display no posts from beacons
        $('#nearby-post-list').find('.nearby-post-beacon-li').remove();
        $('#nearby-post-list').listview('refresh');
    }
    
}

rbgeNearby.mapBeaconRSSI = function(rssi)
{
    if (rssi >= 0) return 1; // Unknown RSSI maps to 1.
    if (rssi < -100) return 100; // Max RSSI
    return 100 + rssi;
}

rbgeNearby.beaconFound = function(beacon){
    console.log('Found beacon: ' + beacon.url);
    beacon.timeStamp = Date.now();
	rbgeNearby.beacons[beacon.address] = beacon;
	
	// if it has been 5 seconds since we starting finding beacons then stop
	// and total them up.
	if(rbgeNearby.beacon_found_timestamp < 0){
	    rbgeNearby.beacon_found_timestamp = beacon.timeStamp;
	}else if(beacon.timeStamp - rbgeNearby.beacon_found_timestamp > 5000){
	    rbgeNearby.stopBeaconScan();
	}
}

rbgeNearby.beaconScanError = function(error){
    console.log('Eddystone scan error: ' + error);
}

rbgeNearby.loadDataForBeacon = function(beacon){
    
    console.log('Loading data for beacon');
    
    console.log(beacon.url);
    
    $.getJSON( rbgeNearby.root_url + "wp-json/rbge_geo_tag/v1/beacon"
        + "?beacon_uri=" + encodeURI(beacon.url) 
        + "&category=" + rbgeNearby.cat_current
        + "&key=" + rbgeNearby.rbge_api_key,
        function( data ) {
        
            // if the data was successfully pulled then we can load it
            // if data was failed then we remove this beacon from our stash and call processBeacons again to process the next - if there is one.
            if(data.posts && data.posts.length > 0){
                
                // OK we have a beacon - lets do it!
                console.log(beacon.address);
                
                rbgeNearby.posts_data_beacon = data;
                rbgeNearby.beacon_current = beacon;
                rbgeNearby.beacon_current.name = data.meta.beacon_name;
                
                rbgeNearby.updateDisplayBeacon();
                                
                // if we have a centroid for the beacon set that as the location
                if(data.meta.centroid){
                    
                    // if the gps is still running stop it.
                    console.log('got beacon centroid');
                    rbgeNearby.stopGps();
                    
                    rbgeNearby.location_current = data.meta.centroid;
                    rbgeNearby.location_error = false;
                    rbgeNearby.location_inaccurate = false;
                    
                    // load data for this lat/lon location
                    rbgeNearby.loadDataGps();
                }
              
            }else{
                console.log('Failed to load beacon data');
                console.log(JSON.stringify(data));
                delete rbgeNearby.beacons[beacon.address];
                rbgeNearby.processBeacons();
            }
            
        }
    );
    
}

rbgeNearby.updateDisplayBeacon = function(){
    
    console.log("update display BEACON");
   
    var post_list = $('#nearby-post-list');
    
    // clear out all the list items
    post_list.find('.nearby-post-beacon-li').remove();

    for (var i = rbgeNearby.posts_data_beacon.posts.length - 1 ; i >= 0; i--) {
        
        var post =  rbgeNearby.posts_data_beacon.posts[i];
        
        // don't add it twice.
        if($('*[data-nearby-post-id="'+ post.id +'"]').length > 0) continue;

        var li = $('<li></li>');
        li.data('nearby-post-index', i);
        li.addClass('nearby-post-beacon-li');
        li.attr('data-nearby-post-id', post.id);
        
        // insert it into the list at the right point!
        // 0 is the category drop down so just putting it after 
        // current i should do it ...
        $("#nearby-post-list li:eq(0)").after(li);
        
        var a = $('<a></a>');
        a.attr('href', '#post-page');
        a.attr('data-transition', "slide");
        a.data('nearby-post-index', i);
        a.on('click', function(){
            rbgeNearby.post_current =  rbgeNearby.posts_data_beacon.posts[$(this).data('nearby-post-index')];
        });
        li.append(a);

        var img = $('<img></img>');
        img.attr('src', post.thumbnail_url);
        a.append(img);

        console.log(post.id + ' ' + post.title);

        var h2 = $('<h2>'+ post.title   +'</h2>');
        a.append(h2);        
        var p = $('<p>'+ rbgeNearby.beacon_current.name + '</p>');
        a.append(p);
    
    }// end loop
   
    post_list.listview('refresh');
    
    // enable category picking again
    $('#nearby-cats-li').removeClass('ui-disabled');
    
}

/*
 * - - - - - - T R A C K I N G - - - - - - - - - 
*/
rbgeNearby.toggleTracking = function(){
    
    if(!rbgeNearby.track_timer){
        rbgeNearby.startTracking();
    }else{
        rbgeNearby.stopTracking();
    }

}

rbgeNearby.startTracking = function(){
    
    var run_for = 20;
    
    // start a timer - we only do this for x seconds
    rbgeNearby.track_timer = setTimeout(rbgeNearby.stopTracking, run_for * 1000);
    
    // start the location tracker
    rbgeNearby.track_watcher = navigator.geolocation.watchPosition(

                 // success
                 function(position){
                     if(position.coords.accuracy < rbgeNearby.location_ok_accuracy){
                         var pos = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
                         rbgeNearby.map_person_marker.setPosition(pos);
                         
                         // we also now update our main location - why waste some gps data.
                         // this also means we can do location sensitive data
                         rbgeNearby.location_error = false;
                         rbgeNearby.location_current = position.coords;
                         rbgeNearby.location_last_update = Date.now();
                         
                     }
                 },
                 // outright failure!
                 function(error){
                     console.log(error);
                     return;
                 },
                 // options
                 {
                   enableHighAccuracy: true, 
                   maximumAge        : 10 * 1000, 
                   timeout           : 10 * 1000
                 }

    );
    
    // blink the icon
    var on = true;
    var rate = 500;
    rbgeNearby.track_person_icon_timer = setInterval(function() {
       if(on) {
           rbgeNearby.map_person_marker.setOptions({
               icon: rbgeNearby.person_icon_on
           });
       } else {
           rbgeNearby.map_person_marker.setOptions({
               icon: rbgeNearby.person_icon_off
           });
       }
      on = !on;
      
    }, rate);

    // disable button
    $("#nearby-track-button").text("Tracking");
}

rbgeNearby.stopTracking = function(){
    
    // clear the timer
    clearTimeout(rbgeNearby.track_timer);
    rbgeNearby.track_timer = false;
    
    // cancel the icon blink
    clearTimeout(rbgeNearby.track_person_icon_timer);
    rbgeNearby.track_person_icon_timer = false;
    if(rbgeNearby.map_person_marker) rbgeNearby.map_person_marker.setOptions({icon: rbgeNearby.person_icon_on});
    
    // stop tracking
    navigator.geolocation.clearWatch(rbgeNearby.track_watcher);
    
    // enable button
    $("#nearby-track-button").text("Track");
}

/*
    cut'n'paste from stackoverflow!
    https://stackoverflow.com/questions/11415106/issue-with-calcuating-compass-bearing-between-two-gps-coordinates
*/
rbgeNearby.getBearing = function (lat1,lng1,lat2,lng2) {
        var dLon = (lng2-lng1);
        var y = Math.sin(dLon) * Math.cos(lat2);
        var x = Math.cos(lat1)*Math.sin(lat2) - Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
        var brng = rbgeNearby.toDeg(Math.atan2(y, x));
        return 360 - ((brng + 360) % 360);
}

rbgeNearby.toDeg = function(rad) {
        return rad * 180 / Math.PI;
}

rbgeNearby.toRad = function(deg) {
         return deg * Math.PI / 180;
}


/*
 *  - - - - - A U D I O - - - - - - - 
*/


rbgeNearby.toggleAudio = function(){
    
    $('#nearby-audio-start-btn').blur();
    
    if($('#nearby-audio').data('playing')){
        rbgeNearby.pauseAudio();
    }else{
        rbgeNearby.startAudio();
    }
}


rbgeNearby.startAudio = function(){

    // set the started flag
    $('#nearby-audio').data('playing', true);

    // set the ui state to playing
    $('#nearby-audio-start-btn').removeClass('ui-icon-audio').addClass('ui-icon-minus');
    $('#nearby-audio-start-btn').html('Stop');

    if(rbgeNearby.cordova_ready){
       rbgeNearby.startAudioApp();
    }else{
       rbgeNearby.startAudioWeb();
    }
    
}

rbgeNearby.startAudioWeb = function(){
    $('#nearby-audio')[0].play();
}

rbgeNearby.startAudioApp = function(){
    
    // never start a new player without destroying the old one
    if(rbgeNearby.mediaPlayer !== false){
        rbgeNearby.stopAudioApp();
    }
    
    // create a media player
    rbgeNearby.mediaPlayer = new Media(
        $('#nearby-audio').attr('src'), 
        rbgeNearby.audioSuccess,
        rbgeNearby.audioError,
        rbgeNearby.audioStatus
    );
    
    rbgeNearby.mediaPlayer.play({ playAudioWhenScreenIsLocked : true });
    myMedia.setVolume('1.0');
    
}

rbgeNearby.audioSuccess = function(){
    console.log('audio success')
}

rbgeNearby.audioError = function(err){
    console.log(err);
}

rbgeNearby.audioStatus = function(status){
    
    // we watch for the status to reach 4 - meaning it has stopped at the end of the stream
    // then we kill the player and reset the UI.
    console.log(status);
    if(status == 4){
        rbgeNearby.stopAudio();
    }
    
}

rbgeNearby.pauseAudio = function(){

    // set the stop
    $('#nearby-audio').data('playing', false);

    // set the ui state to stopped
    $('#nearby-audio-start-btn').removeClass('ui-icon-minus').addClass('ui-icon-audio');
    $('#nearby-audio-start-btn').html('Start');
        
    if(rbgeNearby.cordova_ready){
        rbgeNearby.pauseAudioApp();
    }else{
        rbgeNearby.pauseAudioWeb();
    }
    
}

rbgeNearby.pauseAudioWeb = function(){
    $('#nearby-audio')[0].pause();
}

rbgeNearby.pauseAudioApp = function(){
    if(rbgeNearby.mediaPlayer){
        rbgeNearby.mediaPlayer.pause();
    }
}

rbgeNearby.stopAudio = function(){
    
    // pause it first to update the UI
    rbgeNearby.pauseAudio();

    // actually stop the player
    if(rbgeNearby.cordova_ready){
        rbgeNearby.stopAudioApp();
    }else{
        rbgeNearby.stopAudioWeb();
    }
    
    $('#nearby-audio').data('playing', false);
}

rbgeNearby.stopAudioWeb = function(){
    $('#nearby-audio')[0].pause();
}

rbgeNearby.stopAudioApp = function(){
    if(rbgeNearby.mediaPlayer){
        rbgeNearby.mediaPlayer.stop();
        rbgeNearby.mediaPlayer.release();
        rbgeNearby.mediaPlayer = false;
    }
}

rbgeNearby.skipBackAudio = function(){
    
    $('#nearby-audio-back-btn').blur();
    
    if(rbgeNearby.cordova_ready){
        rbgeNearby.skipBackAudioApp();
    }else{
        rbgeNearby.skipBackAudioWeb();
    }
    
}

rbgeNearby.skipBackAudioWeb = function(){
    if($('#nearby-audio')[0].currentTime > 20){
        $('#nearby-audio')[0].currentTime = $('#nearby-audio')[0].currentTime - 20;
    }else{
        $('#nearby-audio')[0].currentTime = 0;
    }
}

rbgeNearby.skipBackAudioApp = function(){
    if(rbgeNearby.mediaPlayer){
        rbgeNearby.mediaPlayer.getCurrentPosition(function(current_sec){
            if(current_sec > 20){
                rbgeNearby.mediaPlayer.seekTo((current_sec - 20) * 1000);
            }else{
                rbgeNearby.mediaPlayer.seekTo(1); // one 
            }
        });
    }
}

rbgeNearby.restartAudio = function(){
    
    $('#nearby-audio-restart-btn').blur();
    
    if(rbgeNearby.cordova_ready){
        rbgeNearby.restartAudioApp();
    }else{
        rbgeNearby.restartAudioWeb();
    }
    
}


rbgeNearby.restartAudioWeb = function(){
    $('#nearby-audio')[0].currentTime = 0;
}

rbgeNearby.restartAudioApp = function(){
    if(rbgeNearby.mediaPlayer){
        rbgeNearby.mediaPlayer.seekTo(1);
    }
}

/*
    Called after things happen
    It has to work out a relevant message to display
*/
rbgeNearby.updateStatusMessage = function(){
    
   // console.log('updateStatusMessage');
    
    // call this again in a 0.5 seconds
    rbgeNearby.status_message_timer = setTimeout(function(){
        rbgeNearby.updateStatusMessage();
    }, 500);

    // Firstly we warn if there isn't a data connection
    if(rbgeNearby.cordova_ready && navigator.connection.type === Connection.NONE){
        $('#nearby-status-message').html("No data connection!");
        $('#nearby-refresh-button').addClass('ui-disabled');
        $('#nearby-status-message').css('color', 'orange');
        return;
    }

    // if the beacon timer is running we display loading beacon
    if(rbgeNearby.beacon_timer){
        var m = "Scanning BlueTooth";
        if(rbgeNearby.location_timer) m = m + " &amp; GPS";
        $('#nearby-status-message').html(m);
        $('#nearby-status-message').css('color', 'white');
        $('#nearby-refresh-button').addClass('ui-disabled');
        return;
    }
    
    // if the gps timer is running we display looking for gps
    if(rbgeNearby.location_timer){
        $('#nearby-status-message').html("Scanning GPS");
        $('#nearby-status-message').css('color', 'white');
        $('#nearby-refresh-button').addClass('ui-disabled');
        return;
    }
    
    
    // if neither are running we display the time last update time
    if(rbgeNearby.location_current){
    
        //console.log(rbgeNearby.location_current);
        
        var millis = Date.now() - rbgeNearby.location_last_update;
        var mins = Math.floor( (millis/1000)/60  );
        
        if(mins == 0){
            $('#nearby-status-message').html("Location up to date");
            $('#nearby-status-message').css('color', 'white');
            $('#nearby-refresh-button').addClass('ui-disabled');
        }
        
        if(mins == 1){
            $('#nearby-status-message').html('Location updated 1 minute ago');
            $('#nearby-status-message').css('color', 'white');
            $('#nearby-refresh-button').removeClass('ui-disabled');
        }
        
        if(mins > 1){
            $('#nearby-status-message').html('Location updated ' + mins + ' minutes ago');
            $('#nearby-refresh-button').removeClass('ui-disabled');
        }
        
        if(mins > 2){
            $('#nearby-status-message').css('color', 'orange');
        }
        
    }else{
        $('#nearby-status-message').html("No location set.");
        $('#nearby-status-message').css('color', 'orange');
        $('#nearby-refresh-button').removeClass('ui-disabled');
    }
    
}

rbgeNearby.getPrettyCoords = function(location){
    
    var m = 'Lat: '
        + parseFloat(location.latitude).toFixed(5)
        + '&deg; Lon: '
        + parseFloat(location.longitude).toFixed(5)
        + '&deg; &#177; '
        + Math.round(location.accuracy)
        + 'm';
        
    return m;
    
}

rbgeNearby.getDistanceFromLatLonInKm = function(lat1, lon1, lat2, lon2){
    var R = 6371; // Radius of the earth in km
    var dLat = rbgeNearby.deg2rad(lat2-lat1);  // deg2rad below
    var dLon = rbgeNearby.deg2rad(lon2-lon1); 
    var a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(rbgeNearby.deg2rad(lat1)) * Math.cos(rbgeNearby.deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c; // Distance in km
    return d;
}

rbgeNearby.deg2rad = function(deg) {
  return deg * (Math.PI/180)
}


