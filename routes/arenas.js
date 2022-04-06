const express= require ('express');
const router=express.Router({mergeParams: true});//make sure to add mergeParams:true to preserve the req.params values from the parent router

const catchAsync=require('../utils/catchAsync.js');
const createDateObj=require('../utils/createDateObj');

const Arena=require('../models/arena');

const {isLoggedIn, isOwner, hasOwnerRole, validateArenaData}=require('../middleware.js'); //importing middleware 


//image uploading to cloudinary
const multer = require('multer'); //for image uploading
const {cloudinary,storage}= require('../cloudinary'); //folder:cloudinary,file:index.js
const maxSize= 2*1024*1024; //in bytes; max Image file size set to 2MB
const whitelist = ['image/png', 'image/jpeg', 'image/jpg']; //allowed formats of images
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
router.get('/', catchAsync(async(req,res)=>{
    // searching for an arena (name or location or sports)
    let sstring=""; let hasNoMatch = true; let result=[];
    Arena.find({}, function(err, allArenas) {
      if (err) {
        console.log(err);
        req.flash('error', err.message);
        return res.redirect('/');
      } else {
        if (req.query.search){
          sstring=req.query.search;
          let regex=new RegExp(req.query.search, 'gi');
          result = allArenas.filter(place=> (place.name.match(regex)||place.location.match(regex)||place.sports.join('').match(regex)));
          if (result.length >= 1) {
            hasNoMatch = false;
          }
          return res.render('list.ejs', {allArenas: result, hasNoMatch,sstring});
        }else {
          return res.render('list.ejs', {allArenas,hasNoMatch,sstring});
        }
      }})}))
  

//serve a form to add new arena
router.get('/new', isLoggedIn, hasOwnerRole, (req,res)=>{
  res.render('arenaNew.ejs');
})


//save a new arena to DB
router.post('/', isLoggedIn, hasOwnerRole, upload.array('image'), validateArenaData, catchAsync(async(req,res)=>{
    const {name,location,description,price,sports,startTiming,endTiming,duration}=req.body.arena;
    const newArena=new Arena({name,location,description,price,sports,startTiming,endTiming,duration});
    newArena.owner=req.user._id;
    newArena.images= req.files.map( f=>( {url:f.path, filename:f.filename}) ); 
    //details of uploaded images(available on req.files thanks to multer) being added to the arena
    
    if (typeof(sports)==="string"){ //when arena offers only 1 sport
      newArena.sportBookings.push({sport: sports, bookings:[]});
    }else {
      for(let sport of sports){
        newArena.sportBookings.push({sport: sport, bookings:[]});
      }
    }
   
    let {startDate,endDate}=req.body.arena;
    startDate=createDateObj(startDate);
    endDate=createDateObj(endDate);
    newArena.startDate=startDate;
    newArena.endDate=endDate;
  
    await newArena.save();
  
    req.flash('success', 'Successfully created new Arena!');
    return res.redirect(`/arenas/${newArena._id}`);
}))

//serve edit form for an arena
router.get('/:id/edit',isLoggedIn, isOwner, catchAsync(async(req,res)=>{
    const foundArena=await Arena.findById(req.params.id);
    if(!foundArena){
      req.flash('error', 'Cannot find that arena!');
      return res.redirect('/arenas');
    }
    let startDateString=foundArena.startDate.toLocaleDateString('en-CA');
    let endDateString=foundArena.endDate.toLocaleDateString('en-CA');
    return res.render('arenaEdit.ejs', {arena:foundArena, startDateString, endDateString});
}))

//show arena's bookings
router.get('/:id/bookings',isLoggedIn, isOwner, catchAsync(async(req,res)=>{
  const arena=await Arena.findById(req.params.id).populate({path:'sportBookings', populate:{path:'bookings', populate:{path:'playerId'}}});
  if(!arena){
    req.flash('error', 'Cannot find that arena!');
    return res.redirect('/arenas');
  }
  
  //sort bookings by date, before display
  for(let sbooking of arena.sportBookings){
    sbooking.bookings.sort((a,b)=>{ return (a.date-b.date);});
  }
  await arena.save();
  let today=new Date();
  
  return res.render('arenaBookings.ejs', {arena,userId:req.user._id,today});
}))

router.route('/:id')
        //show details of an arena
    .get(catchAsync(async(req,res)=>{
        const arena=await Arena.findById(req.params.id).populate('owner');
        if(!arena){
          req.flash('error', 'Cannot find that arena!');
          return res.redirect('/arenas');
        }
        return res.render('arenaShow.ejs', {arena});
    }))

        //save edited arena's details
    .put(isLoggedIn, isOwner, upload.array('image'), validateArenaData, catchAsync(async(req,res)=>{
        const {name,location,description,price,sports,startTiming,endTiming,duration}=req.body.arena;
        let updatedArena= await Arena.findByIdAndUpdate(req.params.id, {name,location,description,price,sports,startTiming,endTiming,duration});
        if (!updatedArena){
          req.flash('error', 'Cannot find that arena!');
          return res.redirect('/arenas');
        }

        let {startDate,endDate}=req.body.arena;
        startDate=createDateObj(startDate);
        endDate=createDateObj(endDate);
        updatedArena.startDate=startDate;
        updatedArena.endDate=endDate;
        if (req.files.length > 0) {
          const imgs= req.files.map( f=>({url:f.path, filename:f.filename})); 
          updatedArena.images.push(...imgs);
        } 
        await updatedArena.save();

        //removing selected images from the arena; filenames are avbl on req.body.deleteImages[]
        if(req.body.deleteImages){
          //destroy image on cloudinary
          for(let filename of req.body.deleteImages){
            await cloudinary.uploader.destroy(filename);}
          //remove image from arena, directly in db
          await updatedArena.updateOne( {$pull: {images: {filename: {$in: req.body.deleteImages}}}}); 
        }
        
        updatedArena=await Arena.findById(req.params.id);
        //if all existing images were deleted, we add a default image 
        if(updatedArena.images.length===0){
          updatedArena.images.push({
            url:"https://res.cloudinary.com/dvhs0ay92/image/upload/v1649104849/bookmysport/Default_Image_qlhcxb.jpg",
            filename:"bookmysport/Default_Image_qlhcxb"
          });
          await updatedArena.save();
        }
        
        req.flash('success', 'Successfully updated!');
        return res.redirect(`/arenas/${updatedArena._id}`);
    }))

        //delete an arena
    .delete(isLoggedIn, isOwner, catchAsync(async(req,res)=>{
        const deletedArena=await Arena.findByIdAndDelete(req.params.id);
        if (!deletedArena){
          req.flash('error', 'Cannot find that arena!');
          return res.redirect('/arenas');
        }
        for (let image of deletedArena.images) {
          await cloudinary.uploader.destroy(image.filename);
        } 
        req.flash('success', 'Arena deleted!');
        return res.redirect('/arenas');
    }))


module.exports=router;