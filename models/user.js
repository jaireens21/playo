const mongoose=require('mongoose');
const passportLocalMongoose=require('passport-local-mongoose');

const UserSchema=new mongoose.Schema({
    email:{
        type:String,
        required:true,
        //'required' makes sure that the instance will NOT be created without this information
    },
    role:{
        type:String,
        required:true
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date
});

UserSchema.plugin(passportLocalMongoose);
//Passport-Local Mongoose will add a username, hash and salt field to store the username, the hashed password and the salt value.


module.exports=mongoose.model('User', UserSchema);
