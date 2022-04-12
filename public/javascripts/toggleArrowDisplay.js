
function toggleArrowDisplay(element){
    
    document.getElementById('pastBookings').classList.toggle('hidden');
    element.innerHTML= (element.innerHTML==="▼" ? "▲" : "▼");
}