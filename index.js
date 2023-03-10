const express = require("express");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const mongoose = require("mongoose");
const session = require("express-session");
const jwt = require("jsonwebtoken");
const app = express();
const { EmailClient } = require("@azure/communication-email");

const connectionString = `endpoint=https://super-ai-communication-service.communication.azure.com/;accesskey=lGYyqd0n7dXJe/jny3+BaCo7LfQeGMbjQNpA6S0Kdw3K9j1upfZcH7uBV/KqjfMBSitfie3I/jSdd7MKjJYEBg==`;
const emailClient = new EmailClient(connectionString);

// Connect to MongoDB
mongoose
  .connect(
    "mongodb+srv://a2v10:GetSuperAi@cluster0.9rlv7un.mongodb.net/GetSuperAI"
  )
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err);
  });

// Define user schema
const userSchema = new mongoose.Schema({
  googleId: String,
  displayName: String,
  email: String,
  registrationNumber: Number,
});

// Define user model
const User = mongoose.model("User", userSchema);

// Configure Google OAuth2 strategy
passport.use(
  new GoogleStrategy(
    {
      clientID:
        "998724752508-v80j6rb3ll5q0kjb7dgfg8p6i304076n.apps.googleusercontent.com",
      clientSecret: "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",
      callbackURL: "https://get-super-api.onrender.com/auth/google/redirect",
    },
    async (accessToken, refreshToken, profile, cb) => {
      // Check if user already exists in database
      const existingUser = await User.findOne({ googleId: profile.id });
      if (existingUser) {
        return cb(null, existingUser);
      }
      const count = await User.countDocuments();
      const registrationNumber = count + 1015;
      // Create new user if not found in database
      const newUser = new User({
        googleId: profile.id,
        displayName: profile.displayName,
        email: profile.emails[0].value,
        registrationNumber,
      });
      await newUser.save();
      cb(null, newUser);
    }
  )
);

// Serialize and deserialize user object
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then((user) => {
      done(null, user);
    })
    .catch((err) => {
      done(err);
    });
});

// Use middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "getSuperAI",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  next();
});

// Define routes
app.get("/", (req, res) => {
  res.send("Welcome to my app!");
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/redirect",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    // Successful authentication, generate JWT
    const token = jwt.sign(
      {
        email: req.user.email,
        registrationNumber: req.user.registrationNumber,
      },
      "getSuperAI",
      {
        expiresIn: "1h",
      }
    );
    sendRegistrationMail(req.user.email, req.user.registrationNumber);

    // Redirect to frontend with token appended to URL
    const redirectUrl = `https://getsuper.ai/waitlist/?token=${token}`;
    res.redirect(redirectUrl);
  }
);

app.post("/signup", async (req, res, next) => {
  const { name, email, password } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({ message: "User already exists" });
  }

  // Hash password
  // const salt = await bcrypt.genSalt(10);
  // const hashedPassword = await bcrypt.hash(password, salt);
  const count = await User.countDocuments();
  const registrationNumber = count + 1015;
  // Create new user
  const newUser = new User({
    name,
    email,
    password: password,
    registrationNumber,
  });

  // Save user to database
  try {
    await newUser.save();
    sendRegistrationMail(newUser.email, newUser.registrationNumber);

    // Log the user in and store their information in a session
    req.logIn(newUser, (err) => {
      if (err) return next(err);
      req.session.passport.user = { id: newUser.id, name: newUser.name };
      // Generate JWT
      const token = jwt.sign(
        {
          email: newUser.email,
          registrationNumber: newUser.registrationNumber,
        },
        "getSuperAI",
        {
          expiresIn: "1h",
        }
      );
      res.status(201).json(token);
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

async function sendRegistrationMail(receiversEmail, regNo) {
  try {
    // Send email code
    emailMessage = {
      sender: "DoNotReply@510c7a9e-c41a-456f-ae69-9a3de9b0954c.azurecomm.net",
      content: {
        subject: `Super Ai Waitlist Confirmation`,
        // plainText: `${ConvertHtmlToPlaintext(emailBodyHtml)}`,
        plainText: `You have sucessfully joined the Super AI Waitlist, Your registration no is #${regNo}`,
      },
      recipients: {
        to: [
          {
            email: receiversEmail,
            displayName: "",
          },
        ],
      },
    };
    const response = await emailClient.send(emailMessage);
  } catch (e) {
    console.log(e);
  }
}

// Start server
app.listen(8000, () => {
  console.log("Server started on port 3000");
});
