if(process.env.NODE_ENV!=='production'){
 require('dotenv').config();
}

const express=require('express');
const app=express();
const path=require('path');
const mongoSanitize = require('express-mongo-sanitize'); //preventing mongo injection
const helmet=require('helmet'); //auto setting http headers for security


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
app.use(mongoSanitize());
// app.use(helmet({contentSecurityPolicy: false}));

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


const myError=require('./myError'); //custom error class

const passwordComplexity = require("joi-password-complexity"); //package for password complexity check

const session= require('express-session');
const sessionConfig={
  name:'parleg',
  secret: 'thisshouldbeabettersecret',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    httpOnly:true,// helps mitigate the risk of client side script accessing the protected cookie
    
    //secure:true, //use when deploying, httpS will be reqd to set cookies

    maxAge: 1000*60*60*24*7,     // cookie expires in a week
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

const {isLoggedIn, isOwner, validateArenaData}=require('./middleware.js'); //importing middleware 


//image uploading to cloudinary
const multer = require('multer'); //for image uploading
const {cloudinary,storage}= require("./cloudinary"); 
const maxSize= 2*1024*1024; //in bytes; max Image file size set to 2MB
const whitelist = [ //allowed formats of images
  'image/png',
  'image/jpeg',
  'image/jpg'
];
const upload = multer({  
  storage,  //upload to cloudinary
  limits: {fileSize: maxSize, files:3},//limit to 3 image uploads at once
  fileFilter: (req, file, cb) => { //checking if file extension is an allowed format
      if (!whitelist.includes(file.mimetype)){
        cb(null, false);
        return cb(new Error('Only .png, .jpg and .jpeg formats allowed!'));
      }
      else{
        cb(null, true);
      } 
  }
}); 





//ALL ROUTES
app.get("/", (req,res)=>{
  res.render('landing');
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
  // searching for an arena (name or location or sports)
  let noMatch = null; let sstring="";
  if (req.query.search) {
    sstring=req.query.search;
    Arena.find({}, function(err, allArenas) {
      if (err) {
        console.log(err);
      } else {
            let regex=new RegExp(req.query.search, 'gi');
            let result = allArenas.filter(place=> (place.name.match(regex)||place.location.match(regex)||place.sports.join('').match(regex)));
            
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
app.post('/arenas', isLoggedIn, upload.array('image'), validateArenaData, catchAsync(async(req,res)=>{
  const newArena=new Arena(req.body.arena);
  newArena.owner=req.user._id;
  newArena.images= req.files.map( f=>( {url:f.path, filename:f.filename}) ); //details of uploaded images(available on req.files thanks to multer) being added to the arena
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
app.put('/arenas/:id', isLoggedIn, isOwner, upload.array('image'), validateArenaData, catchAsync(async(req,res)=>{
  const updatedArena= await Arena.findByIdAndUpdate(req.params.id, req.body.arena);
  const imgs= req.files.map( f=>({url:f.path, filename:f.filename})); 
  updatedArena.images.push(...imgs); 
  await updatedArena.save();

  //removing selected images, filenames avbl on req.body.deleteImages[]
  if(req.body.deleteImages){
    for(let filename of req.body.deleteImages){
      await cloudinary.uploader.destroy(filename); 
    }
    await updatedArena.updateOne( {$pull: {images: {filename: {$in: req.body.deleteImages}}}});  
  }
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
  if (err.code === 'LIMIT_FILE_SIZE')  //instanceof multer.MulterError
    {err.message = 'File Size is too large. Allowed file size is 2MB';}
  res.status(statusCode).render('error.ejs', {err});
})

app.listen(8080, ()=>{
    console.log("listening on port 8080");
})