if(process.env.NODE_ENV!=='production'){
 require('dotenv').config();
//  so we can use variables stored in .env file
}

const express=require('express');
const app=express();
const path=require('path');
const mongoSanitize = require('express-mongo-sanitize'); //preventing mongo injection
// const helmet=require('helmet'); //auto setting http headers for security

app.set('view engine', 'ejs');//use EJS as templating engine 
app.set('views', path.join(__dirname, 'views'));

const mongoose=require('mongoose'); //to define the structure of data in mongoDB
const dbUrl='mongodb://localhost:27017/playo'; //connecting to local mongo DB
// const dbUrl=process.env.DB_URL; //connecting to atlas (cloud mongo db)
// const dbUrl=process.env.DB_URL || 'mongodb://localhost:27017/playo';
mongoose.connect(dbUrl,{
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

app.use(express.urlencoded({extended:true}));//parses incoming urlencoded requests
app.use(express.json()); //parses incoming JSON requests 
app.use(mongoSanitize());
// app.use(helmet({contentSecurityPolicy: false}));

const methodOverride= require('method-override');//to be able to set methods for forms such as put,delete that are not otherwise supported
app.use(methodOverride('_method'));

const ejsMate=require('ejs-mate');//for layout, partial and block template functions for EJS
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
const MongoDBStore=require('connect-mongo');//using mongo session store
const secret=process.env.SECRET;
const sessionConfig={
  //using mongoDB for session store
  store:MongoDBStore.create({ 
    mongoUrl:dbUrl, 
    touchAfter: 24*60*60, //Lazy session update , time in seconds
  }),
   
  name:'parleg', //changing cookie name from connect.ssid
  secret,
  resave: false, //don't save session if unmodified
  saveUninitialized: true,
  cookie: { 
    httpOnly:true,// helps mitigate the risk of client side script accessing the protected cookie
    //secure:true, //use when deploying, httpS will be reqd to set cookies
    expires: Date.now() + (1000*60*60*24*7), //cookie will expire after a week (in milliseconds)
    maxAge: 1000*60*60*24*7,     // cookie expires in a week
  }
}
app.use(session(sessionConfig));
const flash=require('connect-flash');//to flash messages, uses session
app.use(flash());

const Arena=require('./models/arena');
const User=require('./models/user');

const passport=require('passport'); //for authentication
const LocalStrategy=require('passport-local');
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req,res,next)=>{
  //defining variables on res.locals so that template files (.ejs files,rendered with res.render) have access to them
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

const port=process.env.PORT || 8080;

app.listen(port, ()=>{
  console.log(`listening on port ${port}`);
})