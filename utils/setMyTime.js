//function to set the time of a date Object to UTC 10 hours 

function setMyTime(obj){
    obj.setUTCHours(10); 
    obj.setUTCMinutes(0); 
    obj.setUTCSeconds(0); 
    obj.setUTCMilliseconds(0);
    return obj;
}

module.exports=setMyTime;