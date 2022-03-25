const Joi=require('joi');
const Arena=require('./models/arena');
const myError=require('./utils/myError');

//middleware for authentication before accessing certain protected routes
module.exports.isLoggedIn= (req,res,next)=>{
    if (!req.isAuthenticated()){
      //req.isAuthenticated() will return true if user is logged in
      req.session.originalUrl=req.originalUrl;//saving where the user was originally
      req.flash('error', 'You must be logged in first!');
      return res.redirect('/login');
    }
    next();
}
  

//middleware to check if loggedin user is the owner of the arena
// to protect edit & delete routes
module.exports.isOwner= async(req,res,next)=>{
    const {id}=req.params;
    const arena=await Arena.findById(id);
    if (!arena.owner.equals(req.user._id)){
      req.flash('error', 'You do not have permission to do that!');
      return res.redirect(`/arenas/${id}`);
    }
    next();
}

//middleware to check if loggedin user has the role of owner 
// to protect add new arena GET ,POST routes
module.exports.hasOwnerRole= async(req,res,next)=>{
  if (req.user.role!=="owner"){
    req.flash('error', 'You do not have permission to do that!');
    return res.redirect('/arenas');
  }
  next();
}


//middleware for data validation(server-side) while making a new arena, using Joi schema
const arnSchema=Joi.object({
  deleteImages:Joi.array().single(), //added bcoz validation was not letting it go
    arena:Joi.object({
      name:Joi.string().required(),
      location:Joi.string().required(),
      description:Joi.string().required(),
      price:Joi.number().required().min(0),
      sports:Joi.array().required().single(),
      startTiming:Joi.number().required().min(1).max(23),
      endTiming:Joi.number().required().min(1).max(23),
      startDate:Joi.date().required(),
      endDate:Joi.date().required(),
    }).required()
  })
module.exports.validateArenaData= (req,res,next)=>{
    const {error}=arnSchema.validate(req.body);
    if(error){
      const msg=error.details.map(e=>e.message).join(',');
      next(new myError(400, msg)); //call error handler with custom error
    }else next();//no error--> go to next function 
}



//middleware for data validation(server-side) while booking an arena, using Joi schema
const formSchema=Joi.object({
  sport:Joi.string().required(),
  date:Joi.date().required(),
})
module.exports.validateFormData= (req,res,next)=>{
    const {error}=formSchema.validate(req.body);
    if(error){
      const msg=error.details.map(e=>e.message).join(',');
      next(new myError(400, msg)); //call error handler with custom error
    }else next();//no error--> go to next function 
}



//middleware for data validation(server-side) while making a new user, using Joi schema
const userformSchema=Joi.object({
  username:Joi.string().required(),
  password: Joi.string().required(),
  //password complexity being checked by passwordComplexity npm package in index.js
  email:Joi.string().email({ minDomainSegments: 2, tlds: { allow: true } }).required(),
  //above email complexity check will trigger an error page instead of flash & redirect
  // email:Joi.string().required(),
  role:Joi.string().required(),
})
module.exports.validateUserFormData= (req,res,next)=>{
    const {error}=userformSchema.validate(req.body);
    if(error){
      const msg=error.details.map(e=>e.message).join(',');
      req.flash('error', msg);
      return res.redirect('/register');
    }else next(); 
}