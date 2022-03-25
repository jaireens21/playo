const express= require ('express');
const router=express.Router();

const catchAsync=require('../utils/catchAsync.js');
const createDateObj=require('../utils/createDateObj');
const myError=require('../utils/myError');

const Arena=require('../models/arena');

const {isLoggedIn, isOwner, hasOwnerRole, validateArenaData, validateFormData, validateUserFormData}=require('../middleware.js'); //importing middleware 


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


//list page showing all arenas
router.get("/arenas", catchAsync(async(req,res)=>{
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
  

//serve a form to add new arena
router.get('/arenas/new', isLoggedIn, hasOwnerRole, (req,res)=>{
    res.render('new.ejs');
})


//saving a new arena to DB
router.post('/arenas', isLoggedIn, hasOwnerRole, upload.array('image'), validateArenaData, catchAsync(async(req,res)=>{
    const {name,location,description,price,sports,startTiming,endTiming}=req.body.arena;
    const newArena=new Arena({name,location,description,price,sports,startTiming,endTiming});
    newArena.owner=req.user._id;
    newArena.images= req.files.map( f=>( {url:f.path, filename:f.filename}) ); 
    //details of uploaded images(available on req.files thanks to multer) being added to the arena
    for(let sport of sports){
      newArena.sportBookings.push({sport: sport, bookings:[]});
    }
    let {startDate,endDate}=req.body.arena;
    startDate=createDateObj(startDate);
    endDate=createDateObj(endDate);
    newArena.startDate=startDate;
    newArena.endDate=endDate;
  
    await newArena.save();
  
    req.flash('success', 'Successfully created new Arena!');
    res.redirect(`/arenas/${newArena._id}`);
}))

//serving edit form for an arena
router.get('/arenas/:id/edit',isLoggedIn, isOwner, catchAsync(async(req,res)=>{
    const foundArena=await Arena.findById(req.params.id);
    if(!foundArena){
      req.flash('error', 'Cannot find that arena!');
      return res.redirect('/arenas');
    }
    let startDateString=foundArena.startDate.toLocaleDateString("en-CA");
    let endDateString=foundArena.endDate.toLocaleDateString("en-CA");
    res.render('edit.ejs', {arena:foundArena, startDateString, endDateString});
}))



router.route('/arenas/:id')
        //show page for every arena
    .get(catchAsync(async(req,res)=>{
        const arena=await Arena.findById(req.params.id).populate('owner');
        if(!arena){
          req.flash('error', 'Cannot find that arena!');
          return res.redirect('/arenas');
        }
        res.render('show.ejs', {arena});
    }))

        //saving edited arena's details
    .put(isLoggedIn, isOwner, upload.array('image'), validateArenaData, catchAsync(async(req,res)=>{
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
    .delete(isLoggedIn, isOwner, catchAsync(async(req,res)=>{
        const deletedArena=await Arena.findByIdAndDelete(req.params.id);
        if (!deletedArena){
          req.flash('error', 'Cannot find that arena!');
          return res.redirect('/arenas');
        }
        req.flash('success', 'Arena deleted!');
        res.redirect('/arenas');
    }))