//defining a custom error class
class myError extends Error{
    constructor(statusCode,message){
      super();
      this.message=message;
      this.statusCode=statusCode;
    }
}

module.exports=myError;