const mongoose=require('mongoose');

const bookingSchema= new mongoose.Schema({
    sport:String,
    date: String,
    time: String,
    playerId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
        
    },
    arenaId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Arena'
    },
    
})
module.exports=mongoose.model('Booking',bookingSchema);