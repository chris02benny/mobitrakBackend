const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/api/users/auth/google/callback",
        passReqToCallback: true
    },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                // Check if user already exists
                let user = await User.findOne({ googleId: profile.id });

                if (user) {
                    return done(null, user);
                }

                // Check if user exists by email
                const email = profile.emails[0].value;
                user = await User.findOne({ email });

                if (user) {
                    // Link google account to existing email account
                    user.googleId = profile.id;
                    await user.save();
                    return done(null, user);
                }

                // New User logic
                let role = 'fleetmanager'; // Default
                if (req.query.state) {
                    role = req.query.state;
                }

                const newUser = new User({
                    googleId: profile.id,
                    email: email,
                    firstName: profile.name.givenName,
                    lastName: profile.name.familyName,
                    role: role,
                    isVerified: true, // Google emails are verified
                });

                await newUser.save();
                done(null, newUser);

            } catch (err) {
                console.error(err);
                done(err, null);
            }
        }));
} else {
    console.warn('[Passport] Google OAuth credentials missing. Google login will be disabled.');
}

// We might not need serialize/deserialize if we are not using session cookies,
// but passport might expect them if we initialize it with session support.
// Since we are likely using JWTs, we just want the strategy to verify and return the user.
// We will manually generate JWT in the callback route.
