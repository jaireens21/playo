//create a date object using string input
function createDateObj(str){
    let dateParts=[];
    if(str.indexOf("-")!==-1){
      dateParts=str.split("-");
    }else if (str.indexOf("/")!==-1){
      dateParts=str.split("/");
    }
    let date=new Date(dateParts[0],dateParts[1]-1,dateParts[2],"06","00");
  //creating a date object with default time set as local EST 6:00 hrs. We are keeping in mind EST vs GMT(UTC) (4 hrs) & dayLightSavings (+ or - 1 hr), so that date doesnot switch by -1 when generating localeTimeString
  return date;
}

module.exports=createDateObj;