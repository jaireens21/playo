const express=require('express');
const app=express();
const path=require('path');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const mongoose=require('mongoose');
mongoose.connect('mongodb://localhost:27017/playo',{
    useNewUrlParser: true, 
    useUnifiedTopology: true 
})
.then(()=>{
    console.log('Database connected');  
})
.catch( (err)=>{
    console.log("connection error:");
    console.log(err);
});

const Arena=require('./models/arena');



// testing the connection to DB using mongoose model
// app.get('/makearena', async(req,res)=>{
//     const myarena=new Arena({name:'home',location:'ontario'});
//     await myarena.save();
//     res.send(myarena);
// })


app.get("/", (req,res)=>{
    res.send("hello from playo");
})

app.get("/home", (req,res)=>{
    res.render('home');
})

app.get("/list", async(req,res)=>{
    let allArenas=await Arena.find({});
    res.render('list', {allArenas});
})


app.listen(8080, ()=>{
    console.log("listening on port 8080");
})