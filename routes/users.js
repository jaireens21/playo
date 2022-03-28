const express= require ('express');
const router=express.Router({mergeParams: true});//make sure to add mergeParams:true to preserve the req.params values from the parent router
const passport=require('passport');
const passwordComplexity = require('joi-password-complexity'); //package for password complexity check
const crypto=require('crypto');//for generating resetPasswordToken
const nodemailer = require('nodemailer'); //for sending password reset email

const catchAsync=require('../utils/catchAsync.js');
const myError=require('../utils/myError.js');

const User=require('../models/user');

const {validateUserFormData}=require('../middleware.js'); //importing middleware 


//new user registration form
router.get('/register', (req,res)=>{
  res.render('register');
})


//create a new user
router.post('/register', validateUserFormData, catchAsync(async(req,res,next)=>{
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
      req.flash('error','Password does not meet complexity criteria! Please try again!');
      return res.redirect('/register');
    }
    const newUser= await User.register(user,password);
    req.login(newUser, err=>{ 
      if (err) return next(err);
    })
    req.flash('success','Registration successful!');
    return res.redirect('/arenas');
  
}))


//login form
router.get('/login', (req,res)=>{
  res.render('login');
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
  if (req.isAuthenticated()) { //user is alreay logged in
    return res.redirect('/');
  }
  return res.render('forgot.ejs'); 
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
      res.redirect('/forgot');
    }else{
      //res.send(`Email sent to ${user.email}. Follow instructions given in the email.`);
      res.render('forgotemail.ejs', {email: req.body.email});
    }
  })
}))


//render a form to get new password (when user clicks on reset link in email)
router.get('/reset/:token', catchAsync(async(req,res)=>{
  let user= await User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } });
  if(!user){
    req.flash('error', 'Password reset token is invalid or has expired.');
    res.redirect('/forgot');
  }
  res.render('reset.ejs', { user});
}))


//update user's password
router.put('/reset/:token', catchAsync(async(req,res)=>{
  
  let user= await User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } });
  if(!user){
    req.flash('error', 'Password reset token is invalid or has expired.');
    res.redirect('/forgot');
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
    `This is a confirmation email that the password for your account ${user.email} on BOOKMYSPORTS has been changed successfully.\n`
  };
  transporter.sendMail(mailOptions,(err)=>{
    if(err){
      console.log(err);
    }
  })
}))


module.exports=router;