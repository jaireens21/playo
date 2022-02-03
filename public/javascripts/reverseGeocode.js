const position=require('./getPosition');
const {latitude, longitude}=position.coords;
const api_key= process.env.opencage_api_key;

const api_url = 'https://api.opencagedata.com/geocode/v1/json'

const request_url = api_url
+ '?'
+ 'key=' + api_key
+ '&q=' + encodeURIComponent(latitude + ',' + longitude)
+ '&pretty=1'
+ '&no_annotations=1';

var request = new XMLHttpRequest();
request.open('GET', request_url, true);
    
request.onload = function(){
    
    if (request.status === 200){ 
    var data = JSON.parse(request.responseText);
    console.log(data.results[0].components.city); // print the location city
    }else {
    console.log("server error");
    }
};

request.onerror = function() {
    // There was a connection error of some sort
    console.log("unable to connect to server");        
};
  
request.send(); 