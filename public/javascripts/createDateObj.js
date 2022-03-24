module.exports.createDateObj=(string)=>{
    let dateParts=string.split("-");
    let date=new Date(dateParts[0],dateParts[1]-1,dateParts[2],"06","00");
    return date;
  }