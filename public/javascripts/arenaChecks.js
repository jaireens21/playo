let today=new Date();
today.setUTCHours(10); today.setUTCMinutes(0); today.setUTCSeconds(0); today.setUTCMilliseconds(0);
let todayStr=today.toLocaleDateString("en-CA");

let startDate=document.querySelector("#startDate");
let endDate=document.querySelector("#endDate");
let startTiming=document.querySelector("#startTiming");
let endTiming=document.querySelector("#endTiming");

function checkStartDate(element){
    if(element.value<todayStr){
        alert('First date cannot be earlier than today!');
        element.value=null;
    }
    if(endDat.value && element.value>endDate.value){
        alert('First date cannot be later than last date!');
        element.value=null;
    }
};
function checkEndDate(element){
    if(element.value<startDate.value){
        alert('Last date cannot be earlier than first date!');
        element.value=null;
    }
    // if(element.value<todayStr){
    //     alert('Last date cannot be earlier than today!');
    //     element.value=null;
    // }
};

function checkEndTiming(element){
    if(parseFloat(element.value) < parseFloat(startTiming.value)){
        alert('Last booking cannot be earlier than First Booking!');
        element.value=null;
    }
}

function checkStartTiming(element){
    if((endTiming.value) && parseFloat(element.value) > parseFloat(endTiming.value)){
        alert('First booking cannot be later than Last Booking!');
        element.value=null;
    }
}

//linked to boilerplate.ejs via script tag
//alerts & pre-emptively stops uploading of too many files

function validateFileNumber(element) {
    if (element.files.length>3) {
        alert('Please upload only 3 files!');
        element.value=null;
    }
};


//alerts & pre-emptively stops uploading of a large file

function validateFileSize(element) {
    for(let i=0;i<element.files.length;++i){
        let fileSize= element.files[i].size/1024/1024;
        if (fileSize>2) {
            alert('File size exceeds 2 MB!');
            element.value=null;
            break;
        }
    }
    
};

// function validateFileSize(file) {
//     const fileSize= file.files[0].size/1024/1024;
//     if (fileSize>2) {
//         alert('File size exceeds 2 MB!');
//         document.getElementById('image').value=null;
//     }
// }

//prevent form submission until atleast 1 sport is selected
function validateSports(evt) {
    let boxes=document.querySelectorAll('input[type=checkbox]');
    let flag=false;
    for(let i=0;i<boxes.length;++i){
        if(boxes[i].checked){
            flag=true;
            break;
        }
    }
    if(!flag){
        alert('Please select atleast 1 sport!');
        evt.preventDefault();
    }
};

//confirm if user really wants to delete the arena
function confirmDeleteArena(evt) {
    let result= confirm ('Are you sure you want to delete this arena?');
    if(!result){
        evt.preventDefault();
    }
};