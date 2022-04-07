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
      //Then, check if any of the following have been changed: sports,start date, endDate, startTiming,endTiming
      
      //checking if any sport has been removed
      let missingSport=[];
      for(let i=0;i<arena.sports.length;++i){
        if (sports.indexOf(arena.sports[i])===-1){
          missingSport.push(arena.sports[i]);
        }
      }
      console.log(missingSport);
    
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
          console.log("arena.startDate",arena.startDate);
          
          for(let i=0; i<(startDate-arena.startDate)/(1000 * 60 * 60 * 24);++i){
            
            //missingDates should be arena.startDate, +1, +1.... upto startDate-1
            let missedDate=new Date();
            missedDate.setDate(arena.startDate.getDate()+i); //incrementing from arena.startDate
            missedDate.setUTCHours(10);missedDate.setUTCMinutes(0);missedDate.setUTCSeconds(0);
            missedDate.setUTCMilliseconds(0);
            missingDates.push(missedDate);
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
          console.log("arena.endDate",arena.endDate);
          for (let i=1;i<=((arena.endDate-endDate)/(1000 * 60 * 60 * 24));++i){
            let missedDate=new Date();
            missedDate.setDate(endDate.getDate()+i); //incrementing from endDate+1
            missedDate.setUTCHours(10);missedDate.setUTCMinutes(0);missedDate.setUTCSeconds(0);
            missedDate.setUTCMilliseconds(0);
            missingDates.push(missedDate);
          }

        }
      }
      
      console.log(missingDates);

      let missingTimeSlots={start1:-1,start2:-1,end1:-1,end2:-1};
      //missingTimeSlots will exist on new dates
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
          missingTimeSlots.start1=arena.startTiming;
          missingTimeSlots.start2=parseFloat(startTiming)-arena.duration;
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
          missingTimeSlots.end1=parseFloat(endTiming)+arena.duration;
          missingTimeSlots.end2=arena.endTiming;
        }
      }
      console.log(missingTimeSlots);



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