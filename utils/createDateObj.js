//create a date object using string input
function createDateObj(str){
    let dateParts=[];
    if(str.indexOf("-")!==-1){
      dateParts=str.split("-");
    }else if (str.indexOf("/")!==-1){
      dateParts=str.split("/");
    }
    
    let date=new Date(dateParts[0],dateParts[1]-1,dateParts[2],"06","00");//year,month,day,hours,minutes,seconds
  //creating a date object with default time set as local EST 6:00, instead of default of 0:0 hrs UTC. 
  //We are keeping in mind EST vs GMT(UTC) (4 hrs) & dayLightSavings (+ or - 1 hr)
  //So local time of 6:00 hrs when converted to UTC (while creating Date Object) and then back to local time(when generating string from dateobj using toLocaleTimeString()) stays on the same date as selected by user
  
  return date;
}

module.exports=createDateObj;