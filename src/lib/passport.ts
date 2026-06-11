import passport from 'passport'
import { Strategy as GoogleStrategy, type Profile } from 'passport-google-oauth20'
import { config } from '../config'
import { authService } from '../modules/auth/auth.service'

const googleConfigured =
  Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET)

if (googleConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
        callbackURL: config.GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email'],
      },
      async (_accessToken, _refreshToken, profile: Profile, done) => {
        try {
          const email = profile.emails?.[0]?.value
          if (!email) {
            return done(new Error('No email from Google'), undefined)
          }

          const user = await authService.findOrCreateGoogleUser({
            googleId: profile.id,
            email,
            name: profile.displayName || email.split('@')[0] || 'User',
            avatarUrl: profile.photos?.[0]?.value,
          })

          done(null, user)
        } catch (err) {
          done(err as Error, undefined)
        }
      },
    ),
  )
}

export { passport, googleConfigured }
