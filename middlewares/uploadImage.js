import multer from 'multer'
import path from 'path'

export const UploadImage = (multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, './assets/uploads/images')
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
            cb(null, uniqueSuffix + path.extname(file.originalname))
        }
    }),
    fileFilter: (req, file, cb) => {
        const imgExtension = ['image/png', 'image/jpg', 'image/jpeg'].find(acceptFormat =>
            acceptFormat == file.mimetype)

        if (imgExtension) {
            return cb(null, true)
        }

        return cb(null, false)
    }
}))