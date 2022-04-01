let today=new Date();
today.setUTCHours(10); today.setUTCMinutes(0); today.setUTCSeconds(0); today.setUTCMilliseconds(0);
let todayStr=today.toLocaleDateString("en-CA");

let startDate=document.querySelector("#startDate");

function checkStartDate(e){
    if(e.value<todayStr){
        alert('First date cannot be earlier than today');
        e.value=null;
    }
};
function checkEndDate(e){
    if(e.value<startDate.value){
        alert('Last date cannot be earlier than First Date');
        e.value=null;
    }
};