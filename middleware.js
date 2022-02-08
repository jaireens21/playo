const Joi=require('joi');
const Arena=require('./models/arena');
const myError=require('./myError');

//middleware for authentication before accessing certain protected routes
module.exports.isLoggedIn= (req,res,next)=>{
    if (!req.isAuthenticated()){
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

//middleware for data validation(server-side) using Joi schema
const arnSchema=Joi.object({
  deleteImages:Joi.array().single(), //added bcoz validation was not letting it go
    arena:Joi.object({
      name:Joi.string().required(),
      location:Joi.string().required(),
      description:Joi.string().required(),
      price:Joi.number().required().min(0),
      sports:Joi.array().required().single(),
      timing:Joi.string().required(),
    }).required()
  })
module.exports.validateArenaData= (req,res,next)=>{
    const {error}=arnSchema.validate(req.body);
    if(error){
        const msg=error.details.map(e=>e.message).join(',');
        next(new myError(400, msg)); //call error handler with custom error
    }else next();//no error--> go to next function 
}
