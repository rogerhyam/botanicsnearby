
// namespace object
var rbgeNearby = {};

// two vars vary for dev
var is_live = true;
if(is_live){
    rbgeNearby.root_url = 'https://stories.rbge.org.uk/';
    rbgeNearby.location_ok_accuracy = 200; // this will do to stop the retrieving location
}else{
    rbgeNearby.root_url = 'https://192.168.7.144/';
    rbgeNearby.location_ok_accuracy = 200; // this will do to stop the retrieving location
}


rbgeNearby.location_current = false;
rbgeNearby.location_error = false;
rbgeNearby.location_inaccurate = false;

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
rbgeNearby.track_person_icon_timer = false;
rbgeNearby.track_watcher = false;
rbgeNearby.track_timer = false;

rbgeNearby.beacons = {};
rbgeNearby.beacon_current = false;
rbgeNearby.beacon_found_timestamp = -1;

/*
    Main index page where poi are listed.
*/
$(document).on("pagecreate","#index-page",function(){ 
   
   $('#nearby-refresh-button').on('click', rbgeNearby.refresh);
   
   $("#index-page-map-button").on('click', function(){
       rbgeNearby.map_display_all = true;
   });
   
   // listen to taps on the location message
   $('#nearby-status-message').on('click', rbgeNearby.tagLocation);
   
   // can't pick categories till we load something
   $('#nearby-cats-li').addClass('ui-disabled');
   
});

$(document).on("pageshow","#index-page",function(){
    
    
    if($('.nearby-post-gps-li').length == 0 && $('.nearby-post-beacon-li').length == 0){
        $('#nearby-cats-li').addClass('ui-disabled');
        $('#nearby-intro-block').show();
    }else{
        $('#nearby-cats-li').removeClass('ui-disabled');
        $('#nearby-intro-block').hide();
    }
    
    // if we are showing the list forget the current post
    rbgeNearby.post_current = false;
    rbgeNearby.updateStatusMessage();
    
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

    var pp = $('#nearby-post-page-content');
    pp.empty();
    
    var img = $('<img></img>');
    img.attr('src', post.large_url);
    img.addClass('nearby-post-image');
    pp.append(img);
    
    var h2 = $('<h2></h2>');
    h2.html(post.title);
    pp.append(h2);
    
    // mp3 player if we have mp3
    if(post.mp3){
        
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
    div.append(post.body);
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
    
});

$(document).on("pagehide","#map-page",function(){
    rbgeNearby.stopTracking();
});


/*
 -- tag page
*/

$(document).on( "pagecreate", "#tag-page", function() {
    $('#nearby-tag-reset-btn').on('click', rbgeNearby.resetTagForm);
    $('#nearby-tag-save-btn').on('click', rbgeNearby.submitTagForm);
});

$(document).on("pagebeforeshow","#tag-page",function(){
    $('#email').val(localStorage.getItem("email"));
    $('#memorable-word').val(localStorage.getItem("memorable-word"));
});


rbgeNearby.refresh = function(){

    // set up the display for refresh cycle
    $('#nearby-refresh-button').addClass('ui-disabled');
    $('#nearby-post-list').find('.nearby-post-gps-li').remove();
    $('#nearby-post-list').find('.nearby-post-beacon-li').remove();
    $('#nearby-cats-li').addClass('ui-disabled'); 
    $('#nearby-cats-list').empty();
    $('#nearby-intro-block').hide();
    $('#index-page-map-button').addClass('ui-disabled');
    
    rbgeNearby.startBeaconScan();
    
    // clear the last location
    rbgeNearby.location_current = false;
    
    // double check a watcher isn't already there - or we will lose the handle to it.
    if(rbgeNearby.location_watcher !== false){
        navigator.geolocation.clearWatch(rbgeNearby.location_watcher);
        rbgeNearby.location_watcher = false;
    }
    
    rbgeNearby.updateStatusMessage();
    
    rbgeNearby.location_watcher = navigator.geolocation.watchPosition(

                 // success
                 function(position){

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

                     // if we are less than Ym we can stop
                     if (position.coords.accuracy < rbgeNearby.location_ok_accuracy){
                         rbgeNearby.location_current = position.coords;
                         rbgeNearby.location_inaccurate = false;
                         rbgeNearby.stopGps();
                         rbgeNearby.loadDataGps();
                     }else{
                         rbgeNearby.location_inaccurate = true;
                     }

                 },

                 // outright failure!
                 function(error){
                     console.log(error);
                     rbgeNearby.location_current = false;
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
    
    // we run the location for maximum of 20 secs
    rbgeNearby.location_timer = setTimeout(function(){
                console.log("firing location timeout");
                rbgeNearby.location_timer = false;
                rbgeNearby.stopGps();
                rbgeNearby.loadDataGps();

    }, 20 * 1000);
    
    // while we are calling the location we can update the categories
    rbgeNearby.loadCategories();
    
    // keep track of the refresh - have we moved?
    rbgeNearby.last_refresh = (new Date()).getTime();
    
    rbgeNearby.updateStatusMessage();
    
}

rbgeNearby.stopGps = function(){
    
    // stop the watcher if it is running
    if(rbgeNearby.location_watcher){
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
    
    rbgeNearby.updateStatusMessage();

}

rbgeNearby.loadCategories = function(){
    
    // get the root category first
    $.getJSON( rbgeNearby.root_url + "wp-json/wp/v2/categories?slug=nearby", function( parents ){

        // then call for its children
        if(parents.length > 0){
            $.getJSON( rbgeNearby.root_url + "wp-json/wp/v2/categories?parent=" + parents[0].id, function( cats ) {
                
                
                // write the list items
                var cat_list = $('#nearby-cats-list');
                cat_list.empty();
                
                // add one in for everything at the top
                var li = $('<li></li>');
                li.data('nearby-cat-slug', 'nearby');
                li.data('nearby-cat-name', 'Select a topic');
                li.addClass('nearby-cat-li');
                li.on('click', function(event){
                    rbgeNearby.selectCategory('nearby');
                    rbgeNearby.loadDataGps();
                    event.stopPropagation();
                });
                cat_list.append(li);
                
                var h2 = $('<h2>No specific topic</h2>');
                li.append(h2);
                
                // add in all the child categories
                for (var i=0; i < cats.length; i++) {
                                    
                    var cat = cats[i];
                                        
                    if(cat.slug == 'place') continue;
                    
                    var li = $('<li></li>');
                    li.data('nearby-cat-slug', cat.slug);
                    li.data('nearby-cat-name', cat.name);
                    li.addClass('nearby-cat-li');
                    li.on('click', function(event){
                        rbgeNearby.selectCategory($(this).data('nearby-cat-slug'));
                        rbgeNearby.loadDataGps();
                        if(rbgeNearby.beacon_current){
                            rbgeNearby.loadDataForBeacon(rbgeNearby.beacon_current);
                        }
                    });
                    cat_list.append(li);

                    var h2 = $('<h2>'+ cat.name + '</h2>');
                    li.append(h2);
              
                    var p = $('<p></p>');
                    li.append(p);
                    p.html(cat.description);
                    
                    p = $('<p></p>');
                    li.append(p);
                    p.html(cat.count + ' items in total');

                    cat_list.listview('refresh');
                    $('#nearby-status-footer').show();
                };
                
            });
        }
        
    });
    
    rbgeNearby.selectCategory(rbgeNearby.cat_current);
    
    
}

rbgeNearby.selectCategory = function(slug){
    
    rbgeNearby.cat_current = slug;

    // work through the displayed categories to find the title
    $.each($('.nearby-cat-li'), function(i, val){
        if($(val).data('nearby-cat-slug') == slug){
            $('#span-cat-current').html($(val).data('nearby-cat-name'));
        }
    });
    
    $('#nearby-cats-li').collapsible( "collapse" );
    
}

rbgeNearby.initMapForPost = function(){
    
    var post_pos = new google.maps.LatLng(rbgeNearby.post_current.latitude, rbgeNearby.post_current.longitude);
    var person_pos = new google.maps.LatLng(rbgeNearby.location_current.latitude, rbgeNearby.location_current.longitude);
    
    var options = {
        zoom: 16,
        center: post_pos,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    
    console.log(options);
    
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
    
    var bounds = new google.maps.LatLngBounds();
    
    var person_pos = new google.maps.LatLng(rbgeNearby.location_current.latitude, rbgeNearby.location_current.longitude);
    bounds.extend(person_pos);
    
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
    
    // add markers for all the gps posts we have
    rbgeNearby.clearMapPostMarkers();
    
    if(rbgeNearby.posts_data_gps.posts){
        for (var i=0; i <  rbgeNearby.posts_data_gps.posts.length; i++) {
            var post =  rbgeNearby.posts_data_gps.posts[i];
            var post_pos = new google.maps.LatLng(post.latitude, post.longitude);
            bounds.extend(post_pos);
            rbgeNearby.addMapPostMarker(post);
        }
    }
    
    // FIXME - THIS NEEDS TO DETECT DUPLICATES IN BEACON AND GPS RESULTS
    if(rbgeNearby.posts_data_beacon){
        for (var i=0; i <  rbgeNearby.posts_data_beacon.posts.length; i++) {
            var post =  rbgeNearby.posts_data_beacon.posts[i];
            if(post.latitude && post.longitude){
                var post_pos = new google.maps.LatLng(post.latitude, post.longitude);
                bounds.extend(post_pos);
                rbgeNearby.addMapPostMarker(post);
            }
        }
    }
    
    // person marker position 
    rbgeNearby.setMapPersonMarker(person_pos);
    
    // set the map bounds so we can see it all
    rbgeNearby.map.fitBounds(bounds);
    
    // just to make sure the map renders right
    google.maps.event.trigger(rbgeNearby.map, 'resize');
    
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
        
        console.log(this['nearby_post']);
        
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
    
    $.getJSON( rbgeNearby.root_url + "wp-json/rbge_geo_tag/v1/nearby?lat="+ rbgeNearby.location_current.latitude + "&lon="+ rbgeNearby.location_current.longitude +"&category=" + rbgeNearby.cat_current, function( data ) {
        rbgeNearby.posts_data_gps = data;
        rbgeNearby.google_api_key = data.meta.google_api_key;
        rbgeNearby.updateDisplayGps();
    });
    
    rbgeNearby.updateStatusMessage();
    
}

/* called after data has been loaded */
rbgeNearby.updateDisplayGps = function(){
    
    console.log("update display GPS");
   
    var post_list = $('#nearby-post-list');
    
    // clear out all the list items
    post_list.find('.nearby-post-gps-li').remove();

    for (var i=0; i <  rbgeNearby.posts_data_gps.posts.length; i++) {

        var post =  rbgeNearby.posts_data_gps.posts[i];
        
        if($('*[data-nearby-post-id="'+ post.id +'"]').length > 0) continue;

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

        if(post.distance > 1000){
            var unit = 'km';
            var d = Math.round(post.distance/1000);
        }else{
            var unit = 'metres';
            var d = Math.round(post.distance);
        }
        
        // add in a direction
        var bearing = ''
        if(d > 0){
            
            bearing = rbgeNearby.getBearing(rbgeNearby.location_current.latitude, rbgeNearby.location_current.longitude, post.latitude, post.longitude );
            if (bearing < 45) bearing = 'North'; 
            else if(bearing < 135) bearing = 'East';
            else if(bearing < 225) bearing = 'South';
            else if(bearing < 315) bearing = 'West';
            else bearing = 'North';
            
            // this is mapable so turn the mapping button on
            $('#index-page-map-button').removeClass('ui-disabled');

        }
        
        var accuracy = Math.round(rbgeNearby.location_current.accuracy);
        
        var p = $('<p>'+ d.toLocaleString() + ' ' + unit + ' ' + bearing +' (&#177; '+ accuracy.toLocaleString() + ' metres)</p>');
        a.append(p);

    
    }// end loop
   
    post_list.listview('refresh');
    
    // enable category picking again
    $('#nearby-cats-li').removeClass('ui-disabled');
     $('#nearby-intro-block').hide();
    
    rbgeNearby.updateStatusMessage();
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
     
     rbgeNearby.updateStatusMessage();

}

rbgeNearby.stopBeaconScan = function(){
    console.log('Stopping beacon scan');
    evothings.eddystone.stopScan();
    clearTimeout(rbgeNearby.beacon_timer);
    rbgeNearby.beacon_timer = false;
    rbgeNearby.processBeacons();
    rbgeNearby.updateStatusMessage();
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
        return mapBeaconRSSI(beacon1.rssi) < mapBeaconRSSI(beacon2.rssi);
    });
    
    // try loading the first in the list
    if(beaconList.length > 0){
        // try loading data for the first beacon
        rbgeNearby.loadDataForBeacon(beaconList.shift());
    }else{
        // If we have no beacons we should display no posts from beacons
        post_list.find('.nearby-post-beacon-li').remove();
    }
    
    rbgeNearby.updateStatusMessage();

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
    
    $.getJSON( rbgeNearby.root_url + "wp-json/rbge_geo_tag/v1/beacon?beacon_uri="+ encodeURI(beacon.url) + "&category=" + rbgeNearby.cat_current,
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
    
    rbgeNearby.updateStatusMessage();
    
}

rbgeNearby.updateDisplayBeacon = function(){
    
    console.log("update display BEACON");
   
    var post_list = $('#nearby-post-list');
    
    // clear out all the list items
    post_list.find('.nearby-post-beacon-li').remove();

    for (var i = rbgeNearby.posts_data_beacon.posts.length - 1 ; i >= 0; i--) {
        
        var post =  rbgeNearby.posts_data_beacon.posts[i];

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
    $('#nearby-intro-block').hide();
    
    rbgeNearby.updateStatusMessage();
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
    
    var on = false;

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
    rbgeNearby.map_person_marker.setOptions({icon: rbgeNearby.person_icon_on});
    
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
   
    $('#nearby-audio')[0].play();
    
    // set the started flag
    $('#nearby-audio').data('playing', true);
    
    // set the ui state to playing
    $('#nearby-audio-start-btn').removeClass('ui-icon-audio').addClass('ui-icon-minus');
    $('#nearby-audio-start-btn').html('Stop');
    
}

rbgeNearby.pauseAudio = function(){
    
    $('#nearby-audio')[0].pause();
    
    // set the stop
    $('#nearby-audio').data('playing', false);

    // set the ui state to stopped
    $('#nearby-audio-start-btn').removeClass('ui-icon-minus').addClass('ui-icon-audio');
    $('#nearby-audio-start-btn').html('Start');
    
}

rbgeNearby.stopAudio = function(){
    $('#nearby-audio')[0].pause();
    $('#nearby-audio').data('playing', false);
}

rbgeNearby.skipBackAudio = function(){
    
    $('#nearby-audio-back-btn').blur();
    
    if($('#nearby-audio')[0].currentTime > 20){
        $('#nearby-audio')[0].currentTime = $('#nearby-audio')[0].currentTime - 20;
    }else{
        $('#nearby-audio')[0].currentTime = 0;
    }
    
}

rbgeNearby.restartAudio = function(){
    $('#nearby-audio-restart-btn').blur();
    $('#nearby-audio')[0].currentTime = 0;
}

/*
    ------ T A G G I N G - P L A C E -----------
*/

rbgeNearby.tagLocation = function(){
    
    // we do nothing if there is no location
    if(!rbgeNearby.location_current) return;
    
    // we have a location so lets show them the location page.
    $( ":mobile-pagecontainer" ).pagecontainer( "change", "#tag-page", { transition: "flip" } );
    
    
}

rbgeNearby.resetTagForm = function(){
    
    $('#email').val(localStorage.getItem("email"));
    $('#memorable-word').val(localStorage.getItem("memorable-word"));
    $('#soothed-slider').val(5).slider("refresh");
    $('#anxious-slider').val(5).slider("refresh");
    $('#excited-slider').val(5).slider("refresh");
    $('#comments').val('');
    
}

rbgeNearby.submitTagForm = function(){
    
    // firstly save the persistent values save them reentering 
    localStorage.setItem("email", $('#email').val());
    localStorage.setItem("memorable-word", $('#memorable-word').val());
    
    // get a nice key:val array of the form
    var formArray = $('#tag-location-form').serializeArray()
    var returnArray = {};
    for (var i = 0; i < formArray.length; i++){
        returnArray[formArray[i]['name']] = formArray[i]['value'];
    }
    
    returnArray.latitude = rbgeNearby.location_current.latitude;
    returnArray.longitude = rbgeNearby.location_current.longitude;
    returnArray.accuracy = rbgeNearby.location_current.accuracy;
    returnArray.timestamp = Math.floor(Date.now());

    returnArray.beacon = rbgeNearby.beacon_current.name;
    
    $.post(rbgeNearby.root_url + "wp-json/rbge_geo_tag/v1/tag", returnArray).done(
    
        function(data){alert(data), console.log(data)
            
    });
    
    console.log(returnArray);
    
    $( ":mobile-pagecontainer" ).pagecontainer( "change", "#index-page", { transition: "flip" } );
    
}

rbgeNearby.compassHeading = function( alpha, beta, gamma ) {

  var degtorad = Math.PI / 180; // Degree-to-Radian conversion

  var _x = beta  ? beta  * degtorad : 0; // beta value
  var _y = gamma ? gamma * degtorad : 0; // gamma value
  var _z = alpha ? alpha * degtorad : 0; // alpha value

  var cX = Math.cos( _x );
  var cY = Math.cos( _y );
  var cZ = Math.cos( _z );
  var sX = Math.sin( _x );
  var sY = Math.sin( _y );
  var sZ = Math.sin( _z );

  // Calculate Vx and Vy components
  var Vx = - cZ * sY - sZ * sX * cY;
  var Vy = - sZ * sY + cZ * sX * cY;

  // Calculate compass heading
  var compassHeading = Math.atan( Vx / Vy );

  // Convert compass heading to use whole unit circle
  if( Vy < 0 ) {
    compassHeading += Math.PI;
  } else if( Vx < 0 ) {
    compassHeading += 2 * Math.PI;
  }

  return compassHeading * ( 180 / Math.PI ); // Compass Heading (in degrees)

}

/*
    Called after things happen
    It has to work out a relevant message to display
*/
rbgeNearby.updateStatusMessage = function(){
    
    // if the beacon timer is running we display loading beacon
    if(rbgeNearby.beacon_timer){
        var m = "Scanning for Bluetooth beacons";
        if(rbgeNearby.location_timer) m = m + "<br/>and fetching current location";
        $('#nearby-status-message').html(m);
        return;
    }
    
    // if the gps timer is running we display looking for gps
    if(rbgeNearby.location_timer){
        $('#nearby-status-message').html("Fetching current location");
        return;
    }
    
    // if we have an active beacon then we display its name and location (if there is one)
    if(rbgeNearby.beacon_current){
        var m = rbgeNearby.beacon_current.name;
        if(rbgeNearby.location_current){
            m = m + '<br/>' + rbgeNearby.getPrettyCoords(rbgeNearby.location_current);
        }        
        $('#nearby-status-message').html(m);
        return;
    }
    
    // if we just have a GPS location we display that (with a warning for distance)
    if(rbgeNearby.location_current){
        var m = rbgeNearby.getPrettyCoords(rbgeNearby.location_current);   
        if(rbgeNearby.location_current.accuracy >= 50){
            m = m + '<br/><strong>Warning: Location imprecise</strong>'; 
        }else{
            m = m + "<br/>Tap 'Nearby' to update location"; 
        }
        $('#nearby-status-message').html(m);
        return;
    }
    
    // otherwise we display the default
    $('#nearby-status-message').html("Tap the 'Nearby' to learn more about what is around you.");

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

