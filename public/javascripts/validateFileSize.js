//linked to boilerplate.ejs via script tag
//alerts & pre-emptively stops uploading of a large file

//https://stackoverflow.com/questions/46140918/can-we-limit-upload-file-size-without-uploading-it-fully/46141188#46141188

function validateFileSize(file) {
    const fileSize= file.files[0].size/1024/1024;
    if (fileSize>2) {
        alert('File size exceeds 2 MB!');
        document.getElementById('image').value=null;
    }
}