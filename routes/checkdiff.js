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
            let missedDate=new Date(arena.startDate.toLocaleDateString("en-CA"));
            missedDate.setDate(arena.startDate.getUTCDate()+i); //incrementing from arena.startDate
            missedDate.setUTCHours(10);missedDate.setUTCMinutes(0);missedDate.setUTCSeconds(0);
            missedDate.setUTCMilliseconds(0);
            missingDates.push(missedDate.toLocaleDateString("en-CA"));
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
            let missedDate=new Date(endDate.toLocaleDateString("en-CA"));
            missedDate.setDate(endDate.getUTCDate()+i); //incrementing from endDate+1
            missedDate.setUTCHours(10);missedDate.setUTCMinutes(0);missedDate.setUTCSeconds(0);
            missedDate.setUTCMilliseconds(0);
            missingDates.push(missedDate.toLocaleDateString("en-CA"));
          }

        }
      }
      
      console.log(missingDates);

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
      })
      console.log('commonDates', commonDates);

      //now look for bookings on these common dates that might get affected due to change of timings
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