let today=new Date();
today.setUTCHours(10); today.setUTCMinutes(0); today.setUTCSeconds(0); today.setUTCMilliseconds(0);
let todayStr=today.toLocaleDateString("en-CA");

let startDate=document.querySelector("#startDate");
let startTiming=document.querySelector("#startTiming");

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

function checkEndTiming(e){
    if(parseFloat(e.value) < parseFloat(startTiming.value)){
        alert('Last booking cannot be earlier than First Booking');
        e.value=null;
    }
}

//linked to boilerplate.ejs via script tag
//alerts & pre-emptively stops uploading of too many files

function validateFileNumber(e) {
    if (e.files.length>3) {
        alert('Please upload only 3 files!');
        document.getElementById('image').value=null;
    }
};


//alerts & pre-emptively stops uploading of a large file

function validateFileSize(e) {
    for(let i=0;i<e.files.length;++i){
        let fileSize= e.files[i].size/1024/1024;
        if (fileSize>2) {
            alert('File size exceeds 2 MB!');
            document.getElementById('image').value=null;
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