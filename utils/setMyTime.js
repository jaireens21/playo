function setMyTime(obj){
    obj.setUTCHours(10); 
    obj.setUTCMinutes(0); 
    obj.setUTCSeconds(0); 
    obj.setUTCMilliseconds(0);
    return obj;
}

module.exports=setMyTime;