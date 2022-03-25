//selecting the locateMe button
const locationBtn = document.querySelector('.navigate'); 
const latitudeInput = document.getElementById('latitudeInput'); 
const longitudeInput = document.getElementById('longitudeInput'); 

function getCoords(){
  //console.log("clicked on locate me");
  navigator.geolocation.getCurrentPosition((pos) => {
    console.log(pos.coords);
  latitudeInput.innerHTML=pos.coords.latitude;
  longitudeInput.innerHTML=pos.coords.longitude;})
}

locationBtn.addEventListener('click', getCoords);



   
  

  

  



