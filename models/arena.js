const mongoose=require('mongoose');
const arenaSchema= new mongoose.Schema({
    name:String,
    location: String,
    description: String,
    sports:{
        type:String,
        enum:['Badminton','Football','Ice Hockey']
    },
    price: {
        type:Number,
        min:0,
    },
    timing: String,
    image: String,
    
});

module.exports=mongoose.model('Arena',arenaSchema);