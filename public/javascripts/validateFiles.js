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