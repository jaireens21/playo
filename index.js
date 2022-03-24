if(process.env.NODE_ENV!=='production'){
 require('dotenv').config();
}

const express=require('express');
const app=express();
const path=require('path');
const crypto=require('crypto');//for generating resetPasswordToken
const nodemailer = require("nodemailer"); //for sending password reset email
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
    //interrogate the error, if it's something you can recover from, let it be.
    //if the exception is fatal, exit with prejudice
    //https://stackoverflow.com/questions/27139289/handle-database-error-when-using-connect-mongo
    
    process.exit(1);
    //exit status code 1 - Uncaught Fatal Exception
    //Node normally exits with a 0 status code 
});

const Arena=require('./models/arena');


app.use(express.urlencoded({extended:true}));
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

const {isLoggedIn, isOwner, hasOwnerRole, validateArenaData, validateFormData, validateUserFormData}=require('./middleware.js'); //importing middleware 


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

app.post("/register", validateUserFormData, catchAsync(async(req,res,next)=>{
  try{
    const {username,email,password,role}=req.body;
    const user=new User({username,email,role});
    
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

//FORGOT PASSWORD routes
//render a form to get user's email id
app.get('/forgot', (req,res)=>{
  if (req.isAuthenticated()) { //user is alreay logged in
    return res.redirect('/');
  }
  res.render('forgot.ejs'); 
})

//send reset email to user's email id
app.post('/forgot', catchAsync(async(req,res)=>{
  const user=await User.findOne({email:req.body.email});
  if(!user){
    req.flash('error','user does not exist! please signup!');
    return res.redirect('/register');
  }
  const token=crypto.randomBytes(20).toString('hex');
  user.resetPasswordToken=token;
  user.resetPasswordExpires=Date.now() + 3600000; //1 hour
  await user.save();
  const transporter = nodemailer.createTransport({
    service:'gmail',
    auth:{
      user:process.env.EMAIL_ADDRESS,
      pass:process.env.EMAIL_PASSWORD
      //gmail needs 'app specific password' to be generated for this kind of acccess
    },
  });
  const mailOptions = {
    to: user.email,
    from: 'jaireen.s21@gmail.com',
    subject: 'BOOKMYSPORTS: Password Reset Link',
    text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account on BOOKMYSPORTS.\n\n' +
    'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
    `http://localhost:8080/reset/${token}\n\n'` +
    'If you did not request this, please ignore this email and your password will remain unchanged.\n'
  };
  console.log('sending email');

  transporter.sendMail(mailOptions,(err)=>{
    if(err){
      req.flash('error', 'there is an error!');
      console.log(err);
      res.redirect('/forgot');
    }else{
      //res.send(`Email sent to ${user.email}. Follow instructions given in the email.`);
      res.render('forgotemail.ejs', {email: req.body.email});
    }
  })
}))

//render a form to get new password (when user clicks on reset link in email)
app.get('/reset/:token', catchAsync(async(req,res)=>{
  let user= await User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } });
  if(!user){
    req.flash('error', 'Password reset token is invalid or has expired.');
    res.redirect('/forgot');
  }
  res.render('reset.ejs', { user});
}))

//update user's password
app.put('/reset/:token', catchAsync(async(req,res)=>{
  const {password}=req.body;
  let user= await User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } });
  if(!user){
    req.flash('error', 'Password reset token is invalid or has expired.');
    res.redirect('/forgot');
  }
  //password complexity check implemented using js on the reset page.
  user.setPassword(password, (err,user)=>{ //a passportlocal method to set user password
    if(err){return next(err);}
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.save();
  });
  console.log('user updated!');
  req.flash('success', 'Password has been reset.');
  res.redirect('/login');
  //send email to inform that password has changed
  const transporter = nodemailer.createTransport({
    service:'gmail',
    auth:{
      user:process.env.EMAIL_ADDRESS,
      pass:process.env.EMAIL_PASSWORD
    },
  });
  const mailOptions = {
    to: user.email,
    from: 'jaireen.s21@gmail.com',
    subject: 'BOOKMYSPORTS : Your password has been changed',
    text: 'Hello,\n\n' +
    `This is a confirmation that the password for your account ${user.email} on BOOKMYSPORTS has been changed.\n`
  };
  transporter.sendMail(mailOptions,(err)=>{
    if(err){
      console.log(err);
    }
  })
}))




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
        req.flash('error', err.message);
        res.redirect('/');
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
            req.flash('error', err.message);
            res.redirect('/');
          } else {
              
            res.render("list.ejs", {allArenas,noMatch,sstring});
          }
        });
    }
}))

//get a form to add new arena
app.get('/arenas/new', isLoggedIn, hasOwnerRole, (req,res)=>{
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


//booking page for every arena
app.get('/arenas/:id/book', isLoggedIn, catchAsync(async(req,res)=>{
  const arena=await Arena.findById(req.params.id);
  if(!arena){
    req.flash('error', 'Cannot find that arena!');
    return res.redirect('/arenas/list');
  }
  const todayString=new Date().toLocaleDateString('en-CA');
  res.render('book.ejs', {arena,todayString});
}))


//checking booking availability
app.post('/arenas/:id/book/check', isLoggedIn, validateFormData, catchAsync(async(req,res)=>{
  const arena=await Arena.findById(req.params.id);
  if(!arena){
    req.flash('error', 'Cannot find that arena!');
    return res.redirect('/arenas/list');
  }
  const {sport}=req.body;
  if (!arena.sports.includes(sport)){
    req.flash('error','This arena does not offer that sport!');
    return res.redirect(`/arenas/${arena._id}`);
  }

  let dateParts=req.body.date.split("-");
  let date=new Date(dateParts[0],dateParts[1]-1,dateParts[2],"06","00");
  //creating a date object with default time set as 6:00 hrs keeping EST vs GMT(UTC) (4 hrs) & dayLightSavings (+ or - 1 hr) in mind so that date doesnot switch by -1 when generating localeTimeString

  let today=new Date(); today.setUTCHours(10); today.setUTCMinutes(0); today.setUTCSeconds(0); today.setUTCMilliseconds(0);
  if(date<today){
    date=today;
  }
  //Ensuring that the date (coming from the form) is greater than today's date
  //If it is less than today's date, then reset it to today's date 
  //console.log("date", date);
  let reservations= arena.sportBookings.find(booking=>booking.sport===sport).bookings.filter(b=>b.date.toLocaleDateString()===date.toLocaleDateString());
  //console.log("reservations", reservations);
  let reservedTimeSlots=reservations.map(r=>r.time);
  //console.log("reserved time slots", reservedTimeSlots);
  let availableTimeSlots=[];
  let i=arena.startTiming;
  while(i<arena.endTiming){
    if (!reservedTimeSlots.includes(i)){
      availableTimeSlots.push(i);
    }
    ++i;
  }
  // console.log(availableTimeSlots);
  let dateString=date.toLocaleDateString("en-CA");
   
  res.render('booking.ejs', {arena,sport,dateString,availableTimeSlots});
  
} ))


//create booking for arena
app.post('/arenas/:id/book', isLoggedIn, catchAsync(async(req,res)=>{
  const arena=await Arena.findById(req.params.id);
  const {sport,time}=req.body;
  let dateParts=req.body.date.split("-");
  let date=new Date(dateParts[0],dateParts[1]-1,dateParts[2],"06","00");
  let newBooking={date,time,playerId:req.user._id};
  
  arena.sportBookings.find(booking=>booking.sport===sport).bookings.push(newBooking);
  await arena.save();
  let dateString=date.toLocaleDateString("en-CA");
  res.render('booked.ejs', {arena,sport,dateString,time});
  //send confirmation email to inform that arena has been booked
  const transporter = nodemailer.createTransport({
    service:'gmail',
    auth:{
      user:process.env.EMAIL_ADDRESS,
      pass:process.env.EMAIL_PASSWORD
    },
  });
  const mailOptions = {
    to: req.user.email,
    from: 'jaireen.s21@gmail.com',
    subject: 'BOOKMYSPORTS : Your booking is confirmed',
    text: 'Hello,\n\n' +
    `This is a confirmation email. The following arena has been booked for BOOKMYSPORTS account ${req.user.email}:\n\n`+ `Arena: ${arena.name}, ${arena.location}\n` + `Date: ${dateString} \n` + `Time: ${time}:00 hours \n\n` + 'Have a good day!\n'
  };
  transporter.sendMail(mailOptions,(err)=>{
    if(err){
      console.log(err);
    }
  })
  
} ))


//submitting new arena details to DB
app.post('/arenas', isLoggedIn, hasOwnerRole, upload.array('image'), validateArenaData, catchAsync(async(req,res)=>{
  const {sports}=req.body.arena;
  const newArena=new Arena(req.body.arena);
  newArena.owner=req.user._id;
  newArena.images= req.files.map( f=>( {url:f.path, filename:f.filename}) ); //details of uploaded images(available on req.files thanks to multer) being added to the arena
  for(let sport of sports){
    newArena.sportBookings.push({sport: sport, bookings:[]});
  }
 
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