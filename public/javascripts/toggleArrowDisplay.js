
function toggleArrowDisplay(e){
    
    document.getElementById('pastBookings').classList.toggle('hidden');
    e.innerHTML= (e.innerHTML==="▼" ? "▲" : "▼");
}