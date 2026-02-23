import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = 'assets';

/**
 * Upload avatar image buffer to Supabase Storage
 * @param {Buffer} buffer - Image buffer (PNG/JPG)
 * @param {string} fileName - e.g. 'avatar_principal_abc123.png'
 * @returns {{ url: string, path: string }}
 */
export async function uploadAvatar(buffer, fileName) {
    const storagePath = `avatares/${fileName}`;
    logger.info(`Uploading avatar to Storage: ${storagePath}`, { phase: 'STORAGE_UPLOAD' });

    const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
            contentType: 'image/png',
            upsert: true
        });

    if (error) {
        logger.error(`Storage upload failed: ${error.message}`, { phase: 'STORAGE_ERROR' });
        throw error;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    logger.info(`Avatar uploaded: ${publicUrl}`, { phase: 'STORAGE_OK' });
    return { url: publicUrl, path: storagePath };
}

/**
 * Upload video file to Supabase Storage
 * @param {string} filePath - Local path to video file
 * @param {string} fileName - e.g. 'hook_1_v1.mp4'
 * @returns {{ url: string, path: string }}
 */
export async function uploadVideo(filePath, fileName) {
    const storagePath = `videos/${fileName}`;
    logger.info(`Uploading video to Storage: ${storagePath}`, { phase: 'STORAGE_UPLOAD' });

    const fileBuffer = await fs.readFile(filePath);
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, fileBuffer, {
            contentType: 'video/mp4',
            upsert: true
        });

    if (error) {
        logger.error(`Video upload failed: ${error.message}`, { phase: 'STORAGE_ERROR' });
        throw error;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    logger.info(`Video uploaded: ${urlData.publicUrl}`, { phase: 'STORAGE_OK' });
    return { url: urlData.publicUrl, path: storagePath };
}

/**
 * Upload audio file to Supabase Storage
 * @param {string} filePath - Local path to audio file
 * @param {string} fileName - e.g. 'hook_1.mp3'
 * @returns {{ url: string, path: string }}
 */
export async function uploadAudio(filePath, fileName) {
    const storagePath = `audios/${fileName}`;
    logger.info(`Uploading audio to Storage: ${storagePath}`, { phase: 'STORAGE_UPLOAD' });

    const fileBuffer = await fs.readFile(filePath);
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, fileBuffer, {
            contentType: 'audio/mpeg',
            upsert: true
        });

    if (error) {
        logger.error(`Audio upload failed: ${error.message}`, { phase: 'STORAGE_ERROR' });
        throw error;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    logger.info(`Audio uploaded: ${urlData.publicUrl}`, { phase: 'STORAGE_OK' });
    return { url: urlData.publicUrl, path: storagePath };
}
