import express from 'express'
import { PrismaClient } from '@prisma/client'
import { UploadImage } from '../middlewares/uploadImage.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcrypt'

const router = express.Router()
const prisma = new PrismaClient()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)


router.get('/meu-perfil', async (req, res) => {
    try {
        const userId = req.userId;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                lastName: true,
                email: true,
                image: true,
                googleId: true
            }
        });

        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        res.status(200).json(user);
    } catch (err) {
        console.error("❌ Erro ao buscar dados do usuário:", err);
        res.status(500).json({ message: "Erro no servidor", error: err.message });
    }
});

router.post('/alterar-perfil', UploadImage.single('image'), async (req, res) => {
    try {
        const userId = req.userId;

        // Buscar usuário atual para verificar se já tem imagem
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                image: true,
                email: true
            }
        });

        if (!currentUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        // Verificar se o email está sendo alterado e se já existe outro usuário com esse email
        if (req.body.email && req.body.email !== currentUser.email) {
            const existingUser = await prisma.user.findUnique({
                where: { email: req.body.email }
            });

            if (existingUser && existingUser.id !== userId) {
                return res.status(400).json({ message: "Este email já está em uso por outro usuário" });
            }
        }

        // Preparar dados para atualização
        const updateData = {
            name: req.body.name,
            lastName: req.body.lastName || null,
            email: req.body.email
        };

        // Se uma nova senha foi fornecida, criptografá-la
        if (req.body.password) {
            const salt = await bcrypt.genSalt(10);
            const hashPassword = await bcrypt.hash(req.body.password, salt);
            updateData.password = hashPassword;
        }

        // Se uma nova imagem foi enviada
        if (req.file) {
            const { filename } = req.file;
            const imagePath = `/assets/uploads/images/${filename}`;

            // Adicionar informações da nova imagem
            updateData.image = {
                path: imagePath,
                filename: filename
            };

            // Remover imagem antiga se existir
            if (currentUser.image && currentUser.image.filename) {
                const oldImagePath = path.join(__dirname, '..', 'assets', 'uploads', 'images', currentUser.image.filename);

                // Verificar se o arquivo existe antes de tentar excluir
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
        }

        // Atualizar usuário
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                name: true,
                lastName: true,
                email: true,
                image: true
            }
        });

        console.log("✅ Perfil do usuário atualizado com sucesso:", updatedUser);
        res.status(200).json(updatedUser);
    } catch (err) {
        console.error("❌ Erro ao atualizar perfil do usuário:", err);
        res.status(500).json({ message: "Erro no servidor", error: err.message });
    }
});


router.get('/listar-meus-eventos', async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ error: "Usuário não autenticado" });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        // Buscar o usuário e incluir os eventos paginados
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                events: {
                    skip,
                    take: limit,
                    orderBy: { dateEvent: 'desc' }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const totalEvents = user.events.length;
        const totalPages = Math.ceil(totalEvents / limit);

        res.json({ events: user.events, totalPages });
    } catch (error) {
        console.error("Erro ao listar eventos", error);
        res.status(500).json({ error: "Erro ao buscar eventos" });
    }
});

router.post('/criar-evento', UploadImage.single('image'), async (req, res) => {
    try {

        if (!req.file) {
            return res.status(400).json({ message: "Imagem não enviada" });
        }

        const { filename } = req.file;
        const imagePath = `/assets/uploads/images/${filename}`;

        if (!req.userId) {
            return res.status(401).json({ message: "Usuário não autenticado" });
        }

        const event = await prisma.event.create({
            data: {
                title: req.body.title,
                description: req.body.description,
                date: req.body.date,
                hour: req.body.hour,
                address: req.body.address,
                number: req.body.number,
                district: req.body.district,
                city: req.body.city,
                state: req.body.state,
                local: req.body.local,
                category: req.body.category,
                image: {
                    path: imagePath,
                    filename: filename
                },
                userId: req.userId
            }
        });

        console.log("✅ Evento cadastrado com sucesso:", event);
        res.status(201).json(event);
    } catch (err) {
        console.error("❌ Erro ao cadastrar evento:", err);
        res.status(500).json({ message: "Erro no servidor", error: err.message });
    }
});

router.get('/carregar-imagem-perfil', async (req, res) => {
    try {
        const userId = req.userId;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { 
                name: true, 
                image: true,
                googleId: true
            }
        });

        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        return res.status(200).json({
            name: user.name,
            image: user.image ?? null  // Retorna a imagem ou null se não existir
        });

    } catch (error) {
        console.error("Erro ao carregar imagem de perfil:", error);
        return res.status(500).json({
            message: "Erro ao carregar imagem de perfil",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});


router.delete('/eventos/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.event.delete({
            where: { id },
        });

        return res.status(200).json({ message: "Evento deletado com sucesso." });
    } catch (error) {
        console.error("Erro ao deletar evento:", error);
        return res.status(500).json({ error: "Erro ao deletar evento." });
    }
});


router.get('/eventos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        const event = await prisma.event.findUnique({
            where: { id }
        });

        if (!event) {
            return res.status(404).json({ message: "Evento não encontrado" });
        }

        if (event.userId !== userId) {
            return res.status(403).json({ message: "Sem permissão para editar este evento" });
        }

        res.status(200).json(event);
    } catch (error) {
        console.error("❌ Erro ao buscar evento:", error);
        res.status(500).json({ message: "Erro no servidor", error: error.message });
    }
});


router.put('/eventos/:id', UploadImage.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        const currentEvent = await prisma.event.findUnique({
            where: { id }
        });

        if (!currentEvent) {
            return res.status(404).json({ message: "Evento não encontrado" });
        }

        if (currentEvent.userId !== userId) {
            return res.status(403).json({ message: "Sem permissão para editar este evento" });
        }

        const updateData = {
            title: req.body.title,
            description: req.body.description,
            date: req.body.date,
            hour: req.body.hour,
            address: req.body.address,
            number: req.body.number,
            district: req.body.district,
            city: req.body.city,
            state: req.body.state,
            local: req.body.local,
            category: req.body.category
        };

        if (req.file) {
            const { filename } = req.file;
            const imagePath = `/assets/uploads/images/${filename}`;

            updateData.image = {
                path: imagePath,
                filename: filename
            };

            if (currentEvent.image && currentEvent.image.filename) {
                const oldImagePath = path.join(__dirname, '..', 'assets', 'uploads', 'images', currentEvent.image.filename);

                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
        }

        const updatedEvent = await prisma.event.update({
            where: { id },
            data: updateData
        });

        console.log("✅ Evento atualizado com sucesso:", updatedEvent);
        res.status(200).json(updatedEvent);
    } catch (error) {
        console.error("❌ Erro ao atualizar evento:", error);
        res.status(500).json({ message: "Erro no servidor", error: error.message });
    }
});

router.post('/curtir-evento/:id', async (req, res) => {
    const userId = req.userId;
    const eventId = req.params.id;

    try {
        const existingLike = await prisma.like.findFirst({
            where: {
                userId,
                eventId,
            },
        });

        if (existingLike) {
            // Se já curtiu, remove a curtida
            await prisma.like.delete({
                where: { id: existingLike.id },
            });
            return res.status(200).json({ message: 'Curtida removida' });
        } else {
            // Se ainda não curtiu, cria a curtida
            await prisma.like.create({
                data: {
                    userId,
                    eventId,
                },
            });
            return res.status(201).json({ message: 'Evento curtido' });
        }
    } catch (error) {
        console.error('Erro ao curtir evento:', error);
        return res.status(500).json({ message: 'Erro ao processar curtida' });
    }
});

router.get('/verificar-curtida/:id', async (req, res) => {
    try {
        const userId = req.userId;
        const eventId = req.params.id;

        const like = await prisma.like.findUnique({
            where: {
                userId_eventId: {
                    userId,
                    eventId
                }
            }
        });

        res.status(200).json({ liked: !!like });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao verificar curtida" });
    }
});

router.delete('/descurtir-evento/:id', async (req, res) => {
    try {
        const { id: eventId } = req.params;
        const userId = req.userId;

        const existingLike = await prisma.like.findFirst({
            where: {
                userId,
                eventId,
            },
        });

        if (!existingLike) {
            return res.status(404).json({ message: 'Curtida não encontrada.' });
        }

        await prisma.like.delete({
            where: { id: existingLike.id },
        });

        res.status(200).json({ message: 'Curtida removida com sucesso.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao descurtir evento.' });
    }
});


router.get('/me', async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId }
        });

        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        res.json({
            id: user.id,
            name: user.name,
            lastName: user.lastName,
            email: user.email,
            image: user.image
        });
    } catch (err) {
        console.error('Erro ao buscar dados do usuário:', err);
        res.status(500).json({ message: "Erro no servidor" });
    }
});

router.get('/listar-meus-favoritos', async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ error: "Usuário não autenticado" });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        // Buscar eventos que o usuário deu like
        const userLikes = await prisma.like.findMany({
            where: { userId },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                event: {
                    include: {
                        image: true
                    }
                }
            }
        });

        // Extrair apenas os eventos dos likes
        const likedEvents = userLikes.map(like => like.event);

        // Contar total de likes do usuário para paginação
        const totalLikes = await prisma.like.count({
            where: { userId }
        });

        const totalPages = Math.ceil(totalLikes / limit);

        res.json({ events: likedEvents, totalPages });
    } catch (error) {
        console.error("Erro ao listar favoritos", error);
        res.status(500).json({ error: "Erro ao buscar favoritos" });
    }
});

export default router