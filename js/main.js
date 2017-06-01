
// namespace object
var rbgeNearby = {};
rbgeNearby.location_current = false;
rbgeNearby.location_error = false;
rbgeNearby.location_inaccurate = false;
rbgeNearby.location_ok_accuracy = 200; // this will do to stop the retrieving location
rbgeNearby.location_watcher = false; // the watcher reporting the location (when running)
rbgeNearby.location_timer = false; // a timer that will stop the location_watcher after a set period
rbgeNearby.post_data = false; // holds the last lot of data downloaded
rbgeNearby.post_current = false; // holds the currently selected post.
rbgeNearby.cat_current = 'nearby'; // if all fails we default to the nearby category
rbgeNearby.last_refresh = 0;
rbgeNearby.map = false;
rbgeNearby.map_post_marker = false;
rbgeNearby.map_person_marker = false;
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


/*
    Main index page where poi are listed.
*/
$(document).on("pagecreate","#index-page",function(){ 
   $('#nearby-refresh-button').on('click', rbgeNearby.refresh);
});

$(document).on("pageshow","#index-page",function(){
    
    // if we have no items in the list try and get some
    if($('.nearby-post-li').length == 0 || ((new Date()).getTime() - 600000) > rbgeNearby.last_refresh){
        rbgeNearby.refresh();
    }
    
});



$(document).on("pagecreate","#about-page",function(){ 
  
   
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
        
        var back = $('<a href="#" id="nearby-audio-back-btn" class="ui-btn ui-icon-carat-l ui-btn-icon-left">Back 20\'</a>');
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
    if(!rbgeNearby.map_post_marker){
        rbgeNearby.map_post_marker = new google.maps.Marker({
            position: post_pos,
            map: rbgeNearby.map,
            title: rbgeNearby.post_current.title
        });
    }else{
        rbgeNearby.map_post_marker.setOptions({
            position: post_pos,
            title: rbgeNearby.post_current.title
        });
    }
    
    // person marker position and title
    if(!rbgeNearby.map_person_marker){
        rbgeNearby.map_person_marker =new google.maps.Marker({
            map: rbgeNearby.map,
            position: person_pos,
            icon: rbgeNearby.person_icon_on
        });
        
    }else{
        rbgeNearby.map_person_marker.setOptions({
            position: person_pos
        });
    }
    
    // are they both on the map at the default resolution?
    var bounds = new google.maps.LatLngBounds();
    bounds.extend(rbgeNearby.map_post_marker.getPosition());
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
    
});

$(document).on("pagehide","#map-page",function(){
    rbgeNearby.stopTracking();
});


rbgeNearby.refresh = function(){
    
    // Set out to get our location
    $.mobile.loading( "show", {
        text: 'Fetching location',
        textVisible: true,
        textonly: false,
        html: ""
    });
    
    // clear the last location
    rbgeNearby.location_current = false;
    
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
                         navigator.geolocation.clearWatch(rbgeNearby.location_watcher); // stop the watcher we have enough
                         clearTimeout(rbgeNearby.location_timer); // stop the timer that would stop the watcher
                         rbgeNearby.loadData();
                         
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

                navigator.geolocation.clearWatch(rbgeNearby.location_watcher);

                $.mobile.loading( "hide" ); // hide the loading if it showing
                rbgeNearby.loadData();

    }, 20 * 1000);
    
    // while we are calling the location we can update the categories
    rbgeNearby.loadCategories();
    
    // keep track of the refresh - have we moved?
    rbgeNearby.last_refresh = (new Date()).getTime();
    
}

rbgeNearby.loadCategories = function(){
    
    // get the root category first
    $.getJSON( "/wp-json/wp/v2/categories?slug=nearby", function( parents ){

        // then call for its children
        if(parents.length > 0){
            $.getJSON( "/wp-json/wp/v2/categories?parent=" + parents[0].id, function( cats ) {
                
                
                // write the list items
                var cat_list = $('#nearby-cats-list');
                cat_list.empty();
                
                // add one in for everything at the top
                var li = $('<li></li>');
                li.data('nearby-cat-slug', 'nearby');
                li.data('nearby-cat-name', 'Select a topic');
                li.addClass('nearby-cat-li');
                li.on('click', function(){
                    rbgeNearby.selectCategory('nearby');
                    rbgeNearby.loadData();
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
                    li.on('click', function(){
                        rbgeNearby.selectCategory($(this).data('nearby-cat-slug'));
                        rbgeNearby.loadData();
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


/*
    once we have a location we are happy
    with we call this to load the data
*/
rbgeNearby.loadData = function(){
    
    if(rbgeNearby.location_inaccurate){
        alert('Warning: Location data is inaccurate (only to about '+ (Math.round(rbgeNearby.location_current.accuracy)).toLocaleString() +' metres)');
    }
    
    $.mobile.loading( "show", {
        text: 'Loading data',
        textVisible: true,
        textonly: false,
        html: ""
    });
    
    $.getJSON( "/wp-json/rbge_geo_tag/v1/nearby?lat="+ rbgeNearby.location_current.latitude + "&lon="+ rbgeNearby.location_current.longitude +"&category=" + rbgeNearby.cat_current, function( data ) {
        $.mobile.loading( "hide" );
        rbgeNearby.posts_data = data;
        rbgeNearby.google_api_key = data.meta.google_api_key;
        rbgeNearby.updateDisplay();
    });
    
}

/* called after data has been loaded */
rbgeNearby.updateDisplay = function(){
   
    var post_list = $('#nearby-post-list');
    
    // clear out all the list items
    post_list.find('.nearby-post-li').remove();
    
    for (var i=0; i < rbgeNearby.posts_data.posts.length; i++) {
        
        var post = rbgeNearby.posts_data.posts[i];

        var li = $('<li></li>');
        li.data('nearby-post-index', i);
        li.addClass('nearby-post-li');
        post_list.append(li);
        
        var a = $('<a></a>');
        a.attr('href', '#post-page');
        a.attr('data-transition', "slide");
        a.data('nearby-post-index', i);
        a.on('click', function(){
            rbgeNearby.post_current = rbgeNearby.posts_data.posts[$(this).data('nearby-post-index')];
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
            
            
        }
        
        var accuracy = Math.round(rbgeNearby.location_current.accuracy);
        
        var p = $('<p>'+ d.toLocaleString() + ' ' + unit + ' ' + bearing +' (&#177; '+ accuracy.toLocaleString() + ' metres)</p>');
        a.append(p);
        
        post_list.listview('refresh');
    
    }// end loop
   
   
}

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



rbgeNearby.toggleAudio = function(){
    
    console.log('toggle');
        
    if($('#nearby-audio').data('playing')){
        rbgeNearby.stopAudio();
    }else{
        rbgeNearby.startAudio();
    }
}


rbgeNearby.startAudio = function(){
   
    if(window.cordova){
        rbgeNearby.startAudioCordova();
    }else{
        rbgeNearby.startAudioBrowser();
    }
    // set the started flag
    $('#nearby-audio').data('playing', true);
    
    // set the ui state to playing
    $('#nearby-audio-start-btn').removeClass('ui-icon-audio').addClass('ui-icon-minus');
    $('#nearby-audio-start-btn').html('Stop');
    
//    active_li.addClass('stop-state');
 //   active_li.attr('data-icon', 'minus');
 //   active_li.find('a').removeClass('ui-icon-audio').addClass('ui-icon-minus');
    
 //   $('#index-page div[data-role="footer"]').slideDown();
    
}

rbgeNearby.startAudioCordova = function(){
     
    // we need to be careful not to create an extra media player
    // if it is undefined or false then go for it
   if (rbgeNearby.media_player == false){
       
       rbgeNearby.media_player = new Media(media_url,

           // success callback -- called at the end of playback
           function () {
               rbgeNearby.media_player.release();
               stopAudio();
               rbgeNearby.media_player = false;
           },

           // error callback
           function (err) {
             rbgeNearby.media_player.release();
             if (err.code == MediaError.MEDIA_ERR_ABORTED) console.log("playAudio():Audio Error: MediaError.MEDIA_ERR_ABORTED");
             if (err.code == MediaError.MEDIA_ERR_NETWORK) console.log("playAudio():Audio Error: MediaError.MEDIA_ERR_NETWORK");
             if (err.code == MediaError.MEDIA_ERR_DECODE) console.log("playAudio():Audio Error: MediaError.MEDIA_ERR_DECODE");
             if (err.code == MediaError.MEDIA_ERR_NONE_SUPPORTED) console.log("playAudio():Audio Error: MediaError.MEDIA_ERR_NONE_SUPPORTED");
             rbgeNearby.media_player = false;
           },
           
           // status callback
           function (status){
               rbgeNearby.media_player_status = status;
           }
           
       );
       
       try{
           rbgeNearby.media_player.play();
       }catch(err){
           rbgeNearby.media_player = false;
       }
       
   } // check it doesn't already exist
    
    
}

rbgeNearby.startAudioBrowser = function(){
    $('#nearby-audio')[0].play();
}

rbgeNearby.stopAudio = function(){
    
    // actually stop the audio
    if(window.cordova){
        rbgeNearby.stopAudioCordova();
    }else{
        rbgeNearby.stopAudioBrowser();
    }
    
    // set the stop
    $('#nearby-audio').data('playing', false);

    // set the ui state to stopped
    $('#nearby-audio-start-btn').removeClass('ui-icon-minus').addClass('ui-icon-audio');
    $('#nearby-audio-start-btn').html('Start');
    

}

rbgeNearby.stopAudioCordova = function(){
     if(rbgeNearby.media_player){
         rbgeNearby.media_player.stop();
     }
}

rbgeNearby.stopAudioBrowser = function(){
     $('#nearby-audio')[0].pause();
}

rbgeNearby.skipBackAudio = function(){
    // actually stop the audio
   if(window.cordova){
       rbgeNearby.skipBackAudioCordova();
   }else{
       rbgeNearby.skipBackAudioBrowser();
   }
    
}

rbgeNearby.skipBackAudioBrowser = function(){
    
    if($('#nearby-audio')[0].currentTime > 20){
        $('#nearby-audio')[0].currentTime = $('#nearby-audio')[0].currentTime - 20;
    }else{
        $('#nearby-audio')[0].currentTime = 0;
    }

}

rbgeNearby.skipBackAudioCordova = function(){
    // FIXME - not implemented yet
}

rbgeNearby.restartAudio = function(){
    // actually stop the audio
   if(window.cordova){
       rbgeNearby.restartAudioCordova();
   }else{
       rbgeNearby.restartAudioBrowser();
   }
    
}

rbgeNearby.restartAudioBrowser = function(){
    $('#nearby-audio')[0].currentTime = 0;
}

rbgeNearby.restartAudioCordova = function(){
    // FIXME -  not implemented yet
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

