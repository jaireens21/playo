if(process.env.NODE_ENV!=='production'){
 require('dotenv').config();
}

const express=require('express');
const app=express();
const path=require('path');
const mongoSanitize = require('express-mongo-sanitize'); //preventing mongo injection
const helmet=require('helmet'); //auto setting http headers for security


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
    console.log('connection error:');
    console.log(err);
    //interrogate the error, if it's something you can recover from, let it be.
    //if the exception is fatal, exit with prejudice
    //https://stackoverflow.com/questions/27139289/handle-database-error-when-using-connect-mongo
    
    process.exit(1);
    //exit status code 1 - Uncaught Fatal Exception
    //Node normally exits with a 0 status code 
});

app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(mongoSanitize());
// app.use(helmet({contentSecurityPolicy: false}));

const methodOverride= require('method-override');
app.use(methodOverride('_method'));

const ejsMate=require('ejs-mate');
app.engine('ejs', ejsMate);

app.use(express.static(path.join(__dirname,'/public')));

// initial testing of the connection to DB using mongoose model
// app.get('/makearena', async(req,res)=>{
//     const myarena=new Arena({name:'home',location:'ontario'});
//     await myarena.save();
//     res.send(myarena);
// })

const myError=require('./utils/myError'); //custom error class

const session= require('express-session');
const sessionConfig={
  name:'parleg',
  secret: 'thisshouldbeabettersecret',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    httpOnly:true,// helps mitigate the risk of client side script accessing the protected cookie
    //secure:true, //use when deploying, httpS will be reqd to set cookies
    maxAge: 1000*60*60*24*7,     // cookie expires in a week
  }
}
app.use(session(sessionConfig));
const flash=require('connect-flash');
app.use(flash());

const Arena=require('./models/arena');
const User=require('./models/user');

const passport=require('passport');
const LocalStrategy=require('passport-local');
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req,res,next)=>{
  res.locals.loggedUser=req.user;
  res.locals.success=req.flash('success');
  res.locals.error=req.flash('error');
  next();
});

const arenaRoutes=require('./routes/arenas'); 
const bookingRoutes=require('./routes/bookings');
const userRoutes=require('./routes/users'); 


//ROUTES
app.use('/arenas', arenaRoutes); 
app.use('/arenas/:id/book', bookingRoutes); 
app.use('/', userRoutes); 

app.get('/', (req,res)=>{
  res.render('landing');
})

//catch all for non-existent routes, can handle any request method (get/post/put etc), put after all known routes
app.all('*', (req,res,next)=>{
  next (new myError(404,'Page Not Found!'));
})

//custom error handler
app.use((err,req,res,next)=>{
  //extracting data from error & giving defaults
  const{statusCode=500}=err;
  if(!err.message){err.message='Oh No! Something went wrong';}
  res.status(statusCode).render('error.ejs', {err});
})

app.listen(8080, ()=>{
  console.log('listening on port 8080');
})