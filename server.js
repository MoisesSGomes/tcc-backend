import express from 'express'
import { fileURLToPath } from 'url'
import path from 'path'
import publicRoutes from './routes/public.js'
import privateRoutes from './routes/private.js'
import passwordResetRoutes from './routes/passwordReset.js'
import emailVerificationRoutes from './routes/emailVerification.js'
import auth from './middlewares/auth.js'
import cors from 'cors'
import dotenv from 'dotenv'
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
      scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("Google profile data:", {
          id: profile.id,
          emails: profile.emails,
          photos: profile.photos,
          displayName: profile.displayName
        });

        const profileImageUrl = profile.photos && profile.photos.length > 0
          ? profile.photos[0].value
          : null;

        console.log("Profile image URL:", profileImageUrl);

        let user = await prisma.user.findUnique({
          where: { email: profile.emails[0].value }
        });

        if (!user) {
          
          user = await prisma.user.create({
            data: {
              email: profile.emails[0].value,
              name: profile.name?.givenName || profile.displayName.split(' ')[0],
              lastName: profile.name?.familyName || profile.displayName.split(' ').slice(1).join(' '),
              password: '', 
              verified: true, 
              googleId: profile.id,
              image: profileImageUrl ? {
                path: profileImageUrl,
                filename: `google_${profile.id}`
              } : undefined
            }
          });
        } else {
          
          const updateData = {
            googleId: profile.id
          };

          if (profileImageUrl && (!user.image || !user.image.path.startsWith('http'))) {
            updateData.image = {
              path: profileImageUrl,
              filename: `google_${profile.id}`
            };
          }

          user = await prisma.user.update({
            where: { id: user.id },
            data: updateData
          });
        }

        console.log("User after save:", user);
        return done(null, user);
      } catch (error) {
        console.error("Error in Google auth strategy:", error);
        return done(error);
      }
    }
  )
);

dotenv.config()

const app = express()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.use('/assets', express.static(path.join(__dirname, 'assets')))

app.use(express.json())
app.use(cors())

app.use(passport.initialize());

app.use('/', publicRoutes)
app.use('/', passwordResetRoutes)
app.use('/', emailVerificationRoutes)
app.use('/', auth, privateRoutes)

app.listen(3000, () => {
  console.log("Servidor rodando")
})

