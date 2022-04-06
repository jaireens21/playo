
function toggleArrowDisplay(e){
    
    e.parentElement.nextElementSibling.classList.toggle('hidden');
    e.innerHTML= (e.innerHTML==="▼" ? "▲" : "▼");
}