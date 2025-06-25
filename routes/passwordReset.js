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


router.post('/solicitar-redefinicao-senha', async (req, res) => {
  try {
    const { email } = req.body

    // Verifica se o email existe
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      
      return res.status(200).json({
        message: "Se o email estiver cadastrado, enviaremos um link para recuperação de senha."
      })
    }

    // Gera token único
    const resetToken = crypto.randomBytes(32).toString('hex')
    const tokenExpiry = new Date(Date.now() + 3600000) // Expira em 1 hora

    // Armazena o token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: tokenExpiry
      }
    })

    const resetUrl = new URL(`/redefinir-senha/${resetToken}`, process.env.FRONTEND_URL).toString();

    // Configuração do email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Recuperação de senha',
      html: `
        <h1>Recuperação de senha</h1>
        <p>Olá ${user.name},</p>
        <p>Recebemos uma solicitação para redefinir sua senha.</p>
        <p>Para redefinir sua senha, clique no link abaixo ou copie e cole no seu navegador:</p>
        <p><a href="${resetUrl}" target="_blank">${resetUrl}</a></p>
        <p>Este link é válido por 1 hora.</p>
        <p>Se você não solicitou a redefinição da senha, por favor, ignore este email.</p>
        <p>Atenciosamente,<br>Equipe de suporte Let's Go Party</p>
      `
    }

    await transporter.sendMail(mailOptions)

    res.status(200).json({
      message: "Se o email estiver cadastrado, enviaremos um link para recuperação de senha."
    })
  } catch (err) {
    console.error('Erro na recuperação de senha:', err)
    res.status(500).json({ message: "Erro no servidor, tente novamente mais tarde" })
  }
})

// Verifica se o token de redefinição é válido
router.get('/verificar-token-redefinicao/:token', async (req, res) => {
  try {
    const { token } = req.params

    // Busca usuário com o token
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          gt: new Date() // Verifica se ainda não expirou
        }
      }
    })

    if (!user) {
      return res.status(400).json({ message: "O token é inválido ou expirou" })
    }

    res.status(200).json({ message: "Token válido" })
  } catch (err) {
    console.error('Erro ao verificar token:', err)
    res.status(500).json({ message: "Erro no servidor, tente novamente mais tarde" })
  }
})


router.post('/redefinir-senha', async (req, res) => {
  try {
    const { token, newPassword } = req.body

    
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          gt: new Date()
        }
      }
    })

    if (!user) {
      return res.status(400).json({ message: "O token é inválido ou expirou" })
    }

    // Valida a nova senha
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres" })
    }

    // Hash da nova senha
    const salt = await bcrypt.genSalt(10)
    const hashPassword = await bcrypt.hash(newPassword, salt)

    // Atualiza a senha e limpar os tokens de redefinição
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null
      }
    })

    res.status(200).json({ message: "Senha redefinida com sucesso" })
  } catch (err) {
    console.error('Erro ao redefinir senha:', err)
    res.status(500).json({ message: "Erro no servidor, tente novamente mais tarde" })
  }
})

export default router