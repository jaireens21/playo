const express= require ('express');
const router=express.Router({mergeParams: true});//make sure to add mergeParams:true to preserve the req.params values from the parent router
const nodemailer = require('nodemailer'); 

const catchAsync=require('../utils/catchAsync.js');
const createDateObj=require('../utils/createDateObj.js');

const Arena=require('../models/arena.js');

const {isLoggedIn, validateBookingFormData}=require('../middleware.js'); //importing middleware 
const User = require('../models/user.js');

//booking page for every arena; here user will select a sport & date 
router.get('/', isLoggedIn, catchAsync(async(req,res)=>{
    const arena=await Arena.findById(req.params.id);
    if(!arena){
      req.flash('error', 'Cannot find that arena!');
      return res.redirect('/arenas');
    }
    const todayString=new Date().toLocaleDateString('en-CA');
    const startDateString=arena.startDate.toLocaleDateString('en-CA');
    const endDateString=arena.endDate.toLocaleDateString('en-CA');
    return res.render('bookArena.ejs', {arena,todayString,startDateString, endDateString});
}))


//check availability of time slots for selected sport & date 
router.post('/check', isLoggedIn, validateBookingFormData, catchAsync(async(req,res)=>{
  
    const arena=await Arena.findById(req.params.id);
    if(!arena){
      req.flash('error', 'Cannot find that arena!');
      return res.redirect('/arenas');
    }
  
    const {sport}=req.body;
    if (!arena.sports.includes(sport)){
      req.flash('error','This arena does not offer that sport!');
      return res.redirect(`/arenas/${arena._id}`);
    }
    //date of booking should be greater than or equal to startDate (or today, whichever is greater)
    //date of booking should be less than or equal to endDate
    let bookingDate=createDateObj(req.body.date); 
    let bookingDateStr=bookingDate.toLocaleDateString("en-CA");
    
    let today=new Date(); let currentTimeInHours=today.getHours(); 
    today.setUTCHours(10); today.setUTCMinutes(0); today.setUTCSeconds(0); today.setUTCMilliseconds(0);
    let todayStr=today.toLocaleDateString("en-CA");
  
    let startDateStr=arena.startDate.toLocaleDateString("en-CA");
    let endDateStr=arena.endDate.toLocaleDateString("en-CA");
  
    let minDateStr= todayStr>startDateStr? todayStr: startDateStr;
    
    if(bookingDateStr<minDateStr || bookingDateStr>endDateStr){
      req.flash("error", "Booking date is not valid!");
      return res.redirect(`/arenas/${arena._id}/book`);
    }
    
    let reservations= arena.sportBookings.find(obj=>obj.sport===sport).bookings.filter(booking=>{
      let str= booking.date.toLocaleDateString("en-CA");
      if (str===bookingDateStr){
        return booking;
      }});
    // console.log("reservations", reservations);
  
    let reservedTimeSlots=reservations.map(r=>r.time);
      // console.log("reserved time slots", reservedTimeSlots);
  
    let availableTimeSlots=[]; let i;
    if(todayStr===bookingDateStr){
      //If the booking date is today:
      //display only the slots available after currentTimeInHours +1 hour or 1.5 hour 
      //(depending on if the start timing was a full hour or a half hour)
      i= (arena.startTiming%1===0?currentTimeInHours+1:currentTimeInHours+1.5) ;
    }else{
      i=arena.startTiming;
    }
    while(i<=arena.endTiming){
      if (!reservedTimeSlots.includes(i)){
        availableTimeSlots.push(i);
      }
      i=i+arena.duration;
    }
    // console.log(availableTimeSlots);
    return res.render('bookingArena.ejs', {arena,sport,bookingDateStr,availableTimeSlots});
} ))


//create booking for arena
router.post('/', isLoggedIn, catchAsync(async(req,res)=>{
    
    const {sport,time}=req.body;
    let date=createDateObj(req.body.date);
    let dateString=date.toLocaleDateString("en-CA");

    
    const arena=await Arena.findById(req.params.id);
    arena.sportBookings.find(obj=>obj.sport===sport).bookings.push({date,time,playerId:req.user._id});
    await arena.save();

    const user=await User.findById(req.user._id);
    user.bookings.push({date,time,sport,arenaId:arena._id});
    await user.save();
  
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
      text: `Hello ${req.user.username},\n\n` +
      `This is a confirmation email. The following arena has been booked using your BOOKMYSPORTS account ${req.user.email}:\n\n`+ `Arena: ${arena.name}, ${arena.location}\n` + `Date: ${dateString} \n` + `Time: ${time}:00 hours \n\n` + 'Have a good day!\n'
    };
    transporter.sendMail(mailOptions,(err)=>{
      if(err){
        console.log(err);
      }
    })

    return res.render('bookedArena.ejs', {arena,sport,dateString,time});
} ))
  

module.exports=router;