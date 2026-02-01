const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/users/auth/google/callback",
    passReqToCallback: true
},
    async (req, accessToken, refreshToken, profile, done) => {
        try {
            // req.authorize is used if you want to link accounts, but we are doing login/signup
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

            // New User
            // Role is passed in state query param from frontend -> backend -> google -> backend
            // Note: Google Strategy might not persist 'state' automatically in req unless configured or handled.
            // Actually, passport-google-oauth20 handles state validation but getting the value out requires access to req.query.state or similar.
            // However, the callback URL receives the query params.
            // But the strategy verification callback (this function) doesn't get the raw request by default unless passReqToCallback is true.

            // We attempt to get role from the state parameter passed in the initial request
            // The state parameter comes back as a query string in the callback URL.
            // When passReqToCallback is true, the first argument is req.

            let role = 'fleetmanager'; // Default
            if (req.query.state) {
                try {
                    // If we encoded JSON in state, parse it. If it's just a string, use it.
                    // Frontend should send just the role string or specific format.
                    // Let's assume frontend sends state as just the role string for simplicity, or we can look it up in session if we used sessions.
                    // Since this is JWT based stateless config mostly, query param state is best.
                    role = req.query.state;
                } catch (e) {
                    console.error("Error parsing state:", e);
                }
            }

            const newUser = new User({
                googleId: profile.id,
                email: email,
                firstName: profile.name.givenName,
                lastName: profile.name.familyName,
                role: role,
                isVerified: true, // Google emails are verified
                // Password is not set
            });

            await newUser.save();
            done(null, newUser);

        } catch (err) {
            console.error(err);
            done(err, null);
        }
    }));

// We might not need serialize/deserialize if we are not using session cookies,
// but passport might expect them if we initialize it with session support.
// Since we are likely using JWTs, we just want the strategy to verify and return the user.
// We will manually generate JWT in the callback route.
