import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import passport from 'passport';
import nodemailer from 'nodemailer'

const router = express.Router()
const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET

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

router.post('/login', async (req, res) => {
    try {
        const userInfo = req.body

        const user = await prisma.user.findUnique({
            where: { email: userInfo.email }
        })

        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" })
        }

        if (!user.verified) {
            return res.status(403).json({
                message: "Por favor, verifique seu email antes de fazer login",
                needsVerification: true
            })
        }

        const isMatch = await bcrypt.compare(userInfo.password, user.password)

        if (!isMatch) {
            return res.status(400).json({ message: "Senha inválida" })
        }

        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '5d' })

        res.status(200).json(token)

    } catch (err) {
        console.error('Erro no login:', err)
        res.status(500).json({ message: "Erro no servidor, tente novamente mais tarde" })
    }
})



router.get('/listar-eventos-recentes', async (req, res) => {
    try {
        const events = await prisma.event.findMany({
            orderBy: { dateEvent: 'desc' },
            take: 5 
        });

        res.status(200).json({ message: "Últimos 5 eventos listados com sucesso", events });

    } catch (err) {
        console.error("Erro ao listar eventos:", err);
        res.status(500).json({ message: "Falha no servidor" });
    }
});

router.get('/listar-todos-eventos', async (req, res) => {
    try {
        const currentDate = new Date();

        console.log("Filtrando eventos a partir de:", currentDate);

        const events = await prisma.event.findMany({
            where: {
                date: {
                    gte: currentDate 
                }
            },
            orderBy: [
                { dateEvent: 'desc' }
            ],
            take: 20
        });

        console.log(`Encontrados ${events.length} eventos futuros`);

        res.status(200).json({
            message: "Últimos 20 eventos futuros listados com sucesso",
            events
        });

    } catch (err) {
        console.error("Erro ao listar eventos:", err);
        res.status(500).json({ message: "Falha no servidor" });
    }
});


router.get('/mostrar-evento/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const event = await prisma.event.findUnique({
            where: { id },
            include: {
                image: true, // Garante que a imagem também seja retornada
            },
        });

        if (!event) {
            return res.status(404).json({ message: "Evento não encontrado" });
        }

        // Retorna evento e a imagem corretamente
        res.status(200).json({ event });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao buscar evento" });
    }
});


router.get('/eventos-slider', async (req, res) => {
    try {
        
        const currentDate = new Date();

        const eventos = await prisma.event.findMany({
            where: {
                
                date: {
                    gte: currentDate
                }
            },
            select: {
                id: true,
                title: true,
                description: true,
                image: true,
                date: true, 
            },
            orderBy: { date: 'asc' }, 
            take: 5 
        });       

        const eventosFormatados = eventos.map((evento) => ({
            id: evento.id,
            titleEvent: evento.title,
            descriptionEvent: evento.description,
            image: `${'https://letsgoparty-api.onrender.com'}${evento.image.path}`,
            date: evento.date 
        }));

        res.status(200).json(eventosFormatados);
    } catch (err) {
        console.error('Erro ao buscar eventos:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});


router.get('/listar-eventos-paginados', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20; 
        const skip = (page - 1) * limit;
        const { startDate, endDate } = req.query;

        
        const today = new Date();
        today.setUTCHours(3, 0, 0, 0);

        let dateFilter = {
            gte: today,
        };

        
        if (startDate) {
            const [year, month, day] = startDate.split('-').map(Number);
            const startDateUtc = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
            dateFilter.gte = startDateUtc > today ? startDateUtc : today;
        }

        
        if (endDate) {
            const [year, month, day] = endDate.split('-').map(Number);
            
            const endDateUtc = new Date(Date.UTC(year, month - 1, day + 1, 2, 59, 59, 999));
            dateFilter.lte = endDateUtc;
        }

        console.log('Filtro aplicado:', dateFilter);
        console.log('Limite por página:', limit);

        const events = await prisma.event.findMany({
            where: {
                date: dateFilter,
            },
            skip,
            take: limit,
            include: {
                image: true,
            },
            orderBy: {
                date: 'asc',
            },
        });

        const totalEvents = await prisma.event.count({
            where: {
                date: dateFilter,
            },
        });

        const totalPages = Math.ceil(totalEvents / limit);

        res.json({ events, totalPages });
    } catch (error) {
        console.error('Erro ao listar eventos', error);
        res.status(500).json({ error: 'Erro ao buscar eventos' });
    }
});

router.get('/filtrar-eventos', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;
        const category = req.query.category;

        const filters = category ? { category } : {};

        const events = await prisma.event.findMany({
            skip,
            take: limit,
            where: filters,
            include: {
                image: true
            },
            orderBy: {
                date: 'desc'
            }
        });

        const totalEvents = await prisma.event.count({ where: filters });
        const totalPages = Math.ceil(totalEvents / limit);

        res.json({ events, totalPages });
    } catch (error) {
        console.error("Erro ao listar eventos", error);
        res.status(500).json({ error: "Erro ao buscar eventos" });
    }
});

router.get('/buscar-eventos', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;
        const category = req.query.category;
        const search = req.query.search || "";

        const filters = {
            ...(category && { category }),
            ...(search && {
                OR: [
                    { title: { contains: search, mode: "insensitive" } },
                    { description: { contains: search, mode: "insensitive" } },
                    { address: { contains: search, mode: "insensitive" } },
                    { district: { contains: search, mode: "insensitive" } },
                    { city: { contains: search, mode: "insensitive" } },
                    { state: { contains: search, mode: "insensitive" } },
                    { local: { contains: search, mode: "insensitive" } },
                    { category: { contains: search, mode: "insensitive" } }
                ]
            })
        };

        const events = await prisma.event.findMany({
            skip,
            take: limit,
            where: filters,
            include: { image: true },
            orderBy: { date: "desc" }
        });

        const totalEvents = await prisma.event.count({ where: filters });
        const totalPages = Math.ceil(totalEvents / limit);

        res.json({ events, totalPages });
    } catch (error) {
        console.error("Erro ao listar eventos", error);
        res.status(500).json({ error: "Erro ao buscar eventos" });
    }
});

router.get('/buscar-eventos-data', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";
        const dateFilter = req.query.dateFilter || "";

        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let dateFilterCondition = {
            date: {
                gte: today
            }
        };

        
        if (dateFilter) {
            const currentDate = new Date();

            switch (dateFilter) {
                case "hoje": {
                    
                    const todayEnd = new Date(today);
                    todayEnd.setHours(23, 59, 59, 999);

                    dateFilterCondition = {
                        date: {
                            gte: today,
                            lte: todayEnd
                        }
                    };
                    break;
                }
                case "amanha": {
                    
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);

                    const tomorrowEnd = new Date(tomorrow);
                    tomorrowEnd.setHours(23, 59, 59, 999);

                    dateFilterCondition = {
                        date: {
                            gte: tomorrow,
                            lte: tomorrowEnd
                        }
                    };
                    break;
                }
                case "esta-semana": {
                    
                    const currentDay = currentDate.getDay(); 

                    const monday = new Date(currentDate);
                    monday.setDate(currentDate.getDate() - ((currentDay === 0 ? 7 : currentDay) - 1));
                    monday.setHours(0, 0, 0, 0);

                    const sunday = new Date(monday);
                    sunday.setDate(monday.getDate() + 6);
                    sunday.setHours(23, 59, 59, 999);

                    dateFilterCondition = {
                        date: {
                            gte: today, 
                            lte: sunday
                        }
                    };
                    break;
                }
                case "este-fim-de-semana": {
                    
                    const currentDay = currentDate.getDay();

                    const friday = new Date(currentDate);
                    const daysUntilFriday = (5 - currentDay + 7) % 7;
                    friday.setDate(currentDate.getDate() + daysUntilFriday);
                    friday.setHours(0, 0, 0, 0);

                    const startDay = currentDay >= 5 || currentDay === 0 ? today : friday;

                    const sunday = new Date(friday);
                    sunday.setDate(friday.getDate() + 2);
                    sunday.setHours(23, 59, 59, 999);

                    dateFilterCondition = {
                        date: {
                            gte: startDay,
                            lte: sunday
                        }
                    };
                    break;
                }
                case "este-mes": {
                    
                    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

                    dateFilterCondition = {
                        date: {
                            gte: today,
                            lte: lastDayOfMonth
                        }
                    };
                    break;
                }
            }
        }

        let searchCondition = {};
        if (search) {
            searchCondition = {
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { city: { contains: search, mode: 'insensitive' } },
                    { local: { contains: search, mode: 'insensitive' } },
                    { category: { contains: search, mode: 'insensitive' } }
                ]
            };
        }

        const whereCondition = {
            AND: [
                dateFilterCondition,
                searchCondition
            ]
        };

        const events = await prisma.event.findMany({
            where: whereCondition,
            skip,
            take: limit,
            include: {
                image: true
            },
            orderBy: {
                date: 'asc'
            }
        });

        const totalEvents = await prisma.event.count({
            where: whereCondition
        });

        const totalPages = Math.ceil(totalEvents / limit);

        res.json({ events, totalPages });
    } catch (error) {
        console.error("Erro ao buscar eventos", error);
        res.status(500).json({ error: "Erro ao buscar eventos" });
    }
});


router.get('/auth/google', passport.authenticate('google'));

router.get('/auth/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    (req, res) => {
        const token = jwt.sign({ id: req.user.id }, process.env.JWT_SECRET, { expiresIn: '5d' });

        
        res.redirect(`${process.env.FRONTEND_URL.replace(/\/+$/, '')}/oauth-callback?token=${token}`);
       
    }
);

router.post('/contato', async (req, res) => {
    try {
        const { email, helpType, subject, message } = req.body

        // Validação básica
        if (!email || !helpType || !subject || !message) {
            return res.status(400).json({
                message: "Todos os campos são obrigatórios"
            })
        }

        // Configurações do email
        const mailOptions = {
            from: email,
            to: process.env.EMAIL_USER, 
            subject: `[Contato Let's Go Party] ${helpType} - ${subject}`,
            html: `
                <h2>Nova mensagem de contato</h2>
                <p><strong>Tipo de ajuda:</strong> ${helpType}</p>
                <p><strong>De:</strong> ${email}</p>
                <p><strong>Assunto:</strong> ${subject}</p>
                <p><strong>Mensagem:</strong></p>
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
                    ${message.replace(/\n/g, '<br>')}
                </div>
                <p>Este email foi enviado pelo formulário de contato do site Let's Go Party.</p>
            `
        }

        // Envia o email
        await transporter.sendMail(mailOptions)

        res.status(200).json({
            message: "Mensagem enviada com sucesso. Entraremos em contato em breve."
        })
    } catch (err) {
        console.error('Erro ao enviar mensagem de contato:', err)
        res.status(500).json({
            message: "Erro ao enviar mensagem. Por favor, tente novamente mais tarde."
        })
    }
})

export default router