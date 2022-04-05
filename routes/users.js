const express= require ('express');
const router=express.Router({mergeParams: true});//make sure to add mergeParams:true to preserve the req.params values from the parent router
const passport=require('passport');
const passwordComplexity = require('joi-password-complexity'); //package for password complexity check
const crypto=require('crypto');//for generating resetPasswordToken
const nodemailer = require('nodemailer'); //for sending password reset email

const catchAsync=require('../utils/catchAsync.js');
const myError=require('../utils/myError.js');

const User=require('../models/user.js');
const Arena=require('../models/arena.js');

const {validateUserFormData,isLoggedIn}=require('../middleware.js'); //importing middleware 


//new user registration form
router.get('/register', (req,res)=>{
  return res.render('userRegister.ejs');
})


//create a new user
router.post('/register', validateUserFormData, catchAsync(async(req,res,next)=>{
    const {username,email,password,role}=req.body;
       
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
      req.flash('error','Password does not meet complexity criteria! Please try again!');
      return res.redirect('/register');
    }

    const user=new User({username,email,role});
    const newUser= await User.register(user,password);
    req.login(newUser, err=>{ 
      if (err) return next(err);
    })
    req.flash('success','Registration successful!');
    return res.redirect('/arenas');
  
}))


//login form
router.get('/login', (req,res)=>{
  return res.render('userLogin.ejs');
})


//login registered user
router.post('/login',  passport.authenticate('local', { failureRedirect: '/login', failureFlash: true }), (req,res)=>{
  req.flash('success', 'Welcome back!');
  const redirectTo= req.session.originalUrl || '/arenas';
  delete req.session.originalUrl; 
  return res.redirect(redirectTo);
})


//logout user
router.get('/logout',(req,res)=>{
  req.logout();
  // req.session.destroy(); // clear the session data
  req.flash('success', 'Logged out!');
  return res.redirect('/arenas');
})


//FORGOT PASSWORD routes

//render a form to get user's email id
router.get('/forgot', (req,res)=>{
  if (req.isAuthenticated()) { //user is already logged in
    return res.redirect('/');
  }
  return res.render('passwordForgot.ejs'); 
})


//send reset email to user's email id
router.post('/forgot', catchAsync(async(req,res)=>{
  const user=await User.findOne({email:req.body.email});
  if(!user){
    req.flash('error','User does not exist! Please register!');
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
  //console.log('sending email');

  transporter.sendMail(mailOptions,(err)=>{
    if(err){
      req.flash('error', 'Error sending email for password reset! Please try again');
      console.log(err);
      return res.redirect('/forgot');
    }else{
      //res.send(`Email sent to ${user.email}. Follow instructions given in the email.`);
      return res.render('passwordEmailSent.ejs', {email: req.body.email});
    }
  })
}))


//render a form to get new password (when user clicks on reset link in email)
router.get('/reset/:token', catchAsync(async(req,res)=>{
  let user= await User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } });
  if(!user){
    req.flash('error', 'Password reset token is invalid or has expired.');
    return res.redirect('/forgot');
  }
  return res.render('passwordReset.ejs', { user});
}))


//update user's password
router.put('/reset/:token', catchAsync(async(req,res)=>{
  
  let user= await User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } });
  if(!user){
    req.flash('error', 'Password reset token is invalid or has expired.');
    return res.redirect('/forgot');
  }
  
  const {password}=req.body;
  //password complexity check implemented using js on the reset page.
  user.setPassword(password, async(err,user)=>{ //a passportlocal method to set user password
    if(err){return next(err);}
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    //console.log('user updated!');
  });
  
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
    `This is a confirmation email that the password for your account ${user.email} on BOOKMYSPORTS has been changed successfully.\n`
  };
  transporter.sendMail(mailOptions,(err)=>{
    if(err){
      console.log(err);
    }
  })
  req.flash('success', 'Password has been reset.');
  return res.redirect('/login');
}))

router.get('/users/:id/bookings',isLoggedIn, catchAsync(async(req,res)=>{
  const user=await User.findById(req.user._id).populate({
    path:'bookings',
    populate:{
      path:'arenaId',
    }
  });
  return res.render('userBookings', {user});

}) )

router.get('/users/:id/profile',isLoggedIn, catchAsync(async(req,res)=>{
  const user=await User.findById(req.user._id);
  return res.render('userProfile', {user});

}) )

router.get('/users/:id/arenas',isLoggedIn, catchAsync(async(req,res)=>{
  const userArenas=await Arena.find({owner:req.user._id});
  if(userArenas.length>0){
    return res.render('userArenas', {userArenas});
  }else {
    throw new myError(400,"You do not own any Arenas!");
  }
  
}) )

module.exports=router;