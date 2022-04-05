function passwordComplexityCheck(e) {
    // const complexityOptions = {
    //     min: 8,
    //     max: 16,
    //     lowerCase: 1,
    //     upperCase: 1,
    //     numeric: 1,
    //     symbol: 1,
    //     requirementCount: 4, //all conditions must be met.
    // };

    const password=e.value;
    let flag=false;
    if(password.length<8){flag=true;}
    else if(password.length>16){flag=true;}
    else{
        let hasUpperCase = /[A-Z]/.test(password);
        let hasLowerCase = /[a-z]/.test(password);
        let hasNumbers = /\d/.test(password);
        let hasNonalphas = /\W/.test(password);
        if (hasUpperCase + hasLowerCase + hasNumbers + hasNonalphas < 4){flag:true;}
    } 

    if (flag){ 
        alert('Password does not meet complexity criteria! Please try again!');
        e.value=null;
    }
};


function confirmNewPassword(e){
    if(document.getElementById('newPassword').value !== document.getElementById('confirm').value) {
        alert('Passwords do not match!'); 
        e.value=null;
    }
      
}
function confirmPassword(e){
    if(document.getElementById('password').value !== document.getElementById('confirm').value) {
        alert('Passwords do not match!'); 
        e.value=null;
    }
      
}