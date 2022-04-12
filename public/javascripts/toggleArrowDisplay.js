
function toggleArrowDisplay(ele){
    
    document.getElementById('pastBookings').classList.toggle('hidden');
    ele.innerHTML= (ele.innerHTML==="▼" ? "▲" : "▼");
}