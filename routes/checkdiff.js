//save edited arena's details
.put(isLoggedIn, isOwner, upload.array('image'), validateArenaData, catchAsync(async(req,res)=>{
    //grab all the new details
    const {name,location,description,price,sports,startTiming,endTiming,duration}=req.body.arena;
    let {startDate,endDate}=req.body.arena;
    startDate=createDateObj(startDate);
    endDate=createDateObj(endDate);
    //find the arena
    let arena= await Arena.findById(req.params.id);

    //Check if there are any bookings for the arena
    let hasBookings= arena.sportBookings.some(sbooking=>sbooking.bookings.length>0);

    if(hasBookings){
    //Then, check if any of the following have been changed: sports,price,start date, enddate, startTiming,endTiming
    let sportsChanged= false;
    let priceChanged=false;
    let startDateChanged=false;
    let endDateChanged=false;
    let startTimingChanged=false;
    let endTimingChanged=false;

    }
     
    //Next, check to see if the changes made are affecting an existing booking(s)
    //PROMPT: cannot save chnages, it interferes with an existing booking
    {name,location,description,price,sports,startTiming,endTiming,duration};
    if (!updatedArena){
      req.flash('error', 'Cannot find that arena!');
      return res.redirect('/arenas');
    }

    
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