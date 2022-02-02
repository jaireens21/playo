const navigate = document.querySelector('.navigate'); //selecting the locateMe button



navigate.addEventListener('click', function(){
    console.log("clicking on locate me");
   navigator.geolocation.getCurrentPosition((position) => {
        console.log(position);
        const {latitude,longitude}=position.coords;
        console.log(latitude,longitude);
        }, (err) => {
        console.error(err);
      })
    
      //need google map api to convert coords to location (reverse geocoding). Then plugin location into the search bar input.
} );



