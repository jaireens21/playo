//linked to boilerplate.ejs via script tag
//alerts & stops uploading of too many files

//https://stackoverflow.com/questions/10105411/how-to-limit-the-maximum-files-chosen-when-using-multiple-file-input

function validateFileNumber(e) {
    if (e.files.length>3) {
        alert('Please upload only 3 files!');
        document.getElementById('image').value=null;
    }
}