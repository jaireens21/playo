const mongoose=require('mongoose');
const arenaSchema= new mongoose.Schema({
    name:String,
    location: String,
    description: String,
    price: {
        type:Number,
        min:0,
    },
    image: String,
    sports:[String],
    timing: String,
    
});

module.exports=mongoose.model('Arena',arenaSchema);