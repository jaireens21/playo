const mongoose=require('mongoose');
const { cloudinary } = require('../cloudinary');

const ImageSchema= new mongoose.Schema({
    url: String,
    filename: String
});

//a virtual to crop images to similar sizes using cloudinary to show on arena page
ImageSchema.virtual('aspectratio').get(function(){
    return this.url.replace('/upload', '/upload/b_black,c_pad,ar_16:9');
});  
//for edit page
ImageSchema.virtual('cropped').get(function(){
    return this.url.replace('/upload', '/upload/c_thumb,ar_4:3');
});  


const opts={ toJSON: {virtuals:true}};


const arenaSchema= new mongoose.Schema({
    name:String,
    location: String,
    description: String,
    price: {
        type:Number,
        min:0,
    },
    images: [ImageSchema],  //an array of objects, each with url & filename
    sports:[String],
    sportBookings:[
        {   sport:String, 
            bookings:[
                {   date:Date, 
                    time:Number, 
                    playerId:{
                        type:mongoose.Schema.Types.ObjectId,
                        ref:'User'
                    },
                    // _id: false,
                }
            ],
            _id: false,
        }
    ],
    startTiming: Number,
    endTiming: Number,
    startDate:Date,
    endDate:Date,
    owner: {
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    
}, opts);

//define a mongoose middleware to delete associated images from cloudianry when an arena is deleted
arenaSchema.post('findOneAndDelete', async function(doc){
    if(doc){  //if we have actually found & deleted an arena
        
        //deleting related images from cloudinary
        if(doc.images){
            for (let img of doc.images)
            await cloudinary.uploader.destroy(img.filename);
        }
    }
})

module.exports=mongoose.model('Arena',arenaSchema);