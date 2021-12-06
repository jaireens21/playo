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

const Arena=require('../models/arena');
const {part1, part2}=require('./names');
const cities=require('./cities');

const seedDB=async()=>{
    await Arena.deleteMany({});//clear the DB collection

    
    for (let i=0;i<10;++i){
        
        const myarena=new Arena({name:`${part1[Math.floor(Math.random()*part1.length)]} ${part2[Math.floor(Math.random()*part2.length)]}`,location:`${cities[Math.floor(Math.random()*cities.length)]}`});
        await myarena.save();
    }
    console.log('seeded!');
}
seedDB().then(()=>{
    mongoose.connection.close();  
});
