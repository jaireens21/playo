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

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const methodOverride= require('method-override');
app.use(methodOverride('_method'));

const ejsMate=require('ejs-mate');
app.engine('ejs', ejsMate);


// testing the connection to DB using mongoose model
// app.get('/makearena', async(req,res)=>{
//     const myarena=new Arena({name:'home',location:'ontario'});
//     await myarena.save();
//     res.send(myarena);
// })

app.get("/", (req,res)=>{
  res.render('home');
})

app.get("/arenas", (req,res)=>{
  res.render('arenas');
})



//list page showing all arenas
app.get("/arenas/list", async(req,res)=>{
  // searching for an arena (name or location)
  let noMatch = null; let sstring="";
  if (req.query.search) {
    sstring=req.query.search;
    Arena.find({}, function(err, allArenas) {
      if (err) {
        console.log(err);
      } else {
            let regex=new RegExp(req.query.search, 'gi');
            let result = allArenas.filter(place=> (place.name.match(regex)||place.location.match(regex)));
            
            if (result.length < 1) {
            noMatch = req.query.search;
            }
            res.render("list.ejs", {allArenas: result, noMatch,sstring});
        }
    });
 } else {
        Arena.find({}, function(err, allArenas) {
          if (err) {
            console.log(err);
          } else {
              
            res.render("list.ejs", {allArenas,noMatch,sstring});
          }
        });
    }
})

//get a form to add new arena
app.get('/arenas/new', (req,res)=>{
  res.render('new.ejs');
  })

//show page for every arena
app.get('/arenas/:id', async(req,res)=>{
  const arena=await Arena.findById(req.params.id);
  res.render('show.ejs', {arena});
})

//submitting new arena details to DB
app.post('/arenas', async(req,res)=>{
  const newArena=new Arena(req.body.arena);
  await newArena.save();
  res.redirect('/arenas/list');
})

//serving edit form for an arena
app.get('/arenas/:id/edit', async(req,res)=>{
  const foundArena=await Arena.findById(req.params.id);
  res.render('edit.ejs', {arena:foundArena});
})


//submitting the edit form's details to DB
app.put('/arenas/:id', async(req,res)=>{
  const updatedArena= await Arena.findByIdAndUpdate(req.params.id, req.body.arena);
  res.redirect(`/arenas/${updatedArena._id}`);
})

//deleting an arena
app.delete('/arenas/:id', async(req,res)=>{
  const deletedArena=await Arena.findByIdAndDelete(req.params.id);
  res.redirect('/arenas/list');
})


app.listen(8080, ()=>{
    console.log("listening on port 8080");
})