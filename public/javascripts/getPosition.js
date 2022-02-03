//selecting the locateMe button
const btn = document.querySelector('.navigate'); 

function getCoords(){
  console.log("clicked on locate me");
  navigator.geolocation.getCurrentPosition((pos) => {
    console.log(pos.coords);})
}

btn.addEventListener('click', getCoords);



   
  

  

  



