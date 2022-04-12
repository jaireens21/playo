const express= require ('express');
const router=express.Router({mergeParams: true});//make sure to add mergeParams:true to preserve the req.params values from the parent router

const catchAsync=require('../utils/catchAsync.js');
const createDateObj=require('../utils/createDateObj');
const setMyTime=require('../utils/setMyTime');
const findConflictingBookings=require('../utils/findConflictingBookings');

const {cloudinary}= require('../cloudinary'); //folder:cloudinary,file:index.js

const Arena=require('../models/arena');

const {isLoggedIn, isOwner, hasOwnerRole, validateNewArenaData,validateEditArenaData,uploadingImages}=require('../middleware.js'); //importing middleware 





//list page showing all arenas
router.get('/', catchAsync(async(req,res)=>{
    // searching for an arena (name or location or sports)
    let sstring=""; let hasMatch = false; let result=[];
    Arena.find({}, function(err, allArenas) {
      if (err) {
        console.log(err);
        req.flash('error', err.message);
        return res.redirect('/');
      } else {
        if (req.query.search){
          sstring=req.query.search;
          let regex=new RegExp(sstring, 'gi');
          result = allArenas.filter(place=> (place.name.match(regex)||place.location.match(regex)||place.sports.join('').match(regex)));
          if (result.length >= 1) {
            hasMatch = true;
          }
          return res.render('list.ejs', {allArenas: result, hasMatch,sstring});
        }else {
          return res.render('list.ejs', {allArenas,hasMatch,sstring});
        }
      }})}))
  

//serve a form to add new arena
router.get('/new', isLoggedIn, hasOwnerRole, (req,res)=>{
  res.render('arenaNew.ejs');
})


//save a new arena to DB
router.post('/', isLoggedIn, hasOwnerRole, uploadingImages, validateNewArenaData, catchAsync(async(req,res)=>{
    const {name,location,description,price,sports,startTiming,endTiming,duration}=req.body.arena;
    const newArena=new Arena({name,location,description,price,sports,startTiming,endTiming,duration});
    newArena.owner=req.user._id;
    newArena.images= req.files.map( f=>( {url:f.path, filename:f.filename}) ); 
    //details of uploaded images(available on req.files thanks to multer) being added to the arena
    
    let {startDate,endDate}=req.body.arena;//dates come from the form as strings
    startDate=createDateObj(startDate);//convert to date objects
    endDate=createDateObj(endDate);
    newArena.startDate=startDate;//store in DB as date objects
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
  const arena=await Arena.findById(req.params.id).populate({path:'bookings', populate:{path:'playerId'}});
  if(!arena){
    req.flash('error', 'Cannot find that arena!');
    return res.redirect('/arenas');
  }

  let today=new Date(); let todayStr=today.toLocaleDateString("en-CA");

  let upcomingBookings=arena.bookings.filter(booking=>booking.date.toLocaleDateString("en-CA")>todayStr).sort((a,b)=>(a.date-b.date));
  let pastBookings=arena.bookings.filter(booking=>booking.date.toLocaleDateString("en-CA")<=todayStr).sort((a,b)=>(a.date-b.date));
  
  return res.render('arenaBookings.ejs', {arena,userId:req.user._id,upcomingBookings,pastBookings});
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
    .put(isLoggedIn, isOwner, uploadingImages, validateEditArenaData, catchAsync(async(req,res)=>{
        const {name,location,description,price,sports,startTiming,endTiming,duration}=req.body.arena;
        let {startDate,endDate}=req.body.arena;
        startDate=createDateObj(startDate);
        endDate=createDateObj(endDate);

        let arena= await Arena.findByIdAndUpdate(req.params.id, {name,location,description,price});
        
        if (!arena){
          req.flash('error', 'Cannot find that arena!');
          return res.redirect('/arenas');
        }
        
        //First Date of Booking cannot be changed to a date earlier than today
        let today=new Date(); today=setMyTime(today); 
        if(startDate.toLocaleDateString!==arena.startDate.toLocaleDateString && startDate.toLocaleDateString<today.toLocaleDateString){
          req.flash('error','First Date of Booking cannot be changed to a date earlier than today!');
          return res.redirect(`/arenas/${arena._id}/edit`);
        }

        let conflictingBookings=findConflictingBookings(arena,sports,startTiming,endTiming,startDate,endDate);
        
        arena.sports=sports;
        arena.startDate=startDate;
        arena.endDate=endDate;
        arena.startTiming=startTiming;
        arena.endTiming=endTiming;
        arena.duration=duration;

        if (req.files.length > 0) {
          const imgs= req.files.map( f=>({url:f.path, filename:f.filename})); 
          arena.images.push(...imgs);
        } 
        await arena.save();

        //removing selected images from the arena; filenames are avbl on req.body.deleteImages[]
        if(req.body.deleteImages){
          //destroy image on cloudinary
          for(let filename of req.body.deleteImages){
            await cloudinary.uploader.destroy(filename);}
          //remove image from arena, directly in db
          await arena.updateOne( {$pull: {images: {filename: {$in: req.body.deleteImages}}}}); 
        }
        
        arena=await Arena.findById(req.params.id);
        //if all existing images were deleted, we add a default image 
        if(arena.images.length===0){
          arena.images.push({
            url:"https://res.cloudinary.com/dvhs0ay92/image/upload/v1649104849/bookmysport/Default_Image_qlhcxb.jpg",
            filename:"bookmysport/Default_Image_qlhcxb"
          });
          await arena.save();
        }
        
        req.flash('success', 'Successfully updated!');
        //if the proposed edit is affecting existing bookings: 
        //Prompt the owner to reveiw these bookings
        if(conflictingBookings.length>0){
          return res.render('bookingsConflicted.ejs', {cBookings:conflictingBookings, arena});
        }
        return res.redirect(`/arenas/${arena._id}`);
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