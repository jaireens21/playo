if(process.env.NODE_ENV!=='production'){
 require('dotenv').config();
}

const express=require('express');
const app=express();
const path=require('path');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const mongoose=require('mongoose');
mongoose.connect('mongodb://localhost:27017/playo',{
    useNewUrlParser: true, 
    useUnifiedTopology: true 
})
.then(()=>{
    console.log('Database connected');  
})
.catch( (err)=>{
    console.log("connection error:");
    console.log(err);
});

const Arena=require('./models/arena');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const methodOverride= require('method-override');
app.use(methodOverride('_method'));

const ejsMate=require('ejs-mate');
app.engine('ejs', ejsMate);

app.use(express.static(path.join(__dirname,'/public')));

// testing the connection to DB using mongoose model
// app.get('/makearena', async(req,res)=>{
//     const myarena=new Arena({name:'home',location:'ontario'});
//     await myarena.save();
//     res.send(myarena);
// })

//to catch errors within async functions that express cannot catch on its own.
function catchAsync(myFunc){
  return function(req,res,next){
    myFunc(req,res,next).catch(e=>next(e));
  }
}


//defining a custom error class
class myError extends Error{
  constructor(statusCode,message){
    super();
    this.message=message;
    this.statusCode=statusCode;
  }
}

const Joi=require('joi'); //package for data validation before sending data to DB
const passwordComplexity = require("joi-password-complexity"); //package for password complexity check

//middleware for data validation(server-side) using Joi
const validateArenaData= (req,res,next)=>{
  const arnSchema=Joi.object({
    arena:Joi.object({
      name:Joi.string().required(),
      location:Joi.string().required(),
      description:Joi.string().required(),
      price:Joi.number().required().min(0),
      image:Joi.string().required(),
      sports:Joi.array().required().single(),
      timing:Joi.string().required(),
    }).required()
  })
  const {error}=arnSchema.validate(req.body);
  if(error){
    const msg=error.details.map(e=>e.message).join(',');
    next(new myError(400, msg)); //call error handler with custom error
  }else{
    next();//no error--> go to route handler
  }
}

const session= require('express-session');
const sessionConfig={
  secret: 'thisshouldbeabettersecret',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    httpOnly:true,
    // helps mitigate the risk of client side script accessing the protected cookie
    maxAge: 1000*60*60*24*7,
    // cookie expires in a week
  }
}
app.use(session(sessionConfig));
const flash=require('connect-flash');
app.use(flash());


const User=require('./models/user');
const passport=require('passport');
const LocalStrategy=require('passport-local');
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req,res,next)=>{
  res.locals.loggedUser=req.user;
  res.locals.success=req.flash('success');
  res.locals.error=req.flash('error');
  next();
});

//middleware for authentication before accessing certain protected routes
const isLoggedIn= (req,res,next)=>{
  if (!req.isAuthenticated()){
    req.session.originalUrl=req.originalUrl;//saving where the user was originally
    req.flash('error', 'You must be logged in first!');
    return res.redirect('/login');
  }
  next();
}

//middleware to check if loggedin user is the owner of the arena
// to protect edit & delete routes
const isOwner= async(req,res,next)=>{
  const {id}=req.params;
  const arena=await Arena.findById(id);
  if (!arena.owner.equals(req.user._id)){
    req.flash('error', 'You do not have permission to do that!');
    return res.redirect(`/arenas/${id}`);
  }
  next();
}

app.get("/", (req,res)=>{
  res.render('home');
})

app.get("/register", (req,res)=>{
  res.render('register');
})

app.post("/register", catchAsync(async(req,res,next)=>{
  try{
    const {username,email,password}=req.body;
    const user=new User({username,email});
    
    //password complexity check
    const complexityOptions = {
      min: 8,
      max: 16,
      lowerCase: 1,
      upperCase: 1,
      numeric: 1,
      symbol: 1,
      requirementCount: 4,
    };
    const {error}= passwordComplexity(complexityOptions).validate(password);
    if (error){ 
      throw new Error('Password does not meet complexity criteria! Please try again!');
    }
    const newUser= await User.register(user,password);
    req.login(newUser, err=>{ 
      if (err) return next(err);
      req.flash('success','Registration successful!');
      res.redirect('/arenas/list');
    })
    
  }catch(e){
    req.flash('error', e.message);
    res.redirect('/register');
  }
}))

app.get("/login", (req,res)=>{
  res.render('login');
})

app.post("/login",  passport.authenticate('local', { failureRedirect: '/login', failureFlash: true }), (req,res)=>{
  req.flash('success', 'Welcome back!');
  const redirectTo= req.session.originalUrl || '/arenas/list';
  delete req.session.originalUrl; //clear the session of this data
  res.redirect(redirectTo);
})

app.get('/logout',(req,res)=>{
  req.logout();
  req.flash('success', 'Logged out!');
  res.redirect('/arenas/list');
})

app.get("/arenas", (req,res)=>{
  res.render('arenas');
})

//list page showing all arenas
app.get("/arenas/list", catchAsync(async(req,res)=>{
  // searching for an arena (name or location)
  let noMatch = null; let sstring="";
  if (req.query.search) {
    sstring=req.query.search;
    Arena.find({}, function(err, allArenas) {
      if (err) {
        console.log(err);
      } else {
            let regex=new RegExp(req.query.search, 'gi');
            let result = allArenas.filter(place=> (place.name.match(regex)||place.location.match(regex)));
            
            if (result.length < 1) {
            noMatch = req.query.search;
            }
            res.render("list.ejs", {allArenas: result, noMatch,sstring});
        }
    });
 } else {
        Arena.find({}, function(err, allArenas) {
          if (err) {
            console.log(err);
          } else {
              
            res.render("list.ejs", {allArenas,noMatch,sstring});
          }
        });
    }
}))

//get a form to add new arena
app.get('/arenas/new', isLoggedIn, (req,res)=>{
  res.render('new.ejs');
  })

//show page for every arena
app.get('/arenas/:id', catchAsync(async(req,res)=>{
  const arena=await Arena.findById(req.params.id).populate('owner');
  if(!arena){
    req.flash('error', 'Cannot find that arena!');
    return res.redirect('/arenas/list');
  }
  res.render('show.ejs', {arena});
}))

//submitting new arena details to DB
app.post('/arenas', isLoggedIn, validateArenaData, catchAsync(async(req,res)=>{
  const newArena=new Arena(req.body.arena);
  newArena.owner=req.user._id;
  await newArena.save();
  req.flash('success', 'Successfully created new Arena!');
  res.redirect(`/arenas/${newArena._id}`);
}))

//serving edit form for an arena
app.get('/arenas/:id/edit',isLoggedIn, isOwner, catchAsync(async(req,res)=>{
  const foundArena=await Arena.findById(req.params.id);
  if(!foundArena){
    req.flash('error', 'Cannot find that arena!');
    return res.redirect('/arenas/list');
  }
  res.render('edit.ejs', {arena:foundArena});
}))


//submitting the edit form's details to DB
app.put('/arenas/:id', isLoggedIn, isOwner, validateArenaData, catchAsync(async(req,res)=>{
  const updatedArena= await Arena.findByIdAndUpdate(req.params.id, req.body.arena);
  req.flash('success', 'Successfully updated!');
  res.redirect(`/arenas/${updatedArena._id}`);
}))

//deleting an arena
app.delete('/arenas/:id',isLoggedIn, isOwner, catchAsync(async(req,res)=>{
  const deletedArena=await Arena.findByIdAndDelete(req.params.id);
  if (!deletedArena){
    req.flash('error', 'Cannot find that arena!');
    return res.redirect('/arenas/list');
  }
  req.flash('success', 'Arena deleted!');
  res.redirect('/arenas/list');
}))

//catch all for non-existent routes,can handle any request method (get/post/put etc)
//put below all known routes
app.all("*", (req,res,next)=>{
  next (new myError(404,"Page Not Found!"));
})

//custom error handler
app.use((err,req,res,next)=>{
  //extracting data from error & giving defaults
  const{statusCode=500}=err;
  if(!err.message){err.message="Oh No! Something went wrong";}
  res.status(statusCode).render('error.ejs', {err});
})

app.listen(8080, ()=>{
    console.log("listening on port 8080");
})