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
        let arena= await Arena.findByIdAndUpdate(req.params.id, {name,location,description,price,sports,startTiming,endTiming,duration});
        if (!arena){
          req.flash('error', 'Cannot find that arena!');
          return res.redirect('/arenas');
        }
        let {startDate,endDate}=req.body.arena;
        startDate=createDateObj(startDate);
        endDate=createDateObj(endDate);
        

        let missingDates=[];
      
        //if startDate has changed
        if(startDate.toDateString()!==arena.startDate.toDateString()){
          if(startDate>arena.endDate){
            //opening new slots, no overlaps
            console.log("opening new slots! All OK.")
          }
          else if(startDate<arena.startDate){
            //opening more slots
            //just make sure startDate is not earlier than today
            let today=new Date();today.setUTCHours(10); today.setUTCMinutes(0); today.setUTCSeconds(0); today.setUTCMilliseconds(0);
            if(startDate<today){ 
              req.flash('error','start Date cannot be earlier than today!'); 
              res.redirect(`/arenas/${arena._id}/edit`);
            }
          }
          else {
            // arena.startDate < startDate <= arena.endDate
            //there are missing dates, from arena.startDate upto startDate
            //number of missing days= (startDate-arena.startDate)/(1000 * 60 * 60 * 24)
            console.log("startDate",startDate);
            console.log("arena startDate",arena.startDate);
            
            for(let i=0; i<(startDate-arena.startDate)/(1000 * 60 * 60 * 24);++i){
              
              //missingDates should be arena.startDate, +1, +1.... upto startDate-1
              let missedDate=new Date();
              missedDate.setDate(arena.startDate.getDate()+i); //incrementing from arena.startDate
              missedDate.setUTCHours(10);missedDate.setUTCMinutes(0);missedDate.setUTCSeconds(0);
              missedDate.setUTCMilliseconds(0);
              missingDates.push(missedDate.toLocaleDateString("en-CA"));
              //saving as a string so that equality can be checked later on
            }
          }
        }
        //if endDate has changed
        if(endDate.toDateString()!==arena.endDate.toDateString()){
          if(endDate>arena.endDate){
            //opening new slots, no overlaps
            console.log("opening new slots! All OK.")
          }
          //if(endDate<arena.startDate){
            //opening an earlier slot- make sure it is not earlier than today
            //since startDate cannot be earlier than today & endDate has to be later than startDate
            //so this is already taken care of.}

          else if (endDate<arena.endDate){
            //there are missing dates, from endDate+1 upto arena.endDate
            //no. of missing days= (arena.endDate-endDate)/(1000 * 60 * 60 * 24)
            console.log("endDate",endDate);
            console.log("arena endDate",arena.endDate);
            for (let i=1;i<=((arena.endDate-endDate)/(1000 * 60 * 60 * 24));++i){
              let missedDate=new Date();
              missedDate.setDate(endDate.getDate()+i); //incrementing from endDate+1
              missedDate.setUTCHours(10);missedDate.setUTCMinutes(0);missedDate.setUTCSeconds(0);
              missedDate.setUTCMilliseconds(0);
              console.log("missed date",missedDate);
              missingDates.push(missedDate.toLocaleDateString("en-CA"));
              //saving as a string so that equality can be checked later on
            }

          }
        }
        
        console.log("missingDates",missingDates);

        let conflictingBookings=[];

        //conflicting bookings on dates that have now been closed (for all sports, all timings)
        if(missingDates.length>0){
          arena.sportBookings.forEach(sbooking=>{
            sbooking.bookings.forEach(bkng=>{
              if(missingDates.indexOf(bkng.date.toLocaleDateString("en-CA"))!==-1){
                conflictingBookings.push({date:bkng.date,time:bkng.time,sport:sbooking.sport});
              }
            });
          })
        }

        //there might be bookings in the time range which is now closed
        //this will happen on dates that are common between old dates & new dates
        //find these common dates:
        let oldDates=[];
        for (let i=0;i<((arena.startDate-arena.endDate)/(1000 * 60 * 60 * 24));++i){
          let aDate=new Date();
          aDate.setDate(arena.startDate.getDate()+i); //incrementing from arena.startDate
          aDate.setUTCHours(10);aDate.setUTCMinutes(0);aDate.setUTCSeconds(0);aDate.setUTCMilliseconds(0);
          oldDates.push(aDate.toLocaleDateString("en-CA"));
        }
        let newDates=[];
        for (let i=0;i<((startDate-endDate)/(1000 * 60 * 60 * 24));++i){
          let aDate=new Date();
          aDate.setDate(startDate.getDate()+i); //incrementing from startDate
          aDate.setUTCHours(10);aDate.setUTCMinutes(0);aDate.setUTCSeconds(0);aDate.setUTCMilliseconds(0);
          newDates.push(aDate.toLocaleDateString("en-CA"));
        }
        let commonDates=[];
        newDates.forEach(newDt=>{
          if(oldDates.indexOf(newDt)!==-1){
            commonDates.push(newDt);
          }
        });
        console.log('commonDates', commonDates);

        //now look for bookings on these common dates that might get affected due to change of timings/removal of a sport
        if(commonDates.length>0){
          let start1=undefined; let start2=undefined; let end1=undefined; let end2=undefined;
          //missingTimeSlots will exist on OVERLAPPING dates (dates that are common in old & new date ranges)
          //start1 to start2 - range of missing times due to change in startTiming
          //end1 to end2- range of missing times due to change in endTiming

          //check if startTiming has changed
          if(parseFloat(startTiming)!==arena.startTiming){
            if(parseFloat(startTiming)<arena.startTiming){
              console.log("opening more slots! all OK");
            }
            else if(parseFloat(startTiming)>arena.startTiming) {
              //there is time that is missing, from arena.startTiming till startTiming-arena.duration.
              //NOTE: using OLD duration (arena.duration) since we will look for EXISTING bookings
              start1=arena.startTiming;
              start2=parseFloat(startTiming)-arena.duration;
            }
          }
          //check if endTiming has changed
          if(parseFloat(endTiming)!==arena.endTiming){
            if(parseFloat(endTiming)>arena.endTiming){
              console.log("opening more slots! all OK");
            }
            else if(parseFloat(endTiming)<arena.endTiming) {
              //there is missing time, from endTiming+arena.duration till arena.endTiming.
              //NOTE: using OLD duration (arena.duration) since we will look for EXISTING bookings
              end1=parseFloat(endTiming)+arena.duration;
              end2=arena.endTiming;
            }
          }
          console.log('start-endtimes',start1,start2,end1,end2);
          
          if (start1){
            //find bookings on common dates, in the time between start1 to start2 
            arena.sportBookings.forEach(sbooking=>{
              sbooking.bookings.forEach(bkng=>{
                if(commonDates.indexOf(bkng.date.toLocaleDateString("en-CA"))!==-1){
                  if(bkng.time>=start1 || bkng.time<=start2){
                    conflictingBookings.push({date:bkng.date,time:bkng.time,sport:sbooking.sport});
                  }
                }
              });
            })
          }
          if (end1){
            //find bookings on common dates, in the time between end1 to end2
            arena.sportBookings.forEach(sbooking=>{
              sbooking.bookings.forEach(bkng=>{
                if(commonDates.indexOf(bkng.date.toLocaleDateString("en-CA"))!==-1){
                  if(bkng.time>=end1 || bkng.time<=end2){
                    conflictingBookings.push({date:bkng.date,time:bkng.time,sport:sbooking.sport});
                  }
                }
              });
            })
          }
          
          //if a sport has been removed, common dates may have bookings that get affected

          //checking if any sport has been removed
          let missingSport=[];
          for(let i=0;i<arena.sports.length;++i){
            if (sports.indexOf(arena.sports[i])===-1){
              missingSport.push(arena.sports[i]);
            }
          }
          console.log('missingSport',missingSport);
          //look for bookings for missing sport on common dates
          if(missingSport.length>0){
            arena.sportBookings.forEach(sbooking=>{
              if(missingSport.indexOf(sbooking.sport)!==-1){
                //find the bookings for the missing sport
                sbooking.bookings.forEach(bkng=>{
                  //filter out booking that falls on a common date
                  if(commonDates.indexOf(bkng.date.toLocaleDateString("en-CA"))!==-1){
                    conflictingBookings.push({date:bkng.date,time:bkng.time,sport:sbooking.sport});
                  }
                });
              }
            })
          }
        }


        console.log("conflictingBookings",conflictingBookings);


        
        arena.startDate=startDate;
        arena.endDate=endDate;
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