function findConflictingBookings(arena,sports,startTiming,endTiming,startDate,endDate){
    
    function setMyTime(obj){
        obj.setUTCHours(10); 
        obj.setUTCMinutes(0); 
        obj.setUTCSeconds(0); 
        obj.setUTCMilliseconds(0);
        return obj;
    }

    let missingDates=[];
    let commonDates=[];

    let oldDates=[];
    for (let i=0;i<=((arena.endDate- arena.startDate)/(1000 * 60 * 60 * 24));++i){
        let aDate=new Date(arena.startDate.toLocaleDateString("en-CA"));
        aDate.setDate(aDate.getDate()+i); //incrementing from arena.startDate
        aDate=setMyTime(aDate);
        oldDates.push(aDate.toLocaleDateString("en-CA"));
    }

    let newDates=[];
    for (let i=0;i<=((endDate-startDate)/(1000 * 60 * 60 * 24));++i){
        let bDate=new Date(startDate.toLocaleDateString("en-CA"));
        bDate.setDate(bDate.getDate()+i); //incrementing from startDate
        bDate=setMyTime(bDate);
        newDates.push(bDate.toLocaleDateString("en-CA"));
    }

    console.log('old dates:',oldDates,'new dates:', newDates);

    newDates.forEach(newDt=>{
        if(oldDates.indexOf(newDt)!==-1){
        commonDates.push(newDt);
        }
    });
    console.log('commonDates', commonDates);

    if(commonDates.length>0){
        oldDates.forEach(oldDt=>{
        if(commonDates.indexOf(oldDt)===-1){
            missingDates.push(oldDt);
        }
        })
    }
    console.log('missingDates', missingDates);

    let conflictingBookings=[];

    //conflicting bookings on missing dates (for all sports, all timings)
    if(missingDates.length>0){
        arena.sportBookings.forEach(sbooking=>{
        sbooking.bookings.forEach(bkng=>{
            if(missingDates.indexOf(bkng.date.toLocaleDateString("en-CA"))!==-1){
            conflictingBookings.push({date:bkng.date,time:bkng.time,sport:sbooking.sport});
            }
        });
        })
    }
    console.log("conflictingBookings due to missing dates",conflictingBookings);

    //now look for bookings on common dates that might get affected due to change of timings/removal of a sport
    if(commonDates.length>0){
        let start1=undefined; let start2=undefined; let end1=undefined; let end2=undefined;
        //missingTimeSlots will exist on COMMON dates (dates that are common in old & new date ranges)
        //start1 to start2 - range of missing times due to change in startTiming
        //end1 to end2- range of missing times due to change in endTiming

        //check if startTiming has changed
        if(parseFloat(startTiming)>arena.startTiming) {
        //there is missing time, from arena.startTiming till startTiming-arena.duration.
        //NOTE: using OLD duration (arena.duration) since we will look for EXISTING bookings
        start1=arena.startTiming;
        start2=parseFloat(startTiming)-arena.duration;
        }
        
        //check if endTiming has changed
        if(parseFloat(endTiming)<arena.endTiming) {
        //there is missing time, from endTiming+arena.duration till arena.endTiming.
        //NOTE: using OLD duration (arena.duration) since we will look for EXISTING bookings
        end1=parseFloat(endTiming)+arena.duration;
        end2=arena.endTiming;
        }
        
        console.log('start-endtimes',start1,start2,end1,end2);
        
        if (start1){
        //find bookings on common dates, in the time between start1 to start2 
        arena.sportBookings.forEach(sbooking=>{
            sbooking.bookings.forEach(bkng=>{
            if(commonDates.indexOf(bkng.date.toLocaleDateString("en-CA"))!==-1){
                if(bkng.time>=start1 && bkng.time<=start2){
                conflictingBookings.push({date:bkng.date,time:bkng.time,sport:sbooking.sport});
                }
            }
            });
        })
        }
        console.log("added conflictingBookings due to start time",conflictingBookings);
        if (end1){
        //find bookings on common dates, in the time between end1 to end2
        arena.sportBookings.forEach(sbooking=>{
            sbooking.bookings.forEach(bkng=>{
            if(commonDates.indexOf(bkng.date.toLocaleDateString("en-CA"))!==-1){
                if(bkng.time>=end1 && bkng.time<=end2){
                conflictingBookings.push({date:bkng.date,time:bkng.time,sport:sbooking.sport});
                }
            }
            });
        })
        }
        console.log("added conflictingBookings due to end time",conflictingBookings);
        
        //if a sport has been removed, common dates may have bookings that get affected

        //checking if any sport has been removed
        let missingSports=[];
        for(let i=0;i<arena.sports.length;++i){
        if (sports.indexOf(arena.sports[i])===-1){
            missingSports.push(arena.sports[i]);
        }
        }
        console.log('missingSports',missingSports);

        //look for bookings for missing sports on common dates
        if(missingSports.length>0){
        arena.sportBookings.forEach(sbooking=>{
            if(missingSports.indexOf(sbooking.sport)!==-1){
            //find the bookings for the missing sport
            if(sbooking.bookings.length>0){
                sbooking.bookings.forEach(bkng=>{
                //filter out booking that falls on a common date
                if(commonDates.indexOf(bkng.date.toLocaleDateString("en-CA"))!==-1){
                    conflictingBookings.push({date:bkng.date,time:bkng.time,sport:sbooking.sport});
                }
                });
            }else{ //if there are no bookings for the removed sport
                //remove the corrsponding sbooking from sportBookings array
                //delete sbooking;
                console.log("need to delete empty arrays of sportBookings");
            }
            }
        })
        }
        
    }
    console.log("added conflictingBookings due to missing sport",conflictingBookings);
    

    conflictingBookings.sort((a,b)=>(a.date-b.date));
    console.log("sorted conflictingBookings",conflictingBookings);
    return conflictingBookings;

}

module.exports= findConflictingBookings;