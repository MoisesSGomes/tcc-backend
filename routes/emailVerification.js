import express from 'express'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import nodemailer from 'nodemailer'

const router = express.Router()
const prisma = new PrismaClient()

// Configura o transporter do NodeMailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
})

router.post('/cadastro', async (req, res) => {
    try {
        const user = req.body

        const existingUser = await prisma.user.findUnique({
            where: { email: user.email }
        })

        if (existingUser) {
            return res.status(400).json({ message: "Este email já está registrado" })
        }

        const salt = await bcrypt.genSalt(10)
        const hashPassword = await bcrypt.hash(user.password, salt)

        const verificationToken = crypto.randomBytes(32).toString('hex')
        const verificationTokenExpires = new Date(Date.now() + 3600000)

        const userDB = await prisma.user.create({
            data: {
                email: user.email,
                name: user.name,
                password: hashPassword,
                verificationToken: verificationToken,
                verificationTokenExpires: verificationTokenExpires,
                verified: false
            }
        })

        const verificationUrl = new URL(`/verificar-email/${verificationToken}`, process.env.FRONTEND_URL).toString()

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Verificação de email - Let\'s Go Party',
            html: `
                    <h1>Verificação de email</h1>
                    <p>Olá ${user.name},</p>
                    <p>Obrigado por se cadastrar! Para completar seu registro, clique no link abaixo ou copie e cole no seu navegador:</p>
                    <p><a href="${verificationUrl}" target="_blank">${verificationUrl}</a></p>
                    <p>Este link permite que você ative sua conta na Let's Go Party.</p>
                    <p>Se você não se cadastrou em nosso site, por favor, ignore este email.</p>
                    <p>Atenciosamente,<br>Equipe Let's Go Party</p>
                `
        }

        await transporter.sendMail(mailOptions)

        res.status(201).json({ message: "Usuário cadastrado com sucesso. Por favor, verifique seu email para ativar sua conta." })
    } catch (err) {
        console.error('Erro no cadastro:', err)
        res.status(500).json({ message: "Erro no servidor, tente novamente mais tarde" })
    }
})


router.get('/verificar-email/:token', async (req, res) => {
    try {
        const { token } = req.params

        const user = await prisma.user.findFirst({
            where: { verificationToken: token }
        })

        if (!user) {
            
            const verifiedUser = await prisma.user.findFirst({
                where: {
                    verified: true,
                    
                }
            })
            if (verifiedUser) {
                return res.status(200).json({ message: "Email verificado com sucesso!" })
            }
            return res.status(400).json({ message: "Token inválido ou já utilizado." })
        }

        if (user.verificationTokenExpires && user.verificationTokenExpires < new Date()) {
            return res.status(400).json({ message: "Token expirado. Solicite novo link." })
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                verified: true,
                verificationToken: null,
                verificationTokenExpires: null
            }
        })

        res.status(200).json({ message: "Email verificado com sucesso!" })
    } catch (err) {
        console.error('Erro ao verificar email:', err)
        res.status(500).json({ message: "Erro no servidor, tente novamente mais tarde" })
    }
})



// Rota para reenviar o email de verificação
router.post('/reenviar-verificacao', async (req, res) => {
    try {
        const { email } = req.body

        const user = await prisma.user.findUnique({
            where: { email }
        })

        if (!user) {
            
            return res.status(200).json({
                message: "Se o email estiver cadastrado, enviaremos um novo link de verificação."
            })
        }

        // Se o usuário já está verificado
        if (user.verified) {
            return res.status(200).json({
                message: "Este email já foi verificado. Você pode fazer login normalmente."
            })
        }

        // Gera novo token de verificação
        const verificationToken = crypto.randomBytes(32).toString('hex')
        const verificationTokenExpires = new Date(Date.now() + 3600000)

        // Atualiza o token no banco de dados
        await prisma.user.update({
            where: { id: user.id },
            data: {
                verificationToken: verificationToken,
                verificationTokenExpires: verificationTokenExpires
            }
        })

        // Envia email de verificação
        const verificationUrl = new URL(`/verificar-email/${verificationToken}`, process.env.FRONTEND_URL).toString()

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Verificação de email - Let\'s Go Party',
            html: `
                <h1>Verificação de email</h1>
                <p>Olá ${user.name},</p>
                <p>Você solicitou um novo link de verificação. Para ativar sua conta, clique no link abaixo ou copie e cole no seu navegador:</p>
                <p><a href="${verificationUrl}" target="_blank">${verificationUrl}</a></p>
                <p>Este link permite que você ative sua conta na Let's Go Party.</p>
                <p>Se você não solicitou esta verificação, por favor, ignore este email.</p>
                <p>Atenciosamente,<br>Equipe Let's Go Party</p>
            `
        }

        await transporter.sendMail(mailOptions)

        res.status(200).json({
            message: "Se o email estiver cadastrado, enviaremos um novo link de verificação."
        })
    } catch (err) {
        console.error('Erro ao reenviar verificação:', err)
        res.status(500).json({ message: "Erro no servidor, tente novamente mais tarde" })
    }
})


export default router