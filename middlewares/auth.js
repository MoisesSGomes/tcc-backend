import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET

const auth = (req, res, next) => {
    
    const authHeader = req.headers.authorization
    
    if (!authHeader) {
        return res.status(401).json({ message: "Acesso negado: Token não fornecido" })
    }
    
    const parts = authHeader.split(' ')
    
    if (parts.length !== 2) {
        return res.status(401).json({ message: "Erro no formato do token" })
    }

    const [scheme, token] = parts
    
    if (!/^Bearer$/i.test(scheme)) {
        return res.status(401).json({ message: "Formato de token inválido" })
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        req.userId = decoded.id
        next()
    } catch (err) {
        return res.status(401).json({ 
            message: "Token inválido ou expirado", 
            error: process.env.NODE_ENV === 'development' ? err.message : undefined 
        })
    }
}

export default auth